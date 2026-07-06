import type { WellRecord } from "./types";

export interface UwiComponents {
  departamento: string;
  municipio: string;
  sigla: string;
  numero: string;
  cluster: string;
  angulo: string;
  trayectoria: string;
  objetivo: string;
  terminacion: string;
}

export interface UwiValidationIssue {
  field: string;
  severity: "error" | "warning";
  message: string;
  rule: string;
}

const ANGLE_CODES = ["H", "V", "D"] as const;
const TRAJECTORY_CODES = ["ST", "PR", "ML", "P", "G", "O"] as const;
const OBJECTIVE_CODES = ["EST", "P", "I", "M", "D"] as const;
const TERMINATION_CODES = ["CD", "LC", "LR", "GP", "CC", "OH", "O"] as const;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordsFrom(text: string): string[] {
  return text.split(" ").filter((w) => /[A-Z]/.test(w));
}

function numbersFrom(text: string): string[] {
  return text.match(/\d+/g) ?? [];
}

function extractCode(value: string | null | undefined, codes: readonly string[]): string {
  if (!value) return "";
  const normalized = normalizeText(value);
  const paren = normalized.match(/\(([A-Z]+)\)/);
  if (paren) {
    const hit = codes.find((c) => c === paren[1]);
    if (hit) return hit;
  }
  for (const code of codes) {
    if (normalized.startsWith(`${code} `) || normalized.startsWith(code)) return code;
  }
  return "";
}

function stripTechnicalSuffixes(nombre: string): string {
  let norm = normalizeText(nombre);
  norm = norm.replace(/\s*ST\d+\s*$/i, "");
  norm = norm.replace(/\s*\d+[HVD]\b\s*$/i, "");
  norm = norm.replace(/\s+\d+\s*$/i, "");
  norm = norm.replace(/[HVD]$/i, "");
  return norm.trim();
}

function extractTrajectory(value: string | null | undefined, wellName: string): string {
  const fromName = normalizeText(wellName);
  const nameSt = fromName.match(/\bST(\d+)\b/);
  if (nameSt) return `ST${nameSt[1]}`;

  const fromField = normalizeText(value ?? "");
  const fieldSt = fromField.match(/\bST\b.*?(\d+)/) ?? fromField.match(/\bST(\d+)\b/);
  if (fieldSt) return `ST${fieldSt[1] ?? ""}`;

  const fromFieldCode = extractCode(value, TRAJECTORY_CODES);
  if (fromFieldCode && fromFieldCode !== "ST") return fromFieldCode;
  if (fromField.includes("ST")) return "ST";

  return "";
}

function extractAngle(value: string | null | undefined, wellName: string): string {
  const fromField = extractCode(value, ANGLE_CODES);
  if (fromField) return fromField;

  const norm = normalizeText(wellName);
  if (/\bHZ\b|\d+H\b|H\s*ST|-H\b/.test(norm)) return "H";
  if (/\bV\b/.test(norm) && !norm.includes("VEN")) return "V";
  if (/\bD\b/.test(norm) && !norm.includes("DE")) return "D";
  return "";
}

/** Sigla del nombre del pozo — instructivo ANH abril 2026 */
export function buildWellSigla(nombrePozo: string, esEstratigrafico = false): string {
  const base = stripTechnicalSuffixes(nombrePozo);
  const words = wordsFrom(base);

  let sigla = "";
  if (words.length <= 1) {
    sigla = (words[0] ?? base).replace(/[^A-Z]/g, "").slice(0, 4);
  } else {
    sigla = words.map((word) => word.replace(/[^A-Z]/g, "").slice(0, 2)).join("");
  }

  return esEstratigrafico ? `ANH${sigla}` : sigla;
}

/** Número del pozo — máx. 4 dígitos con ceros a la izquierda */
export function extractWellNumber(nombrePozo: string): string {
  let norm = normalizeText(nombrePozo);
  norm = norm.replace(/\bST\d+\b/g, " ");
  const numbers = numbersFrom(norm);
  if (!numbers.length) return "0000";
  const main = numbers.length > 1 ? numbers[numbers.length - 2] : numbers[numbers.length - 1];
  const picked = numbers.find((n) => n.length >= 2) ?? main ?? numbers[0];
  return picked.padStart(4, "0").slice(-4);
}

