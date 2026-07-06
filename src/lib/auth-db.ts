import { hashPassword, buildAnhEmail, buildOperadoraEmail } from "./auth-crypto";
import { DEMO_CREDENTIALS, DEMO_PASSWORD } from "./demo-auth";
import { getDb } from "./db";
import type { AuditLogEntry, UserRecord, UserRole } from "./types";

const ADMIN_SEED_EMAIL = "johan.redondo@anh.gov.co";
const ADMIN_SEED_PASSWORD = process.env.ANH_ADMIN_PASSWORD ?? "Anh2026!";

function ensureColumn(table: string, column: string, definition: string) {
  const database = getDb();
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function initAuthSchema() {
  const database = getDb();
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('operadora', 'anh', 'admin')),
      operadora TEXT,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      active INTEGER DEFAULT 1,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_operadora ON users(operadora);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
  `);

  ensureColumn("uploads", "submitted_at", "TEXT");
  ensureColumn("uploads", "submitted_by", "TEXT");

  seedAdminIfMissing();
  seedDemoUsersIfMissing();
}

function seedAdminIfMissing() {
  const database = getDb();
  const existing = database.prepare("SELECT id FROM users WHERE email = ?").get(ADMIN_SEED_EMAIL);
  if (existing) return;

  database
    .prepare(
      `INSERT INTO users (email, username, role, operadora, password_hash, display_name, created_by)
       VALUES (?, ?, 'admin', NULL, ?, ?, 'system')`,
    )
    .run(
      ADMIN_SEED_EMAIL,
      "johan.redondo",
      hashPassword(ADMIN_SEED_PASSWORD),
      "Johan Redondo — Administrador",
    );
}

function seedDemoUsersIfMissing() {
  const database = getDb();
  const hash = hashPassword(DEMO_PASSWORD);

  const anh = DEMO_CREDENTIALS.anh;
  const anhEmail = buildAnhEmail(anh.username!);
  if (!database.prepare("SELECT id FROM users WHERE email = ?").get(anhEmail)) {
    database
      .prepare(
        `INSERT INTO users (email, username, role, operadora, password_hash, display_name, created_by)
         VALUES (?, ?, 'anh', NULL, ?, ?, 'system')`,
      )
      .run(anhEmail, anh.username, hash, "Funcionario demo — ANH");
  }

  const op = DEMO_CREDENTIALS.operadora;
  const opEmail = buildOperadoraEmail(op.username!, op.operadora!);
  if (!database.prepare("SELECT id FROM users WHERE email = ?").get(opEmail)) {
    database
      .prepare(
        `INSERT INTO users (email, username, role, operadora, password_hash, display_name, created_by)
         VALUES (?, ?, 'operadora', ?, ?, ?, 'system')`,
      )
      .run(opEmail, op.username, op.operadora, hash, "Usuario demo — Operadora");
  }
}

export function getUserById(id: number): UserRecord | undefined {
  const database = getDb();
  return database.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRecord | undefined;
}

export function getUserByEmail(email: string): UserRecord | undefined {
  const database = getDb();
  return database.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as UserRecord | undefined;
}

export function resolveLoginIdentity(
  role: UserRole,
  email: string,
  username: string,
  operadora: string | null,
): UserRecord | undefined {
  const database = getDb();
  if (role === "operadora") {
    return database
      .prepare("SELECT * FROM users WHERE role = 'operadora' AND username = ? AND operadora = ? AND active = 1")
      .get(username.toLowerCase(), operadora) as UserRecord | undefined;
  }
  return database
    .prepare("SELECT * FROM users WHERE email = ? AND role = ? AND active = 1")
    .get(email.toLowerCase(), role) as UserRecord | undefined;
}

export function listUsers(): UserRecord[] {
  const database = getDb();
  return database.prepare("SELECT * FROM users ORDER BY role, username").all() as UserRecord[];
}

export function createUser(input: {
  email: string;
  username: string;
  role: UserRole;
  operadora?: string | null;
  password: string;
  displayName?: string;
  createdBy: string;
}): UserRecord {
  const database = getDb();
  const result = database
    .prepare(
      `INSERT INTO users (email, username, role, operadora, password_hash, display_name, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.email.toLowerCase(),
      input.username.toLowerCase(),
      input.role,
      input.operadora ?? null,
      hashPassword(input.password),
      input.displayName ?? null,
      input.createdBy,
    );

  return getUserById(Number(result.lastInsertRowid))!;
}

export function updateUser(
  id: number,
  input: {
    displayName?: string;
    active?: boolean;
    password?: string;
    operadora?: string | null;
  },
  actorEmail: string,
): UserRecord | null {
  const database = getDb();
  const before = getUserById(id);
  if (!before) return null;

  const fields: string[] = ["updated_at = CURRENT_TIMESTAMP"];
  const params: unknown[] = [];

  if (input.displayName !== undefined) {
    fields.push("display_name = ?");
    params.push(input.displayName);
  }
  if (input.active !== undefined) {
    fields.push("active = ?");
    params.push(input.active ? 1 : 0);
  }
  if (input.password) {
    fields.push("password_hash = ?");
    params.push(hashPassword(input.password));
  }
  if (input.operadora !== undefined) {
    fields.push("operadora = ?");
    params.push(input.operadora);
  }

  database.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...params, id);

  const after = getUserById(id);
  writeAuditLog({
    actorEmail,
    action: "user.update",
    entityType: "user",
    entityId: id,
    before,
    after,
  });
  return after ?? null;
}

export function deleteUser(id: number, actorEmail: string): boolean {
  const database = getDb();
  const before = getUserById(id);
  if (!before || before.email === ADMIN_SEED_EMAIL) return false;
  database.prepare("DELETE FROM users WHERE id = ?").run(id);
  writeAuditLog({
    actorEmail,
    action: "user.delete",
    entityType: "user",
    entityId: id,
    before,
    after: null,
  });
  return true;
}

export function writeAuditLog(input: {
  actorEmail: string;
  action: string;
  entityType: string;
  entityId?: number | null;
  before?: unknown;
  after?: unknown;
}) {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO audit_log (actor_email, action, entity_type, entity_id, before_json, after_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.actorEmail,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
    );
}

export function listAuditLog(limit = 100): AuditLogEntry[] {
  const database = getDb();
  return database
    .prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?")
    .all(limit) as AuditLogEntry[];
}
