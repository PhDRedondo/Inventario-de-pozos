"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { RoleWorkflowSteps, roleWorkflowIntro } from "@/components/RoleWorkflowSteps";
import { PageHeader, StatCard } from "@/components/ui";
import { useAppPreferences } from "@/context/AppPreferences";
import { useAuth } from "@/context/AuthContext";
import {
  ANALYTICS_THEMES,
  type AnalyticsRadarPoint,
  type AnalyticsSnapshot,
  type AnalyticsThemeId,
  type CompareEntityType,
} from "@/lib/analytics";
import { getChartTheme } from "@/lib/chart-theme";
import { fixEncoding } from "@/lib/geo";

interface AnalyticsEntity {
  id: string;
  label: string;
  meta?: string;
}

interface AnalyticsPayload {
  theme: AnalyticsThemeId;
  baseline: AnalyticsSnapshot;
  comparison: AnalyticsSnapshot;
  compareType: CompareEntityType | null;
  compareValue: string | null;
  compareLabel: string;
  radar: AnalyticsRadarPoint[];
  distribution: {
    byDepartamento: Array<{ name: string; values: Record<string, number>; sampleSize: number }>;
    byOperadora: Array<{ name: string; values: Record<string, number>; sampleSize: number }>;
  } | null;
  scatter: Array<{
    id: number;
    label: string;
    operadora: string | null;
    departamento: string | null;
    petroleo: number;
    agua: number;
    gas: number;
  }> | null;
  metrics: Array<{ key: string; labelKey: string; unitKey?: string }>;
}

const THEME_IDS = Object.keys(ANALYTICS_THEMES) as AnalyticsThemeId[];

const ENTITY_TYPE_KEYS: Record<CompareEntityType, string> = {
  operadora: "analytics.entityOperadora",
  departamento: "analytics.entityDepartamento",
  municipio: "analytics.entityMunicipio",
  pozo: "analytics.entityPozo",
};

function heatColor(ratio: number): string {
  if (ratio >= 130) return "#e8381a";
  if (ratio >= 110) return "#ff8c00";
  if (ratio >= 90) return "#ffe600";
  if (ratio >= 70) return "#38bdf8";
  return "#6366f1";
}

