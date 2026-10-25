import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ru from '@/messages/ru.json';
import { defaultLocale, isLocale, locales } from '@/lib/i18n/locales';

function flattenKeys(node: unknown, prefix = ''): string[] {
  if (node === null || typeof node !== 'object') return [prefix];
  return Object.entries(node).flatMap(([key, value]) =>
    flattenKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe('locale configuration', () => {
  it('lists unique locales including the default', () => {
    expect(new Set(locales).size).toBe(locales.length);
    expect(locales).toContain(defaultLocale);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });
});

describe('message dictionaries', () => {
  const enKeys = new Set(flattenKeys(en));
  const ruKeys = new Set(flattenKeys(ru));

  it('en and ru have identical key sets (no missing translations)', () => {
    const missingInRu = [...enKeys].filter((key) => !ruKeys.has(key));
    const missingInEn = [...ruKeys].filter((key) => !enKeys.has(key));
    expect(missingInRu).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it('covers every required UI path', () => {
    const required = [
      'metadata.title',
      'metadata.description',
      'nav.home',
      'nav.explorer',
      'nav.about',
      'localeSwitcher.label',
      'home.title',
      'home.intro',
      'home.form.signLabel',
      'home.form.periodLabel',
      'home.form.themeLabel',
      'home.form.loading',
      'home.explorerTeaser.cta',
      'result.assembledAt',
      'result.reflectionLabel',
      'result.copy',
      'result.copied',
      'result.copyFailed',
      'result.manualCopy',
      'result.repeatedNotice',
      'result.unavailableTitle',
      'result.unavailableText',
      'sections.overview',
      'sections.focus',
      'sections.relationships',
      'sections.work',
      'sections.growth',
      'sections.closing',
      'periods.daily',
      'periods.weekly',
      'themes.general',
      'themes.relationships',
      'themes.work',
      'themes.growth',
      'notice.title',
      'notice.text',
      'errors.invalid_request',
      'errors.rate_limited',
      'errors.content_unavailable',
      'errors.database_unavailable',
      'errors.unexpected_error',
      'errors.network',
      'errors.retry',
      'explorer.title',
      'explorer.back',
      'about.title',
      'about.lead',
      'about.how.heading',
      'about.entertainment.heading',
      'about.science.heading',
      'about.limits.heading',
      'about.planets.heading',
      'about.privacy.heading',
      'footer.projectInfo',
    ];
    for (const key of required) {
      expect(enKeys.has(key), `en missing key: ${key}`).toBe(true);
      expect(ruKeys.has(key), `ru missing key: ${key}`).toBe(true);
    }
  });

  it('localizes all 12 zodiac names in every locale', () => {
    for (const sign of [
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
    ]) {
      expect(enKeys.has(`zodiac.${sign}.name`), `en missing zodiac.${sign}.name`).toBe(true);
      expect(ruKeys.has(`zodiac.${sign}.name`), `ru missing zodiac.${sign}.name`).toBe(true);
    }
  });
});