/** Locación-clúster — instructivo ANH */
export function buildClusterCode(clusterName: string | null | undefined, wellName: string): string {
  const cluster = normalizeText(clusterName ?? "");
  const well = normalizeText(wellName);

  if (!cluster || cluster === well) return "C";

  const clusterWords = wordsFrom(cluster);
  const clusterNumbers = numbersFrom(cluster);

  if (clusterWords.length === 0 && clusterNumbers.length > 0) {
    return clusterNumbers[clusterNumbers.length - 1].padStart(4, "0").slice(-4);
  }

  let alpha = "";
  if (clusterWords.length >= 3) {
    alpha = clusterWords.map((w) => w[0]).join("");
  } else if (clusterWords.length === 2) {
    alpha = `${clusterWords[0][0]}${clusterWords[1][0]}`;
  } else if (clusterWords.length === 1) {
    alpha = clusterWords[0].slice(0, 2);
  }

  const num = clusterNumbers.length
    ? clusterNumbers[clusterNumbers.length - 1].padStart(4, "0").slice(-4)
    : "";

  if (alpha && num) return `${alpha}${num}`;
  if (alpha) return alpha;
  if (num) return num;
  return "C";
}

export function buildUwiComponents(record: WellRecord): UwiComponents | null {
  const nombre = record.nombre_pozo_sgc ?? record.nombre_pozo_forma_6cr ?? record.pozo_avm;
  if (!nombre) return null;

  const departamento = (record.codigo_dane_depto ?? "").replace(/\D/g, "").padStart(2, "0").slice(-2);
  const municipio = (record.codigo_dane_muni ?? "").replace(/\D/g, "").padStart(5, "0").slice(-3);

  if (!departamento || departamento === "00" || !municipio || municipio === "000") {
    return null;
  }

  const esEstratigrafico =
    (record.tipo_objetivo ?? "").toUpperCase().includes("EST") ||
    normalizeText(nombre).includes("ANH ");

  return {
    departamento,
    municipio,
    sigla: buildWellSigla(nombre, esEstratigrafico),
    numero: extractWellNumber(nombre),
    cluster: buildClusterCode(record.locacion_cluster, nombre),
    angulo: extractAngle(record.tipo_angulo, nombre),
    trayectoria: extractTrajectory(record.tipo_trayectoria, nombre),
    objetivo: extractCode(record.tipo_objetivo, OBJECTIVE_CODES),
    terminacion: extractCode(record.tipo_terminacion, TERMINATION_CODES),
  };
}

export function assembleUwi(components: UwiComponents, includeTerminacion = true): string {
  const core = `${components.departamento}${components.municipio}${components.sigla}${components.numero}${components.cluster}${components.angulo}${components.trayectoria}${components.objetivo}`;
  if (includeTerminacion && components.terminacion) {
    return `${core}-${components.terminacion}`;
  }
  return core;
}

export function generateUwiFiscalizado(record: WellRecord): string | null {
  const components = buildUwiComponents(record);
  if (!components) return null;
  return assembleUwi(components, Boolean(components.terminacion));
}

