/** Helpers de entorno — piloto: defaults conocidos para poder entrar sin .env. */

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Demo activo salvo DEMO_LOGIN_ENABLED=false.
 * (En el piloto se deja abierto para mesa técnica / revisión.)
 */
export function isDemoLoginEnabled(): boolean {
  const flag = process.env.DEMO_LOGIN_ENABLED?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return true;
}

/** Contraseña compartida de acceso piloto (admin + ANH + operadora) si no hay env. */
export const PILOT_ACCESS_PASSWORD = "local-demo-password";

const FALLBACK_SESSION_SECRET = "local-dev-only-session-secret-min-32chars!";

/**
 * Secreto de sesión HMAC.
 * Si falta en producción, usa fallback de piloto (permite entrar; rotar en OTI).
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  return FALLBACK_SESSION_SECRET;
}

/** Contraseña admin semilla / login admin. */
export function getAdminSeedPassword(): string {
  const password = process.env.ANH_ADMIN_PASSWORD?.trim();
  if (password && password.length >= 8) return password;
  return PILOT_ACCESS_PASSWORD;
}

/** Contraseña usuarios demo ANH/operadora. */
export function getDemoPassword(): string {
  const password = process.env.DEMO_PASSWORD?.trim();
  if (password && password.length >= 8) return password;
  return PILOT_ACCESS_PASSWORD;
}

export { sanitizeNextPath } from "./safe-redirect";
