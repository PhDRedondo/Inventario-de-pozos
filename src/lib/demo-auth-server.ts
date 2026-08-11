import { DEMO_CREDENTIALS, type DemoCredentials } from "./demo-auth";
import { getAdminSeedPassword, getDemoPassword, isDemoLoginEnabled } from "./security-env";
import type { UserRole } from "./types";

export { isDemoLoginEnabled, getDemoPassword };

/** Credenciales completas solo en servidor (seed / login demo). */
export function getServerDemoCredentials(role: UserRole): DemoCredentials & { password: string } {
  const base = DEMO_CREDENTIALS[role];
  // Misma contraseña piloto para admin/ANH/operadora (o env si está definida).
  const password = role === "admin" ? getAdminSeedPassword() : getDemoPassword();
  return { ...base, password };
}
