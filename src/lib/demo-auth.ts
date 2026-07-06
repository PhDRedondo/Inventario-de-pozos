import type { UserRole } from "./types";

/** Contraseña compartida para acceso de demostración (todos los perfiles). */
export const DEMO_PASSWORD = "Anh2026!";

export interface DemoCredentials {
  role: UserRole;
  email?: string;
  username?: string;
  operadora?: string;
  password: string;
  label: string;
}

export const DEMO_OPERADORA =
  "AMERISUR EXPLORACIÓN COLOMBIA ANDES OPERATING COMPANY LLC SUCURSAL COLOMBIA";

export const DEMO_CREDENTIALS: Record<UserRole, DemoCredentials> = {
  admin: {
    role: "admin",
    email: "johan.redondo@anh.gov.co",
    password: DEMO_PASSWORD,
    label: "johan.redondo@anh.gov.co",
  },
  anh: {
    role: "anh",
    username: "funcionario",
    password: DEMO_PASSWORD,
    label: "funcionario @anh.gov.co",
  },
  operadora: {
    role: "operadora",
    username: "demo",
    operadora: DEMO_OPERADORA,
    password: DEMO_PASSWORD,
    label: `demo · ${DEMO_OPERADORA}`,
  },
};

export function getDemoCredentials(role: UserRole): DemoCredentials {
  return DEMO_CREDENTIALS[role];
}
