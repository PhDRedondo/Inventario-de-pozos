"use client";

import { useT } from "@/context/AppPreferences";

export function MapLoadingPlaceholder({ className }: { className?: string }) {
  const t = useT();
  return (
    <div
      className={
        className ??
        "map-shell flex h-[min(45vh,420px)] min-h-[280px] items-center justify-center rounded-xl border border-anh-border text-sm text-anh-muted sm:h-[min(52vh,480px)] sm:min-h-[360px]"
      }
    >
      {t("common.loadingMap")}
    </div>
  );
}
