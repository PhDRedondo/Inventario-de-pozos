"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  FileUp,
  Globe2,
  Lock,
  Map,
  MapPin,
  Shield,
  Users,
} from "lucide-react";
import { useT } from "@/context/AppPreferences";

const CAPABILITIES = [
  { icon: FileUp, key: "upload" },
  { icon: ClipboardCheck, key: "validation" },
  { icon: Map, key: "map" },
  { icon: Globe2, key: "uwi" },
  { icon: BarChart3, key: "reports" },
  { icon: Lock, key: "roles" },
] as const;

type CapabilityKey = (typeof CAPABILITIES)[number]["key"];

const HIGHLIGHT_KEYS = ["highlight1", "highlight2", "highlight3"] as const;

function CapabilityVisual({ type }: { type: CapabilityKey }) {
  if (type === "upload") {
    return (
      <div className="capability-visual capability-visual--upload" aria-hidden>
        <div className="capability-flow-step">
          <FileSpreadsheet className="h-5 w-5" />
          <span>Excel</span>
        </div>
        <div className="capability-flow-arrow" />
        <div className="capability-flow-step capability-flow-step--active">
          <ClipboardCheck className="h-5 w-5" />
          <span>VIP</span>
        </div>
        <div className="capability-flow-arrow" />
        <div className="capability-flow-step">
          <Check className="h-5 w-5" />
          <span>OK</span>
        </div>
      </div>
    );
  }

  if (type === "validation") {
    return (
      <div className="capability-visual capability-visual--validation" aria-hidden>
        <span className="capability-pill capability-pill--error">
          <AlertCircle className="h-4 w-4" />
        </span>
        <span className="capability-pill capability-pill--warning">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <span className="capability-pill capability-pill--success">
          <CheckCircle2 className="h-4 w-4" />
        </span>
      </div>
    );
  }

  if (type === "map") {
    return (
      <div className="capability-visual capability-visual--map" aria-hidden>
        {[
          { top: "18%", left: "42%" },
          { top: "35%", left: "28%" },
          { top: "48%", left: "55%" },
          { top: "62%", left: "38%" },
          { top: "72%", left: "62%" },
          { top: "28%", left: "68%" },
        ].map((pos, i) => (
          <MapPin
            key={i}
            className="capability-map-pin"
            style={{ top: pos.top, left: pos.left, animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    );
  }

  if (type === "uwi") {
    return (
      <div className="capability-visual capability-visual--uwi" aria-hidden>
        <code className="capability-uwi-code">
          <span className="capability-uwi-prefix">CO</span>
          <span className="capability-uwi-sep">-</span>
          <span className="capability-uwi-block">ANH</span>
          <span className="capability-uwi-sep">-</span>
          <span className="capability-uwi-block capability-uwi-cursor">00001234</span>
        </code>
      </div>
    );
  }

  if (type === "reports") {
    return (
      <div className="capability-visual capability-visual--reports" aria-hidden>
        {[72, 48, 88, 56, 64].map((h, i) => (
          <div
            key={i}
            className="capability-bar"
            style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="capability-visual capability-visual--roles" aria-hidden>
      <div className="capability-role-chip">
        <FileUp className="h-4 w-4" />
      </div>
      <div className="capability-role-chip capability-role-chip--active">
        <BarChart3 className="h-4 w-4" />
      </div>
      <div className="capability-role-chip">
        <Shield className="h-4 w-4" />
      </div>
      <Users className="capability-role-bg h-16 w-16 opacity-20" />
    </div>
  );
}

export function LandingCapabilities() {
  const t = useT();
  const [active, setActive] = useState<CapabilityKey>("upload");

  const activeItem = CAPABILITIES.find((item) => item.key === active) ?? CAPABILITIES[0];
  const ActiveIcon = activeItem.icon;

  return (
    <section id="capacidades" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="mb-10 max-w-2xl">
        <h2 className="text-2xl font-extrabold text-anh-primary sm:text-3xl">{t("landing.featuresTitle")}</h2>
        <p className="mt-3 text-anh-muted">{t("landing.featuresSubtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
        <div className="flex flex-col gap-3" role="tablist" aria-label={t("landing.featuresTitle")}>
          {CAPABILITIES.map(({ icon: Icon, key }) => {
            const isActive = active === key;

            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`capability-panel-${key}`}
                id={`capability-tab-${key}`}
                onClick={() => setActive(key)}
                className={[
                  "w-full rounded-2xl border p-4 text-left transition-all duration-200",
                  isActive
                    ? "border-anh-secondary bg-anh-secondary/10 shadow-md"
                    : "border-anh-border bg-anh-surface shadow-sm hover:border-anh-secondary/30 hover:shadow-md",
                ].join(" ")}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={[
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                      isActive ? "bg-anh-secondary text-white" : "bg-anh-secondary/10 text-anh-secondary",
                    ].join(" ")}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="font-bold text-anh-primary">{t(`landing.feature.${key}.title`)}</span>
                    {isActive ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-anh-secondary" aria-hidden />
                    ) : null}
                  </div>
                </div>
                {isActive ? <div className="mt-4 h-0.5 w-3/4 rounded-full bg-anh-secondary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>

        <article
          key={active}
          id={`capability-panel-${active}`}
          role="tabpanel"
          aria-labelledby={`capability-tab-${active}`}
          className="capability-panel capability-panel-enter overflow-hidden rounded-2xl border border-anh-border/80 bg-anh-surface shadow-md lg:sticky lg:top-24"
        >
          <div className="capability-panel-hero relative overflow-hidden px-6 pb-8 pt-6 sm:px-8 sm:pt-8">
            <div className="capability-panel-glow pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full" />
            <div className="capability-panel-glow pointer-events-none absolute -bottom-12 -left-6 h-32 w-32 rounded-full opacity-60" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-anh-secondary text-white shadow-lg shadow-anh-secondary/25">
                <ActiveIcon className="h-8 w-8" aria-hidden />
              </div>
              <div className="rounded-xl border border-anh-secondary/25 bg-anh-surface/80 px-4 py-2 text-right backdrop-blur-sm">
                <p className="text-2xl font-extrabold leading-none text-anh-secondary">
                  {t(`landing.feature.${active}.statValue`)}
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-anh-muted">
                  {t(`landing.feature.${active}.statLabel`)}
                </p>
              </div>
            </div>

            <h3 className="relative mt-6 text-2xl font-extrabold text-anh-primary sm:text-3xl">
              {t(`landing.feature.${active}.title`)}
            </h3>

            <div className="relative mt-5">
              <CapabilityVisual type={active} />
            </div>
          </div>

          <div className="border-t border-anh-border px-6 py-6 sm:px-8 sm:py-7">
            <p className="text-sm leading-relaxed text-anh-muted">
              {t(`landing.feature.${active}.detail`)}
            </p>

            <ul className="mt-6 grid gap-3 sm:grid-cols-1">
              {HIGHLIGHT_KEYS.map((highlightKey, index) => (
                <li
                  key={highlightKey}
                  className="capability-highlight flex items-start gap-3 rounded-xl border border-anh-border bg-anh-bg/70 px-4 py-3"
                  style={{ animationDelay: `${index * 0.08}s` }}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-anh-secondary/15 text-anh-secondary">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                  </span>
                  <span className="text-sm font-semibold leading-snug text-anh-primary">
                    {t(`landing.feature.${active}.${highlightKey}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>
    </section>
  );
}
