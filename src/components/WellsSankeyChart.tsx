"use client";

import { useCallback, useMemo } from "react";
import { Rectangle, ResponsiveContainer, Sankey, Tooltip } from "recharts";
import type { NodeProps } from "recharts/types/chart/Sankey";
import { useAppPreferences } from "@/context/AppPreferences";
import { getChartTheme } from "@/lib/chart-theme";
import { fixEncoding } from "@/lib/geo";
import { isDepartamentoSelected } from "@/lib/filters";
import {
  buildSankeyChartData,
  type SankeyChartNode,
  type SankeyColumn,
  type SankeyThirdColumn,
} from "@/lib/sankey-data";
import type { DashboardFilters, DashboardSankeyData } from "@/lib/types";

const COLUMN_COLORS: Record<SankeyColumn, string[]> = {
  departamento: ["#ff8c00", "#e8381a", "#ffe600", "#f59e0b", "#fb923c", "#ea580c"],
  estado: ["#1a1a1a", "#404040", "#525252", "#737373", "#64748b", "#475569"],
  operadora: ["#e8381a", "#ff8c00", "#c0392b", "#d97706", "#b45309", "#9a3412"],
  validacion: ["#27AE60", "#E67E22", "#C0392B", "#2E8B57", "#D97706", "#B91C1C"],
};

const VALIDATION_COLOR: Record<string, string> = {
  valid: "#27AE60",
  warning: "#E67E22",
  invalid: "#C0392B",
};

interface WellsSankeyChartProps {
  data: DashboardSankeyData;
  filters: DashboardFilters;
  onFilter: (key: keyof DashboardFilters, value: string) => void;
  height?: number;
  thirdColumn?: SankeyThirdColumn;
}

function nodeMatchesFilter(node: SankeyChartNode, filters: DashboardFilters): boolean {
  if (node.column === "departamento") {
    return isDepartamentoSelected(filters.departamentos, node.filterValue);
  }
  if (node.column === "estado") {
    return filters.estado === node.filterValue;
  }
  if (node.column === "operadora") {
    return filters.operadora === node.filterValue;
  }
  if (node.column === "validacion") {
    return filters.validation_status === node.filterValue;
  }
  return false;
}

function nodeDimmed(node: SankeyChartNode, filters: DashboardFilters): boolean {
  const hasDept = Boolean(filters.departamentos?.length);
  const hasEstado = Boolean(filters.estado);
  const hasOp = Boolean(filters.operadora);
  const hasValidation = Boolean(filters.validation_status);

  if (!hasDept && !hasEstado && !hasOp && !hasValidation) return false;

  if (node.column === "departamento" && hasDept && !isDepartamentoSelected(filters.departamentos, node.filterValue)) {
    return true;
  }
  if (node.column === "estado" && hasEstado && filters.estado !== node.filterValue) {
    return true;
  }
  if (node.column === "operadora" && hasOp && filters.operadora !== node.filterValue) {
    return true;
  }
  if (node.column === "validacion" && hasValidation && filters.validation_status !== node.filterValue) {
    return true;
  }
  return false;
}

function filterKeyForColumn(column: SankeyColumn): keyof DashboardFilters {
  if (column === "departamento") return "departamentos";
  if (column === "estado") return "estado";
  if (column === "validacion") return "validation_status";
  return "operadora";
}

function formatNodeLabel(node: SankeyChartNode, validationLabel: (status: string) => string): string {
  if (node.column === "departamento") return fixEncoding(node.filterValue);
  if (node.column === "validacion") return validationLabel(node.filterValue);
  return node.filterValue;
}

export function WellsSankeyChart({
  data,
  filters,
  onFilter,
  height = 380,
  thirdColumn = "operadora",
}: WellsSankeyChartProps) {
  const { t, theme } = useAppPreferences();
  const chartTheme = getChartTheme(theme);

  const validationLabel = useCallback(
    (status: string) => {
      if (status === "valid") return t("validationFilter.valid");
      if (status === "warning") return t("validationFilter.warning");
      if (status === "invalid") return t("validationFilter.invalid");
      return status;
    },
    [t],
  );

  const chartData = useMemo(() => {
    const raw = buildSankeyChartData(data, { thirdColumn });
    return {
      ...raw,
      nodes: raw.nodes.map((node) =>
        node.column === "validacion"
          ? { ...node, name: validationLabel(node.filterValue) }
          : node,
      ),
    };
  }, [data, thirdColumn, validationLabel]);

  const colorByNode = useMemo(() => {
    const counters: Record<SankeyColumn, number> = {
      departamento: 0,
      estado: 0,
      operadora: 0,
      validacion: 0,
    };
    const map = new Map<number, string>();
    chartData.nodes.forEach((node, index) => {
      let color: string;
      if (node.column === "validacion") {
        color = VALIDATION_COLOR[node.filterValue] ?? COLUMN_COLORS.validacion[counters.validacion % COLUMN_COLORS.validacion.length];
      } else {
        const palette = COLUMN_COLORS[node.column];
        color = palette[counters[node.column] % palette.length];
      }
      counters[node.column] += 1;
      map.set(index, color);
    });
    return map;
  }, [chartData.nodes]);

  if (!chartData.links.length) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-anh-border text-sm text-anh-muted"
        style={{ height }}
      >
        {t("dashboard.sankeyEmpty")}
      </div>
    );
  }

  const thirdLabel =
    thirdColumn === "validacion" ? t("common.validation") : t("common.operator");
  const columnLabels = [t("common.department"), t("common.state"), thirdLabel] as const;

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2 px-1 text-center text-[10px] font-bold uppercase tracking-wide text-anh-muted sm:text-xs">
        {columnLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={chartData}
            margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
            nodePadding={14}
            linkCurvature={0.5}
            iterations={64}
            onClick={(item, type) => {
              if (type !== "node") return;
              const payload = (item as NodeProps).payload as unknown as SankeyChartNode;
              if (!payload?.column || !payload.filterValue) return;
              onFilter(filterKeyForColumn(payload.column), payload.filterValue);
            }}
            node={(props: NodeProps) => {
              const payload = props.payload as unknown as SankeyChartNode;
              const fill = colorByNode.get(props.index) ?? "#ff8c00";
              const dimmed = nodeDimmed(payload, filters);
              const active = nodeMatchesFilter(payload, filters);
              return (
                <Rectangle
                  x={props.x}
                  y={props.y}
                  width={props.width}
                  height={props.height}
                  fill={fill}
                  fillOpacity={dimmed ? 0.2 : active ? 1 : 0.82}
                  stroke={active ? chartTheme.pieStroke : "transparent"}
                  strokeWidth={active ? 2 : 0}
                  radius={3}
                  style={{ cursor: "pointer" }}
                />
              );
            }}
            link={{
              stroke: theme === "dark" ? "#525252" : "#d4d4d4",
              strokeOpacity: 0.35,
            }}
          >
            <Tooltip
              contentStyle={chartTheme.tooltipContentStyle}
              labelStyle={chartTheme.tooltipLabelStyle}
              formatter={(value, _name, item) => {
                const count = Number(value ?? 0);
                const payload = item?.payload as
                  | { source?: SankeyChartNode; target?: SankeyChartNode }
                  | undefined;
                const source = payload?.source;
                const target = payload?.target;
                if (source && target) {
                  const from = formatNodeLabel(source, validationLabel);
                  const to = formatNodeLabel(target, validationLabel);
                  return [t("common.wellsCount", { count }), `${from} → ${to}`];
                }
                return [t("common.wellsCount", { count }), item?.name ?? ""];
              }}
            />
          </Sankey>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