/** Valida cumplimiento del instructivo UWI ANH (abril 2026) */
export function validateUwiInstructivo(record: WellRecord): UwiValidationIssue[] {
  const issues: UwiValidationIssue[] = [];
  const nombre = record.nombre_pozo_sgc ?? record.nombre_pozo_forma_6cr ?? record.pozo_avm;
  const components = buildUwiComponents(record);

  if (!nombre) {
    issues.push({
      field: "nombre_pozo_sgc",
      severity: "error",
      message: "Se requiere el nombre del pozo para generar el UWI fiscalizado.",
      rule: "uwi_nombre",
    });
    return issues;
  }

  if (!record.codigo_dane_depto || !record.codigo_dane_muni) {
    issues.push({
      field: "codigo_dane_muni",
      severity: "error",
      message: "Código DANE departamental (2 dígitos) y municipal (3 dígitos) son obligatorios.",
      rule: "uwi_dane",
    });
  } else if (components) {
    if (!/^\d{2}$/.test(components.departamento)) {
      issues.push({
        field: "codigo_dane_depto",
        severity: "error",
        message: `Código departamental inválido: "${components.departamento}". Debe tener 2 dígitos.`,
        rule: "uwi_dane_depto",
      });
    }
    if (!/^\d{3}$/.test(components.municipio)) {
      issues.push({
        field: "codigo_dane_muni",
        severity: "error",
        message: `Código municipal inválido: "${components.municipio}". Debe tener 3 dígitos.`,
        rule: "uwi_dane_muni",
      });
    }
  }

  if (!record.tipo_angulo && !extractAngle(null, nombre)) {
    issues.push({
      field: "tipo_angulo",
      severity: "error",
      message: "Tipo de pozo por ángulo (H, V, D) es obligatorio para el UWI fiscalizado.",
      rule: "uwi_angulo",
    });
  }

  if (!record.tipo_trayectoria && !extractTrajectory(null, nombre)) {
    issues.push({
      field: "tipo_trayectoria",
      severity: "warning",
      message: "Trayectoria del pozo (ST, P, PR, ML, G, O) no definida; se omitirá en el UWI.",
      rule: "uwi_trayectoria",
    });
  }

  if (!record.tipo_objetivo) {
    issues.push({
      field: "tipo_objetivo",
      severity: "error",
      message: "Objetivo del pozo (P, I, M, D, EST) es obligatorio para el UWI fiscalizado.",
      rule: "uwi_objetivo",
    });
  }

  if (!components) return issues;

  if (!/^[A-Z]{4,}$/.test(components.sigla)) {
    issues.push({
      field: "nombre_pozo_sgc",
      severity: "error",
      message: `Sigla "${components.sigla}" no cumple: mínimo 4 caracteres alfabéticos según reglas del nombre.`,
      rule: "uwi_sigla",
    });
  }

  if (!/^\d{4}$/.test(components.numero)) {
    issues.push({
      field: "nombre_pozo_sgc",
      severity: "error",
      message: `Numeración "${components.numero}" debe ser exactamente 4 dígitos con ceros a la izquierda.`,
      rule: "uwi_numero",
    });
  }

  if (components.angulo && !ANGLE_CODES.includes(components.angulo as (typeof ANGLE_CODES)[number])) {
    issues.push({
      field: "tipo_angulo",
      severity: "error",
      message: `Código de ángulo "${components.angulo}" no válido. Use H, V o D.`,
      rule: "uwi_angulo_code",
    });
  }

  if (components.trayectoria && !/^ST\d*$|^PR$|^ML$|^P$|^G$|^O$/.test(components.trayectoria)) {
    issues.push({
      field: "tipo_trayectoria",
      severity: "error",
      message: `Trayectoria "${components.trayectoria}" no válida. Use ST[n], P, PR, ML, G u O.`,
      rule: "uwi_trayectoria_code",
    });
  }

  if (components.objetivo && !OBJECTIVE_CODES.includes(components.objetivo as (typeof OBJECTIVE_CODES)[number])) {
    issues.push({
      field: "tipo_objetivo",
      severity: "error",
      message: `Objetivo "${components.objetivo}" no válido. Use P, I, M, D o EST.`,
      rule: "uwi_objetivo_code",
    });
  }

  if (components.terminacion) {
    if (!TERMINATION_CODES.includes(components.terminacion as (typeof TERMINATION_CODES)[number])) {
      issues.push({
        field: "tipo_terminacion",
        severity: "error",
        message: `Terminación "${components.terminacion}" no válida.`,
        rule: "uwi_terminacion_code",
      });
    }
    if (components.terminacion === "OH" && !components.objetivo.includes("EST")) {
      issues.push({
        field: "tipo_terminacion",
        severity: "warning",
        message: "Hueco abierto (OH) solo aplica para pozos estratigráficos o excepciones aprobadas por la ANH.",
        rule: "uwi_terminacion_oh",
      });
    }
  } else {
    issues.push({
      field: "tipo_terminacion",
      severity: "warning",
      message: "Terminación no definida; el UWI se generará sin sufijo -[CD|LC|LR|GP|CC|OH|O].",
      rule: "uwi_terminacion_missing",
    });
  }

  const uwi = assembleUwi(components, Boolean(components.terminacion));
  if (!validateUwiFormat(uwi)) {
    issues.push({
      field: "uwi_fiscalizado",
      severity: "error",
      message: `El UWI "${uwi}" no cumple la estructura del instructivo.`,
      rule: "uwi_format",
    });
  }

  return issues;
}

