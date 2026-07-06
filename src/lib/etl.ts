import seedData from "../../data/seed.json";
import { getAttributeLabel } from "./attributes";
import { fixEncoding, normalizeGeoName, sanitizeSpanishText } from "./geo";
import type { ValidationIssue, WellRecord } from "./types";

const EXTRA_DEPARTAMENTOS = ["OFFSHORE"] as const;

type GeographyResolution = {
  value: string | null;
  original: string | null;
  encodingRepaired: boolean;
  canonicalized: boolean;
  matched: boolean;
};

function getDaneDepartamentos(): Record<string, string> {
  return seedData.catalogs.departamentos_dane as Record<string, string>;
}

function getDaneMunicipios(): Record<string, { nombre: string; dept_code: string }> {
  return seedData.catalogs.municipios_dane as Record<string, { nombre: string; dept_code: string }>;
}

let departamentoLookup: Map<string, string> | null = null;
let municipioLookup: Map<string, { nombre: string; dept_code: string }> | null = null;

function getDepartamentoLookup(): Map<string, string> {
  if (departamentoLookup) return departamentoLookup;

  departamentoLookup = new Map<string, string>();
  for (const name of Object.values(getDaneDepartamentos())) {
    departamentoLookup.set(normalizeGeoName(name), name);
  }
  for (const extra of EXTRA_DEPARTAMENTOS) {
    departamentoLookup.set(normalizeGeoName(extra), extra);
  }
  return departamentoLookup;
}

function getMunicipioLookup(): Map<string, { nombre: string; dept_code: string }> {
  if (municipioLookup) return municipioLookup;

  municipioLookup = new Map();
  for (const info of Object.values(getDaneMunicipios())) {
    municipioLookup.set(normalizeGeoName(info.nombre), info);
  }
  return municipioLookup;
}

export function getCanonicalDepartamentoList(): string[] {
  const values = [...Object.values(getDaneDepartamentos()), ...EXTRA_DEPARTAMENTOS];
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));
}

export function resolveDepartamento(raw: string | null | undefined): GeographyResolution {
  if (!raw || raw.trim() === "") {
    return {
      value: null,
      original: raw ?? null,
      encodingRepaired: false,
      canonicalized: false,
      matched: false,
    };
  }

  const original = raw.trim();
  const repaired = sanitizeSpanishText(original);
  const encodingRepaired = repaired !== original;
  const canonical = getDepartamentoLookup().get(normalizeGeoName(repaired)) ?? null;

  return {
    value: canonical,
    original,
    encodingRepaired,
    canonicalized: Boolean(canonical && canonical !== original),
    matched: Boolean(canonical),
  };
}

export function resolveMunicipio(raw: string | null | undefined): GeographyResolution & { dept_code: string | null } {
  if (!raw || raw.trim() === "") {
    return {
      value: null,
      original: raw ?? null,
      encodingRepaired: false,
      canonicalized: false,
      matched: false,
      dept_code: null,
    };
  }

  const original = raw.trim();
  const repaired = sanitizeSpanishText(original);
  const encodingRepaired = repaired !== original;
  const match = getMunicipioLookup().get(normalizeGeoName(repaired)) ?? null;

  return {
    value: match?.nombre ?? null,
    original,
    encodingRepaired,
    canonicalized: Boolean(match && match.nombre !== original),
    matched: Boolean(match),
    dept_code: match?.dept_code ?? null,
  };
}

function geographyIssues(
  field: "departamento" | "municipio",
  label: string,
  resolution: GeographyResolution,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!resolution.original) return issues;

  if (!resolution.matched) {
    issues.push({
      field,
      severity: "error",
      message: `El valor "${resolution.original}" no corresponde al catálogo oficial de ${label}. La operadora debe corregirlo en el inventario.`,
      rule: "catalog_geography",
    });
    return issues;
  }

  if (resolution.encodingRepaired || resolution.canonicalized) {
    issues.push({
      field,
      severity: "warning",
      message: `El ${label.toLowerCase()} "${resolution.original}" fue normalizado a "${resolution.value}" durante la carga (codificación o formato).`,
      rule: "etl_geography",
    });
  }

  return issues;
}

export function normalizeWellRecordForIngest(record: WellRecord): {
  record: WellRecord;
  etlIssues: ValidationIssue[];
} {
  const etlIssues: ValidationIssue[] = [];
  const next: WellRecord = { ...record };

  const dept = resolveDepartamento(record.departamento);
  etlIssues.push(...geographyIssues("departamento", "Departamento", dept));
  if (dept.value) {
    next.departamento = dept.value;
  }

  const muni = resolveMunicipio(record.municipio);
  etlIssues.push(...geographyIssues("municipio", "Municipio", muni));
  if (muni.value) {
    next.municipio = muni.value;
  }
  if (muni.dept_code && !next.codigo_dane_depto) {
    next.codigo_dane_depto = muni.dept_code;
  }

  for (const key of [
    "operadora",
    "campo_avm",
    "nombre_pozo_sgc",
    "contrato",
    "locacion_cluster",
    "formacion_ruty",
    "yacimiento_ruty",
  ] as const) {
    const value = record[key];
    if (!value) continue;
    const repaired = sanitizeSpanishText(value);
    if (repaired !== value) {
      next[key] = repaired;
      etlIssues.push({
        field: key,
        severity: "warning",
        message: `El atributo "${getAttributeLabel(key)}" fue corregido por codificación de caracteres durante la carga.`,
        rule: "etl_encoding",
      });
    }
  }

  return { record: next, etlIssues };
}

export function dedupeDepartamentoOptions(values: string[]): string[] {
  const canonical = new Map<string, string>();

  for (const value of values) {
    const resolution = resolveDepartamento(value);
    const display = resolution.value ?? sanitizeSpanishText(value);
    const key = normalizeGeoName(display);
    if (!canonical.has(key)) {
      canonical.set(key, display);
    }
  }

  return [...canonical.values()].sort((a, b) => a.localeCompare(b, "es"));
}

export function isCanonicalDepartamento(value: string | null | undefined): boolean {
  if (!value) return true;
  return resolveDepartamento(value).matched;
}

export function repairDisplayText(value: string): string {
  return fixEncoding(value);
}
