"use client";

import { Moon, Sun } from "lucide-react";
import { useAppPreferences } from "@/context/AppPreferences";
import type { Locale } from "@/i18n";

export function PreferencesBar() {
  const { theme, locale, setTheme, setLocale, t } = useAppPreferences();

  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2" data-tour="preferences">
      <div
        className="flex items-center rounded-lg border border-anh-border bg-anh-surface p-0.5"
        role="group"
        aria-label={t("preferences.language")}
      >
        {(["es", "en"] as Locale[]).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            className={`rounded-md px-2 py-1 text-[11px] font-bold transition sm:px-2.5 sm:text-xs ${
              locale === code
                ? "bg-anh-primary text-anh-surface"
                : "text-anh-muted hover:text-anh-primary"
            }`}
            aria-pressed={locale === code}
            aria-label={code === "es" ? t("preferences.spanish") : t("preferences.english")}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-anh-border bg-anh-surface text-anh-text transition hover:bg-anh-bg sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-1.5"
        aria-label={theme === "dark" ? t("preferences.themeLight") : t("preferences.themeDark")}
        title={theme === "dark" ? t("preferences.themeLight") : t("preferences.themeDark")}
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4 shrink-0 stroke-[2]" aria-hidden />
        ) : (
          <Moon className="h-4 w-4 shrink-0 stroke-[2]" aria-hidden />
        )}
        <span className="hidden text-sm font-semibold sm:inline">
          {theme === "dark" ? t("preferences.themeLight") : t("preferences.themeDark")}
        </span>
      </button>
    </div>
  );
}
