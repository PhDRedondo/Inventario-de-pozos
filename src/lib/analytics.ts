export type AnalyticsThemeId = "produccion" | "inyeccion" | "operativo" | "mix_operadores";
export type CompareEntityType = "operadora" | "departamento" | "municipio" | "pozo";

export interface AnalyticsMetricDef {
  key: string;
  labelKey: string;
  aggregateSql: string;
  unitKey?: string;
}

export const ANALYTICS_THEMES: Record<
  AnalyticsThemeId,
  { titleKey: string; descriptionKey: string; metrics: AnalyticsMetricDef[] }
> = {
  produccion: {
    titleKey: "analytics.themeProduction",
    descriptionKey: "analytics.themeProductionDesc",
    metrics: [
      { key: "prod_dias", labelKey: "analytics.metricProdDays", aggregateSql: "AVG(CAST(NULLIF(prod_dias,'') AS REAL))", unitKey: "analytics.unitDays" },
      { key: "prod_petroleo", labelKey: "analytics.metricProdOil", aggregateSql: "AVG(CAST(NULLIF(prod_petroleo,'') AS REAL))", unitKey: "analytics.unitBbl" },
      { key: "prod_agua", labelKey: "analytics.metricProdWater", aggregateSql: "AVG(CAST(NULLIF(prod_agua,'') AS REAL))", unitKey: "analytics.unitBbl" },
      { key: "prod_gas", labelKey: "analytics.metricProdGas", aggregateSql: "AVG(CAST(NULLIF(prod_gas,'') AS REAL))", unitKey: "analytics.unitKpc" },
    ],
  },
  inyeccion: {
    titleKey: "analytics.themeInjection",
    descriptionKey: "analytics.themeInjectionDesc",
    metrics: [
      { key: "iny_dias", labelKey: "analytics.metricInyDays", aggregateSql: "AVG(CAST(NULLIF(iny_dias,'') AS REAL))", unitKey: "analytics.unitDays" },
      { key: "iny_agua", labelKey: "analytics.metricInyWater", aggregateSql: "AVG(CAST(NULLIF(iny_agua,'') AS REAL))", unitKey: "analytics.unitBbl" },
      { key: "iny_gas", labelKey: "analytics.metricInyGas", aggregateSql: "AVG(CAST(NULLIF(iny_gas,'') AS REAL))", unitKey: "analytics.unitKpc" },
      { key: "iny_otros", labelKey: "analytics.metricInyOther", aggregateSql: "AVG(CAST(NULLIF(iny_otros,'') AS REAL))", unitKey: "analytics.unitBbl" },
    ],
  },
  operativo: {
    titleKey: "analytics.themeOperational",
    descriptionKey: "analytics.themeOperationalDesc",
    metrics: [
      {
        key: "pct_activo",
        labelKey: "analytics.metricPctActive",
        aggregateSql: "100.0 * SUM(CASE WHEN estado_pozo = 'Activo' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)",
        unitKey: "analytics.unitPct",
      },
      {
        key: "pct_horizontal",
        labelKey: "analytics.metricPctHorizontal",
        aggregateSql: "100.0 * SUM(CASE WHEN tipo_angulo LIKE '%H%' OR tipo_angulo LIKE '%horizontal%' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)",
        unitKey: "analytics.unitPct",
      },
      {
        key: "pct_productor",
        labelKey: "analytics.metricPctProducer",
        aggregateSql: "100.0 * SUM(CASE WHEN tipo_objetivo LIKE '%P%' OR tipo_objetivo LIKE '%Productor%' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)",
        unitKey: "analytics.unitPct",
      },
      {
        key: "pct_inyector",
        labelKey: "analytics.metricPctInjector",
        aggregateSql: "100.0 * SUM(CASE WHEN tipo_objetivo LIKE '%I%' OR tipo_objetivo LIKE '%Inyector%' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)",
        unitKey: "analytics.unitPct",
      },
      {
        key: "pct_coords",
        labelKey: "analytics.metricPctCoords",
        aggregateSql: "100.0 * SUM(CASE WHEN longitud IS NOT NULL AND longitud != '' AND latitud IS NOT NULL AND latitud != '' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)",
        unitKey: "analytics.unitPct",
      },
      {
        key: "pct_uwi",
        labelKey: "analytics.metricPctUwi",
        aggregateSql: "100.0 * SUM(CASE WHEN uwi_fiscalizado IS NOT NULL AND uwi_fiscalizado != '' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)",
        unitKey: "analytics.unitPct",
      },
    ],
  },
  mix_operadores: {
    titleKey: "analytics.themePortfolio",
    descriptionKey: "analytics.themePortfolioDesc",
    metrics: [
      {
        key: "wells_per_op",
        labelKey: "analytics.metricWellsPerOp",
        aggregateSql: "CAST(COUNT(*) AS REAL) / NULLIF(COUNT(DISTINCT operadora), 0)",
        unitKey: "analytics.unitWells",
      },
      {
        key: "dept_span",
        labelKey: "analytics.metricDeptSpan",
        aggregateSql: "CAST(COUNT(DISTINCT departamento) AS REAL)",
        unitKey: "analytics.unitCount",
      },
      {
        key: "muni_span",
        labelKey: "analytics.metricMuniSpan",
        aggregateSql: "CAST(COUNT(DISTINCT municipio) AS REAL)",
        unitKey: "analytics.unitCount",
      },
      {
        key: "avg_contracts",
        labelKey: "analytics.metricContracts",
        aggregateSql: "CAST(COUNT(DISTINCT contrato) AS REAL) / NULLIF(COUNT(DISTINCT operadora), 0)",
        unitKey: "analytics.unitCount",
      },
    ],
  },
};

export interface AnalyticsSnapshot {
  sampleSize: number;
  values: Record<string, number>;
}

export interface AnalyticsRadarPoint {
  metric: string;
  metricKey: string;
  baseline: number;
  comparison: number;
  baselineRaw: number;
  comparisonRaw: number;
  deltaPct: number;
}

export function buildRadarComparison(
  metrics: AnalyticsMetricDef[],
  labels: Record<string, string>,
  baseline: AnalyticsSnapshot,
  comparison: AnalyticsSnapshot,
): AnalyticsRadarPoint[] {
  return metrics.map((metric) => {
    const baselineRaw = baseline.values[metric.key] ?? 0;
    const comparisonRaw = comparison.values[metric.key] ?? 0;
    const comparisonNorm = baselineRaw > 0 ? (comparisonRaw / baselineRaw) * 100 : comparisonRaw > 0 ? 120 : 0;
    const deltaPct = baselineRaw > 0 ? ((comparisonRaw - baselineRaw) / baselineRaw) * 100 : 0;
    return {
      metric: labels[metric.key] ?? metric.key,
      metricKey: metric.key,
      baseline: 100,
      comparison: Math.round(comparisonNorm * 10) / 10,
      baselineRaw: Math.round(baselineRaw * 100) / 100,
      comparisonRaw: Math.round(comparisonRaw * 100) / 100,
      deltaPct: Math.round(deltaPct * 10) / 10,
    };
  });
}
