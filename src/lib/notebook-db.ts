import { getDb } from "./db";
import { writeAuditLog } from "./auth-db";
import type {
  Notebook,
  NotebookEvent,
  NotebookEventType,
  NotebookSummary,
  NotebookVersion,
  UploadBatch,
  ValidationResult,
  WellRecord,
  UserRole,
} from "./types";
import { saveUploadBatch, getValidationReport, getUpload } from "./db";
import { countIssues } from "./validation-findings";
import { DEMO_OPERADORA } from "./demo-auth";
import seedData from "../../data/seed.json";

function ensureColumn(table: string, column: string, definition: string) {
  const database = getDb();
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function initNotebookSchema() {
  const database = getDb();
  database.exec(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operadora TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'submitted', 'archived')),
      active_version_id INTEGER,
      submitted_version_id INTEGER,
      submitted_at TEXT,
      submitted_by TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_notebooks_operadora ON notebooks(operadora);
    CREATE INDEX IF NOT EXISTS idx_notebooks_status ON notebooks(status);

    CREATE TABLE IF NOT EXISTS notebook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notebook_id INTEGER NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('created', 'upload', 'submit', 'archived')),
      upload_id INTEGER,
      actor_email TEXT,
      message TEXT,
      metadata_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (notebook_id) REFERENCES notebooks(id)
    );
    CREATE INDEX IF NOT EXISTS idx_notebook_events_notebook ON notebook_events(notebook_id);
  `);
  ensureColumn("uploads", "notebook_id", "INTEGER");
  ensureColumn("uploads", "version_number", "INTEGER DEFAULT 1");
  ensureColumn("uploads", "error_issues", "INTEGER DEFAULT 0");
  ensureColumn("uploads", "warning_issues", "INTEGER DEFAULT 0");
  ensureColumn("uploads", "info_issues", "INTEGER DEFAULT 0");
  ensureColumn("notebooks", "title", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("notebooks", "created_by", "TEXT");
}

function mapNotebook(row: Record<string, unknown>): Notebook {
  return {
    id: Number(row.id),
    operadora: String(row.operadora),
    title: String(row.title ?? ""),
    status: row.status as Notebook["status"],
    active_version_id: row.active_version_id != null ? Number(row.active_version_id) : null,
    submitted_version_id: row.submitted_version_id != null ? Number(row.submitted_version_id) : null,
    submitted_at: (row.submitted_at as string) ?? null,
    submitted_by: (row.submitted_by as string) ?? null,
    created_by: (row.created_by as string) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapVersion(row: UploadBatch): NotebookVersion {
  const extended = row as UploadBatch & {
    error_issues?: number;
    warning_issues?: number;
    info_issues?: number;
  };
  return {
    ...row,
    notebook_id: (row as UploadBatch & { notebook_id?: number }).notebook_id ?? null,
    version_number: (row as UploadBatch & { version_number?: number }).version_number ?? 1,
    error_issues: extended.error_issues ?? 0,
    warning_issues: extended.warning_issues ?? 0,
    info_issues: extended.info_issues ?? 0,
  };
}

function backfillVersionIssueCounts(version: NotebookVersion): NotebookVersion {
  if ((version.error_issues ?? 0) > 0 || (version.warning_issues ?? 0) > 0 || (version.info_issues ?? 0) > 0) {
    return version;
  }
  if (version.total_records === 0) return version;

  const report = getValidationReport(version.id);
  const counts = countIssues(report);
  if (counts.errors === 0 && counts.warnings === 0 && counts.info === 0) return version;

  const database = getDb();
  database
    .prepare(
      `UPDATE uploads SET error_issues = ?, warning_issues = ?, info_issues = ? WHERE id = ?`,
    )
    .run(counts.errors, counts.warnings, counts.info, version.id);

  return {
    ...version,
    error_issues: counts.errors,
    warning_issues: counts.warnings,
    info_issues: counts.info,
  };
}

function mapEvent(row: Record<string, unknown>): NotebookEvent {
  let metadata: Record<string, unknown> | null = null;
  if (row.metadata_json) {
    try {
      metadata = JSON.parse(String(row.metadata_json)) as Record<string, unknown>;
    } catch {
      metadata = null;
    }
  }
  return {
    id: Number(row.id),
    notebook_id: Number(row.notebook_id),
    event_type: row.event_type as NotebookEventType,
    upload_id: row.upload_id != null ? Number(row.upload_id) : null,
    actor_email: (row.actor_email as string) ?? null,
    message: (row.message as string) ?? null,
    metadata,
    created_at: String(row.created_at),
  };
}

export function logNotebookEvent(input: {
  notebookId: number;
  eventType: NotebookEventType;
  actorEmail?: string | null;
  uploadId?: number | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO notebook_events (notebook_id, event_type, upload_id, actor_email, message, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.notebookId,
      input.eventType,
      input.uploadId ?? null,
      input.actorEmail ?? null,
      input.message ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    );
  database
    .prepare(`UPDATE notebooks SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(input.notebookId);
}

