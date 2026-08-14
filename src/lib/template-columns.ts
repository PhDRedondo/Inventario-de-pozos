import { EXCEL_COLUMN_MAP, THEMES } from "./catalogs";
import type { WellRecord } from "./types";

/**
 * Definición de las columnas de la plantilla descargable del cuaderno.
 *
 * La plantilla reutiliza los encabezados oficiales del formato ANH para las 29
 * columnas ya mapeadas en `EXCEL_COLUMN_MAP` (así el parser de carga las lee sin
 * cambios y el filtro por `OPERADORA` sigue funcionando), y usa encabezados
 * limpios y únicos para las 10 columnas «especiales» (coordenadas e inyección),
 * que hoy dependen de nombres frágiles generados por SheetJS (`__EMPTY`,
 * `Unnamed: 31`, `DIAS ACUMULADOS.1`, …). Esas columnas se registran en
 * `TEMPLATE_SPECIAL_COLUMN_MAP` para que el parser de carga también las reconozca.
 */

/** Encabezados limpios para las columnas que no están en EXCEL_COLUMN_MAP. */
const TEMPLATE_SPECIAL_HEADERS: Partial<Record<keyof WellRecord, string>> = {
  coord_bogota_x: "COORDENADA SUPERFICIE X (BOGOTÁ)",
  coord_bogota_y: "COORDENADA SUPERFICIE Y (BOGOTÁ)",
  coord_nacional_x: "COORDENADA SUPERFICIE X (NACIONAL)",
  coord_nacional_y: "COORDENADA SUPERFICIE Y (NACIONAL)",
  longitud: "LONGITUD (GEOGRÁFICA)",
  latitud: "LATITUD (GEOGRÁFICA)",
  iny_dias: "INYECCIÓN — DÍAS ACUMULADOS",
  iny_agua: "INYECCIÓN — AGUA ACUMULADA (BBL)",
  iny_gas: "INYECCIÓN — GAS ACUMULADO (KPC)",
  iny_otros: "INYECCIÓN — OTROS ACUMULADO",
};

/** Encabezado limpio → atributo, para que el parser de carga lea la plantilla. */
export const TEMPLATE_SPECIAL_COLUMN_MAP: Record<string, keyof WellRecord> = Object.fromEntries(
  Object.entries(TEMPLATE_SPECIAL_HEADERS).map(([key, header]) => [header, key as keyof WellRecord]),
) as Record<string, keyof WellRecord>;

/** Reverso de EXCEL_COLUMN_MAP: atributo → encabezado oficial. */
const REVERSE_EXCEL_HEADERS: Partial<Record<keyof WellRecord, string>> = {};
for (const [header, key] of Object.entries(EXCEL_COLUMN_MAP)) {
  REVERSE_EXCEL_HEADERS[key] = header;
}

export interface TemplateColumn {
  key: keyof WellRecord;
  /** Encabezado que se escribe en la fila 1 de la hoja INVENTARIO. */
  header: string;
  /** Etiqueta legible del atributo (para hoja de instrucciones). */
  label: string;
  /** select | text | number | coordinate */
  type: string;
  /** Clave de catálogo cuando el campo es una lista desplegable. */
  catalogKey?: string;
  required: boolean;
  themeId: string;
  themeTitle: string;
}

/** Columnas diligenciables de la plantilla, en el orden de los temas del formato. */
export const TEMPLATE_COLUMNS: TemplateColumn[] = THEMES.flatMap((theme) =>
  theme.fields
    .filter((field) => field.type !== "readonly")
    .map((field) => {
      const header = REVERSE_EXCEL_HEADERS[field.key] ?? TEMPLATE_SPECIAL_HEADERS[field.key];
      if (!header) {
        throw new Error(`No hay encabezado de plantilla definido para el atributo "${String(field.key)}"`);
      }
      return {
        key: field.key,
        header,
        label: field.label,
        type: field.type,
        catalogKey: field.catalogKey,
        required: Boolean(field.required),
        themeId: theme.id,
        themeTitle: theme.title,
      };
    }),
);
