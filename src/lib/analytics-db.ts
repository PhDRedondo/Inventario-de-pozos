import { ANALYTICS_THEMES, type AnalyticsSnapshot, type AnalyticsThemeId, type CompareEntityType } from "./analytics";
import { getDb } from "./db";
import { fixEncoding } from "./geo";
import type { DataScope } from "./types";

/** Pozos consolidados y validados visibles para ANH (enviados por operadoras, sin errores bloqueantes). */
export function validatedAnhWhere(): { clause: string; params: string[] } {
  return {
    clause: `(upload_id IS NULL OR upload_id IN (SELECT id FROM uploads WHERE status IN ('submitted', 'seed', 'processed')))
      AND validation_status IN ('valid', 'warning')`,
    params: [],
  };
}

function queryMetrics(
  themeId: AnalyticsThemeId,
  extraClause: string,
  extraParams: (string | number)[],
): AnalyticsSnapshot {
  const database = getDb();
  const theme = ANALYTICS_THEMES[themeId];
  const base = validatedAnhWhere();
  const selects = theme.metrics.map((m) => `${m.aggregateSql} AS ${m.key}`).join(", ");
  const where = `${base.clause} AND ${extraClause}`;
  const row = database
    .prepare(`SELECT COUNT(*) AS sampleSize, ${selects} FROM wells WHERE ${where}`)
    .get(...base.params, ...extraParams) as Record<string, number>;

  const values: Record<string, number> = {};
  for (const metric of theme.metrics) {
    values[metric.key] = Number(row[metric.key] ?? 0);
  }
  return { sampleSize: Number(row.sampleSize ?? 0), values };
}

export function getNationalBaseline(themeId: AnalyticsThemeId): AnalyticsSnapshot {
  return queryMetrics(themeId, "1=1", []);
}

export function getEntityComparison(
  themeId: AnalyticsThemeId,
  entityType: CompareEntityType,
  entityValue: string,
): AnalyticsSnapshot | null {
  if (entityType === "operadora") {
    return queryMetrics(themeId, "operadora = ?", [entityValue]);
  }
  if (entityType === "departamento") {
    return queryMetrics(themeId, "departamento = ?", [entityValue]);
  }
  if (entityType === "municipio") {
    return queryMetrics(themeId, "municipio = ?", [entityValue]);
  }
  if (entityType === "pozo") {
    const id = Number(entityValue);
    if (!Number.isFinite(id)) return null;
    return queryMetrics(themeId, "id = ?", [id]);
  }
  return null;
}

