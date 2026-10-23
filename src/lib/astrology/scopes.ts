/**
 * Horoscope scope vocabulary: periods and themes.
 * Machine IDs are English slugs and must not change; localized labels live in
 * the message dictionaries.
 */
export const HOROSCOPE_PERIODS = ['daily', 'weekly'] as const;
export type HoroscopePeriod = (typeof HOROSCOPE_PERIODS)[number];

export const HOROSCOPE_THEMES = ['general', 'relationships', 'work', 'growth'] as const;
export type HoroscopeTheme = (typeof HOROSCOPE_THEMES)[number];

/** Slot used for the theme-specific body section of a composition. */
export const THEME_BODY_SLOT = {
  general: 'focus',
  relationships: 'relationships',
  work: 'work',
  growth: 'growth',
} as const satisfies Record<HoroscopeTheme, string>;

export function isHoroscopePeriod(value: unknown): value is HoroscopePeriod {
  return typeof value === 'string' && (HOROSCOPE_PERIODS as readonly string[]).includes(value);
}

export function isHoroscopeTheme(value: unknown): value is HoroscopeTheme {
  return typeof value === 'string' && (HOROSCOPE_THEMES as readonly string[]).includes(value);
}
