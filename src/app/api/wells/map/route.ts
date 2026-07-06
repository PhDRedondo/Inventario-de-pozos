import { NextRequest, NextResponse } from "next/server";
import { listWellsForMap } from "@/lib/db";
import { buildDataScope, mergeScopeWithFilters, requireSession } from "@/lib/auth-scope";
import { hasDashboardFilters, parseDashboardFiltersFromSearchParams } from "@/lib/filters";

export async function GET(request: NextRequest) {
  const user = requireSession(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parsed = parseDashboardFiltersFromSearchParams(searchParams);
  const filters = mergeScopeWithFilters(buildDataScope(user), parsed);
  const points = listWellsForMap(hasDashboardFilters(filters) ? filters : undefined, buildDataScope(user));
  return NextResponse.json(points);
}
