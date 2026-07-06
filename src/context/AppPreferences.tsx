"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  DEFAULT_THEME,
  getMessages,
  translate,
  type Locale,
  type Messages,
  type Theme,
} from "@/i18n";

const THEME_KEY = "anh-theme";
const LOCALE_KEY = "anh-locale";

interface AppPreferencesContextValue {
  theme: Theme;
  locale: Locale;
  messages: Messages;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "dark" ? "dark" : DEFAULT_THEME;
}

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = localStorage.getItem(LOCALE_KEY);
  return stored === "en" ? "en" : DEFAULT_LOCALE;
}

function applyThemeToDocument(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
}

function applyLocaleToDocument(locale: Locale) {
  document.documentElement.lang = locale;
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedTheme = readStoredTheme();
    const storedLocale = readStoredLocale();
    setThemeState(storedTheme);
    setLocaleState(storedLocale);
    applyThemeToDocument(storedTheme);
    applyLocaleToDocument(storedLocale);
    setReady(true);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(THEME_KEY, next);
    applyThemeToDocument(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(LOCALE_KEY, next);
    applyLocaleToDocument(next);
  }, []);

  const messages = useMemo(() => getMessages(locale), [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(messages, key, vars),
    [messages],
  );

  useEffect(() => {
    document.title = t("meta.title");
  }, [t]);

  const value = useMemo(
    () => ({ theme, locale, messages, setTheme, toggleTheme, setLocale, t }),
    [theme, locale, messages, setTheme, toggleTheme, setLocale, t],
  );

  if (!ready) {
    return <div className="min-h-screen bg-anh-bg" />;
  }

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);
  if (!context) {
    throw new Error("useAppPreferences must be used within AppPreferencesProvider");
  }
  return context;
}

export function useT() {
  return useAppPreferences().t;
}
