import { NextRequest, NextResponse } from "next/server";
import { getValidationReport } from "@/lib/db";
import { buildDataScope, requireSession } from "@/lib/auth-scope";

export async function GET(request: NextRequest) {
  const user = requireSession(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const uploadId = request.nextUrl.searchParams.get("uploadId");
  const parsedUploadId = uploadId != null && uploadId !== "" ? Number(uploadId) : undefined;
  const report = getValidationReport(
    parsedUploadId != null && Number.isFinite(parsedUploadId) ? parsedUploadId : undefined,
    buildDataScope(user),
  );
  return NextResponse.json(report);
}
