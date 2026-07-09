"use client";

import { useState } from "react";
import {
  BarChart3,
  ClipboardCheck,
  FileUp,
  Globe2,
  Lock,
  Map,
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
                <div className="flex items-start gap-4">
                  <div
                    className={[
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                      isActive ? "bg-anh-secondary text-white" : "bg-anh-secondary/10 text-anh-secondary",
                    ].join(" ")}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-anh-primary">{t(`landing.feature.${key}.title`)}</span>
                      {isActive ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-anh-secondary" aria-hidden />
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-anh-muted">{t(`landing.feature.${key}.text`)}</p>
                  </div>
                </div>
                {isActive ? <div className="mt-4 h-0.5 w-3/4 rounded-full bg-anh-secondary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>

        <article
          id={`capability-panel-${active}`}
          role="tabpanel"
          aria-labelledby={`capability-tab-${active}`}
          className="card min-h-[22rem] border-anh-border/80 p-6 sm:p-8 lg:sticky lg:top-24"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-anh-secondary text-white shadow-sm">
            <ActiveIcon className="h-7 w-7" aria-hidden />
          </div>
          <h3 className="mt-6 text-2xl font-extrabold text-anh-primary sm:text-3xl">
            {t(`landing.feature.${active}.title`)}
          </h3>
          <p className="mt-4 text-base leading-relaxed text-anh-muted sm:text-lg">
            {t(`landing.feature.${active}.detail`)}
          </p>
        </article>
      </div>
    </section>
  );
}
