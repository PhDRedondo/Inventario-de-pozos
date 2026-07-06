import { NextRequest, NextResponse } from "next/server";
import { getValidationReport } from "@/lib/db";
import { buildDataScope, requireSession } from "@/lib/auth-scope";
import { buildCalidadExcelBuffer, type CalidadExportFilter } from "@/lib/export-calidad";

function parseFilter(value: string | null): CalidadExportFilter {
  if (value === "errors" || value === "warnings") return value;
  return "all";
}

export async function GET(request: NextRequest) {
  const user = requireSession(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get("uploadId");
  const filter = parseFilter(searchParams.get("filter"));

  const report = getValidationReport(
    uploadId ? Number(uploadId) : undefined,
    buildDataScope(user),
  );
  const buffer = await buildCalidadExcelBuffer(report, filter);

  const filename = "informe-calidad-inventario-pozos-anh.xlsx";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
