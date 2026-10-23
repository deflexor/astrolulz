import { z } from 'zod';
import { locales } from '@/lib/i18n/locales';
import { ZODIAC_SIGN_IDS } from '@/lib/astrology/zodiacSigns';
import { HOROSCOPE_PERIODS, HOROSCOPE_THEMES } from '@/lib/astrology/scopes';

/** Cap and format rules for client-supplied recent composition fingerprints. */
export const MAX_RECENT_COMPOSITION_IDS = 20;

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const horoscopeRequestSchema = z.object({
  locale: z.enum(locales),
  signId: z.enum(ZODIAC_SIGN_IDS),
  period: z.enum(HOROSCOPE_PERIODS),
  theme: z.enum(HOROSCOPE_THEMES),
  recentCompositionIds: z
    .array(z.string().regex(/^[0-9a-f]{16}$/))
    .max(MAX_RECENT_COMPOSITION_IDS)
    .default([]),
  timeZone: z
    .string()
    .min(1)
    .max(64)
    .refine(isValidTimeZone, { message: 'invalid IANA time zone' })
    .default('UTC'),
});

export type HoroscopeRequestInput = z.input<typeof horoscopeRequestSchema>;
export type ValidatedHoroscopeRequest = z.output<typeof horoscopeRequestSchema>;

export type RequestParseError = { code: 'invalid_request'; field?: string; message: string };

export function parseHoroscopeRequest(
  payload: unknown,
):
  | { success: true; data: ValidatedHoroscopeRequest }
  | { success: false; error: RequestParseError } {
  const result = horoscopeRequestSchema.safeParse(payload);
  if (result.success) return { success: true, data: result.data };
  const first = result.error.issues[0];
  const path = first?.path?.join('.') ?? '';
  return {
    success: false,
    error: {
      code: 'invalid_request',
      field: path || undefined,
      message: first?.message ?? 'invalid payload',
    },
  };
}
