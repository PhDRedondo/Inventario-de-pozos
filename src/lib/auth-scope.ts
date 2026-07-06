import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "./auth";
import type { DataScope, SessionUser } from "./types";

export function buildDataScope(user: SessionUser | null): DataScope | null {
  if (!user) return null;
  return {
    role: user.role,
    operadora: user.operadora,
    email: user.email,
  };
}

export function requireSession(request: NextRequest): SessionUser | null {
  return getSessionUserFromRequest(request);
}

export function requireRole(user: SessionUser | null, roles: SessionUser["role"][]): SessionUser | null {
  if (!user || !roles.includes(user.role)) return null;
  return user;
}

export function mergeScopeWithFilters(
  scope: DataScope | null,
  filters: { operadora?: string },
): { operadora?: string } {
  if (!scope) return filters;
  if (scope.role === "operadora" && scope.operadora) {
    return { ...filters, operadora: scope.operadora };
  }
  return filters;
}
