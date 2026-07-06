import { NextRequest, NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/db";
import { buildDataScope, mergeScopeWithFilters, requireSession } from "@/lib/auth-scope";
import { hasDashboardFilters, parseDashboardFiltersFromSearchParams } from "@/lib/filters";

export async function GET(request: NextRequest) {
  const user = requireSession(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parsed = parseDashboardFiltersFromSearchParams(searchParams);
  const filters = mergeScopeWithFilters(buildDataScope(user), parsed);
  const scope = buildDataScope(user);

  const limitParam = searchParams.get("limit");
  const tableLimit = limitParam === "25" || limitParam === "50" ? Number(limitParam) : 10;

  const stats = getDashboardStats(
    hasDashboardFilters(filters) ? filters : undefined,
    tableLimit,
    scope,
  );
  return NextResponse.json(stats);
}
