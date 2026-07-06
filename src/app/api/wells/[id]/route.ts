import { NextRequest, NextResponse } from "next/server";
import { deleteWell, getWell, resolveDaneCodes, updateWell } from "@/lib/db";
import { buildDataScope, requireRole, requireSession } from "@/lib/auth-scope";
import type { WellRecord } from "@/lib/types";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireSession(_request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const data = getWell(Number(id), buildDataScope(user));
  if (!data) return NextResponse.json({ error: "Pozo no encontrado" }, { status: 404 });
  return NextResponse.json({ ...data, canEdit: user.role === "admin" });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireRole(requireSession(request), ["admin"]);
  if (!user) return NextResponse.json({ error: "Solo administradores pueden editar registros" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json()) as WellRecord;
  const dane = resolveDaneCodes(body.departamento, body.municipio);
  const record: WellRecord = {
    ...body,
    codigo_dane_depto: dane.codigo_dane_depto ?? body.codigo_dane_depto,
    codigo_dane_muni: dane.codigo_dane_muni ?? body.codigo_dane_muni,
  };

  const result = updateWell(Number(id), record, user.email);
  if (!result) return NextResponse.json({ error: "Pozo no encontrado" }, { status: 404 });
  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireRole(requireSession(_request), ["admin"]);
  if (!user) return NextResponse.json({ error: "Solo administradores pueden eliminar registros" }, { status: 403 });

  const { id } = await params;
  const ok = deleteWell(Number(id), user.email);
  if (!ok) return NextResponse.json({ error: "Pozo no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
