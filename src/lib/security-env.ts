/** Credenciales fijas del piloto (no dependen de Vercel/.env). */

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Acceso demo siempre activo mientras el piloto esté en revisión. */
export function isDemoLoginEnabled(): boolean {
  return true;
}

/** Contraseña única y fija para los tres roles. */
export const PILOT_ACCESS_PASSWORD = "Anh2026!";

const FALLBACK_SESSION_SECRET = "local-dev-only-session-secret-min-32chars!";

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  return FALLBACK_SESSION_SECRET;
}

export function getAdminSeedPassword(): string {
  return PILOT_ACCESS_PASSWORD;
}

export function getDemoPassword(): string {
  return PILOT_ACCESS_PASSWORD;
}

export { sanitizeNextPath } from "./safe-redirect";