export function validateUwiFormat(uwi: string | null | undefined): boolean {
  if (!uwi) return false;
  // [2 dept][3 muni][sigla 4+][4 num][cluster 1-7][HVD?][trayectoria?][objetivo]-[terminacion?]
  return /^\d{5}[A-Z]{4,}\d{4}[A-Z0-9]{1,7}[HVD]?(ST\d+|PR|ML|P|G|O)?(EST|P|I|M|D)?(-(CD|LC|LR|GP|CC|OH|O))?$/.test(uwi);
}

/** Casos de referencia del instructivo ANH */
export const INSTRUCTIVO_EXAMPLES: Array<{
  name: string;
  record: Partial<WellRecord>;
  expected: string;
}> = [
  {
    name: "RUBIALES 323 — cluster igual al pozo",
    record: {
      nombre_pozo_sgc: "RUBIALES 323",
      locacion_cluster: "RUBIALES 323",
      codigo_dane_depto: "50",
      codigo_dane_muni: "50568",
    },
    expected: "50568RUBI0323C",
  },
  {
    name: "MORICHE 56 — cluster solo numérico",
    record: {
      nombre_pozo_sgc: "MORICHE 56",
      locacion_cluster: "1289",
      codigo_dane_depto: "15",
      codigo_dane_muni: "15572",
    },
    expected: "15572MORI00561289",
  },
  {
    name: "RUBIALES 502 — cluster distinto",
    record: {
      nombre_pozo_sgc: "RUBIALES 502",
      locacion_cluster: "RUBIALES 323",
      codigo_dane_depto: "50",
      codigo_dane_muni: "50568",
    },
    expected: "50568RUBI0502RU0323",
  },
  {
    name: "LA CIRA 2",
    record: {
      nombre_pozo_sgc: "LA CIRA 2",
      locacion_cluster: "LA CIRA 2",
      codigo_dane_depto: "68",
      codigo_dane_muni: "68081",
    },
    expected: "68081LACI0002C",
  },
  {
    name: "LA CIRA 410 / cluster LA CIRA 289",
    record: {
      nombre_pozo_sgc: "LA CIRA 410",
      locacion_cluster: "LA CIRA 289",
      codigo_dane_depto: "68",
      codigo_dane_muni: "68081",
    },
    expected: "68081LACI0410LC0289",
  },
  {
    name: "CHICHIMENE SOUTH WEST 17",
    record: {
      nombre_pozo_sgc: "CHICHIMENE SOUTH WEST 17",
      locacion_cluster: "CHICHIMENE SOUTH WEST 23",
      codigo_dane_depto: "50",
      codigo_dane_muni: "50006",
    },
    expected: "50006CHSOWE0017CSW0023",
  },
  {
    name: "MORICHE 320H ST3",
    record: {
      nombre_pozo_sgc: "MORICHE 320H ST3",
      locacion_cluster: "1289",
      codigo_dane_depto: "15",
      codigo_dane_muni: "15572",
      tipo_angulo: "H (horizontal)",
      tipo_trayectoria: "ST (Sidetrack)",
    },
    expected: "15572MORI03201289HST3",
  },
  {
    name: "AMBAR 157H ST1 con terminación",
    record: {
      nombre_pozo_sgc: "AMBAR 157H ST1",
      locacion_cluster: "AMBAR 116",
      codigo_dane_depto: "50",
      codigo_dane_muni: "50568",
      tipo_angulo: "H (horizontal)",
      tipo_trayectoria: "ST (Sidetrack)",
      tipo_objetivo: "P (Productor)",
      tipo_terminacion: "LR (Liner Ranurado)",
    },
    expected: "50568AMBA0157AM0116HST1P-LR",
  },
];