export default function AnaliticaPage() {
  const { t, theme } = useAppPreferences();
  const { user } = useAuth();
  const router = useRouter();
  const chartTheme = useMemo(() => getChartTheme(theme), [theme]);

  const [activeTheme, setActiveTheme] = useState<AnalyticsThemeId>("produccion");
  const [entityType, setEntityType] = useState<CompareEntityType>("municipio");
  const [entityQuery, setEntityQuery] = useState("");
  const [entities, setEntities] = useState<AnalyticsEntity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<AnalyticsEntity | null>(null);
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const entityDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role === "operadora") router.replace("/panel");
  }, [user, router]);

  const fetchEntities = useCallback(
    async (type: CompareEntityType, query: string) => {
      const params = new URLSearchParams({ type });
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/analytics/entities?${params}`);
      if (!response.ok) return;
      const data = (await response.json()) as { entities: AnalyticsEntity[] };
      setEntities(data.entities);
    },
    [],
  );

  useEffect(() => {
    if (!user || user.role === "operadora") return;
    if (entityDebounce.current) clearTimeout(entityDebounce.current);
    entityDebounce.current = setTimeout(() => {
      void fetchEntities(entityType, entityQuery);
    }, 280);
    return () => {
      if (entityDebounce.current) clearTimeout(entityDebounce.current);
    };
  }, [entityType, entityQuery, fetchEntities, user]);

  useEffect(() => {
    if (!user || user.role === "operadora") return;

    const params = new URLSearchParams({ theme: activeTheme });
    if (selectedEntity) {
      params.set("compareType", entityType);
      params.set("compareValue", selectedEntity.id);
    }

    setLoading(true);
    setError(null);
    fetch(`/api/analytics?${params}`)
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "fetch failed");
        }
        return response.json() as Promise<AnalyticsPayload>;
      })
      .then(setPayload)
      .catch((err: Error) => {
        setError(err.message === "fetch failed" ? t("analytics.loadError") : err.message);
        setPayload(null);
      })
      .finally(() => setLoading(false));
  }, [activeTheme, entityType, selectedEntity, t, user]);

  const radarData = useMemo(() => {
    if (!payload) return [];
    return payload.radar.map((point) => ({
      ...point,
      metric: t(point.metric),
    }));
  }, [payload, t]);

  const deltaData = useMemo(() => {
    if (!payload) return [];
    return payload.radar.map((point) => ({
      name: t(point.metric),
      delta: point.deltaPct,
      fill: point.deltaPct >= 0 ? "#ff8c00" : "#38bdf8",
    }));
  }, [payload, t]);

  const baselineValues = payload?.baseline.values ?? {};
  const hasComparison = Boolean(selectedEntity);

  function buildHeatmapRows(
    groups: Array<{ name: string; values: Record<string, number>; sampleSize: number }> | undefined,
  ) {
    if (!payload || !groups?.length) return [];
    return groups.map((group) => {
      const cells = payload.metrics.map((metric) => {
        const base = baselineValues[metric.key] ?? 0;
        const raw = group.values[metric.key] ?? 0;
        const ratio = base > 0 ? (raw / base) * 100 : 0;
        return { key: metric.key, label: t(metric.labelKey), ratio, raw };
      });
      return { name: fixEncoding(group.name), sampleSize: group.sampleSize, cells };
    });
  }

  const heatmapDept = buildHeatmapRows(payload?.distribution?.byDepartamento);
  const heatmapOp = buildHeatmapRows(payload?.distribution?.byOperadora);

  if (user?.role === "operadora") {
    return null;
  }

  return (
    <div data-tour="analytics-page">
      <PageHeader
        title={t("analytics.title")}
        description={user ? t(roleWorkflowIntro(user.role, "quality")) : t("analytics.description")}
      />

      <RoleWorkflowSteps role={user?.role ?? "anh"} variant="compact" />

      <div className="card mb-4 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {THEME_IDS.map((themeId) => (
            <button
              key={themeId}
              type="button"
              onClick={() => setActiveTheme(themeId)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition sm:text-sm ${
                activeTheme === themeId
                  ? "bg-anh-secondary text-anh-black shadow-md"
                  : "bg-anh-bg text-anh-muted hover:bg-anh-border/40"
              }`}
            >
              {t(ANALYTICS_THEMES[themeId].titleKey)}
            </button>
          ))}
        </div>
        <p className="text-xs text-anh-muted sm:text-sm">{t(ANALYTICS_THEMES[activeTheme].descriptionKey)}</p>
      </div>

      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-anh-muted">{t("analytics.entityType")}</label>
          <select
            className="input-field"
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value as CompareEntityType);
              setSelectedEntity(null);
              setEntityQuery("");
            }}
          >
            {(Object.keys(ENTITY_TYPE_KEYS) as CompareEntityType[]).map((type) => (
              <option key={type} value={type}>
                {t(ENTITY_TYPE_KEYS[type])}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-anh-muted">{t("analytics.entitySearch")}</label>
          <input
            className="input-field"
            placeholder={t("analytics.entityPlaceholder")}
            value={entityQuery}
            onChange={(e) => setEntityQuery(e.target.value)}
          />
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-anh-border bg-anh-bg">
            {entities.length === 0 ? (
              <p className="p-3 text-xs text-anh-muted">{t("analytics.noEntityResults")}</p>
            ) : (
              entities.map((entity) => (
                <button
                  key={`${entityType}-${entity.id}`}
                  type="button"
                  onClick={() => setSelectedEntity(entity)}
                  className={`flex w-full flex-col items-start border-b border-anh-border/60 px-3 py-2 text-left text-xs transition last:border-0 hover:bg-anh-secondary/10 ${
                    selectedEntity?.id === entity.id ? "bg-anh-secondary/20 font-semibold" : ""
                  }`}
                >
                  <span className="text-anh-primary">{fixEncoding(entity.label)}</span>
                  {entity.meta && <span className="text-anh-muted">{entity.meta}</span>}
                </button>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-col justify-end gap-2">
          {selectedEntity ? (
            <>
              <p className="text-xs text-anh-muted">
                {t("analytics.compareWith")}:{" "}
                <strong className="text-anh-primary">{fixEncoding(selectedEntity.label)}</strong>
              </p>
              <button type="button" className="btn-secondary text-xs" onClick={() => setSelectedEntity(null)}>
                {t("analytics.clearSelection")}
              </button>
            </>
          ) : (
            <p className="text-xs text-anh-muted">{t("analytics.selectEntity")}</p>
          )}
        </div>
      </div>

      {loading && !payload ? (
        <div className="card p-8 text-center text-anh-muted">{t("analytics.loading")}</div>
      ) : error ? (
        <div className="card p-8 text-center text-red-600 dark:text-red-300">{error}</div>
      ) : payload ? (
        <>
          <div className={`mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
            <StatCard
              label={t("analytics.nationalBaseline")}
              value={payload.baseline.sampleSize.toLocaleString()}
            />
            <StatCard
              label={hasComparison ? t("analytics.rawComparison") : t("analytics.selectEntity")}
              value={
                hasComparison ? payload.comparison.sampleSize.toLocaleString() : "—"
              }
            />
            <StatCard label={t(ANALYTICS_THEMES[activeTheme].titleKey)} value={payload.metrics.length} />
            <StatCard
              label={t("analytics.deltaTitle")}
              value={
                hasComparison
                  ? `${(
                      payload.radar.reduce((sum, p) => sum + Math.abs(p.deltaPct), 0) / payload.radar.length
                    ).toFixed(1)}%`
                  : "—"
              }
            />
          </div>

          <div className={`mb-4 grid gap-4 lg:grid-cols-2 ${loading ? "opacity-60" : ""}`}>
            <div className="card p-3 sm:p-4">
              <h3 className="mb-1 font-bold text-anh-primary">{t("analytics.radarTitle")}</h3>
              <p className="mb-4 text-xs text-anh-muted">{t("analytics.radarHint")}</p>
              <div className="h-80 sm:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                    <PolarGrid stroke={chartTheme.gridStroke} />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: chartTheme.axisTick, fontSize: 10 }} />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 160]}
                      tick={{ fill: chartTheme.axisTick, fontSize: 9 }}
                    />
                    <Radar
                      name={t("analytics.nationalBaseline")}
                      dataKey="baseline"
                      stroke="#ffe600"
                      fill="#ffe600"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <Radar
                      name={hasComparison ? fixEncoding(selectedEntity!.label) : t("analytics.nationalBaseline")}
                      dataKey="comparison"
                      stroke="#ff8c00"
                      fill="#ff8c00"
                      fillOpacity={hasComparison ? 0.35 : 0.15}
                      strokeWidth={2}
                    />
                    <Legend />
                    <Tooltip
                      contentStyle={chartTheme.tooltipContentStyle}
                      labelStyle={chartTheme.tooltipLabelStyle}
                      formatter={(value, name, item) => {
                        const point = item.payload as AnalyticsRadarPoint;
                        return [
                          `${value}% · ${t("analytics.rawBaseline")}: ${point.baselineRaw} · ${t("analytics.rawComparison")}: ${point.comparisonRaw}`,
                          String(name),
                        ];
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-3 sm:p-4">
              <h3 className="mb-1 font-bold text-anh-primary">{t("analytics.deltaTitle")}</h3>
              <p className="mb-4 text-xs text-anh-muted">{t("analytics.deltaHint")}</p>
              <div className="h-80 sm:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deltaData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} horizontal={false} />
                    <XAxis type="number" tick={{ fill: chartTheme.axisTick, fontSize: 10 }} unit="%" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fill: chartTheme.axisTick, fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={chartTheme.tooltipContentStyle}
                      labelStyle={chartTheme.tooltipLabelStyle}
                      formatter={(value) => {
                        const n = Number(value ?? 0);
                        return [
                          n > 0
                            ? t("analytics.deltaAbove", { value: Math.abs(n) })
                            : n < 0
                              ? t("analytics.deltaBelow", { value: Math.abs(n) })
                              : t("analytics.deltaEqual"),
                          t("analytics.deltaTitle"),
                        ];
                      }}
                    />
                    <Bar dataKey="delta" radius={[0, 4, 4, 0]}>
                      {deltaData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {payload.scatter && (
            <div className={`card mb-4 p-3 sm:p-4 ${loading ? "opacity-60" : ""}`}>
              <h3 className="mb-1 font-bold text-anh-primary">{t("analytics.scatterTitle")}</h3>
              <p className="mb-4 text-xs text-anh-muted">{t("analytics.scatterHint")}</p>
              <div className="h-80 sm:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                    <XAxis
                      type="number"
                      dataKey="petroleo"
                      name={t("analytics.scatterOil")}
                      tick={{ fill: chartTheme.axisTick, fontSize: 10 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="agua"
                      name={t("analytics.scatterWater")}
                      tick={{ fill: chartTheme.axisTick, fontSize: 10 }}
                    />
                    <ZAxis type="number" dataKey="gas" range={[40, 400]} name={t("analytics.scatterGas")} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={chartTheme.tooltipContentStyle}
                      labelStyle={chartTheme.tooltipLabelStyle}
                      formatter={(value) => [Number(value ?? 0).toLocaleString(), ""]}
                      labelFormatter={(_, items) => {
                        const row = items[0]?.payload as { label?: string; operadora?: string };
                        return row?.label ?? "";
                      }}
                    />
                    <Scatter
                      name={t("common.well")}
                      data={payload.scatter}
                      fill="#ff8c00"
                      fillOpacity={0.65}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {payload.distribution && (heatmapDept.length > 0 || heatmapOp.length > 0) && (
            <div className={`grid gap-4 lg:grid-cols-2 ${loading ? "opacity-60" : ""}`}>
              {[
                { title: t("analytics.heatmapByDept"), rows: heatmapDept },
                { title: t("analytics.heatmapByOp"), rows: heatmapOp },
              ].map(({ title, rows }) =>
                rows.length > 0 ? (
                  <div key={title} className="card overflow-hidden p-3 sm:p-4">
                    <h3 className="mb-1 font-bold text-anh-primary">{t("analytics.heatmapTitle")}</h3>
                    <p className="mb-3 text-xs text-anh-muted">
                      {title} · {t("analytics.heatmapHint")}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] border-collapse text-xs">
                        <thead>
                          <tr>
                            <th className="sticky left-0 bg-anh-card p-2 text-left font-semibold text-anh-muted">
                              {title}
                            </th>
                            {payload.metrics.map((metric) => (
                              <th key={metric.key} className="p-2 text-center font-semibold text-anh-muted">
                                {t(metric.labelKey)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.name} className="border-t border-anh-border/60">
                              <td className="sticky left-0 bg-anh-card p-2 font-semibold text-anh-primary">
                                {row.name}
                                <span className="block text-[10px] font-normal text-anh-muted">
                                  {t("analytics.sampleSize", { count: row.sampleSize })}
                                </span>
                              </td>
                              {row.cells.map((cell) => (
                                <td key={cell.key} className="p-1">
                                  <div
                                    className="rounded-md px-1 py-2 text-center font-bold text-anh-black"
                                    style={{ backgroundColor: heatColor(cell.ratio) }}
                                    title={`${cell.ratio.toFixed(0)}% · ${cell.raw.toLocaleString()}`}
                                  >
                                    {cell.ratio.toFixed(0)}%
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          )}

          <div className={`card mt-4 p-3 sm:p-4 ${loading ? "opacity-60" : ""}`}>
            <h3 className="mb-3 font-bold text-anh-primary">{t("analytics.rawValuesTitle")}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-anh-border text-left text-xs text-anh-muted">
                    <th className="p-2">{t("analytics.rawValuesTitle")}</th>
                    <th className="p-2">{t("analytics.rawBaseline")}</th>
                    <th className="p-2">{hasComparison ? fixEncoding(selectedEntity!.label) : "—"}</th>
                    <th className="p-2">{t("analytics.deltaTitle")}</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.radar.map((point) => (
                    <tr key={point.metricKey} className="border-b border-anh-border/50">
                      <td className="p-2 font-semibold text-anh-primary">{t(point.metric)}</td>
                      <td className="p-2">{point.baselineRaw.toLocaleString()}</td>
                      <td className="p-2">{point.comparisonRaw.toLocaleString()}</td>
                      <td className="p-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            point.deltaPct >= 0
                              ? "bg-anh-secondary/20 text-anh-secondary"
                              : "bg-sky-500/15 text-sky-600 dark:text-sky-300"
                          }`}
                        >
                          {point.deltaPct > 0 ? "+" : ""}
                          {point.deltaPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
