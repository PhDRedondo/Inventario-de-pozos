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

/** Resumen de un cuaderno en el listado (GET /api/notebooks). */
export interface NotebookSummary {
  id: number;
  operadora: string;
  title: string;
  status: string;
  activeVersionId: number | null;
  submittedAt: string | null;
  updatedAt: string;
  versionCount: number;
  lastUploadAt: string | null;
  lastFilename: string | null;
}

export interface NotebookInfo {
  id: number;
  operadora: string;
  title: string;
  status: string;
  activeVersionId: number | null;
}

export interface NotebookVersion {
  id: number;
  versionNumber: number;
  filename: string;
  status: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  warningRecords: number;
  errorIssues: number;
  warningIssues: number;
  infoIssues: number;
}

export interface NotebookEvent {
  eventType: string;
  uploadId: number | null;
  actorEmail: string | null;
  message: string | null;
  createdAt: string;
}

/** Detalle del cuaderno (GET /api/notebooks/{id}). */
export interface NotebookDetail {
  notebook: NotebookInfo;
  versions: NotebookVersion[];
  events: NotebookEvent[];
}

/** Par clave/conteo (KeyValuePair serializado por la API). */
export interface KeyCount {
  key: string;
  value: number;
}

export interface WellRow {
  id: number;
  nombrePozoSgc: string | null;
  operadora: string | null;
  departamento: string | null;
  estadoPozo: string | null;
  validationStatus: string | null;
  uwiFiscalizado: string | null;
}

export interface AnalyticsMetric {
  key: string;
  label: string;
  entityValue: number;
  nationalValue: number;
  index: number;
}

/** Analítica comparativa (GET /api/analytics). */
export interface AnalyticsResult {
  entityType: string;
  entityLabel: string;
  metrics: AnalyticsMetric[];
  operadoras: string[];
  departamentos: string[];
}

/** Punto georreferenciado de un pozo (GET /api/wells/map). */
export interface WellMapPoint {
  id: number;
  nombre: string | null;
  operadora: string | null;
  departamento: string | null;
  estado: string | null;
  validationStatus: string | null;
  lat: number;
  lng: number;
}

export interface SankeyNode {
  id: string;
  label: string;
  col: number;
  value: number;
}
export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}
/** Flujo Departamento → Estado → Operadora (GET /api/analytics/sankey). */
export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

/** KPIs y desgloses del panel (GET /api/stats). */
export interface DashboardStats {
  totalWells: number;
  totalUploads: number;
  validWells: number;
  warningWells: number;
  invalidWells: number;
  byEstado: KeyCount[];
  byOperadora: KeyCount[];
  byDepartamento: KeyCount[];
  byTipoObjetivo: KeyCount[];
  wells: WellRow[];
}
