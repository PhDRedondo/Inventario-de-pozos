"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, LogOut } from "lucide-react";
import { OperatorBadge } from "@/components/OperatorBadge";
import { useAppPreferences } from "@/context/AppPreferences";
import { useAuth } from "@/context/AuthContext";
import type { OperatorBrand } from "@/lib/operator-brand";
import type { AppNavItem } from "@/lib/navigation";
import type { UserRole } from "@/lib/types";

function getDocsTitleKey(role: UserRole): string {
  if (role === "operadora") return "shell.systemDocsOperadora";
  if (role === "anh") return "shell.systemDocsAnh";
  return "shell.systemDocs";
}

interface AppSidebarProps {
  items: Array<AppNavItem & { label: string; shortLabel: string }>;
  brand?: OperatorBrand | null;
  onTour: () => void;
  onDocs: () => void;
  onLogout: () => void;
}

export function AppSidebar({ items, brand, onTour, onDocs, onLogout }: AppSidebarProps) {
  const pathname = usePathname();
  const { t } = useAppPreferences();
  const { user } = useAuth();
  const docsTitle = t(getDocsTitleKey(user?.role ?? "admin"));

  return (
    <aside
      className="anh-sidebar fixed inset-y-0 left-0 z-30 hidden w-[5.75rem] flex-col overflow-y-auto overscroll-contain border-r border-anh-sidebar-border bg-anh-sidebar lg:flex"
      aria-label={t("nav.mainMenu")}
    >
      <div className="flex shrink-0 flex-col items-center border-b border-anh-sidebar-border px-2 py-3 sm:py-4">
        <Link href="/panel" className="group flex flex-col items-center gap-1.5 sm:gap-2" title={t("shell.appTitle")}>
          <Image
            src="/anh-logo.png"
            alt={t("shell.logoAlt")}
            width={44}
            height={44}
            className="h-9 w-9 rounded-full bg-white/95 object-contain p-1 shadow-sm ring-1 ring-white/10 transition group-hover:ring-anh-secondary/60 sm:h-10 sm:w-10"
            priority
          />
          <span className="text-center text-[9px] font-extrabold uppercase leading-tight tracking-wide text-anh-sidebar-text">
            ANH
          </span>
        </Link>
        {brand && (
          <div className="mt-2 flex flex-col items-center gap-1" title={brand.shortName}>
            <div className="rounded-xl p-0.5" style={{ background: brand.gradient }}>
              <div className="rounded-[10px] bg-anh-sidebar-bg px-1 py-1">
                <OperatorBadge brand={brand} size="sm" />
              </div>
            </div>
            <span
              className="max-w-[4.5rem] truncate text-center text-[8px] font-bold leading-tight"
              style={{ color: brand.secondary }}
              title={brand.shortName}
            >
              {brand.shortName.split(/\s+/)[0]}
            </span>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3 sm:gap-1 sm:py-4" data-tour="app-nav">
        {items.map(({ href, shortLabel, icon: Icon, tourId, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              data-tour={tourId}
              title={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
                className={`anh-sidebar-link group relative flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition sm:py-2.5 ${
                  active ? "anh-sidebar-link--active bg-anh-sidebar-active" : "hover:bg-anh-sidebar-hover"
                }`}
            >
              <Icon
                className={`h-[1.15rem] w-[1.15rem] shrink-0 transition sm:h-5 sm:w-5 ${
                  active ? "text-anh-sidebar-accent" : "text-anh-sidebar-icon group-hover:text-anh-sidebar-text-active"
                }`}
                strokeWidth={active ? 2.25 : 2}
              />
              <span
                className={`max-w-full truncate text-center text-[9px] font-bold leading-tight sm:text-[10px] ${
                  active ? "text-anh-sidebar-text-active" : "text-anh-sidebar-text group-hover:text-anh-sidebar-text-active"
                }`}
              >
                {shortLabel}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-anh-sidebar-border px-2 py-2 sm:space-y-1 sm:py-3" data-tour="workflow">
        <button
          type="button"
          onClick={onTour}
          className="anh-sidebar-link group flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 transition hover:bg-anh-sidebar-hover sm:py-2.5"
          title={t("shell.guidedTour")}
        >
          <Compass className="h-[1.15rem] w-[1.15rem] text-anh-sidebar-icon transition group-hover:text-anh-sidebar-accent sm:h-5 sm:w-5" />
          <span className="text-center text-[9px] font-bold leading-tight text-anh-sidebar-text group-hover:text-anh-sidebar-text-active sm:text-[10px]">
            {t("nav.tourShort")}
          </span>
        </button>
        <button
          type="button"
          onClick={onDocs}
          className="anh-sidebar-link group flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 transition hover:bg-anh-sidebar-hover sm:py-2.5"
          title={docsTitle}
        >
          <BookOpen className="h-[1.15rem] w-[1.15rem] text-anh-sidebar-icon transition group-hover:text-anh-sidebar-accent sm:h-5 sm:w-5" />
          <span className="text-center text-[9px] font-bold leading-tight text-anh-sidebar-text group-hover:text-anh-sidebar-text-active sm:text-[10px]">
            {t("nav.docsShort")}
          </span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="anh-sidebar-link group flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 transition hover:bg-anh-sidebar-hover sm:py-2.5"
          title={t("auth.logout")}
        >
          <LogOut className="h-[1.15rem] w-[1.15rem] text-anh-sidebar-icon transition group-hover:text-anh-red sm:h-5 sm:w-5" />
          <span className="text-center text-[9px] font-bold leading-tight text-anh-sidebar-text group-hover:text-anh-sidebar-text-active sm:text-[10px]">
            {t("nav.logoutShort")}
          </span>
        </button>
      </div>
    </aside>
  );
}
