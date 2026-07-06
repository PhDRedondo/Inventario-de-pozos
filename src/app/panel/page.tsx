"use client";

import dynamic from "next/dynamic";
import { Download } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardFiltersBar } from "@/components/DashboardFiltersBar";
import { MapLoadingPlaceholder } from "@/components/MapLoadingPlaceholder";
import { WellDetailModal } from "@/components/WellDetailModal";
import { PageHeader, StatCard } from "@/components/ui";
import { WellsSankeyChart } from "@/components/WellsSankeyChart";
import { WellsTableView } from "@/components/WellsTableView";
import { useAppPreferences } from "@/context/AppPreferences";
import { useAuth } from "@/context/AuthContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getChartTheme } from "@/lib/chart-theme";
import { downloadDashboardReportPdf } from "@/lib/dashboard-report-pdf";
import { fixEncoding } from "@/lib/geo";
import { applyDashboardFilters, hasActiveFilters, isDepartamentoSelected, parseDepartamentosParam, serializeDepartamentos, toggleDepartamento } from "@/lib/filters";
import type { DashboardFilters, DashboardStats, WellMapPoint, WellRecord } from "@/lib/types";

const WellsMap = dynamic(() => import("@/components/WellsMap"), {
  ssr: false,
  loading: () => <MapLoadingPlaceholder />,
});

const TABLE_PAGE_SIZES = [10, 25, 50] as const;
type TablePageSize = (typeof TABLE_PAGE_SIZES)[number];

function buildQuery(filters: DashboardFilters, tableLimit?: TablePageSize) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.estado) params.set("estado", filters.estado);
  if (filters.departamentos?.length) params.set("departamento", serializeDepartamentos(filters.departamentos)!);
  if (filters.operadora) params.set("operadora", filters.operadora);
  if (filters.validation_status) params.set("validation_status", filters.validation_status);
  if (tableLimit) params.set("limit", String(tableLimit));
  return params.toString();
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-center text-anh-muted">...</div>}>
      <DashboardPageContent />
    </Suspense>
  );
}

