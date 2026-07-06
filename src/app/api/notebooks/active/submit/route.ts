import { NextRequest, NextResponse } from "next/server";
import { buildUploadExcelBuffer } from "@/lib/export-upload";
import { getWellsByUpload } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth-scope";
import { sendSubmissionEmail } from "@/lib/mail";
import { getActiveNotebook, getNotebook, submitNotebook } from "@/lib/notebook-db";

export async function POST(request: NextRequest) {
  const user = requireRole(requireSession(request), ["operadora", "admin"]);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { notebookId?: number; operadora?: string };
  let notebookId = body.notebookId;
  let operadora = user.role === "operadora" ? user.operadora : body.operadora?.trim() || null;

  if (!notebookId && operadora) {
    const active = getActiveNotebook(operadora);
    notebookId = active?.id;
  }

  if (!notebookId) {
    return NextResponse.json({ error: "Cuaderno no encontrado" }, { status: 404 });
  }

  const notebook = getNotebook(notebookId);
  if (!notebook) return NextResponse.json({ error: "Cuaderno no encontrado" }, { status: 404 });

  if (user.role === "operadora" && notebook.operadora !== user.operadora) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const result = submitNotebook(notebookId, user.email);
  if (result.error) {
    return NextResponse.json({ error: result.error, notebook: result.notebook, version: result.version }, { status: 400 });
  }

  const wells = getWellsByUpload(result.version.id);
  const excelBuffer = buildUploadExcelBuffer(wells, result.version.filename.replace(/\.xlsx?$/i, "") || "INVENTARIO");

  await sendSubmissionEmail({
    uploadId: result.version.id,
    operadora: notebook.operadora,
    filename: result.version.filename,
    submittedBy: user.email,
    totalRecords: result.version.total_records,
    validRecords: result.version.valid_records,
    excelBuffer,
  });

  return NextResponse.json({
    notebook: result.notebook,
    version: result.version,
    message:
      "Inventario aplicado. Los datos ya están visibles en el panel principal y el Excel quedó en data/outbox/.",
  });
}
