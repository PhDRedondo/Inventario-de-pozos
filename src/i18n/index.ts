import { en } from "./messages/en";
import { es, type MessageTree } from "./messages/es";

export type Locale = "es" | "en";
export type Theme = "light" | "dark";
export type Messages = MessageTree;

export const DEFAULT_LOCALE: Locale = "es";
export const DEFAULT_THEME: Theme = "light";

const catalogs: Record<Locale, Messages> = { es, en };

export function getMessages(locale: Locale): Messages {
  return catalogs[locale] ?? es;
}

export function translate(
  messages: Messages,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const parts = key.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) return key;
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current !== "string") return key;
  if (!vars) return current;
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
    current,
  );
}
