"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/context/AppPreferences";
import { fixEncoding } from "@/lib/geo";

interface DepartmentMultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[] | undefined) => void;
}

export function DepartmentMultiSelect({ options, selected, onChange }: DepartmentMultiSelectProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const toggle = (departamento: string) => {
    const next = selected.includes(departamento)
      ? selected.filter((item) => item !== departamento)
      : [...selected, departamento];
    onChange(next.length > 0 ? next : undefined);
  };

  const triggerLabel =
    selected.length === 0
      ? t("common.allMasc")
      : selected.length === 1
        ? fixEncoding(selected[0])
        : t("dashboard.departmentsSelected", { count: selected.length });

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="input-field flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-anh-border bg-anh-surface py-1 shadow-lg"
        >
          {selected.length > 0 && (
            <button
              type="button"
              className="flex w-full px-3 py-2 text-left text-xs font-semibold text-anh-secondary hover:bg-anh-bg"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              {t("dashboard.clearDepartments")}
            </button>
          )}
          {options.map((departamento) => {
            const checked = selected.includes(departamento);
            return (
              <label
                key={departamento}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-anh-bg"
              >
                <input
                  type="checkbox"
                  className="accent-anh-secondary"
                  checked={checked}
                  onChange={() => toggle(departamento)}
                />
                <span className="truncate">{fixEncoding(departamento)}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
