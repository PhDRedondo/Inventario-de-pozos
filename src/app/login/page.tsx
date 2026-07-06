"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { getDemoCredentials } from "@/lib/demo-auth";
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
  const next = searchParams.get("next") ?? "/panel";
  const roleParam = searchParams.get("role") as UserRole | null;

  const [role, setRole] = useState<UserRole>("operadora");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const applyRole = useCallback((nextRole: UserRole) => {
    setRole(nextRole);
    setError(null);
  }, []);

  useEffect(() => {
    if (roleParam && ROLES.some((r) => r.id === roleParam)) {
      applyRole(roleParam);
    }
  }, [roleParam, applyRole]);

  const demo = getDemoCredentials(role);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const creds = getDemoCredentials(role);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          email: creds.email,
          username: creds.username,
          operadora: creds.operadora,
          password: creds.password,
        }),
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
            <div className="rounded-lg border border-anh-border bg-anh-bg px-4 py-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-anh-muted">{t("auth.demoAccess")}</p>
              <p className="mt-1 font-medium text-anh-primary">{demo.label}</p>
            </div>

            {error && (
              <p className="rounded-lg border border-anh-danger/30 bg-anh-danger/5 px-3 py-2 text-sm text-anh-danger">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </form>
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
