"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Compass, LogOut } from "lucide-react";
import { OperatorBadge } from "@/components/OperatorBadge";
import { useAppPreferences } from "@/context/AppPreferences";
import { useAuth } from "@/context/AuthContext";
import type { OperatorBrand } from "@/lib/operator-brand";
import type { AppNavItem } from "@/lib/navigation";
import type { UserRole } from "@/lib/types";

/** Tiempo que el cursor debe permanecer sobre el sidebar para desplegarlo. */
const HOVER_EXPAND_MS = 2000;

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

  // Despliegue por permanencia: solo se expande si el cursor se queda >= 2 s.
  // Mientras tanto el riel sigue clicable sin desplegarse.
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<number | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }
  function handleEnter() {
    clearTimer();
    timerRef.current = window.setTimeout(() => setExpanded(true), HOVER_EXPAND_MS);
  }
  function handleLeave() {
    clearTimer();
    setExpanded(false);
  }
  useEffect(() => clearTimer, []);

  const itemBase = "anh-sidebar-link group relative flex rounded-xl transition";
  const itemLayout = expanded ? "items-center gap-3 px-3 py-2.5" : "flex-col items-center gap-1 px-1 py-2 sm:py-2.5";

  return (
    <aside
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`anh-sidebar fixed inset-y-0 left-0 z-30 hidden flex-col overflow-y-auto overflow-x-hidden overscroll-contain border-r border-anh-sidebar-border bg-anh-sidebar transition-[width] duration-300 ease-out lg:flex ${
        expanded ? "w-64 shadow-2xl shadow-black/40" : "w-[5.75rem]"
      }`}
      aria-label={t("nav.mainMenu")}
    >
      <div className={`flex shrink-0 border-b border-anh-sidebar-border px-2 py-3 sm:py-4 ${expanded ? "flex-col gap-3 px-3" : "flex-col items-center"}`}>
        <Link href="/" className={`group flex ${expanded ? "items-center gap-3" : "flex-col items-center gap-1.5 sm:gap-2"}`} title={t("landing.backHome")}>
          <Image
            src="/anh-logo.png"
            alt={t("shell.logoAlt")}
            width={44}
            height={44}
            className="h-9 w-9 shrink-0 rounded-full bg-white/95 object-contain p-1 shadow-sm ring-1 ring-white/10 transition group-hover:ring-anh-secondary/60 sm:h-10 sm:w-10"
            priority
          />
          {expanded ? (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-sm font-extrabold tracking-wide text-anh-sidebar-text-active">ANH · VIP</span>
              <span className="truncate text-[11px] text-anh-sidebar-text">Inventario de Pozos</span>
            </span>
          ) : (
            <span className="text-center text-[9px] font-extrabold uppercase leading-tight tracking-wide text-anh-sidebar-text">ANH</span>
          )}
        </Link>
        {brand && (
          <div className={`flex items-center ${expanded ? "gap-2" : "mt-2 flex-col gap-1"}`} title={brand.shortName}>
            <div className="rounded-xl p-0.5" style={{ background: brand.gradient }}>
              <div className="rounded-[10px] bg-anh-sidebar-bg px-1 py-1">
                <OperatorBadge brand={brand} size="sm" />
              </div>
            </div>
            <span
              className={`truncate font-bold leading-tight ${expanded ? "min-w-0 flex-1 text-left text-[11px]" : "max-w-[4.5rem] text-center text-[8px]"}`}
              style={{ color: brand.secondary }}
              title={brand.shortName}
            >
              {expanded ? brand.shortName : brand.shortName.split(/\s+/)[0]}
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
              className={`${itemBase} ${itemLayout} ${active ? "anh-sidebar-link--active bg-anh-sidebar-active" : "hover:bg-anh-sidebar-hover"}`}
            >
              <Icon
                className={`h-[1.15rem] w-[1.15rem] shrink-0 transition sm:h-5 sm:w-5 ${
                  active ? "text-anh-sidebar-accent" : "text-anh-sidebar-icon group-hover:text-anh-sidebar-text-active"
                }`}
                strokeWidth={active ? 2.25 : 2}
              />
              <span
                className={`truncate leading-tight ${
                  expanded ? "min-w-0 flex-1 text-left text-[13px] font-semibold" : "max-w-full text-center text-[9px] font-bold sm:text-[10px]"
                } ${active ? "text-anh-sidebar-text-active" : "text-anh-sidebar-text group-hover:text-anh-sidebar-text-active"}`}
              >
                {expanded ? label : shortLabel}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-anh-sidebar-border px-2 py-2 sm:space-y-1 sm:py-3" data-tour="workflow">
        <button
          type="button"
          onClick={onTour}
          className={`${itemBase} w-full ${itemLayout} hover:bg-anh-sidebar-hover`}
          title={t("shell.guidedTour")}
        >
          <Compass className="h-[1.15rem] w-[1.15rem] shrink-0 text-anh-sidebar-icon transition group-hover:text-anh-sidebar-accent sm:h-5 sm:w-5" />
          <span className={`truncate leading-tight text-anh-sidebar-text group-hover:text-anh-sidebar-text-active ${expanded ? "min-w-0 flex-1 text-left text-[13px] font-semibold" : "text-center text-[9px] font-bold sm:text-[10px]"}`}>
            {expanded ? t("shell.guidedTour") : t("nav.tourShort")}
          </span>
        </button>
        <button
          type="button"
          onClick={onDocs}
          className={`${itemBase} w-full ${itemLayout} hover:bg-anh-sidebar-hover`}
          title={docsTitle}
        >
          <BookOpen className="h-[1.15rem] w-[1.15rem] shrink-0 text-anh-sidebar-icon transition group-hover:text-anh-sidebar-accent sm:h-5 sm:w-5" />
          <span className={`truncate leading-tight text-anh-sidebar-text group-hover:text-anh-sidebar-text-active ${expanded ? "min-w-0 flex-1 text-left text-[13px] font-semibold" : "text-center text-[9px] font-bold sm:text-[10px]"}`}>
            {expanded ? docsTitle : t("nav.docsShort")}
          </span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className={`${itemBase} w-full ${itemLayout} hover:bg-anh-sidebar-hover`}
          title={t("auth.logout")}
        >
          <LogOut className="h-[1.15rem] w-[1.15rem] shrink-0 text-anh-sidebar-icon transition group-hover:text-anh-red sm:h-5 sm:w-5" />
          <span className={`truncate leading-tight text-anh-sidebar-text group-hover:text-anh-sidebar-text-active ${expanded ? "min-w-0 flex-1 text-left text-[13px] font-semibold" : "text-center text-[9px] font-bold sm:text-[10px]"}`}>
            {expanded ? t("auth.logout") : t("nav.logoutShort")}
          </span>
        </button>
      </div>
    </aside>
  );
}
