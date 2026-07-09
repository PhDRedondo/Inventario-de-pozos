"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BarChart3, FileUp, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/AppPreferences";
import { getNavItemsForRole } from "@/lib/navigation";

const ROLES = [
  {
    id: "operadora" as const,
    icon: FileUp,
    accent: "from-anh-orange/90 via-anh-orange/40 to-transparent",
    glow: "shadow-anh-orange/25",
    chipClass: "bg-anh-orange/20 text-anh-yellow",
  },
  {
    id: "anh" as const,
    icon: BarChart3,
    accent: "from-cyan-400/80 via-cyan-500/30 to-transparent",
    glow: "shadow-cyan-400/20",
    chipClass: "bg-cyan-400/15 text-cyan-200",
  },
];

const HIGHLIGHT_KEYS = ["highlight1", "highlight2", "highlight3"] as const;

export function LandingRoles() {
  const t = useT();
  const { user } = useAuth();
  const [focused, setFocused] = useState<(typeof ROLES)[number]["id"]>("operadora");

  function roleHref(role: (typeof ROLES)[number]["id"]) {
    if (user) {
      if (user.role === role || user.role === "admin") {
        return getNavItemsForRole(user.role === "admin" ? role : user.role)[0]?.href ?? "/panel";
      }
      return getNavItemsForRole(user.role)[0]?.href ?? "/panel";
    }
    return `/login?role=${role}`;
  }

  return (
    <section className="landing-roles relative overflow-hidden border-y border-anh-sidebar-border bg-anh-sidebar text-anh-sidebar-text-active">
      <div className="landing-roles-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div className="landing-roles-glow pointer-events-none absolute -left-32 top-1/4 h-72 w-72 rounded-full bg-anh-orange/20 blur-3xl" aria-hidden />
      <div className="landing-roles-glow pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-anh-secondary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t("landing.rolesEyebrow")}
          </p>
          <h2 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl">{t("landing.rolesTitle")}</h2>
          <p className="mt-4 text-base leading-relaxed text-anh-sidebar-text sm:text-lg">{t("landing.rolesSubtitle")}</p>
        </div>

        <div className="relative mt-12 lg:mt-14">
          <div className="landing-roles-bridge hidden lg:block" aria-hidden>
            <span className="landing-roles-bridge-dot landing-roles-bridge-dot--a" />
            <span className="landing-roles-bridge-dot landing-roles-bridge-dot--b" />
            <span className="landing-roles-bridge-dot landing-roles-bridge-dot--c" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
            {ROLES.map(({ id, icon: Icon, accent, glow, chipClass }) => {
              const isFocused = focused === id;
              return (
                <Link
                  key={id}
                  href={roleHref(id)}
                  className={[
                    "landing-roles-panel group relative flex min-h-[17rem] flex-col overflow-hidden rounded-3xl border p-6 transition-all duration-300 sm:min-h-[19rem] sm:p-8",
                    isFocused
                      ? `border-white/20 bg-white/[0.07] shadow-2xl ${glow}`
                      : "border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]",
                  ].join(" ")}
                  onMouseEnter={() => setFocused(id)}
                  onFocus={() => setFocused(id)}
                >
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-80 transition-opacity duration-300 group-hover:opacity-100`}
                    aria-hidden
                  />
                  <Icon
                    className="pointer-events-none absolute -bottom-6 -right-4 h-36 w-36 text-white/[0.04] transition-transform duration-500 group-hover:scale-110 sm:h-44 sm:w-44"
                    strokeWidth={1}
                    aria-hidden
                  />

                  <div className="relative flex items-start justify-between gap-4">
                    <div
                      className={[
                        "flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm transition-transform duration-300",
                        isFocused ? "scale-105" : "",
                      ].join(" ")}
                    >
                      <Icon className="h-7 w-7 text-white" aria-hidden />
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
                      {id === "operadora" ? t("landing.rolesBadgeSource") : t("landing.rolesBadgeViewer")}
                    </span>
                  </div>

                  <div className="relative mt-6 flex flex-1 flex-col">
                    <h3 className="text-2xl font-extrabold text-white sm:text-[1.65rem]">{t(`landing.role.${id}.title`)}</h3>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-anh-sidebar-text sm:text-[0.95rem]">
                      {t(`landing.role.${id}.text`)}
                    </p>

                    <ul className="mt-5 flex flex-wrap gap-2">
                      {HIGHLIGHT_KEYS.map((key) => (
                        <li
                          key={key}
                          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${chipClass}`}
                        >
                          {t(`landing.role.${id}.${key}`)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="relative mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-5">
                    <span className="text-sm font-semibold text-white/90">
                      {user ? t("landing.goToPanel") : t("landing.roleSignIn")}
                    </span>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-anh-black transition-transform duration-300 group-hover:translate-x-1 group-hover:bg-anh-yellow">
                      <ArrowRight className="h-5 w-5" aria-hidden />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="anh-gradient-bar" />
    </section>
  );
}
