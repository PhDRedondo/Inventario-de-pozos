"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LandingCapabilities } from "@/components/LandingCapabilities";
import { LandingRoles } from "@/components/LandingRoles";
import { InstitutionalFooter } from "@/components/InstitutionalFooter";
import { PreferencesBar } from "@/components/PreferencesBar";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/AppPreferences";
import { getNavItemsForRole } from "@/lib/navigation";
import type { LandingStats } from "@/lib/landing-stats";

const LANDING_STATS = [
  { key: "wells" as const, label: "statWellsLabel" },
  { key: "operators" as const, label: "statOperatorsLabel" },
  { key: "validationRules" as const, label: "statValidationLabel" },
];

const NEUTRAL_STAT_KEYS = new Set<(typeof LANDING_STATS)[number]["key"]>(["operators", "validationRules"]);

function isNeutralStatCard(key: (typeof LANDING_STATS)[number]["key"]) {
  return NEUTRAL_STAT_KEYS.has(key);
}

export default function LandingPage() {
  const t = useT();
  const { user } = useAuth();
  const [landingStats, setLandingStats] = useState<LandingStats | null>(null);
  const homeHref = user ? (getNavItemsForRole(user.role)[0]?.href ?? "/panel") : "/login";

  useEffect(() => {
    fetch("/api/public/landing-stats")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: LandingStats | null) => {
        if (data) setLandingStats(data);
      })
      .catch(() => {});
  }, []);

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
            <Link href={homeHref} className="btn-primary text-sm">
              {user ? t("landing.goToPanel") : t("landing.signIn")}
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
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {LANDING_STATS.map(({ key, label }) => {
                const neutral = isNeutralStatCard(key);
                return (
                <div
                  key={key}
                  className={neutral ? "landing-stat-card landing-stat-card--neutral" : "landing-stat-card"}
                >
                  <p className={`text-2xl font-extrabold ${neutral ? "text-anh-secondary" : "text-anh-black"}`}>
                    {landingStats ? landingStats[key].toLocaleString("es-CO") : "—"}
                  </p>
                  <p className={`mt-1 text-sm font-semibold ${neutral ? "text-anh-primary" : "text-anh-black/85"}`}>
                    {t(`landing.${label}`)}
                  </p>
                </div>
                );
              })}
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

        <LandingRoles />
      </main>

      <InstitutionalFooter />
    </div>
  );
}
