"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { BarChart3, FileUp, Shield, Users } from "lucide-react";
import { LandingCapabilities } from "@/components/LandingCapabilities";
import { InstitutionalFooter } from "@/components/InstitutionalFooter";
import { PreferencesBar } from "@/components/PreferencesBar";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/AppPreferences";
import type { UserRole } from "@/lib/types";

const ROLE_IDS: UserRole[] = ["operadora", "anh", "admin"];

function RoleIcon({ role }: { role: UserRole }) {
  if (role === "operadora") return <FileUp className="h-6 w-6 text-anh-secondary" />;
  if (role === "anh") return <BarChart3 className="h-6 w-6 text-anh-secondary" />;
  return <Shield className="h-6 w-6 text-anh-secondary" />;
}

export default function LandingPage() {
  const t = useT();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      window.location.href = "/panel";
    }
  }, [user, loading]);

  const steps = ["step1", "step2", "step3"] as const;

  return (
    <div className="min-h-screen bg-anh-bg text-anh-text">
      <header className="sticky top-0 z-30 border-b border-anh-border bg-anh-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/anh-logo.png" alt="ANH" width={140} height={48} className="h-9 w-auto" priority />
            <div className="hidden border-l border-anh-border pl-3 sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-anh-muted">{t("shell.gopSystem")}</p>
              <p className="text-sm font-bold text-anh-primary">{t("shell.appTitle")}</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <PreferencesBar />
            <Link href="/login" className="btn-primary text-sm">
              {t("landing.signIn")}
            </Link>
          </div>
        </div>
        <div className="anh-gradient-bar" />
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-anh-border">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,140,0,0.12),transparent)]" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
            <div className="max-w-3xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-anh-secondary">
                {t("landing.heroEyebrow")}
              </p>
              <h1 className="text-3xl font-extrabold leading-tight text-anh-primary sm:text-4xl lg:text-5xl">
                {t("landing.heroTitle")}
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-anh-muted sm:text-xl">{t("landing.heroSubtitle")}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="btn-primary px-6 py-3 text-base">
                  {t("landing.ctaPrimary")}
                </Link>
                <a href="#capacidades" className="btn-secondary px-6 py-3 text-base">
                  {t("landing.ctaSecondary")}
                </a>
              </div>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {(
                [
                  { value: "statWellsValue", label: "statWellsLabel" },
                  { value: "statOperatorsValue", label: "statOperatorsLabel" },
                  { value: "statValidationValue", label: "statValidationLabel" },
                ] as const
              ).map(({ value, label }) => (
                <div key={value} className="card border-anh-border/80 p-5">
                  <p className="text-2xl font-extrabold text-anh-secondary">{t(`landing.${value}`)}</p>
                  <p className="mt-1 text-sm font-semibold text-anh-primary">{t(`landing.${label}`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <LandingCapabilities />

        {/* Workflow */}
        <section className="border-y border-anh-border bg-anh-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-extrabold text-anh-primary sm:text-3xl">{t("landing.workflowTitle")}</h2>
            <p className="mt-3 max-w-2xl text-anh-muted">{t("landing.workflowSubtitle")}</p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {steps.map((step, i) => (
                <div key={step} className="workflow-step">
                  <span className="workflow-step-num">{i + 1}</span>
                  <div>
                    <p className="font-semibold text-anh-primary">{t(`landing.${step}Title`)}</p>
                    <p className="mt-2 text-sm leading-relaxed text-anh-muted">{t(`landing.${step}Text`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Roles */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-anh-primary sm:text-3xl">{t("landing.rolesTitle")}</h2>
              <p className="mt-3 max-w-2xl text-anh-muted">{t("landing.rolesSubtitle")}</p>
            </div>
            <Users className="hidden h-10 w-10 text-anh-secondary/60 sm:block" />
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {ROLE_IDS.map((role) => (
              <article key={role} className="card flex flex-col p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-anh-bg">
                  <RoleIcon role={role} />
                </div>
                <h3 className="text-lg font-bold text-anh-primary">{t(`landing.role.${role}.title`)}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-anh-muted">{t(`landing.role.${role}.text`)}</p>
                <Link
                  href={`/login?role=${role}`}
                  className="mt-5 inline-flex text-sm font-semibold text-anh-secondary hover:underline"
                >
                  {t("landing.roleSignIn")} →
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>

      <InstitutionalFooter />
    </div>
  );
}
