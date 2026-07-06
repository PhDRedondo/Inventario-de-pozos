"use client";

import { useT } from "@/context/AppPreferences";
import type { UserRole } from "@/lib/types";

const STEPS = [1, 2, 3] as const;

type WorkflowVariant = "cards" | "compact";

export function RoleWorkflowSteps({
  role,
  variant = "cards",
}: {
  role: UserRole;
  variant?: WorkflowVariant;
}) {
  const t = useT();
  const prefix = `workflow.${role}`;

  if (variant === "compact") {
    return (
      <div
        className="mb-4 rounded-lg border border-anh-border/60 bg-anh-bg/50 px-3 py-2.5 sm:px-4 sm:py-3"
        aria-label={t("workflow.compactLabel")}
      >
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-anh-muted">
          {t("workflow.compactLabel")}
        </p>
        <ol className="grid gap-2 sm:grid-cols-3 sm:gap-3">
          {STEPS.map((step) => (
            <li key={step} className="flex min-w-0 items-start gap-2">
              <span className="workflow-step-num workflow-step-num--compact">{step}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-snug text-anh-primary sm:text-sm">
                  {t(`${prefix}.step${step}Title`)}
                </p>
                <p className="mt-0.5 hidden text-xs leading-relaxed text-anh-muted lg:block">
                  {t(`${prefix}.step${step}Text`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="mb-6 grid gap-4 md:grid-cols-3">
      {STEPS.map((step) => (
        <div key={step} className="workflow-step">
          <span className="workflow-step-num">{step}</span>
          <div>
            <p className="font-semibold text-anh-primary">{t(`${prefix}.step${step}Title`)}</p>
            <p className="mt-1 text-sm text-anh-muted">{t(`${prefix}.step${step}Text`)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function roleWorkflowIntro(role: UserRole, page: "upload" | "quality"): string {
  return `workflow.${role}.${page}Intro`;
}
