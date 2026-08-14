import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireSession } from "@/lib/auth-scope";
import { buildNotebookTemplate, clampTemplateRows } from "@/lib/notebook-template";

export async function GET(request: NextRequest) {
  const user = requireRole(requireSession(request), ["operadora", "admin"]);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const rowsParam = Number(request.nextUrl.searchParams.get("rows"));
  const rows = clampTemplateRows(Number.isFinite(rowsParam) ? rowsParam : undefined);

  const operadoraParam = request.nextUrl.searchParams.get("operadora");
  const operadora = user.role === "operadora" ? user.operadora : operadoraParam?.trim() || null;

  const buffer = await buildNotebookTemplate({ rows, operadora });

  const filename = `plantilla-inventario-pozos-${rows}-registros.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
