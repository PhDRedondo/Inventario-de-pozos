import { fixEncoding } from "./geo";
import type { DashboardSankeyData } from "./types";

export type SankeyColumn = "departamento" | "estado" | "operadora" | "validacion";

export type SankeyThirdColumn = "operadora" | "validacion";

export interface SankeyChartNode {
  name: string;
  column: SankeyColumn;
  filterValue: string;
}

function truncateLabel(value: string, max = 26): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function displayLabel(column: SankeyColumn, value: string): string {
  if (column === "departamento") return truncateLabel(fixEncoding(value), 22);
  if (column === "operadora") return truncateLabel(value, 28);
  if (column === "validacion") return value;
  return truncateLabel(value, 22);
}

export function buildSankeyChartData(
  data: DashboardSankeyData,
  options?: { thirdColumn?: SankeyThirdColumn },
) {
  const thirdColumn = options?.thirdColumn ?? "operadora";
  const nodes: SankeyChartNode[] = [];
  const index = new Map<string, number>();

  const ensureNode = (column: SankeyColumn, value: string) => {
    const key = `${column}::${value}`;
    if (!index.has(key)) {
      index.set(key, nodes.length);
      nodes.push({
        name: displayLabel(column, value),
        column,
        filterValue: value,
      });
    }
    return index.get(key)!;
  };

  const links: Array<{ source: number; target: number; value: number }> = [];

  for (const row of data.dept_to_estado) {
    if (!row.source || !row.target || row.count <= 0) continue;
    links.push({
      source: ensureNode("departamento", row.source),
      target: ensureNode("estado", row.target),
      value: row.count,
    });
  }

  const thirdLinks =
    thirdColumn === "validacion" ? data.estado_to_validation : data.estado_to_operadora;
  const thirdNodeColumn: SankeyColumn = thirdColumn === "validacion" ? "validacion" : "operadora";

  for (const row of thirdLinks) {
    if (!row.source || !row.target || row.count <= 0) continue;
    links.push({
      source: ensureNode("estado", row.source),
      target: ensureNode(thirdNodeColumn, row.target),
      value: row.count,
    });
  }

  return { nodes, links };
}
