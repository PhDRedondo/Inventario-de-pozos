import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import seedData from "../../data/seed.json";
import { dedupeDepartamentoOptions, getCanonicalDepartamentoList, normalizeWellRecordForIngest } from "./etl";
import { normalizeGeoName } from "./geo";
import { validateWell } from "./validation";
import { generateUwiFiscalizado } from "./uwi";
import type { DashboardFilters, DashboardStats, DashboardSankeyData, DataScope, UploadBatch, ValidationResult, WellMapPoint, WellRecord } from "./types";
import { initAuthSchema, writeAuditLog } from "./auth-db";

import { getDbPath, getDataDir } from "./paths";

const DATA_DIR = getDataDir();
const DB_PATH = getDbPath();

let db: Database.Database | null = null;
let uwisRecomputed = false;
let geographyRenormalized = false;

function ensureDataDir() {
  getDataDir();
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      operadora TEXT,
      total_records INTEGER DEFAULT 0,
      valid_records INTEGER DEFAULT 0,
      invalid_records INTEGER DEFAULT 0,
      warning_records INTEGER DEFAULT 0,
      status TEXT DEFAULT 'processed',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wells (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upload_id INTEGER,
      pozo_existente_avm TEXT,
      operadora TEXT,
      contrato TEXT,
      campo_avm TEXT,
      pozo_formacion_avm TEXT,
      pozo_avm TEXT,
      formacion_avm TEXT,
      formacion_forma_9sh TEXT,
      formacion_ruty TEXT,
      yacimiento_ruty TEXT,
      tipo_angulo TEXT,
      tipo_trayectoria TEXT,
      tipo_objetivo TEXT,
      tipo_terminacion TEXT,
      sistema_levantamiento TEXT,
      clasificacion_lahee TEXT,
      nombre_pozo_forma_6cr TEXT,
      uwi_sgc TEXT,
      uwi_fiscalizado TEXT,
      nombre_pozo_sgc TEXT,
      estado_pozo TEXT,
      departamento TEXT,
      municipio TEXT,
      codigo_dane_depto TEXT,
      codigo_dane_muni TEXT,
      locacion_cluster TEXT,
      coord_bogota_x TEXT,
      coord_bogota_y TEXT,
      coord_nacional_x TEXT,
      coord_nacional_y TEXT,
      longitud TEXT,
      latitud TEXT,
      prod_dias TEXT,
      prod_petroleo TEXT,
      prod_agua TEXT,
      prod_gas TEXT,
      iny_dias TEXT,
      iny_agua TEXT,
      iny_gas TEXT,
      iny_otros TEXT,
      validation_status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (upload_id) REFERENCES uploads(id)
    );

    CREATE TABLE IF NOT EXISTS validation_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      well_id INTEGER NOT NULL,
      field TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      rule TEXT NOT NULL,
      FOREIGN KEY (well_id) REFERENCES wells(id)
    );

    CREATE INDEX IF NOT EXISTS idx_wells_operadora ON wells(operadora);
    CREATE INDEX IF NOT EXISTS idx_wells_estado ON wells(estado_pozo);
    CREATE INDEX IF NOT EXISTS idx_wells_upload ON wells(upload_id);
  `);
}

function seedIfEmpty(database: Database.Database) {
  const count = database.prepare("SELECT COUNT(*) as c FROM wells").get() as { c: number };
  if (count.c > 0) return;

  const upload = database
    .prepare(
      `INSERT INTO uploads (filename, operadora, total_records, valid_records, invalid_records, warning_records, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("FORMATO INVENTARIO POZOS ANH.xlsx (semilla)", "Múltiples operadoras", 0, 0, 0, 0, "seed");

  const uploadId = Number(upload.lastInsertRowid);
  let valid = 0;
  let invalid = 0;
  let warnings = 0;

  const insertWell = database.prepare(`
    INSERT INTO wells (
      upload_id, pozo_existente_avm, operadora, contrato, campo_avm, pozo_formacion_avm, pozo_avm,
      formacion_avm, formacion_forma_9sh, formacion_ruty, yacimiento_ruty, tipo_angulo, tipo_trayectoria,
      tipo_objetivo, tipo_terminacion, sistema_levantamiento, clasificacion_lahee, nombre_pozo_forma_6cr,
      uwi_sgc, uwi_fiscalizado, nombre_pozo_sgc, estado_pozo, departamento, municipio, codigo_dane_depto,
      codigo_dane_muni, locacion_cluster, coord_bogota_x, coord_bogota_y, coord_nacional_x, coord_nacional_y,
      longitud, latitud, prod_dias, prod_petroleo, prod_agua, prod_gas, iny_dias, iny_agua, iny_gas,
      iny_otros, validation_status
    ) VALUES (
      @upload_id, @pozo_existente_avm, @operadora, @contrato, @campo_avm, @pozo_formacion_avm, @pozo_avm,
      @formacion_avm, @formacion_forma_9sh, @formacion_ruty, @yacimiento_ruty, @tipo_angulo, @tipo_trayectoria,
      @tipo_objetivo, @tipo_terminacion, @sistema_levantamiento, @clasificacion_lahee, @nombre_pozo_forma_6cr,
      @uwi_sgc, @uwi_fiscalizado, @nombre_pozo_sgc, @estado_pozo, @departamento, @municipio, @codigo_dane_depto,
      @codigo_dane_muni, @locacion_cluster, @coord_bogota_x, @coord_bogota_y, @coord_nacional_x, @coord_nacional_y,
      @longitud, @latitud, @prod_dias, @prod_petroleo, @prod_agua, @prod_gas, @iny_dias, @iny_agua, @iny_gas,
      @iny_otros, @validation_status
    )
  `);

  const insertIssue = database.prepare(`
    INSERT INTO validation_issues (well_id, field, severity, message, rule)
    VALUES (@well_id, @field, @severity, @message, @rule)
  `);

  const depts = seedData.catalogs.departamentos_dane as Record<string, string>;
  const munis = seedData.catalogs.municipios_dane as Record<string, { nombre: string; dept_code: string }>;

  const deptNameToCode = Object.fromEntries(
    Object.entries(depts).map(([code, name]) => [name.toUpperCase(), code]),
  );

  const muniNameToCode: Record<string, string> = {};
  for (const [code, info] of Object.entries(munis)) {
    muniNameToCode[info.nombre.toUpperCase()] = code;
  }

  const tx = database.transaction(() => {
    for (const raw of seedData.records) {
      const { record: normalized } = normalizeWellRecordForIngest({ ...raw } as WellRecord);
      const record = { ...normalized, ...resolveDaneCodes(normalized.departamento, normalized.municipio) };

      const validation = validateWell(record);
      record.uwi_fiscalizado = validation.uwi_fiscalizado;
      record.validation_status = validation.is_valid
        ? validation.warning_count > 0
          ? "warning"
          : "valid"
        : "invalid";

      const result = insertWell.run({
        upload_id: uploadId,
        ...record,
        uwi_fiscalizado: validation.uwi_fiscalizado,
        validation_status: record.validation_status,
      });

      const wellId = Number(result.lastInsertRowid);
      for (const issue of validation.issues) {
        insertIssue.run({ well_id: wellId, ...issue });
      }

      if (!validation.is_valid) invalid++;
      else if (validation.warning_count > 0) warnings++;
      else valid++;
    }
  });

  tx();

  database
    .prepare(
      `UPDATE uploads SET total_records = ?, valid_records = ?, invalid_records = ?, warning_records = ? WHERE id = ?`,
    )
    .run(seedData.records.length, valid, invalid, warnings, uploadId);
}

