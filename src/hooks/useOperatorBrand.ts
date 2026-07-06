"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { resolveOperatorBrand, type OperatorBrand } from "@/lib/operator-brand";

export function useOperatorBrand(): OperatorBrand | null {
  const { user } = useAuth();
  return useMemo(() => {
    if (user?.role !== "operadora" || !user.operadora) return null;
    return resolveOperatorBrand(user.operadora);
  }, [user?.role, user?.operadora]);
}