export function listNotebookEvents(notebookId: number): NotebookEvent[] {
  const database = getDb();
  const rows = database
    .prepare(`SELECT * FROM notebook_events WHERE notebook_id = ? ORDER BY created_at DESC, id DESC`)
    .all(notebookId) as Array<Record<string, unknown>>;
  return rows.map(mapEvent);
}

export function listNotebookVersions(notebookId: number): NotebookVersion[] {
  const database = getDb();
  const rows = database
    .prepare(`SELECT * FROM uploads WHERE notebook_id = ? ORDER BY version_number DESC, id DESC`)
    .all(notebookId) as UploadBatch[];
  return rows.map((row) => backfillVersionIssueCounts(mapVersion(row)));
}

export function getNotebook(id: number): Notebook | null {
  const database = getDb();
  const row = database.prepare("SELECT * FROM notebooks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? mapNotebook(row) : null;
}

export function getActiveNotebook(operadora: string): Notebook | null {
  const database = getDb();
  const row = database
    .prepare(`SELECT * FROM notebooks WHERE operadora = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
    .get(operadora) as Record<string, unknown> | undefined;
  return row ? mapNotebook(row) : null;
}

function defaultNotebookTitle(operadora: string): string {
  const database = getDb();
  const count =
    (database.prepare(`SELECT COUNT(*) AS c FROM notebooks WHERE operadora = ?`).get(operadora) as { c: number }).c +
    1;
  return `Cuaderno ${count}`;
}

export function listNotebooks(operadora: string): NotebookSummary[] {
  ensureDemoNotebook(operadora);
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT n.*,
              COUNT(u.id) AS version_count,
              MAX(u.created_at) AS last_upload_at,
              (SELECT filename FROM uploads WHERE notebook_id = n.id ORDER BY id DESC LIMIT 1) AS last_filename
       FROM notebooks n
       LEFT JOIN uploads u ON u.notebook_id = n.id
       WHERE n.operadora = ?
       GROUP BY n.id
       ORDER BY n.updated_at DESC, n.id DESC`,
    )
    .all(operadora) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    ...mapNotebook(row),
    version_count: Number(row.version_count ?? 0),
    last_upload_at: (row.last_upload_at as string) ?? null,
    last_filename: (row.last_filename as string) ?? null,
  }));
}

