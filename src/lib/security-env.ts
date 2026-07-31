/** Helpers de entorno para hardening (GU-18: no embeber secretos). */

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Login demo solo si se habilita explícitamente (en prod) o en desarrollo por defecto. */
export function isDemoLoginEnabled(): boolean {
  const flag = process.env.DEMO_LOGIN_ENABLED?.trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return !isProductionRuntime();
}

/**
 * Secreto de sesión HMAC. En producción exige SESSION_SECRET (≥32 chars).
 * En desarrollo usa un valor local solo si falta la variable.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (isProductionRuntime()) {
    throw new Error(
      "SESSION_SECRET es obligatorio en producción (mínimo 32 caracteres). Configúrelo en el entorno.",
    );
  }
  return "local-dev-only-session-secret-min-32chars!";
}

/** Contraseña del admin sembrado. Obligatoria en producción. */
export function getAdminSeedPassword(): string {
  const password = process.env.ANH_ADMIN_PASSWORD?.trim();
  if (password && password.length >= 10) return password;
  if (isProductionRuntime()) {
    throw new Error(
      "ANH_ADMIN_PASSWORD es obligatorio en producción (mínimo 10 caracteres).",
    );
  }
  return "local-dev-admin-change-me";
}

/** Contraseña de usuarios demo (solo si el login demo está habilitado). */
export function getDemoPassword(): string {
  const password = process.env.DEMO_PASSWORD?.trim();
  if (password && password.length >= 8) return password;
  if (isProductionRuntime() && isDemoLoginEnabled()) {
    throw new Error(
      "DEMO_PASSWORD es obligatorio cuando DEMO_LOGIN_ENABLED=true en producción.",
    );
  }
  return "local-demo-password";
}

export { sanitizeNextPath } from "./safe-redirect";