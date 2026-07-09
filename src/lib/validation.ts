import { getAttributeLabel } from "./attributes";
import seedData from "../../data/seed.json";
import { isCanonicalDepartamento } from "./etl";
import { generateUwiFiscalizado, validateUwiFormat, validateUwiInstructivo } from "./uwi";
import type { ValidationIssue, ValidationResult, WellRecord } from "./types";

type Catalogs = Record<string, string[] | Record<string, string | { nombre: string; dept_code: string }>>;

const catalogs = seedData.catalogs as Catalogs;

function isInCatalog(key: string, value: string | null | undefined): boolean {
  if (!value) return true;
  const catalog = catalogs[key];
  if (!catalog) return true;
  if (Array.isArray(catalog)) {
    return catalog.includes(value);
  }
  return true;
}

function isNumeric(value: string | null | undefined): boolean {
  if (!value) return true;
  return !Number.isNaN(Number(value.replace(/,/g, "")));
}

function isCoordinate(value: string | null | undefined): boolean {
  if (!value) return true;
  return /^-?\d+(\.\d+)?$/.test(value.replace(/,/g, "").trim());
}

function isLatLong(value: string | null | undefined): boolean {
  if (!value) return true;
  const num = Number(value.replace(/,/g, "").trim());
  return !Number.isNaN(num) && Math.abs(num) <= 180;
}

function requiresLevantamiento(record: WellRecord): boolean {
  return (record.tipo_objetivo ?? "").toUpperCase().startsWith("P");
}

function requiresAvmFields(record: WellRecord): boolean {
  const flag = (record.pozo_existente_avm ?? "").toUpperCase();
  return flag.includes("MANTIENE") || flag.includes("MODIFIC");
}

