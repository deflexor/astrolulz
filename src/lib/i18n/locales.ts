/**
 * Single source of truth for supported locales.
 * Adding a locale requires: an entry here, a `src/messages/<locale>.json`
 * dictionary, and an approved content bank (see docs/localization.md).
 */
export const locales = ['en', 'ru'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}
