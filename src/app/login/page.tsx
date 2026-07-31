"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { DEMO_OPERADORA, getDemoCredentials } from "@/lib/demo-auth";
import { sanitizeNextPath } from "@/lib/safe-redirect";
import { useT } from "@/context/AppPreferences";
import { useAuth } from "@/context/AuthContext";

const ROLES: { id: UserRole; label: string; description: string }[] = [
  {
    id: "operadora",
    label: "Operadora",
    description: "Carga, valida y envía el inventario de su operadora.",
  },
  {
    id: "anh",
    label: "ANH",
    description: "Consulta el inventario consolidado recibido de operadoras.",
  },
  {
    id: "admin",
    label: "Administrador",
    description: "Gestiona usuarios, edita y elimina registros con trazabilidad.",
  },
];

function LoginForm() {
  const t = useT();
  const { refresh } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeNextPath(searchParams.get("next"));
  const roleParam = searchParams.get("role") as UserRole | null;

  const [role, setRole] = useState<UserRole>("operadora");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [operadora, setOperadora] = useState(DEMO_OPERADORA);
  const [password, setPassword] = useState("");
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const applyRole = useCallback((nextRole: UserRole) => {
    setRole(nextRole);
    setError(null);
    const demo = getDemoCredentials(nextRole);
    setEmail(demo.email ?? "");
    setUsername(demo.username ?? "");
    setOperadora(demo.operadora ?? DEMO_OPERADORA);
    setPassword("");
  }, []);

  useEffect(() => {
    if (roleParam && ROLES.some((r) => r.id === roleParam)) {
      applyRole(roleParam);
    }
  }, [roleParam, applyRole]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/config")
      .then((r) => r.json())
      .then((data: { demoLoginEnabled?: boolean }) => {
        if (!cancelled) setDemoEnabled(Boolean(data.demoLoginEnabled));
      })
      .catch(() => {
        if (!cancelled) setDemoEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const demo = getDemoCredentials(role);

  async function submitLogin(payload: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error de autenticación");

      await refresh();
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitLogin({
      role,
      email: role === "admin" ? email : undefined,
      username: role !== "admin" ? username : undefined,
      operadora: role === "operadora" ? operadora : undefined,
      password,
    });
  }

  async function handleDemoLogin() {
    await submitLogin({ role, demo: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-anh-bg px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <Link href="/" className="mb-4 inline-block text-sm text-anh-muted hover:text-anh-secondary">
            ← {t("landing.backHome")}
          </Link>
          <Image
            src="/anh-logo.png"
            alt="ANH"
            width={180}
            height={72}
            className="mx-auto mb-4 h-16 w-auto"
            priority
          />
          <h1 className="text-2xl font-bold text-anh-primary">Inventario de Pozos</h1>
          <p className="mt-2 text-sm text-anh-muted">Sistema GOP — Acceso institucional</p>
        </div>

        <div className="card p-6">
          <div className="mb-6 grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => applyRole(r.id)}
                className={`rounded-lg border px-2 py-3 text-center text-xs font-semibold transition ${
                  role === r.id
                    ? "border-anh-secondary bg-anh-secondary/10 text-anh-primary"
                    : "border-anh-border text-anh-muted hover:border-anh-secondary/50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <p className="mb-4 text-sm text-anh-muted">{ROLES.find((r) => r.id === role)?.description}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {role === "admin" ? (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-anh-primary">Correo</span>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-anh-border bg-white px-3 py-2"
                />
              </label>
            ) : (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-anh-primary">Usuario</span>
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-anh-border bg-white px-3 py-2"
                />
              </label>
            )}

            {role === "operadora" && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-anh-primary">Operadora</span>
                <input
                  type="text"
                  required
                  value={operadora}
                  onChange={(e) => setOperadora(e.target.value)}
                  className="w-full rounded-lg border border-anh-border bg-white px-3 py-2"
                />
              </label>
            )}

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-anh-primary">Contraseña</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-anh-border bg-white px-3 py-2"
              />
            </label>

            {error && (
              <p className="rounded-lg border border-anh-danger/30 bg-anh-danger/5 px-3 py-2 text-sm text-anh-danger">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </form>

          {demoEnabled && (
            <div className="mt-4 border-t border-anh-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-anh-muted">
                {t("auth.demoAccess")}
              </p>
              <p className="mb-3 text-sm text-anh-muted">{demo.label}</p>
              <button
                type="button"
                className="btn-secondary w-full"
                disabled={loading}
                onClick={handleDemoLogin}
              >
                Ingreso demo ({ROLES.find((r) => r.id === role)?.label})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-anh-muted">Cargando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
