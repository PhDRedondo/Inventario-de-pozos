import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { EXCEL_SPECIAL_COLUMN_BINDINGS } from "@/lib/attributes";
import { EXCEL_COLUMN_MAP } from "@/lib/catalogs";
import { resolveDaneCodes } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth-scope";
import { sanitizeSpanishText } from "@/lib/geo";
import { addNotebookVersion, assertNotebookAccess } from "@/lib/notebook-db";
import type { WellRecord } from "@/lib/types";
import { summarizeValidation } from "@/lib/validation";

function parseExcelRow(row: Record<string, unknown>): WellRecord {
  const record: Partial<WellRecord> = {};

  for (const [excelCol, key] of Object.entries(EXCEL_COLUMN_MAP)) {
    const value = row[excelCol];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      (record as Record<string, string | null>)[key] = sanitizeSpanishText(String(value).trim());
    }
  }

  for (const { excelHeader, key } of EXCEL_SPECIAL_COLUMN_BINDINGS) {
    const value = row[excelHeader] ?? (key === "coord_bogota_y" ? row["Unnamed: 29"] : undefined)
      ?? (key === "iny_dias" ? row["DIAS ACUMULADOS "] : undefined);
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      (record as Record<string, string | null>)[key] = String(value);
    }
  }

  const dane = resolveDaneCodes(record.departamento ?? null, record.municipio ?? null);
  record.codigo_dane_depto = dane.codigo_dane_depto ?? record.codigo_dane_depto ?? null;
  record.codigo_dane_muni = dane.codigo_dane_muni ?? record.codigo_dane_muni ?? null;

  return record as WellRecord;
}

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

  const formData = await request.formData();
  const file = formData.get("file");
  let operadora = (formData.get("operadora") as string) || null;

  if (user.role === "operadora") {
    operadora = user.operadora;
  }

  const access = assertNotebookAccess(notebookId, operadora, user.role, user.operadora);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Debe adjuntar un archivo Excel (.xlsx)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames.find((s) => s.toUpperCase().includes("INVENTARIO")) ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const dataRows = rows.filter((row) => {
    const operadoraVal = row["OPERADORA"];
    return operadoraVal && !String(operadoraVal).toUpperCase().includes("LISTA");
  });

  if (dataRows.length === 0) {
    return NextResponse.json({ error: "No se encontraron registros válidos en la hoja de inventario." }, { status: 400 });
  }

  const records = dataRows.map(parseExcelRow);

  try {
    const { notebook, version, results } = addNotebookVersion(
      notebookId,
      access.notebook.operadora,
      file.name,
      records,
      user.email,
    );
    const summary = summarizeValidation(results);
    return NextResponse.json({ notebook, version, summary, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al cargar la versión";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