export function searchAnalyticsEntities(
  entityType: CompareEntityType,
  query?: string,
  limit = 40,
): Array<{ id: string; label: string; meta?: string }> {
  const database = getDb();
  const base = validatedAnhWhere();
  const like = query?.trim() ? `%${query.trim()}%` : null;

  if (entityType === "operadora") {
    const sql = like
      ? `SELECT operadora AS id, operadora AS label, COUNT(*) AS c FROM wells WHERE ${base.clause} AND operadora LIKE ? GROUP BY operadora ORDER BY c DESC LIMIT ?`
      : `SELECT operadora AS id, operadora AS label, COUNT(*) AS c FROM wells WHERE ${base.clause} AND operadora IS NOT NULL AND operadora != '' GROUP BY operadora ORDER BY c DESC LIMIT ?`;
    const rows = (like
      ? database.prepare(sql).all(...base.params, like, limit)
      : database.prepare(sql).all(...base.params, limit)) as Array<{ id: string; label: string; c: number }>;
    return rows.map((r) => ({ id: r.id, label: r.label, meta: `${r.c} pozos` }));
  }

  if (entityType === "departamento") {
    const sql = like
      ? `SELECT departamento AS id, departamento AS label, COUNT(*) AS c FROM wells WHERE ${base.clause} AND departamento LIKE ? GROUP BY departamento ORDER BY c DESC LIMIT ?`
      : `SELECT departamento AS id, departamento AS label, COUNT(*) AS c FROM wells WHERE ${base.clause} AND departamento IS NOT NULL AND departamento != '' GROUP BY departamento ORDER BY c DESC LIMIT ?`;
    const rows = (like
      ? database.prepare(sql).all(...base.params, like, limit)
      : database.prepare(sql).all(...base.params, limit)) as Array<{ id: string; label: string; c: number }>;
    return rows.map((r) => ({ id: r.id, label: fixEncoding(r.label), meta: `${r.c} pozos` }));
  }

  if (entityType === "municipio") {
    const sql = like
      ? `SELECT municipio AS id, municipio AS label, departamento, COUNT(*) AS c FROM wells WHERE ${base.clause} AND municipio LIKE ? GROUP BY municipio, departamento ORDER BY c DESC LIMIT ?`
      : `SELECT municipio AS id, municipio AS label, departamento, COUNT(*) AS c FROM wells WHERE ${base.clause} AND municipio IS NOT NULL AND municipio != '' GROUP BY municipio, departamento ORDER BY c DESC LIMIT ?`;
    const rows = (like
      ? database.prepare(sql).all(...base.params, like, limit)
      : database.prepare(sql).all(...base.params, limit)) as Array<{ id: string; label: string; departamento: string; c: number }>;
    return rows.map((r) => ({
      id: r.id,
      label: fixEncoding(r.label),
      meta: `${fixEncoding(r.departamento)} · ${r.c} pozos`,
    }));
  }

  const sql = like
    ? `SELECT CAST(id AS TEXT) AS id, nombre_pozo_sgc AS label, operadora, municipio FROM wells WHERE ${base.clause} AND (nombre_pozo_sgc LIKE ? OR uwi_fiscalizado LIKE ?) ORDER BY id DESC LIMIT ?`
    : `SELECT CAST(id AS TEXT) AS id, nombre_pozo_sgc AS label, operadora, municipio FROM wells WHERE ${base.clause} ORDER BY id DESC LIMIT ?`;
  const rows = (like
    ? database.prepare(sql).all(...base.params, like, like, limit)
    : database.prepare(sql).all(...base.params, limit)) as Array<{ id: string; label: string; operadora: string; municipio: string }>;
  return rows.map((r) => ({
    id: r.id,
    label: r.label ?? `Pozo ${r.id}`,
    meta: `${r.operadora ?? ""} · ${fixEncoding(r.municipio ?? "")}`.trim(),
  }));
}

export function getProductionScatterSample(limit = 120): Array<{
  id: number;
  label: string;
  operadora: string | null;
  departamento: string | null;
  petroleo: number;
  agua: number;
  gas: number;
}> {
  const database = getDb();
  const base = validatedAnhWhere();
  return database
    .prepare(
      `SELECT id, nombre_pozo_sgc AS label, operadora, departamento,
              CAST(NULLIF(prod_petroleo,'') AS REAL) AS petroleo,
              CAST(NULLIF(prod_agua,'') AS REAL) AS agua,
              CAST(NULLIF(prod_gas,'') AS REAL) AS gas
       FROM wells
       WHERE ${base.clause}
         AND prod_petroleo IS NOT NULL AND prod_petroleo != ''
         AND prod_agua IS NOT NULL AND prod_agua != ''
       ORDER BY RANDOM()
       LIMIT ?`,
    )
    .all(...base.params, limit) as Array<{
    id: number;
    label: string;
    operadora: string | null;
    departamento: string | null;
    petroleo: number;
    agua: number;
    gas: number;
  }>;
}

export function getThemeDistribution(
  themeId: AnalyticsThemeId,
  groupColumn: "operadora" | "departamento",
  top = 8,
): Array<{ name: string; values: Record<string, number>; sampleSize: number }> {
  const database = getDb();
  const theme = ANALYTICS_THEMES[themeId];
  const base = validatedAnhWhere();
  const groups = database
    .prepare(
      `SELECT ${groupColumn} AS name, COUNT(*) AS c FROM wells WHERE ${base.clause} AND ${groupColumn} IS NOT NULL AND ${groupColumn} != '' GROUP BY ${groupColumn} ORDER BY c DESC LIMIT ?`,
    )
    .all(...base.params, top) as Array<{ name: string; c: number }>;

  return groups.map((group) => {
    const snapshot = queryMetrics(themeId, `${groupColumn} = ?`, [group.name]);
    return {
      name: groupColumn === "departamento" ? fixEncoding(group.name) : group.name,
      values: snapshot.values,
      sampleSize: snapshot.sampleSize,
    };
  });
}

/** Aplica filtro de inventario validado al scope ANH en estadísticas del panel. */
export function appendValidatedFilter(scope?: DataScope | null): string {
  if (scope?.role === "anh") {
    return " AND validation_status IN ('valid', 'warning')";
  }
  return "";
}
