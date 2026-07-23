import { NextRequest, NextResponse } from "next/server";
import {
  ANALYTICS_THEMES,
  buildRadarComparison,
  type AnalyticsThemeId,
  type CompareEntityType,
} from "@/lib/analytics";
import {
  getEntityComparison,
  getNationalBaseline,
  getProductionScatterSample,
  getThemeDistribution,
} from "@/lib/analytics-db";
import { requireRole, requireSession } from "@/lib/auth-scope";

const THEMES = new Set(Object.keys(ANALYTICS_THEMES));
const ENTITY_TYPES = new Set<CompareEntityType>(["operadora", "departamento", "municipio", "pozo"]);

export async function GET(request: NextRequest) {
  const user = requireRole(requireSession(request), ["anh"]);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const theme = (searchParams.get("theme") ?? "produccion") as AnalyticsThemeId;
  const compareType = searchParams.get("compareType") as CompareEntityType | null;
  const compareValue = searchParams.get("compareValue");

  if (!THEMES.has(theme)) {
    return NextResponse.json({ error: "Tema no válido" }, { status: 400 });
  }

  const themeDef = ANALYTICS_THEMES[theme];
  const baseline = getNationalBaseline(theme);

  let comparison = baseline;
  let compareLabel = "Promedio nacional";

  if (compareType && compareValue && ENTITY_TYPES.has(compareType)) {
    const entitySnapshot = getEntityComparison(theme, compareType, compareValue);
    if (!entitySnapshot || entitySnapshot.sampleSize === 0) {
      return NextResponse.json({ error: "Entidad sin datos en el inventario validado" }, { status: 404 });
    }
    comparison = entitySnapshot;
    compareLabel = compareValue;
  }

  const metricLabels = Object.fromEntries(themeDef.metrics.map((m) => [m.key, m.labelKey]));
  const radar = buildRadarComparison(themeDef.metrics, metricLabels, baseline, comparison);

  const distribution =
    theme === "produccion" || theme === "operativo"
      ? {
          byDepartamento: getThemeDistribution(theme, "departamento", 8),
          byOperadora: getThemeDistribution(theme, "operadora", 6),
        }
      : null;

  const scatter = theme === "produccion" ? getProductionScatterSample(150) : null;

  return NextResponse.json({
    theme,
    baseline,
    comparison,
    compareType: compareType ?? null,
    compareValue: compareValue ?? null,
    compareLabel,
    radar,
    distribution,
    scatter,
    metrics: themeDef.metrics,
  });
}
