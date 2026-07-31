import type { UserRole } from "./types";

export interface DemoCredentials {
  role: UserRole;
  email?: string;
  username?: string;
  operadora?: string;
  label: string;
}

export const DEMO_OPERADORA =
  "AMERISUR EXPLORACIÓN COLOMBIA ANDES OPERATING COMPANY LLC SUCURSAL COLOMBIA";

/** Metadatos demo seguros para UI (sin contraseña). */
export const DEMO_CREDENTIALS: Record<UserRole, DemoCredentials> = {
  admin: {
    role: "admin",
    email: "johan.redondo@anh.gov.co",
    label: "johan.redondo@anh.gov.co",
  },
  anh: {
    role: "anh",
    username: "funcionario",
    label: "funcionario @anh.gov.co",
  },
  operadora: {
    role: "operadora",
    username: "demo",
    operadora: DEMO_OPERADORA,
    label: `demo · ${DEMO_OPERADORA}`,
  },
};

export function getDemoCredentials(role: UserRole): DemoCredentials {
  return DEMO_CREDENTIALS[role];
}
