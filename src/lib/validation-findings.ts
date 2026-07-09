import type { ValidationIssue, ValidationResult } from "./types";

export type FindingFilter = "all" | "errors" | "warnings";

export function issueMatchesFilter(severity: ValidationIssue["severity"], filter: FindingFilter): boolean {
  if (filter === "errors") return severity === "error";
  if (filter === "warnings") return severity === "warning" || severity === "info";
  return true;
}

export function countIssues(report: ValidationResult[]) {
  return report.reduce(
    (acc, row) => {
      for (const issue of row.issues) {
        if (issue.severity === "error") acc.errors += 1;
        else if (issue.severity === "warning") acc.warnings += 1;
        else if (issue.severity === "info") acc.info += 1;
      }
      return acc;
    },
    { errors: 0, warnings: 0, info: 0 },
  );
}

export function flattenFindings(
  report: ValidationResult[],
  filter: FindingFilter,
  options?: { includeOperator?: boolean },
) {
  return report.flatMap((row) =>
    row.issues
      .filter((issue) => issueMatchesFilter(issue.severity, filter))
      .map((issue, idx) => ({
        key: `${row.well_id}-${issue.field}-${issue.rule}-${idx}`,
        well_id: row.well_id,
        operadora: row.operadora,
        well: row.nombre_pozo_sgc,
        field: issue.field,
        severity: issue.severity,
        message: issue.message,
        rule: issue.rule,
        includeOperator: options?.includeOperator ?? false,
      })),
  );
}

export function severityBadgeClass(severity: ValidationIssue["severity"]): string {
  if (severity === "error") return "badge-invalid";
  if (severity === "warning") return "badge-warning";
  return "badge-info";
}
