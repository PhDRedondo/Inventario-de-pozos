import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireSession } from "@/lib/auth-scope";
import {
  createNotebook,
  getActiveNotebookDetail,
  getNotebookDetail,
} from "@/lib/notebook-db";

export async function GET(request: NextRequest) {
  const user = requireRole(requireSession(request), ["operadora", "admin"]);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const operadoraParam = request.nextUrl.searchParams.get("operadora");
  const operadora =
    user.role === "operadora" ? user.operadora : operadoraParam?.trim() || null;

  if (!operadora) {
    return NextResponse.json({ error: "Seleccione una operadora" }, { status: 400 });
  }

  const detail = getActiveNotebookDetail(operadora);
  return NextResponse.json(detail);
}

export async function POST(request: NextRequest) {
  const user = requireRole(requireSession(request), ["operadora", "admin"]);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { operadora?: string; action?: string; title?: string };
  const operadora =
    user.role === "operadora" ? user.operadora : body.operadora?.trim() || null;

  if (!operadora) {
    return NextResponse.json({ error: "Seleccione una operadora" }, { status: 400 });
  }

  if (body.action === "new") {
    const notebook = createNotebook(operadora, body.title?.trim() || "", user.email);
    return NextResponse.json(getNotebookDetail(notebook.id));
  }

  const detail = getActiveNotebookDetail(operadora);
  return NextResponse.json(detail);
}
