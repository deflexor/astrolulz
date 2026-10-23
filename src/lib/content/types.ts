import type { HoroscopePeriod, HoroscopeTheme } from '@/lib/astrology/scopes';
import type { Locale } from '@/lib/i18n/locales';
import type { ContentSlot } from '@/lib/content/contentSchema';

/**
 * Final horoscope result returned by the API, shaped per spec FR-03.
 * All text is pre-generated, approved, and in exactly one locale.
 */
export type HoroscopeResultSection = {
  /** Localized heading, resolved from the message dictionary by slot. */
  heading: string;
  text: string;
};

export type HoroscopeResult = {
  locale: Locale;
  signId: string;
  period: HoroscopePeriod;
  theme: HoroscopeTheme;
  title: string;
  overview: string;
  sections: HoroscopeResultSection[];
  reflectionPrompt?: string;
  assembledAt: string;
  contentVersion: string;
  compositionId: string;
  generatedByAI: true;
  generationMode: 'pre-generated-composition';
  disclaimerVersion: string;
};

/** Version of the localized AI disclosure wording (spec FR-03/FR-04). */
export const DISCLAIMER_VERSION = 'v1';

/** Machine-readable error codes; the UI maps them to localized messages. */
export type HoroscopeErrorCode =
  | 'invalid_request'
  | 'rate_limited'
  | 'content_unavailable'
  | 'database_unavailable'
  | 'unexpected_error';

export type HoroscopeApiError = {
  error: { code: HoroscopeErrorCode; field?: string };
};

export type HoroscopeApiResponse =
  { result: HoroscopeResult; repeated: boolean } | HoroscopeApiError;

/** Slots whose headings exist in `result.headings.<slot>` message keys. */
export type SectionSlot = Extract<
  ContentSlot,
  'overview' | 'focus' | 'relationships' | 'work' | 'growth' | 'closing'
>;
