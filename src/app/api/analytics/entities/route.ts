import { NextRequest, NextResponse } from "next/server";
import { searchAnalyticsEntities } from "@/lib/analytics-db";
import type { CompareEntityType } from "@/lib/analytics";
import { requireRole, requireSession } from "@/lib/auth-scope";

const ENTITY_TYPES = new Set<CompareEntityType>(["operadora", "departamento", "municipio", "pozo"]);

export async function GET(request: NextRequest) {
  const user = requireRole(requireSession(request), ["anh", "admin"]);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as CompareEntityType | null;
  const q = searchParams.get("q") ?? undefined;

  if (!type || !ENTITY_TYPES.has(type)) {
    return NextResponse.json({ error: "Tipo de entidad no válido" }, { status: 400 });
  }

  return NextResponse.json({ entities: searchAnalyticsEntities(type, q) });
}
