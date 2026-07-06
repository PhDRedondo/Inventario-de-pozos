"use client";

import { DepartmentMultiSelect } from "@/components/DepartmentMultiSelect";
import type { DashboardFilters } from "@/lib/types";
import { useT } from "@/context/AppPreferences";

interface DashboardFiltersBarProps {
  filters: DashboardFilters;
  operadoras: string[];
  departamentos: string[];
  estados: string[];
  validationStatuses: string[];
  onFilterChange: (key: keyof DashboardFilters, value: string) => void;
  onDepartamentosChange: (departamentos: string[] | undefined) => void;
  wellCount?: number;
  filteredCount?: number;
  catalogCount?: number;
  hideValidation?: boolean;
  filtersHint?: string;
}

export function DashboardFiltersBar({
  filters,
  operadoras,
  departamentos,
  estados,
  validationStatuses,
  onFilterChange,
  onDepartamentosChange,
  wellCount,
  filteredCount,
  catalogCount,
  hideValidation = false,
  filtersHint,
}: DashboardFiltersBarProps) {
  const t = useT();

  const validationLabel = (value: string) => {
    if (value === "valid") return t("validationFilter.valid");
    if (value === "warning") return t("validationFilter.warning");
    if (value === "invalid") return t("validationFilter.invalid");
    return value;
  };

  return (
    <div className="card mb-3 p-3 sm:mb-4 sm:p-4" data-tour="dashboard-filters">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:mb-3">
        <div>
          <h3 className="font-bold text-anh-primary">{t("dashboard.filtersTitle")}</h3>
          <p className="text-xs text-anh-muted">{filtersHint ?? t("dashboard.filtersHint")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filteredCount !== undefined && catalogCount !== undefined && filteredCount !== catalogCount && (
            <span className="rounded-full bg-anh-secondary/15 px-3 py-1 text-xs font-semibold text-anh-secondary">
              {t("dashboard.filteredOfTotal", { filtered: filteredCount, total: catalogCount })}
            </span>
          )}
          {wellCount !== undefined && (
            <span className="rounded-full bg-anh-bg px-3 py-1 text-xs font-semibold text-anh-muted">
              {t("dashboard.wellsOnMap", { count: wellCount })}
            </span>
          )}
        </div>
      </div>
      <div className={`grid gap-3 sm:grid-cols-2 ${hideValidation ? "lg:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-3 xl:grid-cols-6"}`}>
        <div className="sm:col-span-2 xl:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-anh-muted">{t("dashboard.searchWell")}</label>
          <input
            className="input-field"
            placeholder={t("dashboard.searchPlaceholder")}
            value={filters.q ?? ""}
            onChange={(e) => onFilterChange("q", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-anh-muted">{t("common.operator")}</label>
          <select
            className="input-field"
            value={filters.operadora ?? ""}
            onChange={(e) => onFilterChange("operadora", e.target.value)}
          >
            <option value="">{t("common.all")}</option>
            {operadoras.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-anh-muted">{t("common.department")}</label>
          <DepartmentMultiSelect
            options={departamentos}
            selected={filters.departamentos ?? []}
            onChange={onDepartamentosChange}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-anh-muted">{t("common.state")}</label>
          <select
            className="input-field"
            value={filters.estado ?? ""}
            onChange={(e) => onFilterChange("estado", e.target.value)}
          >
            <option value="">{t("common.all")}</option>
            {estados.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </div>
        {!hideValidation && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-anh-muted">{t("common.validation")}</label>
            <select
              className="input-field"
              value={filters.validation_status ?? ""}
              onChange={(e) => onFilterChange("validation_status", e.target.value)}
            >
              <option value="">{t("common.all")}</option>
              {validationStatuses.map((status) => (
                <option key={status} value={status}>
                  {validationLabel(status)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