function DashboardPageContent() {
  const { t, locale, theme } = useAppPreferences();
  const { user } = useAuth();
  const isOperadora = user?.role === "operadora";
  const isAnh = user?.role === "anh";
  const chartTheme = useMemo(() => getChartTheme(theme), [theme]);
  const isCompactCharts = useMediaQuery("(max-width: 639px)");
  const searchParams = useSearchParams();
  const urlFiltersApplied = useRef(false);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [allMapPoints, setAllMapPoints] = useState<WellMapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [selectedWellId, setSelectedWellId] = useState<number | null>(null);
  const [showAllWells, setShowAllWells] = useState(false);
  const [tablePageSize, setTablePageSize] = useState<TablePageSize>(10);
  const [expandedWells, setExpandedWells] = useState<WellRecord[]>([]);
  const [loadingExpanded, setLoadingExpanded] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleDepartamentoFilter = useCallback((departamento: string) => {
    setFilters((prev) => ({
      ...prev,
      departamentos: toggleDepartamento(prev.departamentos, departamento),
    }));
  }, []);

  const setDepartamentosFilter = useCallback((departamentos: string[] | undefined) => {
    setFilters((prev) => ({
      ...prev,
      departamentos,
    }));
  }, []);

  const toggleFilter = useCallback((key: keyof DashboardFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key] === value ? undefined : value,
    }));
  }, []);

  const applyCrossFilter = useCallback(
    (key: keyof DashboardFilters, value: string) => {
      if (key === "q") {
        setFilters((prev) => {
          const next = prev.q === value ? undefined : value;
          setSearchInput(next ?? "");
          return { ...prev, q: next };
        });
        return;
      }
      if (key === "departamentos") {
        toggleDepartamentoFilter(value);
        return;
      }
      toggleFilter(key, value);
    },
    [toggleFilter, toggleDepartamentoFilter],
  );

  const setFilter = useCallback((key: keyof DashboardFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
    if (key === "q") {
      setSearchInput(value);
    }
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchInput("");
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        q: value.trim() || undefined,
      }));
    }, 350);
  }, []);

  useEffect(() => {
    if (urlFiltersApplied.current) return;
    const fromUrl: DashboardFilters = {};
    const operadora = searchParams.get("operadora");
    const estado = searchParams.get("estado");
    const departamento = searchParams.get("departamento");
    const validation_status = searchParams.get("validation_status");
    const q = searchParams.get("q");
    if (operadora) fromUrl.operadora = operadora;
    if (estado) fromUrl.estado = estado;
    const departamentos = parseDepartamentosParam(departamento);
    if (departamentos) fromUrl.departamentos = departamentos;
    if (validation_status) fromUrl.validation_status = validation_status;
    if (q) {
      fromUrl.q = q;
      setSearchInput(q);
    }
    if (Object.keys(fromUrl).length > 0) {
      setFilters(fromUrl);
    }
    urlFiltersApplied.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!urlFiltersApplied.current) return;
    const qs = buildQuery(filters);
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }, [filters]);

  useEffect(() => {
    fetch("/api/wells/map")
      .then((r) => r.json())
      .then(setAllMapPoints)
      .catch(console.error)
      .finally(() => setMapLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = buildQuery(filters, tablePageSize);
    fetch(`/api/stats${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters, tablePageSize]);

  useEffect(() => {
    if (!showAllWells) return;
    setLoadingExpanded(true);
    const qs = buildQuery(filters);
    fetch(`/api/wells${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then(setExpandedWells)
      .catch(console.error)
      .finally(() => setLoadingExpanded(false));
  }, [showAllWells, filters]);

  const filteredMapPoints = useMemo(
    () => applyDashboardFilters(allMapPoints, filters),
    [allMapPoints, filters],
  );

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; value: string; onRemove: () => void }> = [];

    if (filters.q) {
      chips.push({
        id: "q",
        label: t("common.well"),
        value: filters.q,
        onRemove: () => {
          setSearchInput("");
          setFilter("q", "");
        },
      });
    }
    if (filters.estado) {
      chips.push({
        id: "estado",
        label: t("common.state"),
        value: filters.estado,
        onRemove: () => toggleFilter("estado", filters.estado!),
      });
    }
    for (const departamento of filters.departamentos ?? []) {
      chips.push({
        id: `departamento-${departamento}`,
        label: t("common.department"),
        value: departamento,
        onRemove: () => toggleDepartamentoFilter(departamento),
      });
    }
    if (filters.operadora) {
      chips.push({
        id: "operadora",
        label: t("common.operator"),
        value: filters.operadora,
        onRemove: () => toggleFilter("operadora", filters.operadora!),
      });
    }
    if (filters.validation_status && !isAnh) {
      chips.push({
        id: "validation_status",
        label: t("common.validation"),
        value: filters.validation_status,
        onRemove: () => toggleFilter("validation_status", filters.validation_status!),
      });
    }

    return chips;
  }, [filters, isAnh, setFilter, t, toggleDepartamentoFilter, toggleFilter]);

  const tableWells = useMemo(() => {
    if (!stats) return [];
    if (!showAllWells) return stats.filtered_wells;
    return expandedWells.map((well) => ({
      id: well.id!,
      nombre_pozo_sgc: well.nombre_pozo_sgc,
      operadora: well.operadora,
      departamento: well.departamento,
      estado_pozo: well.estado_pozo,
      validation_status: well.validation_status,
      uwi_fiscalizado: well.uwi_fiscalizado,
    }));
  }, [stats, showAllWells, expandedWells]);

  const validationLabel = (value: string) => {
    if (value === "valid") return t("validationFilter.valid");
    if (value === "warning") return t("validationFilter.warning");
    if (value === "invalid") return t("validationFilter.invalid");
    return value;
  };

  const generatedAt = new Date().toLocaleString(locale === "en" ? "en-US" : "es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const handleExportDashboardPdf = useCallback(async () => {
    if (!stats) return;

    setExportingPdf(true);
    setPdfError(null);
    try {
      const qs = buildQuery(filters);
      const wellsResponse = await fetch(`/api/wells${qs ? `?${qs}` : ""}`);
      if (!wellsResponse.ok) throw new Error("WELLS_FETCH_FAILED");
      const wells = await wellsResponse.json();

      const dateSlug = new Date().toISOString().slice(0, 10);
      const filename = `${t("dashboard.filePrefix")}-${dateSlug}.pdf`;

      await downloadDashboardReportPdf({
        stats,
        filters,
        wells,
        generatedAt: t("dashboardReport.generatedAt", { date: generatedAt }),
        filename,
        labels: {
          anhTitle: t("wellReport.anhTitle"),
          gopSystem: t("shell.gopSystem"),
          title: t("dashboardReport.title"),
          subtitle: t("dashboardReport.subtitle"),
          footer: t("dashboardReport.footer"),
          generatedAt: t("dashboardReport.generatedAt", { date: generatedAt }),
          scopeTitle: t("dashboardReport.scopeTitle"),
          scopeAll: t("dashboardReport.scopeAll"),
          scopeFiltered: t("dashboardReport.scopeFiltered"),
          activeFiltersTitle: t("dashboardReport.activeFiltersTitle"),
          noActiveFilters: t("dashboardReport.noActiveFilters"),
          summaryTitle: t("dashboardReport.summaryTitle"),
          validationTitle: t("dashboardReport.validationTitle"),
          estadoTitle: t("dashboardReport.estadoTitle"),
          departamentoTitle: t("dashboardReport.departamentoTitle"),
          operadoraTitle: t("dashboardReport.operadoraTitle"),
          wellsTitle: t("dashboardReport.wellsTitle"),
          wellsTruncated: t("dashboardReport.wellsTruncated"),
          uploadsTitle: t("dashboardReport.uploadsTitle"),
          count: t("dashboardReport.count"),
          percentage: t("dashboardReport.percentage"),
          none: t("common.none"),
          statTotal: t("dashboard.statTotal"),
          statUploads: t("dashboard.statUploads"),
          statValid: t("dashboard.statValid"),
          statWarnings: t("dashboard.statWarnings"),
          statErrors: t("dashboard.statErrors"),
          colWell: t("dashboard.colWell"),
          colUwi: t("dashboard.colUwi"),
          colOperator: t("dashboard.colOperator"),
          colDepartment: t("dashboard.colDepartment"),
          colState: t("dashboard.colState"),
          colValidation: t("dashboard.colValidation"),
          colFile: t("dashboard.colFile"),
          colTotal: t("dashboard.colTotal"),
          colValid: t("dashboard.colValid"),
          colErrors: t("dashboard.colErrors"),
          colWarnings: t("dashboard.colWarnings"),
          colDate: t("dashboard.colDate"),
          statusValid: t("status.valid"),
          statusWarning: t("status.warning"),
          statusInvalid: t("status.invalid"),
          statusPending: t("status.pending"),
          filterSearch: t("dashboardReport.filterSearch"),
          filterState: t("dashboardReport.filterState"),
          filterDepartment: t("dashboardReport.filterDepartment"),
          filterOperator: t("dashboardReport.filterOperator"),
          filterValidation: t("dashboardReport.filterValidation"),
        },
      });
    } catch (error) {
      console.error(error);
      setPdfError(t("dashboard.pdfError"));
    } finally {
      setExportingPdf(false);
    }
  }, [filters, generatedAt, stats, t]);

  if (!stats && loading) {
    return <div className="card p-8 text-center text-anh-muted">{t("common.loadingDashboard")}</div>;
  }

  if (!stats) {
    return <div className="card p-8 text-center text-anh-muted">{t("common.loadingStats")}</div>;
  }

  const validationData = [
    { name: t("validationFilter.valid"), status: "valid" as const, value: stats.valid_wells },
    { name: t("validationFilter.warning"), status: "warning" as const, value: stats.wells_with_warnings },
    { name: t("validationFilter.invalid"), status: "invalid" as const, value: stats.wells_with_errors },
  ];
  const validationTotal = validationData.reduce((sum, item) => sum + item.value, 0);
  const estadoData = Object.entries(stats.by_estado).map(([name, value]) => ({ name, value }));
  const estadoTotal = estadoData.reduce((sum, item) => sum + item.value, 0);
  const deptoData = Object.entries(stats.by_departamento)
    .slice(0, 8)
    .map(([fullName, value]) => {
      const label = fixEncoding(fullName);
      const display = label.length > 18 ? `${label.slice(0, 18)}…` : label;
      return { name: display, fullName, value };
    });
  const operadoraData = Object.entries(stats.by_operadora)
    .slice(0, 6)
    .map(([fullName, value]) => {
      const display = fullName.length > 22 ? `${fullName.slice(0, 22)}…` : fullName;
      return { name: display, fullName, value };
    });

  return (
    <div>
      <PageHeader
        title={t("dashboard.title")}
        description={t(isAnh ? "dashboard.descriptionAnh" : "dashboard.description")}
        action={
          <div className="flex flex-col items-stretch gap-1 sm:items-end">
            <button
              type="button"
              className="btn-primary inline-flex items-center justify-center gap-2 text-xs sm:text-sm"
              onClick={handleExportDashboardPdf}
              disabled={loading || exportingPdf}
            >
              <Download className="h-4 w-4" />
              {exportingPdf ? t("dashboard.generatingPdf") : t("dashboard.downloadPdf")}
            </button>
            {pdfError && <p className="text-right text-xs text-red-600 dark:text-red-300">{pdfError}</p>}
          </div>
        }
      />

      <DashboardFiltersBar
        filters={{ ...filters, q: searchInput }}
        operadoras={stats.filter_options.operadoras}
        departamentos={stats.filter_options.departamentos}
        estados={stats.filter_options.estados}
        validationStatuses={stats.filter_options.validation_statuses}
        hideValidation={isAnh}
        filtersHint={isAnh ? t("dashboard.filtersHintAnh") : undefined}
        filteredCount={stats.total_wells}
        catalogCount={stats.catalog_total_wells}
        onFilterChange={(key, value) => {
          if (key === "q") {
            handleSearchChange(value);
            return;
          }
          setFilter(key, value);
        }}
        onDepartamentosChange={setDepartamentosFilter}
        wellCount={filteredMapPoints.length}
      />

      {activeFilterChips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-anh-muted">{t("common.activeFilters")}</span>
          {activeFilterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-anh-black"
              style={{ background: "linear-gradient(90deg, #ffe60066, #ff8c0066)" }}
            >
              {chip.label}:{" "}
              {chip.id.startsWith("validation_status")
                ? validationLabel(chip.value)
                : fixEncoding(chip.value)}
              <span aria-hidden>×</span>
            </button>
          ))}
          <button type="button" onClick={clearFilters} className="btn-secondary text-xs">
            {t("common.clearAll")}
          </button>
        </div>
      )}

      <div className="card mb-4 overflow-hidden p-3 sm:mb-6 sm:p-4" data-tour="dashboard-map">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2 sm:mb-3">
          <div>
            <h3 className="font-bold text-anh-primary">{t("dashboard.mapTitle")}</h3>
            <p className="text-xs text-anh-muted">{t("dashboard.mapHint")}</p>
          </div>
        </div>
        <WellsMap
          allWells={allMapPoints}
          filteredWells={filteredMapPoints}
          filters={filters}
          departamentos={stats.filter_options.departamentos}
          onFilter={applyCrossFilter}
          onToggleDepartamento={toggleDepartamentoFilter}
          onWellSelect={setSelectedWellId}
          loading={mapLoading || loading}
        />
      </div>

      {selectedWellId && (
        <WellDetailModal wellId={selectedWellId} onClose={() => setSelectedWellId(null)} />
      )}

      <div
        className={`mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:gap-4 ${isAnh ? "md:grid-cols-4" : "md:grid-cols-3 xl:grid-cols-5"} ${loading ? "opacity-60" : ""}`}
        data-tour="dashboard-stats"
      >
        <StatCard
          label={t("dashboard.statTotal")}
          value={
            hasActiveFilters(filters)
              ? `${stats.total_wells} / ${stats.catalog_total_wells}`
              : stats.total_wells
          }
          active={hasActiveFilters(filters)}
          onClick={hasActiveFilters(filters) ? clearFilters : undefined}
        />
        <StatCard label={t("dashboard.statUploads")} value={stats.total_uploads} />
        {isAnh ? (
          <>
            <StatCard label={t("dashboard.statOperators")} value={Object.keys(stats.by_operadora).length} />
            <StatCard label={t("dashboard.statDepartments")} value={Object.keys(stats.by_departamento).length} />
          </>
        ) : (
          <>
            <StatCard
              label={t("dashboard.statValid")}
              value={stats.valid_wells}
              tone="success"
              active={filters.validation_status === "valid"}
              onClick={() => applyCrossFilter("validation_status", "valid")}
            />
            <StatCard
              label={t("dashboard.statWarnings")}
              value={stats.wells_with_warnings}
              tone="warning"
              active={filters.validation_status === "warning"}
              onClick={() => applyCrossFilter("validation_status", "warning")}
            />
            <StatCard
              label={t("dashboard.statErrors")}
              value={stats.wells_with_errors}
              tone="danger"
              active={filters.validation_status === "invalid"}
              onClick={() => applyCrossFilter("validation_status", "invalid")}
            />
          </>
        )}
      </div>

      <div className={`grid gap-6 lg:grid-cols-2 ${loading ? "opacity-60" : ""}`} data-tour="dashboard-charts">
        {!isAnh && (
        <div className="card p-3 sm:p-4">
          <h3 className="mb-1 font-bold text-anh-primary">{t("dashboard.chartValidationTitle")}</h3>
          <p className="mb-4 text-xs text-anh-muted">{t("dashboard.chartValidationHint")}</p>
          <div className={isCompactCharts ? "h-80" : "h-64"}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={validationData}
                  dataKey="value"
                  nameKey="name"
                  cx={isCompactCharts ? "50%" : "42%"}
                  cy={isCompactCharts ? "44%" : "50%"}
                  innerRadius={isCompactCharts ? 40 : 52}
                  outerRadius={isCompactCharts ? 68 : 80}
                  paddingAngle={2}
                  label={
                    isCompactCharts
                      ? false
                      : { fill: chartTheme.pieLabelFill, fontSize: 11, fontWeight: 600 }
                  }
                  style={{ cursor: "pointer" }}
                  onClick={(entry) => {
                    const status = (entry as { payload?: { status?: string } }).payload?.status;
                    if (status) applyCrossFilter("validation_status", status);
                  }}
                >
                  {validationData.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={chartTheme.validationPieColors[entry.status]}
                      opacity={
                        filters.validation_status && filters.validation_status !== entry.status ? 0.3 : 1
                      }
                      stroke={filters.validation_status === entry.status ? chartTheme.pieStroke : "transparent"}
                      strokeWidth={filters.validation_status === entry.status ? 2 : 0}
                    />
                  ))}
                  <Label
                    value={validationTotal}
                    position="center"
                    fill={chartTheme.pieLabelFill}
                    fontSize={isCompactCharts ? 18 : 22}
                    fontWeight={800}
                  />
                </Pie>
                <Tooltip
                  formatter={(value) => [t("common.wellsCount", { count: Number(value) }), t("common.quantity")]}
                  contentStyle={chartTheme.tooltipContentStyle}
                  labelStyle={chartTheme.tooltipLabelStyle}
                />
                <Legend
                  layout={isCompactCharts ? "horizontal" : "vertical"}
                  align={isCompactCharts ? "center" : "right"}
                  verticalAlign={isCompactCharts ? "bottom" : "middle"}
                  iconType="circle"
                  iconSize={10}
                  wrapperStyle={isCompactCharts ? { paddingTop: 8 } : undefined}
                  onClick={(entry) => {
                    const match = validationData.find((item) => item.name === entry.value);
                    if (match) applyCrossFilter("validation_status", match.status);
                  }}
                  formatter={(value: string) => (
                    <span
                      className={`cursor-pointer text-xs ${
                        validationData.find((item) => item.name === value)?.status === filters.validation_status
                          ? "font-bold text-anh-secondary"
                          : "text-anh-text"
                      }`}
                    >
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}

        <div className="card p-3 sm:p-4">
          <h3 className="mb-1 font-bold text-anh-primary">{t("dashboard.chartStateTitle")}</h3>
          <p className="mb-4 text-xs text-anh-muted">{t("dashboard.chartStateHint")}</p>
          <div className={isCompactCharts ? "h-80" : "h-64"}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={estadoData}
                  dataKey="value"
                  nameKey="name"
                  cx={isCompactCharts ? "50%" : "42%"}
                  cy={isCompactCharts ? "44%" : "50%"}
                  innerRadius={isCompactCharts ? 40 : 52}
                  outerRadius={isCompactCharts ? 68 : 80}
                  paddingAngle={1}
                  label={
                    isCompactCharts
                      ? false
                      : { fill: chartTheme.pieLabelFill, fontSize: 11, fontWeight: 600 }
                  }
                  style={{ cursor: "pointer" }}
                  onClick={(entry) => entry?.name && applyCrossFilter("estado", String(entry.name))}
                >
                  {estadoData.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={chartTheme.pieColors[i % chartTheme.pieColors.length]}
                      opacity={filters.estado && filters.estado !== entry.name ? 0.3 : 1}
                      stroke={filters.estado === entry.name ? chartTheme.pieStroke : "transparent"}
                      strokeWidth={filters.estado === entry.name ? 2 : 0}
                    />
                  ))}
                  <Label
                    value={estadoTotal}
                    position="center"
                    fill={chartTheme.pieLabelFill}
                    fontSize={isCompactCharts ? 18 : 22}
                    fontWeight={800}
                  />
                </Pie>
                <Tooltip
                  formatter={(value) => [t("common.wellsCount", { count: Number(value) }), t("common.quantity")]}
                  contentStyle={chartTheme.tooltipContentStyle}
                  labelStyle={chartTheme.tooltipLabelStyle}
                />
                <Legend
                  layout={isCompactCharts ? "horizontal" : "vertical"}
                  align={isCompactCharts ? "center" : "right"}
                  verticalAlign={isCompactCharts ? "bottom" : "middle"}
                  iconType="circle"
                  iconSize={10}
                  wrapperStyle={isCompactCharts ? { paddingTop: 8 } : undefined}
                  onClick={(entry) => entry.value && applyCrossFilter("estado", String(entry.value))}
                  formatter={(value: string) => (
                    <span
                      className={`cursor-pointer text-xs ${filters.estado === value ? "font-bold text-anh-secondary" : "text-anh-text"}`}
                    >
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {!isOperadora && (
        <div className="card p-3 sm:p-4">
          <h3 className="mb-1 font-bold text-anh-primary">{t("dashboard.chartOpTitle")}</h3>
          <p className="mb-4 text-xs text-anh-muted">{t("dashboard.chartOpHint")}</p>
          <div className={isCompactCharts ? "h-72" : "h-64"}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={operadoraData}
                layout="vertical"
                margin={{ left: isCompactCharts ? 4 : 10, right: isCompactCharts ? 20 : 28 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                <XAxis type="number" tick={{ fontSize: 10, fill: chartTheme.axisTick }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={isCompactCharts ? 88 : 120}
                  tick={{ fontSize: 10, fill: chartTheme.axisTick }}
                />
                <Tooltip
                  formatter={(value) => [t("common.wellsCount", { count: Number(value) }), t("common.quantity")]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                  contentStyle={chartTheme.tooltipContentStyle}
                  labelStyle={chartTheme.tooltipLabelStyle}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 4, 4, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={(data) => {
                    const fullName = (data as { payload?: { fullName?: string } }).payload?.fullName;
                    if (fullName) applyCrossFilter("operadora", fullName);
                  }}
                >
                  {operadoraData.map((entry) => (
                    <Cell
                      key={entry.fullName}
                      fill={filters.operadora === entry.fullName ? "#ff8c00" : "#e8381a"}
                      opacity={filters.operadora && filters.operadora !== entry.fullName ? 0.35 : 1}
                    />
                  ))}
                  <LabelList dataKey="value" position="right" fill={chartTheme.barLabelFill} fontSize={11} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}

        <div className="card p-3 sm:p-4">
          <h3 className="mb-1 font-bold text-anh-primary">{t("dashboard.chartDeptTitle")}</h3>
          <p className="mb-4 text-xs text-anh-muted">{t("dashboard.chartDeptHint")}</p>
          <div className={isCompactCharts ? "h-72" : "h-64"}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={deptoData}
                layout="vertical"
                margin={{ left: isCompactCharts ? 4 : 10, right: isCompactCharts ? 20 : 28 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                <XAxis type="number" tick={{ fontSize: 10, fill: chartTheme.axisTick }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={isCompactCharts ? 72 : 110}
                  tick={{ fontSize: 10, fill: chartTheme.axisTick }}
                />
                <Tooltip
                  formatter={(value) => [t("common.wellsCount", { count: Number(value) }), t("common.quantity")]}
                  labelFormatter={(_, payload) => fixEncoding(payload?.[0]?.payload?.fullName ?? "")}
                  contentStyle={chartTheme.tooltipContentStyle}
                  labelStyle={chartTheme.tooltipLabelStyle}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 4, 4, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={(data) => {
                    const fullName = (data as { payload?: { fullName?: string } }).payload?.fullName;
                    if (fullName) applyCrossFilter("departamentos", fullName);
                  }}
                >
                  {deptoData.map((entry) => (
                    <Cell
                      key={entry.fullName}
                      fill={isDepartamentoSelected(filters.departamentos, entry.fullName) ? "#e8381a" : "#ff8c00"}
                      opacity={
                        filters.departamentos?.length && !isDepartamentoSelected(filters.departamentos, entry.fullName)
                          ? 0.35
                          : 1
                      }
                    />
                  ))}
                  <LabelList dataKey="value" position="right" fill={chartTheme.barLabelFill} fontSize={11} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-3 sm:p-4 lg:col-span-2">
          <h3 className="mb-1 font-bold text-anh-primary">
            {t(isOperadora ? "dashboard.sankeyTitleOperadora" : "dashboard.sankeyTitle")}
          </h3>
          <p className="mb-4 text-xs text-anh-muted">{t("dashboard.sankeyHint")}</p>
          <WellsSankeyChart
            data={stats.sankey}
            filters={filters}
            onFilter={applyCrossFilter}
            thirdColumn={isOperadora ? "validacion" : "operadora"}
            height={isCompactCharts ? 420 : 380}
          />
        </div>
      </div>

      <div className="card mt-6 overflow-hidden" data-tour="wells-table">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-anh-border px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <div>
            <h3 className="font-bold text-anh-primary">{t("dashboard.tableTitle")}</h3>
            <p className="text-xs text-anh-muted">
              {showAllWells
                ? t("dashboard.tableHintFull", { count: tableWells.length })
                : t("dashboard.tableHint", {
                    count: stats.filtered_wells.length,
                    limit: tablePageSize,
                  })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!showAllWells && (
              <label className="flex items-center gap-2 text-xs text-anh-muted">
                <span>{t("dashboard.tablePageSize")}</span>
                <select
                  value={tablePageSize}
                  onChange={(event) => setTablePageSize(Number(event.target.value) as TablePageSize)}
                  className="input-field w-auto py-1 pr-8 text-xs"
                  aria-label={t("dashboard.tablePageSize")}
                >
                  {TABLE_PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              className="btn-secondary w-full text-xs sm:w-auto"
              onClick={() => setShowAllWells((value) => !value)}
            >
              {showAllWells ? t("dashboard.showSummary") : t("dashboard.fullQuery")}
            </button>
          </div>
        </div>
        <div>
          {loadingExpanded ? (
            <p className="p-8 text-center text-anh-muted">{t("common.loading")}</p>
          ) : (
            <WellsTableView
              wells={tableWells}
              selectedWellId={selectedWellId}
              onSelect={setSelectedWellId}
              onCrossFilter={applyCrossFilter}
              labels={{
                well: t("dashboard.colWell"),
                uwi: t("dashboard.colUwi"),
                operator: t("dashboard.colOperator"),
                department: t("dashboard.colDepartment"),
                state: t("dashboard.colState"),
                validation: t("dashboard.colValidation"),
                none: t("common.none"),
              }}
            />
          )}
        </div>
        <p className="border-t border-anh-border px-4 py-2 text-xs text-anh-muted">{t("dashboard.rowHint")}</p>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-anh-border px-3 py-2.5 sm:px-4 sm:py-3">
          <h3 className="font-bold text-anh-primary">{t("dashboard.uploadsTitle")}</h3>
        </div>

        <div className="divide-y divide-anh-border md:hidden">
          {stats.recent_uploads.map((upload) => (
            <div key={upload.id} className="space-y-2 px-3 py-3 text-sm sm:px-4">
              <p className="break-words font-medium text-anh-primary">{upload.filename}</p>
              <p className="text-anh-muted">{upload.operadora ?? t("common.none")}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-anh-muted">{t("dashboard.colTotal")}: </span>
                  {upload.total_records}
                </div>
                <div>
                  <span className="text-anh-muted">{t("dashboard.colValid")}: </span>
                  <span className="text-green-700 dark:text-green-300">{upload.valid_records}</span>
                </div>
                <div>
                  <span className="text-anh-muted">{t("dashboard.colErrors")}: </span>
                  <span className="text-red-700 dark:text-red-300">{upload.invalid_records}</span>
                </div>
                <div>
                  <span className="text-anh-muted">{t("dashboard.colWarnings")}: </span>
                  <span className="text-amber-700 dark:text-amber-300">{upload.warning_records}</span>
                </div>
              </div>
              <p className="text-xs text-anh-muted">
                {new Date(upload.created_at).toLocaleString(locale === "en" ? "en-US" : "es-CO")}
              </p>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead className="bg-anh-bg text-left text-anh-muted">
              <tr>
                <th className="px-4 py-3">{t("dashboard.colFile")}</th>
                <th className="px-4 py-3">{t("dashboard.colOperator")}</th>
                <th className="px-4 py-3">{t("dashboard.colTotal")}</th>
                <th className="px-4 py-3">{t("dashboard.colValid")}</th>
                <th className="px-4 py-3">{t("dashboard.colErrors")}</th>
                <th className="px-4 py-3">{t("dashboard.colWarnings")}</th>
                <th className="px-4 py-3">{t("dashboard.colDate")}</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_uploads.map((upload) => (
                <tr key={upload.id} className="border-t border-anh-border">
                  <td className="px-4 py-3 font-medium">{upload.filename}</td>
                  <td className="px-4 py-3">{upload.operadora ?? t("common.none")}</td>
                  <td className="px-4 py-3">{upload.total_records}</td>
                  <td className="px-4 py-3 text-green-700">{upload.valid_records}</td>
                  <td className="px-4 py-3 text-red-700">{upload.invalid_records}</td>
                  <td className="px-4 py-3 text-amber-700">{upload.warning_records}</td>
                  <td className="px-4 py-3 text-anh-muted">
                    {new Date(upload.created_at).toLocaleString(locale === "en" ? "en-US" : "es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
