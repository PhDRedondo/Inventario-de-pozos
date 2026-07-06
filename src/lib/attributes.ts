import { THEMES } from "./catalogs";
import type { WellRecord } from "./types";

/** Etiquetas oficiales de cada atributo del formato ANH (fila «Atributo» del Excel). */
export function buildAttributeLabelMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const theme of THEMES) {
    for (const field of theme.fields) {
      map[String(field.key)] = field.label;
    }
  }
  return map;
}

export const ATTRIBUTE_LABELS = buildAttributeLabelMap();

/** 40 atributos persistidos por pozo (39 del Excel + UWI fiscalizado generado). */
export const ALL_WELL_ATTRIBUTE_KEYS = Object.keys(ATTRIBUTE_LABELS) as (keyof WellRecord)[];

export function getAttributeLabel(key: string): string {
  return ATTRIBUTE_LABELS[key] ?? key.replace(/_/g, " ");
}

/** Columnas del Excel no incluidas en EXCEL_COLUMN_MAP (posición especial en la plantilla). */
export const EXCEL_SPECIAL_COLUMN_BINDINGS: Array<{
  excelHeader: string;
  key: keyof WellRecord;
}> = [
  { excelHeader: "Coordenadas Planas Origen Bogotá", key: "coord_bogota_x" },
  { excelHeader: "__EMPTY", key: "coord_bogota_y" },
  { excelHeader: "Coordenadas Planas Origen Nacional", key: "coord_nacional_x" },
  { excelHeader: "Unnamed: 31", key: "coord_nacional_y" },
  { excelHeader: "Coordenadas Geograficas", key: "longitud" },
  { excelHeader: "Unnamed: 33", key: "latitud" },
  { excelHeader: "DIAS ACUMULADOS.1", key: "iny_dias" },
  { excelHeader: "AGUA ACUMULADA (BBL).1", key: "iny_agua" },
  { excelHeader: "GAS ACUMULADO  (KPC).1", key: "iny_gas" },
  { excelHeader: "OTROS ACUMULADO", key: "iny_otros" },
];

export function getExcelAttributeCoverage(): {
  mappedInExcel: number;
  specialColumns: number;
  generated: string[];
  totalPersisted: number;
} {
  return {
    mappedInExcel: 29,
    specialColumns: EXCEL_SPECIAL_COLUMN_BINDINGS.length,
    generated: ["uwi_fiscalizado"],
    totalPersisted: ALL_WELL_ATTRIBUTE_KEYS.length,
  };
}
