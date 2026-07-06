"use client";

import type { ReactNode } from "react";
import { useT } from "@/context/AppPreferences";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-anh-primary sm:text-2xl">{title}</h2>
        <p className="mt-1 line-clamp-3 max-w-3xl text-xs text-anh-muted sm:line-clamp-none sm:text-sm">{description}</p>
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = "default",
  active = false,
  onClick,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
  active?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    default: "border-anh-border",
    success: "stat-tone-success",
    warning: "stat-tone-warning",
    danger: "stat-tone-danger",
  };

  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`card w-full p-3 text-left transition sm:p-4 ${tones[tone]} ${
        onClick ? "cursor-pointer hover:shadow-md" : ""
      } ${active ? "ring-2 ring-anh-secondary ring-offset-2 ring-offset-anh-bg" : ""}`}
    >
      <p className="text-sm font-semibold text-anh-muted">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-anh-primary sm:text-3xl">{value}</p>
    </Component>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  const t = useT();
  if (status === "valid") return <span className="badge-valid">{t("status.valid")}</span>;
  if (status === "warning") return <span className="badge-warning">{t("status.warning")}</span>;
  if (status === "invalid") return <span className="badge-invalid">{t("status.invalid")}</span>;
  return <span className="badge-warning">{t("status.pending")}</span>;
}
