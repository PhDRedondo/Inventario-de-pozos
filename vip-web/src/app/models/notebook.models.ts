/** Modelos que reflejan los contratos de la Web API .NET (Anh.Vip.Api). */

export interface CreateNotebookRequest {
  operadora: string;
  title?: string;
  actorEmail?: string;
}

export interface NotebookCreated {
  id: number;
  operadora: string;
  title: string;
  status: string;
}

/** Resumen agregado del lote (ValidationSummary, serializado en camelCase). */
export interface ValidationSummary {
  total: number;
  valid: number;
  withWarnings: number;
  invalid: number;
  errorTotal: number;
  warningTotal: number;
}

export interface UploadResult {
  upload_id: number;
  version_number: number;
  summary: ValidationSummary;
}

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  field: string;
  severity: Severity;
  message: string;
  rule: string;
}

/** Hallazgos por pozo devueltos por GET /api/validations. */
export interface ValidationResult {
  well_id: number;
  operadora: string | null;
  nombre_pozo_sgc: string | null;
  is_valid: boolean;
  error_count: number;
  warning_count: number;
  uwi_fiscalizado: string | null;
  issues: ValidationIssue[];
}

export interface SubmitResponse {
  upload_id: number;
  version_number: number;
  message: string;
}
