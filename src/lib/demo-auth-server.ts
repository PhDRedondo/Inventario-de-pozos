import { DEMO_CREDENTIALS, type DemoCredentials } from "./demo-auth";
import { getAdminSeedPassword, getDemoPassword, isDemoLoginEnabled } from "./security-env";
import type { UserRole } from "./types";

export { isDemoLoginEnabled, getDemoPassword };

/** Credenciales completas solo en servidor (seed / login demo). */
export function getServerDemoCredentials(role: UserRole): DemoCredentials & { password: string } {
  const base = DEMO_CREDENTIALS[role];
  // Admin semilla usa ANH_ADMIN_PASSWORD; ANH/operadora usan DEMO_PASSWORD.
  const password = role === "admin" ? getAdminSeedPassword() : getDemoPassword();
  return { ...base, password };
}