export function createNotebook(operadora: string, title: string, createdBy: string): Notebook {
  const database = getDb();
  const trimmedTitle = title.trim() || defaultNotebookTitle(operadora);

  const notebook = database.transaction(() => {
    const active = getActiveNotebook(operadora);
    if (active) {
      database
        .prepare(`UPDATE notebooks SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(active.id);
      logNotebookEvent({
        notebookId: active.id,
        eventType: "archived",
        actorEmail: createdBy,
        message: "Cuaderno archivado al iniciar uno nuevo",
      });
    }

    const result = database
      .prepare(`INSERT INTO notebooks (operadora, status, title, created_by) VALUES (?, 'active', ?, ?)`)
      .run(operadora, trimmedTitle, createdBy);
    const id = Number(result.lastInsertRowid);
    const created = getNotebook(id)!;

    logNotebookEvent({
      notebookId: id,
      eventType: "created",
      actorEmail: createdBy,
      message: trimmedTitle,
    });

    writeAuditLog({
      actorEmail: createdBy,
      action: "notebook.create",
      entityType: "notebook",
      entityId: id,
      after: created,
    });

    return created;
  })();

  return notebook;
}

export function getOrCreateActiveNotebook(operadora: string, createdBy?: string): Notebook {
  const existing = getActiveNotebook(operadora);
  if (existing) return existing;
  return createNotebook(operadora, defaultNotebookTitle(operadora), createdBy ?? "system");
}

export function getNotebookDetail(notebookId: number): {
  notebook: Notebook;
  versions: NotebookVersion[];
  activeVersion: NotebookVersion | null;
  events: NotebookEvent[];
} | null {
  const notebook = getNotebook(notebookId);
  if (!notebook) return null;
  backfillNotebookEvents(notebook);
  const versions = listNotebookVersions(notebookId);
  const activeVersion =
    versions.find((v) => v.id === notebook.active_version_id) ?? versions[0] ?? null;
  const events = listNotebookEvents(notebookId);
  return { notebook, versions, activeVersion, events };
}

function backfillNotebookEvents(notebook: Notebook) {
  const existing = listNotebookEvents(notebook.id);
  if (existing.length > 0) return;

  logNotebookEvent({
    notebookId: notebook.id,
    eventType: "created",
    actorEmail: notebook.created_by,
    message: notebook.title || `Cuaderno ${notebook.id}`,
  });

  const versions = listNotebookVersions(notebook.id).slice().reverse();
  for (const version of versions) {
    logNotebookEvent({
      notebookId: notebook.id,
      eventType: "upload",
      uploadId: version.id,
      actorEmail: version.submitted_by ?? notebook.created_by,
      message: `Versión ${version.version_number}: ${version.filename}`,
      metadata: {
        version_number: version.version_number,
        filename: version.filename,
        total_records: version.total_records,
        valid_records: version.valid_records,
        invalid_records: version.invalid_records,
        error_issues: version.error_issues ?? 0,
        warning_issues: version.warning_issues ?? 0,
        info_issues: version.info_issues ?? 0,
      },
    });
  }

  if (notebook.status === "submitted" && notebook.submitted_version_id) {
    const submittedVersion = versions.find((v) => v.id === notebook.submitted_version_id);
    logNotebookEvent({
      notebookId: notebook.id,
      eventType: "submit",
      uploadId: notebook.submitted_version_id,
      actorEmail: notebook.submitted_by,
      message: submittedVersion
        ? `Inventario aplicado — versión ${submittedVersion.version_number}`
        : "Inventario aplicado a ANH",
      metadata: submittedVersion
        ? {
            version_number: submittedVersion.version_number,
            total_records: submittedVersion.total_records,
            valid_records: submittedVersion.valid_records,
          }
        : null,
    });
  }
}

export function getActiveNotebookDetail(operadora: string): {
  notebook: Notebook;
  versions: NotebookVersion[];
  activeVersion: NotebookVersion | null;
  events: NotebookEvent[];
} {
  const active = getActiveNotebook(operadora);
  if (active) return getNotebookDetail(active.id)!;

  const database = getDb();
  const submitted = database
    .prepare(
      `SELECT * FROM notebooks WHERE operadora = ? AND status = 'submitted' ORDER BY submitted_at DESC LIMIT 1`,
    )
    .get(operadora) as Record<string, unknown> | undefined;
  if (submitted) return getNotebookDetail(Number(submitted.id))!;

  return getNotebookDetail(getOrCreateActiveNotebook(operadora).id)!;
}

export function addNotebookVersion(
  notebookId: number,
  operadora: string,
  filename: string,
  records: WellRecord[],
  actorEmail: string,
): { notebook: Notebook; version: NotebookVersion; results: ValidationResult[] } {
  const database = getDb();
  const notebook = getNotebook(notebookId);
  if (!notebook) throw new Error("Cuaderno no encontrado");
  if (notebook.operadora !== operadora) throw new Error("Cuaderno no pertenece a la operadora");
  if (notebook.status !== "active") throw new Error("Este cuaderno ya fue aplicado o archivado");

  const maxVersion =
    (database
      .prepare(`SELECT MAX(version_number) as m FROM uploads WHERE notebook_id = ?`)
      .get(notebookId) as { m: number | null }).m ?? 0;

  const versionNumber = maxVersion + 1;
  const { upload, results } = saveUploadBatch(filename, operadora, records, {
    status: "draft",
    forceOperadora: operadora,
    notebookId,
    versionNumber,
  });

  database
    .prepare(`UPDATE notebooks SET active_version_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(upload.id, notebookId);

  const invalid = results.filter((r) => !r.is_valid).length;
  const warnings = results.reduce((s, r) => s + r.warning_count, 0);
  const issueCounts = countIssues(results);

  logNotebookEvent({
    notebookId,
    eventType: "upload",
    uploadId: upload.id,
    actorEmail,
    message: `Versión ${versionNumber}: ${filename}`,
    metadata: {
      version_number: versionNumber,
      filename,
      total_records: upload.total_records,
      valid_records: upload.valid_records,
      invalid_records: upload.invalid_records,
      wells_with_errors: invalid,
      warning_count: warnings,
      error_issues: issueCounts.errors,
      warning_issues: issueCounts.warnings,
      info_issues: issueCounts.info,
    },
  });

  writeAuditLog({
    actorEmail,
    action: "notebook.upload",
    entityType: "notebook",
    entityId: notebookId,
    after: { upload_id: upload.id, version_number: versionNumber },
  });

  return {
    notebook: getNotebook(notebookId)!,
    version: mapVersion(upload),
    results,
  };
}

/** Compatibilidad con flujos que aún resuelven el cuaderno activo automáticamente. */
export function addNotebookVersionForOperadora(
  operadora: string,
  filename: string,
  records: WellRecord[],
  actorEmail: string,
): { notebook: Notebook; version: NotebookVersion; results: ValidationResult[] } {
  const notebook = getOrCreateActiveNotebook(operadora, actorEmail);
  return addNotebookVersion(notebook.id, operadora, filename, records, actorEmail);
}

export function submitNotebook(
  notebookId: number,
  submittedBy: string,
): { notebook: Notebook; version: NotebookVersion; error?: string } {
  const database = getDb();
  const notebook = getNotebook(notebookId);
  if (!notebook) return { notebook: notebook!, version: {} as NotebookVersion, error: "Cuaderno no encontrado" };
  if (notebook.status !== "active") {
    return { notebook, version: {} as NotebookVersion, error: "Este cuaderno ya fue aplicado" };
  }

  const versionId = notebook.active_version_id;
  if (!versionId) {
    return { notebook, version: {} as NotebookVersion, error: "No hay versiones cargadas en el cuaderno" };
  }

  const upload = getUpload(versionId);
  if (!upload) {
    return { notebook, version: {} as NotebookVersion, error: "Versión activa no encontrada" };
  }
  if ((upload.invalid_records ?? 0) > 0) {
    return { notebook, version: mapVersion(upload), error: "Corrija todos los errores antes de aplicar" };
  }

  database
    .prepare(
      `UPDATE uploads SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, submitted_by = ? WHERE id = ?`,
    )
    .run(submittedBy, versionId);

  database
    .prepare(
      `UPDATE notebooks SET status = 'submitted', submitted_version_id = ?, submitted_at = CURRENT_TIMESTAMP,
       submitted_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .run(versionId, submittedBy, notebookId);

  const updatedNotebook = getNotebook(notebookId)!;
  const version = mapVersion(getUpload(versionId)!);

  logNotebookEvent({
    notebookId,
    eventType: "submit",
    uploadId: versionId,
    actorEmail: submittedBy,
    message: `Inventario aplicado — versión ${version.version_number}`,
    metadata: {
      version_number: version.version_number,
      total_records: version.total_records,
      valid_records: version.valid_records,
    },
  });

  writeAuditLog({
    actorEmail: submittedBy,
    action: "notebook.submit",
    entityType: "notebook",
    entityId: notebookId,
    before: notebook,
    after: updatedNotebook,
  });

  return { notebook: updatedNotebook, version };
}

export function getVersionReport(versionId: number, operadora: string): ValidationResult[] {
  return getValidationReport(versionId, { role: "operadora", operadora });
}

export function assertNotebookAccess(
  notebookId: number,
  operadora: string | null | undefined,
  role: UserRole,
  userOperadora?: string | null,
): { ok: true; notebook: Notebook } | { ok: false; error: string; status: number } {
  const notebook = getNotebook(notebookId);
  if (!notebook) return { ok: false, error: "Cuaderno no encontrado", status: 404 };
  if (role === "operadora" && notebook.operadora !== userOperadora) {
    return { ok: false, error: "No autorizado", status: 403 };
  }
  if (role === "admin" && operadora && notebook.operadora !== operadora) {
    return { ok: false, error: "Cuaderno no pertenece a la operadora seleccionada", status: 400 };
  }
  return { ok: true, notebook };
}

const DEMO_NOTEBOOK_TITLE = "Cuaderno demo — inventario de prueba";

function buildDemoNotebookRecords(): WellRecord[] {
  const template = seedData.records[0] as WellRecord;
  return [
    {
      ...template,
      operadora: DEMO_OPERADORA,
      nombre_pozo_sgc: "RUBIALES - 3002H",
      pozo_existente_avm: "SE MANTIENE",
      municipio: "Municipio inventado demo",
      yacimiento_ruty: "Yacimiento no catalogado",
      tipo_objetivo: "X (inválido)",
      estado_pozo: "Estado inválido",
      uwi_sgc: "CO_RUB_3002H",
    },
    {
      ...template,
      operadora: "",
      nombre_pozo_sgc: "POZO SIN OPERADORA",
      pozo_existente_avm: "SE MANTIENE",
    },
  ];
}

/** Garantiza un cuaderno de demostración para la operadora demo en cada instancia nueva. */
export function ensureDemoNotebook(operadora: string): void {
  if (operadora !== DEMO_OPERADORA) return;

  const database = getDb();
  const existing = database
    .prepare("SELECT id FROM notebooks WHERE operadora = ? AND title = ?")
    .get(operadora, DEMO_NOTEBOOK_TITLE) as { id: number } | undefined;
  if (existing) return;

  const active = getActiveNotebook(operadora);
  const status = active ? "archived" : "active";
  const result = database
    .prepare(`INSERT INTO notebooks (operadora, status, title, created_by) VALUES (?, ?, ?, ?)`)
    .run(operadora, status, DEMO_NOTEBOOK_TITLE, "system@demo");
  const notebookId = Number(result.lastInsertRowid);

  logNotebookEvent({
    notebookId,
    eventType: "created",
    actorEmail: "system@demo",
    message: DEMO_NOTEBOOK_TITLE,
  });

  const { upload, results } = saveUploadBatch(
    "demo-inventario-prueba.xlsx",
    operadora,
    buildDemoNotebookRecords(),
    {
      status: "draft",
      forceOperadora: operadora,
      notebookId,
      versionNumber: 1,
    },
  );

  database
    .prepare(`UPDATE notebooks SET active_version_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(upload.id, notebookId);

  const invalid = results.filter((r) => !r.is_valid).length;
  const warnings = results.reduce((s, r) => s + r.warning_count, 0);
  const issueCounts = countIssues(results);

  logNotebookEvent({
    notebookId,
    eventType: "upload",
    uploadId: upload.id,
    actorEmail: "system@demo",
    message: `Versión 1: demo-inventario-prueba.xlsx`,
    metadata: {
      version_number: 1,
      filename: upload.filename,
      total_records: upload.total_records,
      valid_records: upload.valid_records,
      invalid_records: upload.invalid_records,
      wells_with_errors: invalid,
      warning_count: warnings,
      error_issues: issueCounts.errors,
      warning_issues: issueCounts.warnings,
      info_issues: issueCounts.info,
    },
  });
}
