import { NextRequest, NextResponse } from "next/server";
import { deleteUser, getUserById, updateUser } from "@/lib/auth-db";
import { requireRole, requireSession } from "@/lib/auth-scope";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = requireRole(requireSession(request), ["admin"]);
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json()) as {
    displayName?: string;
    active?: boolean;
    password?: string;
    operadora?: string | null;
  };

  const updated = updateUser(Number(id), body, actor.email);
  if (!updated) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  const { password_hash: _, ...safe } = updated;
  return NextResponse.json(safe);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = requireRole(requireSession(request), ["admin"]);
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const target = getUserById(Number(id));
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const ok = deleteUser(Number(id), actor.email);
  if (!ok) return NextResponse.json({ error: "No se puede eliminar este usuario" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
