import ExcelJS from "exceljs";
import { getCatalogs } from "./db";
import { TEMPLATE_COLUMNS } from "./template-columns";

export const TEMPLATE_MIN_ROWS = 1;
export const TEMPLATE_MAX_ROWS = 500;
export const TEMPLATE_DEFAULT_ROWS = 10;

const HEADER_FILL = "FF1A1A1A"; // ANH primary (negro)
const HEADER_REQUIRED_FILL = "FFFF8C00"; // ANH secondary (naranja) para obligatorios
const HEADER_FONT = "FFFFFFFF";
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD8E2EC" } },
  left: { style: "thin", color: { argb: "FFD8E2EC" } },
  bottom: { style: "thin", color: { argb: "FFD8E2EC" } },
  right: { style: "thin", color: { argb: "FFD8E2EC" } },
};

export function clampTemplateRows(raw: number | null | undefined): number {
  if (!Number.isFinite(raw ?? NaN)) return TEMPLATE_DEFAULT_ROWS;
  return Math.min(TEMPLATE_MAX_ROWS, Math.max(TEMPLATE_MIN_ROWS, Math.floor(raw as number)));
}

/** Opciones de un catálogo para las listas desplegables. */
function catalogOptions(catalogKey: string): string[] {
  const catalogs = getCatalogs() as Record<string, unknown>;

  if (catalogKey === "municipios") {
    const munis = catalogs.municipios_dane as Record<string, { nombre: string }> | undefined;
    if (!munis) return [];
    const names = Object.values(munis).map((m) => m.nombre);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, "es"));
  }

  const value = catalogs[catalogKey];
  if (Array.isArray(value)) return value.map((v) => String(v));
  return [];
}

/**
 * Genera la plantilla `.xlsx` del cuaderno: una hoja INVENTARIO con los
 * encabezados oficiales y `rows` filas listas para diligenciar, selectores en
 * las columnas de catálogo, una hoja Listas oculta con los valores permitidos y
 * una hoja de Instrucciones.
 */
export async function buildNotebookTemplate(options: {
  rows: number;
  operadora?: string | null;
}): Promise<Buffer> {
  const rows = clampTemplateRows(options.rows);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ANH — VIP (Validador del Inventario de Pozos)";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("INVENTARIO", {
    properties: { defaultRowHeight: 18 },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const listas = workbook.addWorksheet("Listas", { state: "hidden" });

  // 1) Hoja oculta de listas: una columna por catálogo usado.
  const rangeByCatalog = new Map<string, string>();
  let listCol = 1;
  const usedCatalogs = [...new Set(TEMPLATE_COLUMNS.filter((c) => c.catalogKey).map((c) => c.catalogKey!))];
  for (const catalogKey of usedCatalogs) {
    const options_ = catalogOptions(catalogKey);
    const colLetter = listas.getColumn(listCol).letter;
    listas.getCell(1, listCol).value = catalogKey;
    options_.forEach((opt, i) => {
      listas.getCell(i + 2, listCol).value = opt;
    });
    // Rango sin el encabezado (fila 1), referenciable en la validación.
    const lastRow = options_.length + 1;
    rangeByCatalog.set(catalogKey, `Listas!$${colLetter}$2:$${colLetter}$${Math.max(lastRow, 2)}`);
    listCol += 1;
  }

  // 2) Encabezados en la hoja INVENTARIO.
  sheet.columns = TEMPLATE_COLUMNS.map((col) => ({
    key: String(col.key),
    width: Math.min(38, Math.max(16, col.header.length + 2)),
  }));

  const headerRow = sheet.getRow(1);
  TEMPLATE_COLUMNS.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1);
    // El encabezado debe quedar EXACTO (sin sufijos) porque el parser de carga
    // usa este texto como llave. La obligatoriedad se indica con color y nota.
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: col.required ? HEADER_REQUIRED_FILL : HEADER_FILL },
    };
    cell.border = THIN_BORDER;
    if (col.required) {
      cell.note = "Campo obligatorio";
    }
  });
  headerRow.height = 34;

  // 3) Filas de datos: prellenar operadora y aplicar selectores.
  const operadora = options.operadora?.trim() || null;
  for (let r = 2; r <= rows + 1; r += 1) {
    TEMPLATE_COLUMNS.forEach((col, index) => {
      const cell = sheet.getCell(r, index + 1);
      cell.border = THIN_BORDER;

      if (col.key === "operadora" && operadora) {
        cell.value = operadora;
      }

      if (col.catalogKey) {
        const range = rangeByCatalog.get(col.catalogKey);
        if (range) {
          cell.dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [range],
            showErrorMessage: true,
            errorStyle: "warning",
            errorTitle: "Valor fuera de catálogo",
            error: "El valor no está en la lista oficial. Puede continuar, pero se marcará en la validación.",
          };
        }
      }
    });
  }

  // 4) Hoja de instrucciones.
  buildInstructionsSheet(workbook, rows);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function buildInstructionsSheet(workbook: ExcelJS.Workbook, rows: number) {
  const sheet = workbook.addWorksheet("Instrucciones", { properties: { defaultRowHeight: 18 } });
  sheet.getColumn(1).width = 4;
  sheet.getColumn(2).width = 100;

  const lines: Array<{ text: string; style?: "title" | "subtitle" | "bullet" }> = [
    { text: "Plantilla del cuaderno — Inventario de Pozos (VIP · ANH)", style: "title" },
    { text: "", },
    { text: `Esta plantilla se generó para registrar hasta ${rows} pozo(s).`, style: "subtitle" },
    { text: "" },
    { text: "Cómo diligenciarla:", style: "subtitle" },
    { text: "1. Diligencie una fila por pozo en la hoja «INVENTARIO». No cambie los encabezados de la fila 1.", style: "bullet" },
    { text: "2. Las columnas marcadas con « * » son obligatorias.", style: "bullet" },
    { text: "3. En las columnas con lista desplegable, elija un valor del selector (flecha a la derecha de la celda).", style: "bullet" },
    { text: "4. Los códigos DANE y el UWI fiscalizado se calculan automáticamente al cargar; no es necesario diligenciarlos.", style: "bullet" },
    { text: "5. Si necesita más filas, copie una fila existente hacia abajo para conservar los selectores.", style: "bullet" },
    { text: "6. Guarde el archivo en formato .xlsx y cárguelo en el cuaderno con «Validar y crear versión».", style: "bullet" },
    { text: "" },
    { text: "El sistema validará cada registro y le mostrará errores y advertencias por atributo.", style: "subtitle" },
  ];

  lines.forEach((line, i) => {
    const cell = sheet.getCell(i + 1, 2);
    cell.value = line.text;
    if (line.style === "title") {
      cell.font = { bold: true, size: 15, color: { argb: "FF1A1A1A" } };
    } else if (line.style === "subtitle") {
      cell.font = { bold: true, size: 11, color: { argb: "FF1A2B3C" } };
    } else {
      cell.font = { size: 11, color: { argb: "FF1A2B3C" } };
    }
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}