export function getDb() {
  if (!db) {
    ensureDataDir();
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initSchema(db);
    initAuthSchema();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./notebook-db").initNotebookSchema();
    seedIfEmpty(db);
    if (!uwisRecomputed) {
      recomputeStoredUwis(db);
      uwisRecomputed = true;
    }
    if (!geographyRenormalized) {
      renormalizeGeographyInDb(db);
      geographyRenormalized = true;
    }
  }
  return db;
}

function recomputeStoredUwis(database: Database.Database) {
  const wells = database.prepare("SELECT * FROM wells").all() as WellRecord[];
  if (!wells.length) return;

  const updateWell = database.prepare(
    "UPDATE wells SET uwi_fiscalizado = ?, validation_status = ? WHERE id = ?",
  );
  const deleteIssues = database.prepare("DELETE FROM validation_issues WHERE well_id = ?");
  const insertIssue = database.prepare(
    "INSERT INTO validation_issues (well_id, field, severity, message, rule) VALUES (?, ?, ?, ?, ?)",
  );

  const tx = database.transaction(() => {
    for (const well of wells) {
      const validation = validateWell(well);
      const status = validation.is_valid
        ? validation.warning_count > 0
          ? "warning"
          : "valid"
        : "invalid";
      updateWell.run(validation.uwi_fiscalizado, status, well.id);
      deleteIssues.run(well.id);
      for (const issue of validation.issues) {
        insertIssue.run(well.id, issue.field, issue.severity, issue.message, issue.rule);
      }
    }
  });
  tx();
}

