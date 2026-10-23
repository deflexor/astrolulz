/**
 * Stable machine identifiers for the 12 zodiac signs.
 *
 * IDs are language-independent slugs and must never change: they are used in
 * URLs, the content bank, and the database. Localized display names live in
 * the message dictionaries (`zodiac.<id>.name`), not here.
 *
 * `approxStart`/`approxEnd` are approximate tropical-zodiac date boundaries
 * for display only; real boundaries shift with leap years and time zones.
 */
export const ZODIAC_SIGN_IDS = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
] as const;

export type ZodiacSignId = (typeof ZODIAC_SIGN_IDS)[number];

export const ZODIAC_ELEMENTS = ['fire', 'earth', 'air', 'water'] as const;
export type ZodiacElement = (typeof ZODIAC_ELEMENTS)[number];

export type ZodiacSign = {
  id: ZodiacSignId;
  /** Unicode astrological symbol, e.g. ♈ — always paired with a text label. */
  symbol: string;
  element: ZodiacElement;
  approxStart: { month: number; day: number };
  approxEnd: { month: number; day: number };
};

export const ZODIAC_SIGNS: readonly ZodiacSign[] = [
  {
    id: 'aries',
    symbol: '♈',
    element: 'fire',
    approxStart: { month: 3, day: 21 },
    approxEnd: { month: 4, day: 19 },
  },
  {
    id: 'taurus',
    symbol: '♉',
    element: 'earth',
    approxStart: { month: 4, day: 20 },
    approxEnd: { month: 5, day: 20 },
  },
  {
    id: 'gemini',
    symbol: '♊',
    element: 'air',
    approxStart: { month: 5, day: 21 },
    approxEnd: { month: 6, day: 20 },
  },
  {
    id: 'cancer',
    symbol: '♋',
    element: 'water',
    approxStart: { month: 6, day: 21 },
    approxEnd: { month: 7, day: 22 },
  },
  {
    id: 'leo',
    symbol: '♌',
    element: 'fire',
    approxStart: { month: 7, day: 23 },
    approxEnd: { month: 8, day: 22 },
  },
  {
    id: 'virgo',
    symbol: '♍',
    element: 'earth',
    approxStart: { month: 8, day: 23 },
    approxEnd: { month: 9, day: 22 },
  },
  {
    id: 'libra',
    symbol: '♎',
    element: 'air',
    approxStart: { month: 9, day: 23 },
    approxEnd: { month: 10, day: 22 },
  },
  {
    id: 'scorpio',
    symbol: '♏',
    element: 'water',
    approxStart: { month: 10, day: 23 },
    approxEnd: { month: 11, day: 21 },
  },
  {
    id: 'sagittarius',
    symbol: '♐',
    element: 'fire',
    approxStart: { month: 11, day: 22 },
    approxEnd: { month: 12, day: 21 },
  },
  {
    id: 'capricorn',
    symbol: '♑',
    element: 'earth',
    approxStart: { month: 12, day: 22 },
    approxEnd: { month: 1, day: 19 },
  },
  {
    id: 'aquarius',
    symbol: '♒',
    element: 'air',
    approxStart: { month: 1, day: 20 },
    approxEnd: { month: 2, day: 18 },
  },
  {
    id: 'pisces',
    symbol: '♓',
    element: 'water',
    approxStart: { month: 2, day: 19 },
    approxEnd: { month: 3, day: 20 },
  },
] as const;

export function isZodiacSignId(value: unknown): value is ZodiacSignId {
  return typeof value === 'string' && (ZODIAC_SIGN_IDS as readonly string[]).includes(value);
}

export function getZodiacSign(id: ZodiacSignId): ZodiacSign {
  const sign = ZODIAC_SIGNS.find((s) => s.id === id);
  if (!sign) throw new Error(`Unknown zodiac sign: ${id}`);
  return sign;
}
