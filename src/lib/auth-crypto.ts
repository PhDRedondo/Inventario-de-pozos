import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "anh_session";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-inventario-anh-secret-change-in-prod";
export const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(password, salt, 64);
  if (hashBuf.length !== testBuf.length) return false;
  return timingSafeEqual(hashBuf, testBuf);
}

export function createSessionToken(userId: number): string {
  const payload = `${userId}.${Date.now()}.${randomBytes(8).toString("hex")}`;
  const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, ts, nonce, sig] = parts;
  const payload = `${userId}.${ts}.${nonce}`;
  const expected = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const age = Date.now() - Number(ts);
  if (Number.isNaN(age) || age > SESSION_MS) return null;
  return Number(userId);
}

export function buildAnhEmail(username: string): string {
  return `${username.trim().toLowerCase()}@anh.gov.co`;
}

export function buildOperadoraEmail(username: string, operadora: string): string {
  const slug = operadora
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${username.trim().toLowerCase()}@${slug || "operadora"}.operadora.local`;
}