export function validateWell(
  record: WellRecord,
  rowNumber?: number,
  extraIssues: ValidationIssue[] = [],
): ValidationResult {
  const issues: ValidationIssue[] = [...extraIssues];

  const requiredFields: Array<{ key: keyof WellRecord; label: string }> = [
    { key: "pozo_existente_avm", label: "¿Pozo existente en AVM ANH?" },
    { key: "operadora", label: "Operadora" },
    { key: "contrato", label: "Contrato según AVM ANH" },
    { key: "campo_avm", label: "Campo AVM" },
    { key: "nombre_pozo_sgc", label: "Nombre pozo (SGC)" },
    { key: "estado_pozo", label: "Estado del pozo" },
    { key: "departamento", label: "Departamento" },
    { key: "municipio", label: "Municipio" },
  ];

  for (const field of requiredFields) {
    if (!record[field.key] || String(record[field.key]).trim() === "") {
      issues.push({
        field: field.key,
        severity: "error",
        message: `El atributo "${field.label}" es obligatorio.`,
        rule: "required",
      });
    }
  }

  const selectChecks: Array<{ key: keyof WellRecord; catalog: string; label: string }> = [
    { key: "pozo_existente_avm", catalog: "pozo_existente_avm", label: "¿Pozo existente en AVM ANH?" },
    { key: "operadora", catalog: "operadoras", label: "Operadora" },
    { key: "contrato", catalog: "contratos", label: "Contrato según AVM ANH" },
    { key: "campo_avm", catalog: "campos_avm", label: "Campo AVM" },
    { key: "formacion_ruty", catalog: "formaciones_ruty", label: "Formación RUTY" },
    { key: "yacimiento_ruty", catalog: "yacimientos_ruty", label: "Yacimiento RUTY" },
    { key: "tipo_angulo", catalog: "tipo_angulo", label: "Tipo de pozo por ángulo" },
    { key: "tipo_trayectoria", catalog: "tipo_trayectoria", label: "Tipo de pozo por trayectoria" },
    { key: "tipo_objetivo", catalog: "tipo_objetivo", label: "Tipo de pozo por objetivo" },
    { key: "tipo_terminacion", catalog: "tipo_terminacion", label: "Tipo de terminación" },
    { key: "sistema_levantamiento", catalog: "sistema_levantamiento", label: "Sistema de levantamiento" },
    { key: "estado_pozo", catalog: "estado_pozo", label: "Estado del pozo" },
    { key: "departamento", catalog: "departamentos", label: "Departamento" },
  ];

  for (const check of selectChecks) {
    const value = record[check.key] as string | null;
    if (!value) continue;

    if (check.catalog === "departamentos") {
      if (!isCanonicalDepartamento(value)) {
        issues.push({
          field: check.key,
          severity: "error",
          message: `El valor "${value}" no está en la lista oficial de departamentos (DANE).`,
          rule: "catalog",
        });
      }
      continue;
    }

    if (!isInCatalog(check.catalog, value)) {
      issues.push({
        field: check.key,
        severity: "error",
        message: `El valor "${value}" no está en la lista permitida para "${check.label}".`,
        rule: "catalog",
      });
    }
  }

  if (requiresAvmFields(record)) {
    for (const key of ["pozo_avm", "formacion_avm", "pozo_formacion_avm"] as const) {
      if (!record[key]) {
        issues.push({
          field: key,
          severity: "warning",
          message: `Para registros de mantenimiento o modificación se recomienda diligenciar el atributo "${getAttributeLabel(key)}".`,
          rule: "conditional_required",
        });
      }
    }
  }

  if (requiresLevantamiento(record) && !record.sistema_levantamiento) {
    issues.push({
      field: "sistema_levantamiento",
      severity: "warning",
      message: "Los pozos productores deben reportar el sistema de levantamiento.",
      rule: "conditional_required",
    });
  }

  const numericFields: Array<{ key: keyof WellRecord; label: string }> = [
    { key: "prod_dias", label: "Días acumulados (producción)" },
    { key: "prod_petroleo", label: "Petróleo acumulado" },
    { key: "prod_agua", label: "Agua acumulada (producción)" },
    { key: "prod_gas", label: "Gas acumulado (producción)" },
    { key: "iny_dias", label: "Días acumulados (inyección)" },
    { key: "iny_agua", label: "Agua acumulada (inyección)" },
    { key: "iny_gas", label: "Gas acumulado (inyección)" },
    { key: "iny_otros", label: "Otros acumulado" },
  ];

  for (const field of numericFields) {
    if (!isNumeric(record[field.key] as string | null)) {
      issues.push({
        field: field.key,
        severity: "error",
        message: `"${field.label}" debe ser numérico.`,
        rule: "numeric",
      });
    }
  }

  for (const key of ["coord_bogota_x", "coord_bogota_y", "coord_nacional_x", "coord_nacional_y"] as const) {
    if (!isCoordinate(record[key])) {
      issues.push({
        field: key,
        severity: "error",
        message: `El atributo "${getAttributeLabel(key)}" no tiene formato numérico válido.`,
        rule: "coordinate",
      });
    }
  }

  if (!isLatLong(record.longitud)) {
    issues.push({
      field: "longitud",
      severity: "error",
      message: "La longitud debe estar entre -180 y 180 grados.",
      rule: "coordinate",
    });
  }

  if (!isLatLong(record.latitud)) {
    issues.push({
      field: "latitud",
      severity: "error",
      message: "La latitud debe estar entre -90 y 90 grados.",
      rule: "coordinate",
    });
  }

  const uwiFiscalizado = generateUwiFiscalizado(record);
  const uwiIssues = validateUwiInstructivo({ ...record, uwi_fiscalizado: uwiFiscalizado });

  for (const issue of uwiIssues) {
    issues.push({
      field: issue.field,
      severity: issue.severity,
      message: issue.message,
      rule: issue.rule,
    });
  }

  if (!uwiFiscalizado && uwiIssues.length === 0) {
    issues.push({
      field: "uwi_fiscalizado",
      severity: "warning",
      message: "No fue posible generar el UWI fiscalizado. Verifique códigos DANE, nombre del pozo y clasificación técnica.",
      rule: "uwi_generation",
    });
  }

  if (record.uwi_sgc && uwiFiscalizado && record.uwi_sgc !== uwiFiscalizado) {
    issues.push({
      field: "uwi_sgc",
      severity: "info",
      message: `El UWI SGC (${record.uwi_sgc}) difiere del UWI fiscalizado generado (${uwiFiscalizado}).`,
      rule: "uwi_consistency",
    });
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return {
    well_id: record.id,
    row_number: rowNumber,
    operadora: record.operadora,
    nombre_pozo_sgc: record.nombre_pozo_sgc,
    is_valid: errorCount === 0,
    error_count: errorCount,
    warning_count: warningCount,
    issues,
    uwi_fiscalizado: uwiFiscalizado,
  };
}

export function summarizeValidation(results: ValidationResult[]) {
  return {
    total: results.length,
    valid: results.filter((r) => r.is_valid && r.warning_count === 0).length,
    with_warnings: results.filter((r) => r.is_valid && r.warning_count > 0).length,
    invalid: results.filter((r) => !r.is_valid).length,
    error_total: results.reduce((sum, r) => sum + r.error_count, 0),
    warning_total: results.reduce((sum, r) => sum + r.warning_count, 0),
  };
}

/** Active checks in validateWell plus UWI instructivo rules (abril 2026). */
export function getActiveValidationRuleCount(): number {
  const requiredFields = 8;
  const selectChecks = 13;
  const conditionalAvm = 3;
  const levantamiento = 1;
  const numericFields = 8;
  const projectedCoords = 4;
  const latLong = 2;
  const uwiGeneration = 1;
  const uwiConsistency = 1;
  const uwiInstructivo = 18;
  return (
    requiredFields +
    selectChecks +
    conditionalAvm +
    levantamiento +
    numericFields +
    projectedCoords +
    latLong +
    uwiGeneration +
    uwiConsistency +
    uwiInstructivo
  );
}
