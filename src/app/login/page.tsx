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

const PILOT_PASSWORD = "Anh2026!";

const ROLES: { id: UserRole; label: string; description: string; howTo: string }[] = [
  {
    id: "operadora",
    label: "Operadora",
    description: "Carga, valida y envía el inventario de su operadora.",
    howTo: "Usuario: demo",
  },
  {
    id: "anh",
    label: "ANH",
    description: "Consulta el inventario consolidado recibido de operadoras.",
    howTo: "Usuario: funcionario",
  },
  {
    id: "admin",
    label: "Administrador",
    description: "Gestiona usuarios, edita y elimina registros con trazabilidad.",
    howTo: "Correo: johan.redondo@anh.gov.co",
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

  const selected = ROLES.find((r) => r.id === role)!;
  const demo = getDemoCredentials(role);

  async function handleEnter(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Entrada fija de piloto: el servidor resuelve usuario + Anh2026!
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, demo: true }),
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
          <p className="mt-2 text-sm text-anh-muted">Sistema GOP — Acceso institucional (piloto)</p>
        </div>

        <div className="card p-6">
          <div className="mb-4 rounded-lg border border-anh-secondary/40 bg-anh-secondary/10 px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-anh-muted">Acceso fijo del piloto</p>
            <p className="mt-1 font-semibold text-anh-primary">Contraseña para todos los roles: {PILOT_PASSWORD}</p>
            <p className="mt-1 text-anh-muted">Elija el rol y pulse Ingresar. No necesita escribir nada.</p>
          </div>

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

          <p className="mb-2 text-sm text-anh-muted">{selected.description}</p>
          <p className="mb-4 text-sm font-medium text-anh-primary">
            {selected.howTo}
            {role === "operadora" ? (
              <span className="mt-1 block text-xs font-normal text-anh-muted">{DEMO_OPERADORA}</span>
            ) : null}
            <span className="mt-1 block text-xs text-anh-muted">Cuenta: {demo.label}</span>
          </p>

          <form onSubmit={handleEnter} className="space-y-4">
            {error && (
              <p className="rounded-lg border border-anh-danger/30 bg-anh-danger/5 px-3 py-2 text-sm text-anh-danger">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? t("auth.signingIn") : `Ingresar como ${selected.label}`}
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