const WELL_FIELDS = [
  "pozo_existente_avm", "operadora", "contrato", "campo_avm", "pozo_formacion_avm", "pozo_avm",
  "formacion_avm", "formacion_forma_9sh", "formacion_ruty", "yacimiento_ruty", "tipo_angulo",
  "tipo_trayectoria", "tipo_objetivo", "tipo_terminacion", "sistema_levantamiento",
  "clasificacion_lahee", "nombre_pozo_forma_6cr", "uwi_sgc", "uwi_fiscalizado", "nombre_pozo_sgc",
  "estado_pozo", "departamento", "municipio", "codigo_dane_depto", "codigo_dane_muni",
  "locacion_cluster", "coord_bogota_x", "coord_bogota_y", "coord_nacional_x", "coord_nacional_y",
  "longitud", "latitud", "prod_dias", "prod_petroleo", "prod_agua", "prod_gas",
  "iny_dias", "iny_agua", "iny_gas", "iny_otros",
] as const;

function renormalizeGeographyInDb(database: Database.Database) {
  const wells = database.prepare("SELECT * FROM wells").all() as WellRecord[];
  if (!wells.length) return;

  const updateWell = database.prepare(
    `UPDATE wells SET departamento = ?, municipio = ?, codigo_dane_depto = ?, codigo_dane_muni = ?,
     uwi_fiscalizado = ?, validation_status = ? WHERE id = ?`,
  );
  const deleteIssues = database.prepare("DELETE FROM validation_issues WHERE well_id = ?");
  const insertIssue = database.prepare(
    "INSERT INTO validation_issues (well_id, field, severity, message, rule) VALUES (?, ?, ?, ?, ?)",
  );

  const tx = database.transaction(() => {
    for (const well of wells) {
      const { record: normalized, etlIssues } = normalizeWellRecordForIngest(well);
      const withCodes = { ...normalized, ...resolveDaneCodes(normalized.departamento, normalized.municipio) };
      const validation = validateWell(withCodes, undefined, etlIssues);
      const status = validation.is_valid
        ? validation.warning_count > 0
          ? "warning"
          : "valid"
        : "invalid";

      updateWell.run(
        withCodes.departamento ?? null,
        withCodes.municipio ?? null,
        withCodes.codigo_dane_depto ?? null,
        withCodes.codigo_dane_muni ?? null,
        validation.uwi_fiscalizado,
        status,
        well.id,
      );

      deleteIssues.run(well.id);
      for (const issue of validation.issues) {
        insertIssue.run(well.id, issue.field, issue.severity, issue.message, issue.rule);
      }
    }
  });
  tx();
}

export function saveWell(record: WellRecord, uploadId?: number | null): { well: WellRecord; validation: ValidationResult } {
  const database = getDb();
  const { record: normalized, etlIssues } = normalizeWellRecordForIngest(record);
  const withCodes = { ...normalized, ...resolveDaneCodes(normalized.departamento, normalized.municipio) };
  const validation = validateWell(withCodes, undefined, etlIssues);
  withCodes.uwi_fiscalizado = validation.uwi_fiscalizado;
  withCodes.validation_status = validation.is_valid
    ? validation.warning_count > 0
      ? "warning"
      : "valid"
    : "invalid";

  const placeholders = WELL_FIELDS.map((f) => `@${f}`).join(", ");
  const result = database
    .prepare(`INSERT INTO wells (upload_id, ${WELL_FIELDS.join(", ")}, validation_status) VALUES (@upload_id, ${placeholders}, @validation_status)`)
    .run({ upload_id: uploadId ?? null, ...pickWellFields(withCodes), validation_status: withCodes.validation_status });

  const wellId = Number(result.lastInsertRowid);
  const insertIssue = database.prepare(
    `INSERT INTO validation_issues (well_id, field, severity, message, rule) VALUES (?, ?, ?, ?, ?)`,
  );
  for (const issue of validation.issues) {
    insertIssue.run(wellId, issue.field, issue.severity, issue.message, issue.rule);
  }

  return { well: { ...withCodes, id: wellId }, validation };
}

