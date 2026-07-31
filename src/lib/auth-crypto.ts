import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getSessionSecret } from "./security-env";

export const SESSION_COOKIE = "anh_session";

/** Inactividad máxima sin renovar la cookie (sliding). */
export const SESSION_IDLE_MS = 30 * 60 * 1000;
/** Vida absoluta máxima de la sesión desde su emisión. */
export const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
/** @deprecated Usar SESSION_ABSOLUTE_MS; mantenido para cookies maxAge. */
export const SESSION_MS = SESSION_ABSOLUTE_MS;

export type SessionClaims = {
  userId: number;
  issuedAt: number;
  lastActivity: number;
};

function signPayload(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length || bufA.length === 0) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

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

/** Token: userId.issuedAt.lastActivity.nonce.sig (5 partes + firma). */
export function createSessionToken(userId: number): string {
  const now = Date.now();
  const nonce = randomBytes(8).toString("hex");
  const payload = `${userId}.${now}.${now}.${nonce}`;
  return `${payload}.${signPayload(payload)}`;
}

export function verifySessionToken(token: string): number | null {
  const claims = parseSessionToken(token);
  return claims?.userId ?? null;
}

export function parseSessionToken(token: string): SessionClaims | null {
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [userIdRaw, issuedRaw, activityRaw, nonce, sig] = parts;
  if (!userIdRaw || !issuedRaw || !activityRaw || !nonce || !sig) return null;

  const payload = `${userIdRaw}.${issuedRaw}.${activityRaw}.${nonce}`;
  const expected = signPayload(payload);
  if (!safeEqualHex(sig, expected)) return null;

  const userId = Number(userIdRaw);
  const issuedAt = Number(issuedRaw);
  const lastActivity = Number(activityRaw);
  if (!Number.isFinite(userId) || !Number.isFinite(issuedAt) || !Number.isFinite(lastActivity)) {
    return null;
  }

  const now = Date.now();
  if (now - issuedAt > SESSION_ABSOLUTE_MS) return null;
  if (now - lastActivity > SESSION_IDLE_MS) return null;

  return { userId, issuedAt, lastActivity };
}

/** Renueva lastActivity manteniendo issuedAt (sliding idle). */
export function refreshSessionToken(token: string): string | null {
  const claims = parseSessionToken(token);
  if (!claims) return null;
  const nonce = randomBytes(8).toString("hex");
  const lastActivity = Date.now();
  const payload = `${claims.userId}.${claims.issuedAt}.${lastActivity}.${nonce}`;
  return `${payload}.${signPayload(payload)}`;
}

export function shouldRefreshSession(claims: SessionClaims): boolean {
  return Date.now() - claims.lastActivity > SESSION_IDLE_MS / 3;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000),
  };
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
