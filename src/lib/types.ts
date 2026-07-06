export interface WellRecord {
  id?: number;
  upload_id?: number | null;
  pozo_existente_avm: string | null;
  operadora: string | null;
  contrato: string | null;
  campo_avm: string | null;
  pozo_formacion_avm: string | null;
  pozo_avm: string | null;
  formacion_avm: string | null;
  formacion_forma_9sh: string | null;
  formacion_ruty: string | null;
  yacimiento_ruty: string | null;
  tipo_angulo: string | null;
  tipo_trayectoria: string | null;
  tipo_objetivo: string | null;
  tipo_terminacion: string | null;
  sistema_levantamiento: string | null;
  clasificacion_lahee: string | null;
  nombre_pozo_forma_6cr: string | null;
  uwi_sgc: string | null;
  uwi_fiscalizado: string | null;
  nombre_pozo_sgc: string | null;
  estado_pozo: string | null;
  departamento: string | null;
  municipio: string | null;
  codigo_dane_depto: string | null;
  codigo_dane_muni: string | null;
  locacion_cluster: string | null;
  coord_bogota_x: string | null;
  coord_bogota_y: string | null;
  coord_nacional_x: string | null;
  coord_nacional_y: string | null;
  longitud: string | null;
  latitud: string | null;
  prod_dias: string | null;
  prod_petroleo: string | null;
  prod_agua: string | null;
  prod_gas: string | null;
  iny_dias: string | null;
  iny_agua: string | null;
  iny_gas: string | null;
  iny_otros: string | null;
  validation_status?: string;
  created_at?: string;
}

export interface ValidationIssue {
  field: string;
  severity: "error" | "warning" | "info";
  message: string;
  rule: string;
}

export interface ValidationResult {
  well_id?: number;
  row_number?: number;
  operadora: string | null;
  nombre_pozo_sgc: string | null;
  is_valid: boolean;
  error_count: number;
  warning_count: number;
  issues: ValidationIssue[];
  uwi_fiscalizado: string | null;
}

export type UserRole = "operadora" | "anh" | "admin";

export interface UserRecord {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  operadora: string | null;
  password_hash: string;
  display_name: string | null;
  active: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionUser {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  operadora: string | null;
  displayName: string;
}

export interface DataScope {
  role: UserRole;
  operadora?: string | null;
  email?: string;
}

export interface AuditLogEntry {
  id: number;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
}

export interface UploadBatch {
  id: number;
  filename: string;
  operadora: string | null;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  warning_records: number;
  status: string;
  notebook_id?: number | null;
  version_number?: number | null;
  submitted_at?: string | null;
  submitted_by?: string | null;
  created_at: string;
}

export type NotebookStatus = "active" | "submitted" | "archived";
export type NotebookEventType = "created" | "upload" | "submit" | "archived";

export interface Notebook {
  id: number;
  operadora: string;
  title: string;
  status: NotebookStatus;
  active_version_id: number | null;
  submitted_version_id: number | null;
  submitted_at: string | null;
  submitted_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotebookSummary extends Notebook {
  version_count: number;
  last_upload_at: string | null;
  last_filename: string | null;
}

export interface NotebookEvent {
  id: number;
  notebook_id: number;
  event_type: NotebookEventType;
  upload_id: number | null;
  actor_email: string | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface NotebookVersion extends UploadBatch {
  notebook_id: number | null;
  version_number: number;
}

export interface DashboardFilters {
  estado?: string;
  departamentos?: string[];
  operadora?: string;
  validation_status?: string;
  q?: string;
}

export interface WellMapPoint {
  id: number;
  nombre_pozo_sgc: string | null;
  operadora: string | null;
  departamento: string | null;
  municipio: string | null;
  estado_pozo: string | null;
  validation_status: string | null;
  uwi_fiscalizado: string | null;
  lat: number;
  lng: number;
}

export interface DashboardStats {
  total_wells: number;
  catalog_total_wells: number;
  total_uploads: number;
  valid_wells: number;
  wells_with_errors: number;
  wells_with_warnings: number;
  by_estado: Record<string, number>;
  by_departamento: Record<string, number>;
  by_operadora: Record<string, number>;
  recent_uploads: UploadBatch[];
  filtered_wells: Array<{
    id: number;
    nombre_pozo_sgc: string | null;
    operadora: string | null;
    departamento: string | null;
    estado_pozo: string | null;
    validation_status: string | null;
    uwi_fiscalizado: string | null;
  }>;
  filter_options: {
    operadoras: string[];
    departamentos: string[];
    estados: string[];
    validation_statuses: string[];
  };
  sankey: DashboardSankeyData;
}

export interface SankeyFlowRow {
  source: string;
  target: string;
  count: number;
}

export interface DashboardSankeyData {
  dept_to_estado: SankeyFlowRow[];
  estado_to_operadora: SankeyFlowRow[];
  estado_to_validation: SankeyFlowRow[];
}

export type FieldType =
  | "select"
  | "text"
  | "number"
  | "coordinate"
  | "readonly";

export interface FieldDefinition {
  key: keyof WellRecord;
  label: string;
  type: FieldType;
  catalogKey?: string;
  required?: boolean;
  dependsOn?: keyof WellRecord;
  placeholder?: string;
}

export interface ThemeDefinition {
  id: string;
  title: string;
  description: string;
  fields: FieldDefinition[];
}
