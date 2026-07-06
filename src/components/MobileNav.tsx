"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface MobileNavProps {
  items: Array<{ href: string; label: string; shortLabel: string; icon: LucideIcon; tourId?: string }>;
  onTour: () => void;
  onDocs: () => void;
  tourLabel: string;
  docsLabel: string;
  ariaLabel: string;
}

export function MobileNav({ items, onTour, onDocs, tourLabel, docsLabel, ariaLabel }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="anh-mobile-nav fixed inset-x-0 bottom-0 z-[1500] pointer-events-none px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 lg:hidden"
      aria-label={ariaLabel}
    >
      <div className="anh-mobile-nav-pill pointer-events-auto mx-auto max-w-md rounded-2xl">
        <div className="grid grid-cols-5 gap-0 px-1 py-1.5">
          {items.map(({ href, label, shortLabel, icon: Icon, tourId }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                data-tour={tourId}
                title={label}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`anh-mobile-nav-link relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-2 transition ${
                  active
                    ? "anh-mobile-nav-link--active bg-anh-sidebar-active"
                    : "text-anh-sidebar-text hover:bg-anh-sidebar-hover hover:text-anh-sidebar-text-active"
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${active ? "text-anh-sidebar-accent" : "text-anh-sidebar-icon"}`}
                  strokeWidth={active ? 2.25 : 2}
                />
                <span
                  className={`w-full truncate text-center text-[10px] font-bold leading-tight ${
                    active ? "text-anh-sidebar-text-active" : ""
                  }`}
                >
                  {shortLabel}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={onTour}
            className="anh-mobile-nav-link flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-2 text-anh-sidebar-text transition hover:bg-anh-sidebar-hover hover:text-anh-sidebar-text-active"
            title={tourLabel}
            aria-label={tourLabel}
            data-tour="workflow"
          >
            <Compass className="h-5 w-5 shrink-0 text-anh-sidebar-icon" />
            <span className="w-full truncate text-center text-[10px] font-bold leading-tight">{tourLabel}</span>
          </button>

          <button
            type="button"
            onClick={onDocs}
            className="anh-mobile-nav-link flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-2 text-anh-sidebar-text transition hover:bg-anh-sidebar-hover hover:text-anh-sidebar-text-active"
            title={docsLabel}
            aria-label={docsLabel}
          >
            <BookOpen className="h-5 w-5 shrink-0 text-anh-sidebar-icon" />
            <span className="w-full truncate text-center text-[10px] font-bold leading-tight">{docsLabel}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
