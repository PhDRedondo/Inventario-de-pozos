import { THEMES } from "@/lib/catalogs";
import { fixEncoding } from "@/lib/geo";
import type { FieldDefinition, ValidationIssue, WellRecord } from "@/lib/types";
import type { ReactNode } from "react";

function formatFieldValue(well: WellRecord, field: FieldDefinition, noneLabel: string): string {
  const raw = well[field.key];
  if (raw === null || raw === undefined || String(raw).trim() === "") return noneLabel;

  if (field.key === "departamento" || field.key === "municipio" || field.key === "locacion_cluster") {
    return fixEncoding(String(raw));
  }

  return String(raw);
}

interface WellReportSectionsProps {
  well: WellRecord;
  issues: ValidationIssue[];
  mapSlot: ReactNode;
  labels: {
    locationMap: string;
    noCoordinates: string;
    validationSection: string;
    none: string;
    errorLabel: string;
    warningLabel: string;
  };
  variant?: "screen" | "print";
}

export function WellReportSections({
  well,
  issues,
  mapSlot,
  labels,
  variant = "screen",
}: WellReportSectionsProps) {
  const isPrint = variant === "print";
  const sectionClass = isPrint
    ? "mb-5 break-inside-avoid rounded-lg border border-neutral-200 bg-white p-4"
    : "rounded-xl border border-anh-border bg-anh-surface p-4 sm:p-5";
  const titleClass = isPrint
    ? "mb-1 text-sm font-bold text-neutral-900"
    : "text-base font-bold text-anh-primary";
  const descClass = isPrint ? "mb-3 text-xs text-neutral-600" : "mb-4 text-xs text-anh-muted";
  const fieldLabelClass = isPrint
    ? "text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
    : "text-xs font-semibold text-anh-muted";
  const fieldValueClass = isPrint
    ? "mt-0.5 text-sm text-neutral-900"
    : "mt-0.5 break-words text-sm text-anh-text";

  return (
    <div className={isPrint ? "space-y-4" : "space-y-4 sm:space-y-5"}>
      <section className={sectionClass}>
        <h4 className={titleClass}>{labels.locationMap}</h4>
        <div className={isPrint ? "mt-3" : "mt-4"}>{mapSlot}</div>
        {!well.latitud && !well.longitud && (
          <p className={`mt-2 text-xs ${isPrint ? "text-neutral-500" : "text-anh-muted"}`}>{labels.noCoordinates}</p>
        )}
      </section>

      {THEMES.map((theme) => (
        <section key={theme.id} className={sectionClass}>
          <h4 className={titleClass}>{theme.title}</h4>
          <p className={descClass}>{theme.description}</p>
          <div className={`grid gap-3 sm:grid-cols-2 ${isPrint ? "gap-2" : "sm:gap-4"}`}>
            {theme.fields.map((field) => (
              <div key={field.key}>
                <p className={fieldLabelClass}>{field.label}</p>
                <p className={fieldValueClass}>{formatFieldValue(well, field, labels.none)}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      {issues.length > 0 && (
        <section className={sectionClass}>
          <h4 className={titleClass}>{labels.validationSection}</h4>
          <ul className={`mt-3 space-y-2 ${isPrint ? "text-xs" : "text-sm"}`}>
            {issues.map((issue, index) => (
              <li
                key={`${issue.rule}-${index}`}
                className={
                  issue.severity === "error"
                    ? isPrint
                      ? "text-red-700"
                      : "text-red-700 dark:text-red-300"
                    : isPrint
                      ? "text-amber-700"
                      : "text-amber-700 dark:text-amber-300"
                }
              >
                <span className="font-semibold">
                  {issue.severity === "error" ? labels.errorLabel : labels.warningLabel}:
                </span>{" "}
                {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
