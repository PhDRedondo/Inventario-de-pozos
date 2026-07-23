import type { DashboardFilters, WellMapPoint } from "./types";
import { deptNamesMatch } from "./geo";

export function parseDepartamentosParam(value: string | null | undefined): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

export function serializeDepartamentos(departamentos: string[] | undefined): string | undefined {
  if (!departamentos?.length) return undefined;
  return departamentos.join(",");
}

export function toggleDepartamento(
  current: string[] | undefined,
  departamento: string,
): string[] | undefined {
  const selected = current ?? [];
  const alreadySelected = selected.some((item) => deptNamesMatch(item, departamento));
  const next = alreadySelected
    ? selected.filter((item) => !deptNamesMatch(item, departamento))
    : [...selected, departamento];
  return next.length > 0 ? next : undefined;
}

export function isDepartamentoSelected(
  departamentos: string[] | undefined,
  departamento: string,
): boolean {
  return Boolean(departamentos?.some((item) => deptNamesMatch(item, departamento)));
}

export function parseDashboardFiltersFromSearchParams(searchParams: URLSearchParams): DashboardFilters {
  const filters: DashboardFilters = {};
  const estado = searchParams.get("estado");
  const departamento = searchParams.get("departamento");
  const operadora = searchParams.get("operadora");
  const validation_status = searchParams.get("validation_status");
  const tipo_objetivo = searchParams.get("tipo_objetivo");
  const q = searchParams.get("q");

  if (estado) filters.estado = estado;
  const departamentos = parseDepartamentosParam(departamento);
  if (departamentos) filters.departamentos = departamentos;
  if (operadora) filters.operadora = operadora;
  if (validation_status) filters.validation_status = validation_status;
  if (tipo_objetivo) filters.tipo_objetivo = tipo_objetivo;
  if (q) filters.q = q;

  return filters;
}

export function hasDashboardFilters(filters: DashboardFilters): boolean {
  return Object.keys(filters).length > 0;
}

export function hasActiveFilters(filters: DashboardFilters): boolean {
  return Boolean(
    filters.q ||
      filters.estado ||
      filters.departamentos?.length ||
      filters.operadora ||
      filters.validation_status ||
      filters.tipo_objetivo,
  );
}

export function matchesDashboardFilters<T extends WellMapPoint>(
  point: T,
  filters: DashboardFilters,
): boolean {
  if (filters.estado && point.estado_pozo !== filters.estado) return false;
  if (filters.departamentos?.length) {
    if (!point.departamento || !filters.departamentos.some((d) => deptNamesMatch(d, point.departamento!))) {
      return false;
    }
  }
  if (filters.operadora && point.operadora !== filters.operadora) return false;
  if (filters.validation_status && point.validation_status !== filters.validation_status) return false;
  if (filters.tipo_objetivo && point.tipo_objetivo !== filters.tipo_objetivo) return false;
  if (filters.q) {
    const q = filters.q.toLowerCase();
    const matches = [point.nombre_pozo_sgc, point.uwi_fiscalizado, point.operadora].some((value) =>
      value?.toLowerCase().includes(q),
    );
    if (!matches) return false;
  }
  return true;
}

export function applyDashboardFilters<T extends WellMapPoint>(points: T[], filters: DashboardFilters): T[] {
  if (!hasActiveFilters(filters)) return points;
  return points.filter((point) => matchesDashboardFilters(point, filters));
}
