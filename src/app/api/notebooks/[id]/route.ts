import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireSession } from "@/lib/auth-scope";
import { assertNotebookAccess, getNotebookDetail } from "@/lib/notebook-db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = requireRole(requireSession(request), ["operadora", "admin"]);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const notebookId = Number(id);
  if (!Number.isFinite(notebookId)) {
    return NextResponse.json({ error: "Cuaderno no válido" }, { status: 400 });
  }

  const operadoraParam = request.nextUrl.searchParams.get("operadora");
  const access = assertNotebookAccess(
    notebookId,
    operadoraParam,
    user.role,
    user.operadora,
  );
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const detail = getNotebookDetail(notebookId);
  if (!detail) return NextResponse.json({ error: "Cuaderno no encontrado" }, { status: 404 });
  return NextResponse.json(detail);
}
