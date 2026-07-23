import { BarChart3, ClipboardCheck, LayoutDashboard, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "./types";

export interface AppNavItem {
  href: string;
  key: string;
  shortKey: string;
  icon: LucideIcon;
  tourId: string;
}

const PANEL: AppNavItem = {
  href: "/panel",
  key: "nav.dashboard",
  shortKey: "nav.dashboardShort",
  icon: LayoutDashboard,
  tourId: "nav-dashboard",
};

const ADMIN_PANEL: AppNavItem = {
  href: "/panel",
  key: "nav.adminPanel",
  shortKey: "nav.adminPanelShort",
  icon: LayoutDashboard,
  tourId: "nav-dashboard",
};

const NOTEBOOK: AppNavItem = {
  href: "/calidad",
  key: "nav.notebook",
  shortKey: "nav.notebookShort",
  icon: ClipboardCheck,
  tourId: "nav-calidad",
};

const ANALYTICS: AppNavItem = {
  href: "/analitica",
  key: "nav.analytics",
  shortKey: "nav.analyticsShort",
  icon: BarChart3,
  tourId: "nav-analitica",
};

const ADMIN_USERS: AppNavItem = {
  href: "/admin/usuarios",
  key: "nav.adminUsers",
  shortKey: "nav.adminUsersShort",
  icon: Users,
  tourId: "nav-admin",
};

export function getNavItemsForRole(role: UserRole): AppNavItem[] {
  if (role === "anh") return [PANEL, ANALYTICS];
  if (role === "operadora") return [PANEL, NOTEBOOK];
  if (role === "admin") return [ADMIN_PANEL, ADMIN_USERS];
  return [PANEL];
}
