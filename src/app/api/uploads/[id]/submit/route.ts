import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-scope";
import { getUpload, getWellsByUpload, submitUpload } from "@/lib/db";
import { buildUploadExcelBuffer } from "@/lib/export-upload";
import { sendSubmissionEmail } from "@/lib/mail";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = requireSession(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "operadora") {
    return NextResponse.json({ error: "Solo operadoras pueden enviar inventario" }, { status: 403 });
  }

  const { id } = await params;
  const uploadId = Number(id);
  const upload = getUpload(uploadId);
  if (!upload) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
  if (upload.operadora !== user.operadora) {
    return NextResponse.json({ error: "No autorizado para este lote" }, { status: 403 });
  }

  const result = submitUpload(uploadId, user.email);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const wells = getWellsByUpload(uploadId);
  const excelBuffer = buildUploadExcelBuffer(wells, upload.filename.replace(/\.xlsx?$/i, "") || "INVENTARIO");
  const mailResult = await sendSubmissionEmail({
    uploadId,
    operadora: upload.operadora ?? user.operadora ?? "Operadora",
    filename: upload.filename,
    submittedBy: user.email,
    totalRecords: upload.total_records,
    validRecords: upload.valid_records,
    excelBuffer,
  });

  return NextResponse.json({
    upload: result.upload,
    email: mailResult,
    message:
      "Inventario publicado en el panel ANH. El Excel fue generado en data/outbox/ para envío a correspondenciaanh@anh.gov.co.",
  });
}
