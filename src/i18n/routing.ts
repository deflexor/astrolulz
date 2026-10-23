import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from '@/lib/i18n/locales';

/**
 * Locale routing configuration. The locale in the URL is the source of truth;
 * `locales`/`defaultLocale` come from the shared config in `src/lib/i18n`.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
});
