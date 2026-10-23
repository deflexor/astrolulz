import { describe, expect, it } from 'vitest';
import {
  MAX_RECENT_COMPOSITION_IDS,
  parseHoroscopeRequest,
} from '@/lib/validation/horoscopeRequest';

const validPayload = {
  locale: 'en',
  signId: 'aries',
  period: 'daily',
  theme: 'general',
};

describe('horoscope request validation', () => {
  it('accepts a minimal valid request and applies safe defaults', () => {
    const result = parseHoroscopeRequest(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recentCompositionIds).toEqual([]);
      expect(result.data.timeZone).toBe('UTC');
    }
  });

  it('accepts a full request with recents and an IANA time zone', () => {
    const result = parseHoroscopeRequest({
      ...validPayload,
      locale: 'ru',
      signId: 'pisces',
      period: 'weekly',
      theme: 'work',
      recentCompositionIds: ['0123456789abcdef'],
      timeZone: 'Europe/Moscow',
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ['unknown locale', { locale: 'fr' }],
    ['unknown sign', { signId: 'ophiuchus' }],
    ['unknown period', { period: 'monthly' }],
    ['unknown theme', { theme: 'love' }],
    ['missing sign', { signId: undefined }],
    ['non-string theme', { theme: 3 }],
  ])('rejects %s', (_name, override) => {
    const result = parseHoroscopeRequest({ ...validPayload, ...override });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('invalid_request');
  });

  it('rejects an invalid IANA time zone', () => {
    const result = parseHoroscopeRequest({ ...validPayload, timeZone: 'Not/AZone' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.field).toBe('timeZone');
  });

  it('rejects malformed and oversized recent-composition lists', () => {
    expect(
      parseHoroscopeRequest({ ...validPayload, recentCompositionIds: ['nothex'] }).success,
    ).toBe(false);
    expect(
      parseHoroscopeRequest({
        ...validPayload,
        recentCompositionIds: Array.from(
          { length: MAX_RECENT_COMPOSITION_IDS + 1 },
          () => '0123456789abcdef',
        ),
      }).success,
    ).toBe(false);
  });

  it('rejects non-object payloads', () => {
    expect(parseHoroscopeRequest(null).success).toBe(false);
    expect(parseHoroscopeRequest('horoscope please').success).toBe(false);
  });
});
