"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { AppDocumentationModal } from "@/components/AppDocumentationModal";
import { AppSidebar } from "@/components/AppSidebar";
import { InstitutionalFooter } from "@/components/InstitutionalFooter";
import { MobileNav } from "@/components/MobileNav";
import { OperatorBrandEffect } from "@/components/OperatorBrandEffect";
import { OperatorWelcomeStrip } from "@/components/OperatorWelcomeStrip";
import { PreferencesBar } from "@/components/PreferencesBar";
import { useAppPreferences } from "@/context/AppPreferences";
import { useAuth } from "@/context/AuthContext";
import { useOperatorBrand } from "@/hooks/useOperatorBrand";
import { startGuidedTour } from "@/lib/guided-tour";
import { getNavItemsForRole } from "@/lib/navigation";
import "driver.js/dist/driver.css";

function waitForNavigation(path: string, timeout = 4000): Promise<void> {
  return new Promise((resolve) => {
    if (window.location.pathname === path) {
      window.setTimeout(resolve, 350);
      return;
    }

    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.location.pathname === path) {
        window.clearInterval(timer);
        window.setTimeout(resolve, 350);
      } else if (Date.now() - started > timeout) {
        window.clearInterval(timer);
        resolve();
      }
    }, 60);
  });
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useAppPreferences();
  const { user, logout } = useAuth();
  const operatorBrand = useOperatorBrand();
  const pathname = usePathname();
  const isNotebookRoute = pathname === "/calidad" || pathname.startsWith("/calidad/");
  const welcomeCompact = pathname !== "/panel" && !isNotebookRoute;
  const router = useRouter();
  const [docsOpen, setDocsOpen] = useState(false);

  const isPublicShell = pathname === "/login" || pathname === "/";
  const role = user?.role;
  const navItems = (role ? getNavItemsForRole(role) : []).map(({ href, key, shortKey, icon, tourId }) => ({
    href,
    key,
    shortKey,
    icon,
    tourId,
    label: t(key),
    shortLabel: t(shortKey),
  }));

  const docsLabel =
    role === "operadora"
      ? t("shell.systemDocsOperadora")
      : role === "anh"
        ? t("shell.systemDocsAnh")
        : t("nav.docsShort");

  const mobileNavItems = navItems.map(({ href, label, shortLabel, icon, tourId }) => ({
    href,
    label,
    shortLabel,
    icon,
    tourId,
  }));

  const navigateForTour = useCallback(
    async (path: string) => {
      if (window.location.pathname === path) return;
      router.push(path);
      await waitForNavigation(path);
    },
    [router],
  );

  const handleStartTour = useCallback(() => {
    if (!role) return;
    startGuidedTour(t, navigateForTour, role);
  }, [navigateForTour, role, t]);

  if (isPublicShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-anh-bg">
      <OperatorBrandEffect />
      <AppSidebar items={navItems} brand={operatorBrand} onTour={handleStartTour} onDocs={() => setDocsOpen(true)} onLogout={logout} />

      <div className="flex min-h-screen flex-col lg:pl-[5.75rem]">
        <header
          className="sticky top-0 z-20 border-b border-anh-border bg-anh-surface/95 shadow-sm backdrop-blur lg:hidden"
          data-tour="app-header"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
            <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3" title={t("landing.backHome")}>
              <Image
                src="/anh-logo.png"
                alt={t("shell.logoAlt")}
                width={160}
                height={48}
                className="h-8 w-auto shrink-0 sm:h-9"
                priority
              />
              <div className="min-w-0 border-l border-anh-border pl-2 sm:pl-3">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-anh-muted sm:text-xs">
                  {t("shell.gopSystem")}
                </p>
                <h1 className="truncate text-xs font-bold leading-tight text-anh-primary sm:text-sm">
                  {t("shell.appTitle")}
                </h1>
              </div>
            </Link>
            <PreferencesBar />
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1 rounded-lg border border-anh-border p-2 text-anh-muted transition hover:border-anh-secondary hover:text-anh-secondary"
              title={t("auth.logout")}
            >
              <LogOut className="h-4 w-4" />
            </button>
            {user && (
              <div className="flex items-center gap-2">
                <div className="hidden text-right text-xs sm:block">
                  <p className="font-semibold text-anh-primary">{user.displayName}</p>
                  <p className="text-anh-muted capitalize">{user.role}</p>
                </div>
              </div>
            )}
          </div>
          <div className="anh-gradient-bar" />
        </header>

        <header
          className="sticky top-0 z-20 hidden border-b border-anh-border bg-anh-surface/90 backdrop-blur lg:block"
          data-tour="app-header"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-anh-muted sm:text-[11px] sm:tracking-[0.14em]">
                {t("shell.gopSystem")}
              </p>
              <h1 className="truncate text-lg font-extrabold text-anh-primary sm:text-xl lg:text-2xl">
                {t("shell.appTitle")}
              </h1>
              <p className="mt-0.5 hidden text-sm text-anh-muted lg:block">{t("shell.tagline")}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {user && (
                <div className="hidden text-right text-xs xl:block">
                  <p className="font-semibold text-anh-primary">{user.displayName}</p>
                  <p className="text-anh-muted capitalize">{user.role}</p>
                </div>
              )}
              <PreferencesBar />
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-anh-border bg-anh-surface px-2.5 py-1.5 text-xs font-semibold text-anh-primary transition hover:border-anh-secondary hover:text-anh-secondary sm:px-3 sm:text-sm"
                title={t("auth.logout")}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t("auth.logout")}</span>
              </button>
            </div>
          </div>
          <div className="anh-gradient-bar" />
        </header>

        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-5 md:px-6 md:py-6">
          {user?.role === "operadora" && <OperatorWelcomeStrip compact={welcomeCompact} />}

          <main className="min-w-0 flex-1 pb-[calc(var(--anh-mobile-nav-space)+env(safe-area-inset-bottom))] lg:pb-0">
            {children}
          </main>
        </div>

        <InstitutionalFooter withMobileNavPadding />
      </div>

      <MobileNav
        items={mobileNavItems}
        onTour={handleStartTour}
        onDocs={() => setDocsOpen(true)}
        tourLabel={t("nav.tourShort")}
        docsLabel={docsLabel}
        ariaLabel={t("nav.mainMenu")}
      />

      {docsOpen && <AppDocumentationModal onClose={() => setDocsOpen(false)} />}
    </div>
  );
}
