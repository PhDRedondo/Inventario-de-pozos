"use client";

import type { OperatorBrand } from "@/lib/operator-brand";

type Size = "sm" | "md" | "lg";

const sizeClasses: Record<Size, string> = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
};

export function OperatorBadge({ brand, size = "md" }: { brand: OperatorBrand; size?: Size }) {
  return (
    <span
      className={`operator-badge inline-flex shrink-0 items-center justify-center rounded-xl font-extrabold tracking-tight ${sizeClasses[size]}`}
      style={{
        background: brand.gradient,
        color: "#ffffff",
        boxShadow: `0 4px 14px ${brand.primary}33`,
      }}
      aria-hidden
    >
      {brand.initials}
    </span>
  );
}
