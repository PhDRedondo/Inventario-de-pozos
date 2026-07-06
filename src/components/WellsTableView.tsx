"use client";

import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui";
import { fixEncoding } from "@/lib/geo";
import type { DashboardFilters } from "@/lib/types";

export interface WellTableRow {
  id: number;
  nombre_pozo_sgc: string | null;
  uwi_fiscalizado: string | null;
  operadora: string | null;
  departamento: string | null;
  estado_pozo: string | null;
  validation_status: string | null | undefined;
}

interface WellsTableViewProps {
  wells: WellTableRow[];
  selectedWellId: number | null;
  onSelect: (wellId: number) => void;
  onCrossFilter?: (key: keyof DashboardFilters, value: string) => void;
  labels: {
    well: string;
    uwi: string;
    operator: string;
    department: string;
    state: string;
    validation: string;
    none: string;
  };
}

function CrossFilterButton({
  value,
  active,
  onClick,
  children,
  className = "",
}: {
  value: string | null | undefined;
  active?: boolean;
  onClick?: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  if (!value || !onClick) {
    return <span className={className}>{children}</span>;
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick(value);
      }}
      className={`rounded px-1 py-0.5 text-left transition hover:bg-anh-secondary/15 ${
        active ? "bg-anh-secondary/20 font-semibold text-anh-secondary" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function WellsTableView({
  wells,
  selectedWellId,
  onSelect,
  onCrossFilter,
  labels,
}: WellsTableViewProps) {
  return (
    <>
      <div className="divide-y divide-anh-border md:hidden">
        {wells.map((well) => (
          <div
            key={well.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(well.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(well.id);
              }
            }}
            className={`w-full cursor-pointer px-4 py-3 text-left transition hover:bg-anh-bg/60 ${
              selectedWellId === well.id ? "bg-anh-bg" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <CrossFilterButton
                  value={well.nombre_pozo_sgc}
                  onClick={onCrossFilter ? (value) => onCrossFilter("q", value) : undefined}
                  className="block w-full truncate font-semibold text-anh-primary"
                >
                  {well.nombre_pozo_sgc ?? labels.none}
                </CrossFilterButton>
                <p className="mt-0.5 truncate font-mono text-xs text-anh-muted">
                  {well.uwi_fiscalizado ?? labels.none}
                </p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (well.validation_status && onCrossFilter) {
                    onCrossFilter("validation_status", well.validation_status);
                  }
                }}
              >
                <StatusBadge status={well.validation_status} />
              </button>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div className="min-w-0">
                <dt className="text-anh-muted">{labels.operator}</dt>
                <dd className="truncate">
                  <CrossFilterButton
                    value={well.operadora}
                    onClick={onCrossFilter ? (value) => onCrossFilter("operadora", value) : undefined}
                  >
                    {well.operadora ?? labels.none}
                  </CrossFilterButton>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-anh-muted">{labels.department}</dt>
                <dd className="truncate">
                  <CrossFilterButton
                    value={well.departamento}
                    onClick={onCrossFilter ? (value) => onCrossFilter("departamentos", value) : undefined}
                  >
                    {fixEncoding(well.departamento ?? labels.none)}
                  </CrossFilterButton>
                </dd>
              </div>
              <div className="min-w-0 col-span-2">
                <dt className="text-anh-muted">{labels.state}</dt>
                <dd className="truncate">
                  <CrossFilterButton
                    value={well.estado_pozo}
                    onClick={onCrossFilter ? (value) => onCrossFilter("estado", value) : undefined}
                  >
                    {well.estado_pozo ?? labels.none}
                  </CrossFilterButton>
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-anh-bg text-left text-anh-muted">
            <tr>
              <th className="px-4 py-3">{labels.well}</th>
              <th className="hidden px-4 py-3 lg:table-cell">{labels.uwi}</th>
              <th className="px-4 py-3">{labels.operator}</th>
              <th className="hidden px-4 py-3 sm:table-cell">{labels.department}</th>
              <th className="hidden px-4 py-3 xl:table-cell">{labels.state}</th>
              <th className="px-4 py-3">{labels.validation}</th>
            </tr>
          </thead>
          <tbody>
            {wells.map((well) => (
              <tr
                key={well.id}
                className={`cursor-pointer border-t border-anh-border hover:bg-anh-bg/60 ${
                  selectedWellId === well.id ? "bg-anh-bg" : ""
                }`}
                onClick={() => onSelect(well.id)}
              >
                <td className="max-w-[12rem] truncate px-4 py-3 font-medium">
                  <CrossFilterButton
                    value={well.nombre_pozo_sgc}
                    onClick={onCrossFilter ? (value) => onCrossFilter("q", value) : undefined}
                  >
                    {well.nombre_pozo_sgc}
                  </CrossFilterButton>
                </td>
                <td className="hidden max-w-[10rem] truncate px-4 py-3 font-mono text-xs lg:table-cell">
                  {well.uwi_fiscalizado ?? labels.none}
                </td>
                <td className="max-w-[10rem] truncate px-4 py-3">
                  <CrossFilterButton
                    value={well.operadora}
                    onClick={onCrossFilter ? (value) => onCrossFilter("operadora", value) : undefined}
                  >
                    {well.operadora}
                  </CrossFilterButton>
                </td>
                <td className="hidden max-w-[8rem] truncate px-4 py-3 sm:table-cell">
                  <CrossFilterButton
                    value={well.departamento}
                    onClick={onCrossFilter ? (value) => onCrossFilter("departamentos", value) : undefined}
                  >
                    {fixEncoding(well.departamento ?? "")}
                  </CrossFilterButton>
                </td>
                <td className="hidden px-4 py-3 xl:table-cell">
                  <CrossFilterButton
                    value={well.estado_pozo}
                    onClick={onCrossFilter ? (value) => onCrossFilter("estado", value) : undefined}
                  >
                    {well.estado_pozo}
                  </CrossFilterButton>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (well.validation_status && onCrossFilter) {
                        onCrossFilter("validation_status", well.validation_status);
                      }
                    }}
                  >
                    <StatusBadge status={well.validation_status} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
