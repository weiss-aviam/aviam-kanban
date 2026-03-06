/**
 * Minimal i18n utility for the Aviam Kanban Board application.
 * Provides a type-safe t() helper with dot-notation key access and variable interpolation.
 */

import { de } from "./locales/de";

export { de };

type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? `${K}.${NestedKeyOf<T[K]>}`
          : K
        : never;
    }[keyof T]
  : never;

type LocaleKey = NestedKeyOf<typeof de>;

/**
 * Resolve a dot-notation key path against the locale object.
 */
function getNestedValue(obj: unknown, path: string): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : undefined;
}

/**
 * Translation function. Accepts a dot-notation key and optional interpolation variables.
 *
 * @example
 * t("common.cancel")                          // → "Abbrechen"
 * t("admin.showingUsers", { count: 5, total: 20 }) // → "Zeige 5 von 20 Benutzern"
 */
export function t(
  key: LocaleKey,
  vars?: Record<string, string | number>,
): string {
  const raw = getNestedValue(de, key);

  if (raw === undefined) {
    // Fallback: return the key itself so missing translations are visible
    return key;
  }

  if (!vars) return raw;

  return raw.replace(/\{(\w+)\}/g, (_, name: string) => {
    const val = vars[name];
    return val !== undefined ? String(val) : `{${name}}`;
  });
}
