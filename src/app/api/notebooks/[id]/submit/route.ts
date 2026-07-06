import { NextRequest, NextResponse } from "next/server";
import { buildUploadExcelBuffer } from "@/lib/export-upload";
import { getWellsByUpload } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth-scope";
import { sendSubmissionEmail } from "@/lib/mail";
import { assertNotebookAccess, submitNotebook } from "@/lib/notebook-db";

export async function POST(
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

  const body = (await request.json().catch(() => ({}))) as { operadora?: string };
  const operadora =
    user.role === "operadora" ? user.operadora : body.operadora?.trim() || null;

  const access = assertNotebookAccess(notebookId, operadora, user.role, user.operadora);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const result = submitNotebook(notebookId, user.email);
  if (result.error) {
    return NextResponse.json({ error: result.error, notebook: result.notebook, version: result.version }, { status: 400 });
  }

  const wells = getWellsByUpload(result.version.id);
  const excelBuffer = buildUploadExcelBuffer(wells, result.version.filename.replace(/\.xlsx?$/i, "") || "INVENTARIO");

  await sendSubmissionEmail({
    uploadId: result.version.id,
    operadora: access.notebook.operadora,
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