export function saveUploadBatch(
  filename: string,
  operadora: string | null,
  records: WellRecord[],
  options?: {
    status?: string;
    forceOperadora?: string | null;
    notebookId?: number;
    versionNumber?: number;
  },
): { upload: UploadBatch; results: ValidationResult[] } {
  const database = getDb();
  let valid = 0;
  let invalid = 0;
  let warnings = 0;
  const results: ValidationResult[] = [];
  const batchStatus = options?.status ?? "processed";
  const forcedOperadora = options?.forceOperadora ?? operadora;

  const uploadResult = database
    .prepare(
      `INSERT INTO uploads (filename, operadora, total_records, status, notebook_id, version_number)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      filename,
      forcedOperadora,
      records.length,
      batchStatus,
      options?.notebookId ?? null,
      options?.versionNumber ?? null,
    );
  const uploadId = Number(uploadResult.lastInsertRowid);

  const tx = database.transaction(() => {
    for (let i = 0; i < records.length; i++) {
      const record =
        forcedOperadora && options?.forceOperadora
          ? { ...records[i], operadora: forcedOperadora }
          : records[i];
      const { validation } = saveWell(record, uploadId);
      validation.row_number = i + 1;
      results.push(validation);
      if (!validation.is_valid) invalid++;
      else if (validation.warning_count > 0) warnings++;
      else valid++;
    }
  });
  tx();

  database
    .prepare(
      `UPDATE uploads SET valid_records = ?, invalid_records = ?, warning_records = ?, status = ? WHERE id = ?`,
    )
    .run(valid, invalid, warnings, batchStatus === "processing" ? "processed" : batchStatus, uploadId);

  const upload = database.prepare("SELECT * FROM uploads WHERE id = ?").get(uploadId) as UploadBatch;
  return { upload, results };
}

function pickWellFields(record: WellRecord) {
  return Object.fromEntries(WELL_FIELDS.map((f) => [f, record[f] ?? null]));
}

export function getOperadorasSummary(scope?: DataScope | null) {
  const database = getDb();
  const { clause, params } = buildScopeClause(scope);
  return database
    .prepare(
      `SELECT operadora,
              COUNT(*) as total_pozos,
              SUM(CASE WHEN validation_status = 'valid' THEN 1 ELSE 0 END) as validos,
              SUM(CASE WHEN validation_status = 'warning' THEN 1 ELSE 0 END) as advertencias,
              SUM(CASE WHEN validation_status = 'invalid' THEN 1 ELSE 0 END) as errores
       FROM wells
       WHERE operadora IS NOT NULL AND operadora != '' AND ${clause}
       GROUP BY operadora
       ORDER BY total_pozos DESC`,
    )
    .all(...params) as Array<{
      operadora: string;
      total_pozos: number;
      validos: number;
      advertencias: number;
      errores: number;
    }>;
}

export function listWells(filters?: DashboardFilters, scope?: DataScope | null) {
  const database = getDb();
  const { where, params } = buildFilterClause(filters, undefined, scope);
  const query = `SELECT * FROM wells WHERE ${where} ORDER BY id DESC LIMIT 500`;
  return database.prepare(query).all(...params) as WellRecord[];
}

export function listWellsForMap(filters?: DashboardFilters, scope?: DataScope | null): WellMapPoint[] {
  const database = getDb();
  const { where, params } = buildFilterClause(filters, undefined, scope);

  const rows = database
    .prepare(
      `SELECT id, nombre_pozo_sgc, operadora, departamento, municipio, estado_pozo,
              validation_status, uwi_fiscalizado, longitud, latitud
       FROM wells
       WHERE ${where}
         AND longitud IS NOT NULL AND latitud IS NOT NULL
         AND longitud != '' AND latitud != ''
       ORDER BY id DESC LIMIT 1000`,
    )
    .all(...params) as Array<{
      id: number;
      nombre_pozo_sgc: string | null;
      operadora: string | null;
      departamento: string | null;
      municipio: string | null;
      estado_pozo: string | null;
      validation_status: string | null;
      uwi_fiscalizado: string | null;
      longitud: string;
      latitud: string;
    }>;

  return rows
    .map((row) => {
      const lng = Number(String(row.longitud).replace(/,/g, ""));
      const lat = Number(String(row.latitud).replace(/,/g, ""));
      if (Number.isNaN(lat) || Number.isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return null;
      }
      if (lat < -5 || lat > 16 || lng < -82 || lng > -66) return null;
      return {
        id: row.id,
        nombre_pozo_sgc: row.nombre_pozo_sgc,
        operadora: row.operadora,
        departamento: row.departamento,
        municipio: row.municipio,
        estado_pozo: row.estado_pozo,
        validation_status: row.validation_status,
        uwi_fiscalizado: row.uwi_fiscalizado,
        lat,
        lng,
      };
    })
    .filter((p): p is WellMapPoint => p !== null);
}

export function getWell(id: number, scope?: DataScope | null) {
  const database = getDb();
  const { clause, params } = buildScopeClause(scope);
  const well = database
    .prepare(`SELECT * FROM wells WHERE id = ? AND ${clause}`)
    .get(id, ...params) as WellRecord | undefined;
  if (!well) return null;
  const issues = database
    .prepare("SELECT field, severity, message, rule FROM validation_issues WHERE well_id = ?")
    .all(id);
  return { well, issues };
}

export function getValidationReport(uploadId?: number, scope?: DataScope | null) {
  const database = getDb();
  const { clause, params: scopeParams } = buildScopeClause(scope);
  let query = `
    SELECT w.id as well_id, w.operadora, w.nombre_pozo_sgc, w.validation_status, w.uwi_fiscalizado,
           vi.field, vi.severity, vi.message, vi.rule
    FROM wells w
    LEFT JOIN validation_issues vi ON vi.well_id = w.id
    WHERE ${clause}
  `;
  const params: (number | string)[] = [...scopeParams];
  if (uploadId) {
    query += " AND w.upload_id = ?";
    params.push(uploadId);
  }
  query += " ORDER BY w.id DESC";

  const rows = database.prepare(query).all(...params) as Array<{
    well_id: number;
    operadora: string;
    nombre_pozo_sgc: string;
    validation_status: string;
    uwi_fiscalizado: string;
    field: string | null;
    severity: string | null;
    message: string | null;
    rule: string | null;
  }>;

  const grouped = new Map<number, ValidationResult>();
  for (const row of rows) {
    if (!grouped.has(row.well_id)) {
      grouped.set(row.well_id, {
        well_id: row.well_id,
        operadora: row.operadora,
        nombre_pozo_sgc: row.nombre_pozo_sgc,
        is_valid: row.validation_status !== "invalid",
        error_count: 0,
        warning_count: 0,
        issues: [],
        uwi_fiscalizado: row.uwi_fiscalizado,
      });
    }
    if (row.field && row.severity && row.message && row.rule) {
      const entry = grouped.get(row.well_id)!;
      entry.issues.push({
        field: row.field,
        severity: row.severity as "error" | "warning" | "info",
        message: row.message,
        rule: row.rule,
      });
      if (row.severity === "error") entry.error_count++;
      if (row.severity === "warning") entry.warning_count++;
    }
  }

  return Array.from(grouped.values());
}

function buildScopeClause(scope?: DataScope | null): { clause: string; params: string[] } {
  if (!scope || scope.role === "admin") {
    return { clause: "1=1", params: [] };
  }
  if (scope.role === "operadora" && scope.operadora) {
    return {
      clause: `operadora = ? AND (upload_id IS NULL OR upload_id IN (SELECT id FROM uploads WHERE status IN ('submitted', 'seed')))`,
      params: [scope.operadora],
    };
  }
  if (scope.role === "anh") {
    return {
      clause: `(upload_id IS NULL OR upload_id IN (SELECT id FROM uploads WHERE status IN ('submitted', 'seed', 'processed')))
        AND validation_status IN ('valid', 'warning')`,
      params: [],
    };
  }
  return { clause: "1=1", params: [] };
}

function buildFilterClause(
  filters?: DashboardFilters,
  excludeFilter?: keyof DashboardFilters,
  scope?: DataScope | null,
) {
  const clauses = ["1=1"];
  const params: string[] = [];

  const scopeFilter = buildScopeClause(scope);
  if (scopeFilter.clause !== "1=1") {
    clauses.push(scopeFilter.clause);
    params.push(...scopeFilter.params);
  }

  if (filters?.estado && excludeFilter !== "estado") {
    clauses.push("estado_pozo = ?");
    params.push(filters.estado);
  }
  if (filters?.departamentos?.length && excludeFilter !== "departamentos") {
    clauses.push(`departamento IN (${filters.departamentos.map(() => "?").join(", ")})`);
    params.push(...filters.departamentos);
  }
  if (filters?.operadora && excludeFilter !== "operadora") {
    clauses.push("operadora = ?");
    params.push(filters.operadora);
  }
  if (filters?.validation_status && excludeFilter !== "validation_status") {
    clauses.push("validation_status = ?");
    params.push(filters.validation_status);
  }
  if (filters?.q && excludeFilter !== "q") {
    clauses.push("(nombre_pozo_sgc LIKE ? OR uwi_fiscalizado LIKE ? OR operadora LIKE ?)");
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }

  return { where: clauses.join(" AND "), params };
}

function distinctColumn(
  database: Database.Database,
  column: string,
  filters?: DashboardFilters,
  excludeFilter?: keyof DashboardFilters,
  scope?: DataScope | null,
): string[] {
  const { where, params } = buildFilterClause(filters, excludeFilter, scope);
  return (
    database
      .prepare(
        `SELECT DISTINCT ${column} as value FROM wells
         WHERE ${column} IS NOT NULL AND ${column} != '' AND ${where}
         ORDER BY value COLLATE NOCASE`,
      )
      .all(...params) as Array<{ value: string }>
  ).map((row) => row.value);
}

export function getDashboardFilterOptions(filters?: DashboardFilters, scope?: DataScope | null) {
  const database = getDb();
  return {
    operadoras: distinctColumn(database, "operadora", filters, "operadora", scope),
    departamentos: dedupeDepartamentoOptions(
      distinctColumn(database, "departamento", filters, "departamentos", scope),
    ),
    estados: distinctColumn(database, "estado_pozo", filters, "estado", scope),
    validation_statuses: distinctColumn(database, "validation_status", filters, "validation_status", scope),
  };
}

function getSankeyFlowData(
  database: Database.Database,
  filters?: DashboardFilters,
  scope?: DataScope | null,
): DashboardSankeyData {
  const { where, params } = buildFilterClause(filters, undefined, scope);

  const dept_to_estado = database
    .prepare(
      `SELECT departamento as source, estado_pozo as target, COUNT(*) as count
       FROM wells
       WHERE departamento IS NOT NULL AND departamento != ''
         AND estado_pozo IS NOT NULL AND estado_pozo != ''
         AND ${where}
       GROUP BY departamento, estado_pozo
       ORDER BY count DESC`,
    )
    .all(...params) as DashboardSankeyData["dept_to_estado"];

  const estado_to_operadora = database
    .prepare(
      `SELECT estado_pozo as source, operadora as target, COUNT(*) as count
       FROM wells
       WHERE estado_pozo IS NOT NULL AND estado_pozo != ''
         AND operadora IS NOT NULL AND operadora != ''
         AND ${where}
       GROUP BY estado_pozo, operadora
       ORDER BY count DESC`,
    )
    .all(...params) as DashboardSankeyData["estado_to_operadora"];

  const estado_to_validation = database
    .prepare(
      `SELECT estado_pozo as source, validation_status as target, COUNT(*) as count
       FROM wells
       WHERE estado_pozo IS NOT NULL AND estado_pozo != ''
         AND validation_status IS NOT NULL AND validation_status != ''
         AND ${where}
       GROUP BY estado_pozo, validation_status
       ORDER BY count DESC`,
    )
    .all(...params) as DashboardSankeyData["estado_to_validation"];

  return { dept_to_estado, estado_to_operadora, estado_to_validation };
}

export function getDashboardStats(
  filters?: DashboardFilters,
  tableLimit = 10,
  scope?: DataScope | null,
): DashboardStats {
  const database = getDb();
  const { where, params } = buildFilterClause(filters, undefined, scope);
  const limit = tableLimit === 25 || tableLimit === 50 ? tableLimit : 10;

  const count = (extra = "") => {
    const sql = `SELECT COUNT(*) as c FROM wells WHERE ${where}${extra}`;
    return (database.prepare(sql).get(...params) as { c: number }).c;
  };

  const total_wells = count();
  const catalog_total_wells = scope
    ? count()
    : (database.prepare("SELECT COUNT(*) as c FROM wells").get() as { c: number }).c;
  const total_uploads = (database.prepare("SELECT COUNT(*) as c FROM uploads").get() as { c: number }).c;
  const valid_wells = count(" AND validation_status = 'valid'");
  const wells_with_errors = count(" AND validation_status = 'invalid'");
  const wells_with_warnings = count(" AND validation_status = 'warning'");

  const countBy = (column: string, excludeFilter?: keyof DashboardFilters) => {
    const { where, params } = buildFilterClause(filters, excludeFilter, scope);
    const rows = database
      .prepare(
        `SELECT ${column} as key, COUNT(*) as count FROM wells
         WHERE ${column} IS NOT NULL AND ${column} != '' AND ${where}
         GROUP BY ${column} ORDER BY count DESC LIMIT 10`,
      )
      .all(...params) as Array<{ key: string; count: number }>;
    return Object.fromEntries(rows.map((r) => [r.key, r.count]));
  };

  const uploadScope = scope?.role === "operadora" && scope.operadora
    ? " WHERE operadora = ?"
    : scope?.role === "anh"
      ? " WHERE status IN ('submitted', 'seed', 'processed')"
      : "";
  const uploadParams = scope?.role === "operadora" && scope.operadora ? [scope.operadora] : [];

  const recent_uploads = database
    .prepare(`SELECT * FROM uploads${uploadScope} ORDER BY created_at DESC LIMIT 5`)
    .all(...uploadParams) as UploadBatch[];

  const filtered_wells = database
    .prepare(
      `SELECT id, nombre_pozo_sgc, operadora, departamento, estado_pozo, validation_status, uwi_fiscalizado
       FROM wells WHERE ${where} ORDER BY id DESC LIMIT ${limit}`,
    )
    .all(...params) as DashboardStats["filtered_wells"];

  return {
    total_wells,
    catalog_total_wells,
    total_uploads,
    valid_wells,
    wells_with_errors,
    wells_with_warnings,
    by_estado: countBy("estado_pozo", "estado"),
    by_departamento: countBy("departamento", "departamentos"),
    by_operadora: countBy("operadora", "operadora"),
    recent_uploads,
    filtered_wells,
    filter_options: getDashboardFilterOptions(filters, scope),
    sankey: getSankeyFlowData(database, filters, scope),
  };
}

export function getLatestDraftUpload(scope?: DataScope | null): UploadBatch | null {
  if (scope?.role !== "operadora" || !scope.operadora) return null;
  const database = getDb();
  const row = database
    .prepare(
      `SELECT * FROM uploads WHERE operadora = ? AND status = 'draft' ORDER BY created_at DESC LIMIT 1`,
    )
    .get(scope.operadora) as UploadBatch | undefined;
  return row ?? null;
}

export function getUpload(id: number): UploadBatch | null {
  const database = getDb();
  return (database.prepare("SELECT * FROM uploads WHERE id = ?").get(id) as UploadBatch) ?? null;
}

export function updateWell(
  id: number,
  record: WellRecord,
  actorEmail: string,
): { well: WellRecord; validation: ValidationResult } | null {
  const database = getDb();
  const before = database.prepare("SELECT * FROM wells WHERE id = ?").get(id) as WellRecord | undefined;
  if (!before) return null;

  const { record: normalized, etlIssues } = normalizeWellRecordForIngest(record);
  const withCodes = { ...normalized, ...resolveDaneCodes(normalized.departamento, normalized.municipio) };
  const validation = validateWell(withCodes, undefined, etlIssues);
  withCodes.uwi_fiscalizado = validation.uwi_fiscalizado;
  withCodes.validation_status = validation.is_valid
    ? validation.warning_count > 0
      ? "warning"
      : "valid"
    : "invalid";

  const setClause = WELL_FIELDS.map((f) => `${f} = @${f}`).join(", ");
  database
    .prepare(`UPDATE wells SET ${setClause}, validation_status = @validation_status WHERE id = @id`)
    .run({
      id,
      ...pickWellFields(withCodes),
      validation_status: withCodes.validation_status,
    });

  database.prepare("DELETE FROM validation_issues WHERE well_id = ?").run(id);
  const insertIssue = database.prepare(
    `INSERT INTO validation_issues (well_id, field, severity, message, rule) VALUES (?, ?, ?, ?, ?)`,
  );
  for (const issue of validation.issues) {
    insertIssue.run(id, issue.field, issue.severity, issue.message, issue.rule);
  }

  const after = { ...withCodes, id, upload_id: before.upload_id, created_at: before.created_at };
  writeAuditLog({
    actorEmail,
    action: "well.update",
    entityType: "well",
    entityId: id,
    before,
    after,
  });

  return { well: after, validation: { ...validation, well_id: id } };
}

export function deleteWell(id: number, actorEmail: string): boolean {
  const database = getDb();
  const before = database.prepare("SELECT * FROM wells WHERE id = ?").get(id) as WellRecord | undefined;
  if (!before) return false;

  database.prepare("DELETE FROM validation_issues WHERE well_id = ?").run(id);
  database.prepare("DELETE FROM wells WHERE id = ?").run(id);
  writeAuditLog({
    actorEmail,
    action: "well.delete",
    entityType: "well",
    entityId: id,
    before,
    after: null,
  });
  return true;
}

export function submitUpload(
  uploadId: number,
  submittedBy: string,
): { upload: UploadBatch; error?: string } {
  const database = getDb();
  const upload = getUpload(uploadId);
  if (!upload) return { upload: upload!, error: "Lote no encontrado" };
  if (upload.status === "submitted") return { upload, error: "Este lote ya fue enviado" };
  if (upload.invalid_records > 0) {
    return { upload, error: "No se puede enviar un lote con errores de validación" };
  }

  database
    .prepare(
      `UPDATE uploads SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, submitted_by = ? WHERE id = ?`,
    )
    .run(submittedBy, uploadId);

  writeAuditLog({
    actorEmail: submittedBy,
    action: "upload.submit",
    entityType: "upload",
    entityId: uploadId,
    before: upload,
    after: getUpload(uploadId),
  });

  return { upload: getUpload(uploadId)! };
}

export function getWellsByUpload(uploadId: number): WellRecord[] {
  const database = getDb();
  return database.prepare("SELECT * FROM wells WHERE upload_id = ? ORDER BY id").all(uploadId) as WellRecord[];
}

export function getCatalogs() {
  return {
    ...seedData.catalogs,
    departamentos: getCanonicalDepartamentoList(),
  };
}

export function resolveDaneCodes(departamento: string | null, municipio: string | null) {
  const catalogs = getCatalogs();
  const depts = catalogs.departamentos_dane as Record<string, string>;
  const munis = catalogs.municipios_dane as Record<string, { nombre: string; dept_code: string }>;

  let codigo_dane_depto: string | null = null;
  let codigo_dane_muni: string | null = null;

  if (departamento) {
    const entry = Object.entries(depts).find(
      ([, name]) => normalizeGeoName(name) === normalizeGeoName(departamento),
    );
    codigo_dane_depto = entry?.[0] ?? null;
  }

  if (municipio) {
    const entry = Object.entries(munis).find(
      ([, info]) => normalizeGeoName(info.nombre) === normalizeGeoName(municipio),
    );
    codigo_dane_muni = entry?.[0] ?? null;
    if (entry && !codigo_dane_depto) {
      codigo_dane_depto = entry[1].dept_code;
    }
  }

  return { codigo_dane_depto, codigo_dane_muni };
}

export function previewUwi(record: WellRecord) {
  const withCodes = { ...record, ...resolveDaneCodes(record.departamento, record.municipio) };
  return generateUwiFiscalizado(withCodes);
}
