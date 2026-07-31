/**
 * Verificación de sesión compatible con Edge Runtime (middleware).
 * Misma forma de token que auth-crypto (Node): userId.issued.lastAct.nonce.sig
 */

export const SESSION_COOKIE = "anh_session";
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;

export type EdgeSessionClaims = {
  userId: number;
  issuedAt: number;
  lastActivity: number;
  nonce: string;
};

function getEdgeSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    return "";
  }
  return "local-dev-only-session-secret-min-32chars!";
}

async function hmacHex(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifySessionTokenEdge(token: string): Promise<EdgeSessionClaims | null> {
  const secret = getEdgeSessionSecret();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [userIdRaw, issuedRaw, activityRaw, nonce, sig] = parts;
  if (!userIdRaw || !issuedRaw || !activityRaw || !nonce || !sig) return null;

  const payload = `${userIdRaw}.${issuedRaw}.${activityRaw}.${nonce}`;
  const expected = await hmacHex(payload, secret);
  if (!timingSafeEqualHex(sig.toLowerCase(), expected.toLowerCase())) return null;

  const userId = Number(userIdRaw);
  const issuedAt = Number(issuedRaw);
  const lastActivity = Number(activityRaw);
  if (!Number.isFinite(userId) || !Number.isFinite(issuedAt) || !Number.isFinite(lastActivity)) {
    return null;
  }

  const now = Date.now();
  if (now - issuedAt > SESSION_ABSOLUTE_MS) return null;
  if (now - lastActivity > SESSION_IDLE_MS) return null;

  return { userId, issuedAt, lastActivity, nonce };
}

export async function refreshSessionTokenEdge(claims: EdgeSessionClaims): Promise<string> {
  const secret = getEdgeSessionSecret();
  const nonceBytes = new Uint8Array(8);
  crypto.getRandomValues(nonceBytes);
  const nonce = Array.from(nonceBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const lastActivity = Date.now();
  const payload = `${claims.userId}.${claims.issuedAt}.${lastActivity}.${nonce}`;
  const sig = await hmacHex(payload, secret);
  return `${payload}.${sig}`;
}

export function shouldRefreshSessionEdge(claims: EdgeSessionClaims): boolean {
  return Date.now() - claims.lastActivity > SESSION_IDLE_MS / 3;
}
