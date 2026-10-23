import { describe, expect, it } from 'vitest';
import { ZODIAC_SIGNS, ZODIAC_SIGN_IDS, isZodiacSignId } from '@/lib/astrology/zodiacSigns';
import { HOROSCOPE_PERIODS, HOROSCOPE_THEMES, THEME_BODY_SLOT } from '@/lib/astrology/scopes';

describe('zodiac metadata', () => {
  it('contains exactly 12 unique stable sign IDs in traditional order', () => {
    expect(ZODIAC_SIGN_IDS).toHaveLength(12);
    expect(new Set(ZODIAC_SIGN_IDS).size).toBe(12);
    expect(ZODIAC_SIGN_IDS[0]).toBe('aries');
    expect(ZODIAC_SIGN_IDS[11]).toBe('pisces');
  });

  it('has matching detail records with unique symbols and valid elements', () => {
    expect(ZODIAC_SIGNS).toHaveLength(12);
    const symbols = new Set(ZODIAC_SIGNS.map((s) => s.symbol));
    expect(symbols.size).toBe(12);
    for (const sign of ZODIAC_SIGNS) {
      expect(['fire', 'earth', 'air', 'water']).toContain(sign.element);
      expect(sign.approxStart.month).toBeGreaterThanOrEqual(1);
      expect(sign.approxStart.month).toBeLessThanOrEqual(12);
      expect(sign.approxEnd.day).toBeGreaterThanOrEqual(1);
      expect(sign.approxEnd.day).toBeLessThanOrEqual(31);
    }
  });

  it('recognizes valid IDs and rejects unknown values', () => {
    expect(isZodiacSignId('leo')).toBe(true);
    expect(isZodiacSignId('Leo')).toBe(false);
    expect(isZodiacSignId('ophiuchus')).toBe(false);
    expect(isZodiacSignId(42)).toBe(false);
  });
});

describe('scope vocabulary', () => {
  it('defines daily/weekly periods and four themes', () => {
    expect(HOROSCOPE_PERIODS).toEqual(['daily', 'weekly']);
    expect(HOROSCOPE_THEMES).toEqual(['general', 'relationships', 'work', 'growth']);
  });

  it('maps every theme to a distinct body slot', () => {
    const slots = Object.values(THEME_BODY_SLOT);
    expect(new Set(slots).size).toBe(4);
    expect(THEME_BODY_SLOT.general).toBe('focus');
    expect(THEME_BODY_SLOT.relationships).toBe('relationships');
  });
});
