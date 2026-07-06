"use client";

import { OperatorBadge } from "@/components/OperatorBadge";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/AppPreferences";
import { useOperatorBrand } from "@/hooks/useOperatorBrand";

export function OperatorWelcomeStrip({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { user } = useAuth();
  const brand = useOperatorBrand();

  if (!brand || !user) return null;

  return (
    <div
      className={`operator-welcome-strip ${compact ? "operator-welcome-strip--compact" : ""}`}
      style={{ borderLeftColor: brand.primary, background: brand.accent }}
    >
      <OperatorBadge brand={brand} size={compact ? "sm" : "md"} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-anh-muted sm:text-[11px]">
          {t("operatorBrand.workspace")}
        </p>
        <p className="truncate text-sm font-extrabold text-anh-primary sm:text-base">{brand.shortName}</p>
        {!compact && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-anh-muted sm:line-clamp-none sm:text-sm">
            {t("operatorBrand.greeting", { name: user.displayName ?? user.username })}
            {" · "}
            {t("operatorBrand.scopeHint")}
          </p>
        )}
      </div>
      <div
        className="hidden h-10 w-1 shrink-0 rounded-full sm:block"
        style={{ background: brand.gradient }}
        aria-hidden
      />
    </div>
  );
}
