import * as XLSX from "xlsx";
import { EXCEL_COLUMN_MAP } from "./catalogs";
import { EXCEL_SPECIAL_COLUMN_BINDINGS } from "./attributes";
import type { WellRecord } from "./types";

const REVERSE_MAP = Object.fromEntries(
  Object.entries(EXCEL_COLUMN_MAP).map(([excel, key]) => [key, excel]),
) as Record<string, string>;

export function buildUploadExcelBuffer(wells: WellRecord[], sheetName = "FORMATO INVENTARIO POZOS"): Buffer {
  const headers = Object.keys(EXCEL_COLUMN_MAP);
  const rows = wells.map((well) => {
    const row: Record<string, string | number | null> = {};
    for (const header of headers) {
      const key = EXCEL_COLUMN_MAP[header];
      row[header] = well[key as keyof WellRecord] ?? "";
    }
    for (const { excelHeader, key } of EXCEL_SPECIAL_COLUMN_BINDINGS) {
      const value = well[key];
      if (value) row[excelHeader] = value;
    }
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

export { REVERSE_MAP };
