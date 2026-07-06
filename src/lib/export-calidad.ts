import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { sanitizeSpanishText } from "@/lib/geo";
import { getAttributeLabel } from "@/lib/attributes";
import type { ValidationResult } from "@/lib/types";

export type CalidadExportFilter = "all" | "errors" | "warnings";

const SEVERITY_LABELS: Record<string, string> = {
  error: "Error",
  warning: "Advertencia",
  info: "Información",
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};

function filterReport(report: ValidationResult[], filter: CalidadExportFilter): ValidationResult[] {
  if (filter === "errors") return report.filter((row) => !row.is_valid);
  if (filter === "warnings") return report.filter((row) => row.is_valid && row.warning_count > 0);
  return report;
}

function shouldIncludeIssue(issueSeverity: string, filter: CalidadExportFilter): boolean {
  if (filter === "errors") return issueSeverity === "error";
  if (filter === "warnings") return issueSeverity === "warning";
  return true;
}

function filterLabel(filter: CalidadExportFilter): string {
  if (filter === "errors") return "Solo errores";
  if (filter === "warnings") return "Solo advertencias";
  return "Todos los hallazgos";
}

export async function buildCalidadWorkbook(
  report: ValidationResult[],
  filter: CalidadExportFilter,
): Promise<ExcelJS.Workbook> {
  const filtered = filterReport(report, filter);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ANH - Inventario Nacional de Pozos";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Informe calidad", {
    properties: { defaultRowHeight: 18 },
    views: [{ state: "frozen", ySplit: 8, showGridLines: true }],
  });

  sheet.columns = [
    { key: "operadora", width: 28 },
    { key: "pozo", width: 22 },
    { key: "uwi", width: 28 },
    { key: "severidad", width: 14 },
    { key: "atributo", width: 28 },
    { key: "mensaje", width: 58 },
    { key: "regla", width: 24 },
  ];

  const logoPath = path.join(process.cwd(), "public", "anh-logo.png");
  if (fs.existsSync(logoPath)) {
    const imageId = workbook.addImage({
      filename: logoPath,
      extension: "png",
    });
    sheet.addImage(imageId, {
      tl: { col: 0.1, row: 0.2 },
      ext: { width: 150, height: 72 },
    });
  }

  sheet.mergeCells("C1:G2");
  const titleCell = sheet.getCell("C1");
  titleCell.value = "INFORME DE CALIDAD DE DATOS";
  titleCell.font = { name: "Calibri", bold: true, size: 18, color: { argb: "FF1A1A1A" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

  sheet.mergeCells("C3:G3");
  const subtitleCell = sheet.getCell("C3");
  subtitleCell.value = "Inventario Nacional de Pozos — Agencia Nacional de Hidrocarburos (ANH)";
  subtitleCell.font = { name: "Calibri", size: 11, color: { argb: "FF4A5568" } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left" };

  sheet.mergeCells("C4:G4");
  const dateCell = sheet.getCell("C4");
  dateCell.value = `Fecha de generación: ${new Date().toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  })}`;
  dateCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF718096" } };

  sheet.getRow(1).height = 26;
  sheet.getRow(2).height = 26;
  sheet.getRow(3).height = 20;
  sheet.getRow(4).height = 18;
  sheet.getRow(5).height = 10;
  sheet.getRow(6).height = 22;
  sheet.getRow(7).height = 8;

  const totalErrores = filtered.reduce((sum, row) => sum + row.error_count, 0);
  const totalAdvertencias = filtered.reduce((sum, row) => sum + row.warning_count, 0);

  sheet.mergeCells("A6:G6");
  const summaryCell = sheet.getCell("A6");
  summaryCell.value = `Filtro aplicado: ${filterLabel(filter)} · ${filtered.length} pozos · ${totalErrores} errores · ${totalAdvertencias} advertencias`;
  summaryCell.font = { name: "Calibri", bold: true, size: 10, color: { argb: "FF1A1A1A" } };
  summaryCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF8E1" },
  };
  summaryCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  const headerRow = sheet.getRow(8);
  const headers = ["Operadora", "Pozo", "UWI fiscalizado", "Severidad", "Atributo", "Mensaje", "Regla"];
  headers.forEach((label, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = label;
    cell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1A1A1A" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = THIN_BORDER;
  });
  headerRow.height = 24;

  let rowNumber = 9;
  for (const row of filtered) {
    for (const issue of row.issues) {
      if (!shouldIncludeIssue(issue.severity, filter)) continue;

      const dataRow = sheet.getRow(rowNumber);
      dataRow.getCell(1).value = sanitizeSpanishText(row.operadora);
      dataRow.getCell(2).value = sanitizeSpanishText(row.nombre_pozo_sgc);
      dataRow.getCell(3).value = row.uwi_fiscalizado ?? "";
      dataRow.getCell(4).value = SEVERITY_LABELS[issue.severity] ?? issue.severity;
      dataRow.getCell(5).value = getAttributeLabel(issue.field);
      dataRow.getCell(6).value = sanitizeSpanishText(issue.message);
      dataRow.getCell(7).value = issue.rule;

      for (let col = 1; col <= 7; col++) {
        const cell = dataRow.getCell(col);
        cell.font = { name: "Calibri", size: 10, color: { argb: "FF1A1A1A" } };
        cell.alignment = { vertical: "top", wrapText: col === 6, horizontal: col === 4 ? "center" : "left" };
        cell.border = THIN_BORDER;
      }

      const severityCell = dataRow.getCell(4);
      if (issue.severity === "error") {
        severityCell.font = { name: "Calibri", bold: true, size: 10, color: { argb: "FFE8381A" } };
        severityCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEBEE" } };
      } else if (issue.severity === "warning") {
        severityCell.font = { name: "Calibri", bold: true, size: 10, color: { argb: "FFFF8C00" } };
        severityCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E1" } };
      }

      rowNumber += 1;
    }
  }

  if (rowNumber === 9) {
    const emptyRow = sheet.getRow(9);
    sheet.mergeCells("A9:G9");
    emptyRow.getCell(1).value = "No se encontraron hallazgos para el filtro seleccionado.";
    emptyRow.getCell(1).font = { name: "Calibri", italic: true, color: { argb: "FF718096" } };
    emptyRow.getCell(1).alignment = { horizontal: "center" };
  }

  return workbook;
}

export async function buildCalidadExcelBuffer(
  report: ValidationResult[],
  filter: CalidadExportFilter,
): Promise<Buffer> {
  const workbook = await buildCalidadWorkbook(report, filter);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
