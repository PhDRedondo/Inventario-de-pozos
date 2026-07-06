"use client";

import { useEffect } from "react";
import { useOperatorBrand } from "@/hooks/useOperatorBrand";

const VARS = [
  "--operator-primary",
  "--operator-secondary",
  "--operator-accent",
  "--operator-gradient",
] as const;

export function OperatorBrandEffect() {
  const brand = useOperatorBrand();

  useEffect(() => {
    const root = document.documentElement;
    if (!brand) {
      root.removeAttribute("data-operator-brand");
      for (const key of VARS) root.style.removeProperty(key);
      return;
    }

    root.setAttribute("data-operator-brand", brand.slug);
    root.style.setProperty("--operator-primary", brand.primary);
    root.style.setProperty("--operator-secondary", brand.secondary);
    root.style.setProperty("--operator-accent", brand.accent);
    root.style.setProperty("--operator-gradient", brand.gradient);

    return () => {
      root.removeAttribute("data-operator-brand");
      for (const key of VARS) root.style.removeProperty(key);
    };
  }, [brand]);

  return null;
}
