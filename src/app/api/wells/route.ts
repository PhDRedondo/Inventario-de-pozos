import { NextRequest, NextResponse } from "next/server";
import { listWells, resolveDaneCodes, saveWell } from "@/lib/db";
import { buildDataScope, mergeScopeWithFilters, requireRole, requireSession } from "@/lib/auth-scope";
import { hasDashboardFilters, parseDashboardFiltersFromSearchParams } from "@/lib/filters";
import type { WellRecord } from "@/lib/types";

export async function GET(request: NextRequest) {
  const user = requireSession(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parsed = parseDashboardFiltersFromSearchParams(searchParams);
  const filters = mergeScopeWithFilters(buildDataScope(user), parsed);
  const wells = listWells(hasDashboardFilters(filters) ? filters : undefined, buildDataScope(user));
  return NextResponse.json(wells);
}

export async function POST(request: NextRequest) {
  const user = requireRole(requireSession(request), ["admin", "anh"]);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = (await request.json()) as WellRecord;
  const dane = resolveDaneCodes(body.departamento, body.municipio);
  const record: WellRecord = {
    ...body,
    codigo_dane_depto: dane.codigo_dane_depto ?? body.codigo_dane_depto,
    codigo_dane_muni: dane.codigo_dane_muni ?? body.codigo_dane_muni,
  };

  const { well, validation } = saveWell(record);
  return NextResponse.json({ well, validation }, { status: validation.is_valid ? 201 : 422 });
}
