'use client';

import { Suspense } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { defaultLocale, isLocale, localeLabels, locales } from '@/lib/i18n/locales';

/**
 * Switches the locale segment of the current URL, preserving the path and
 * query string (which carries the selected sign/period/theme, spec §8.1).
 * The URL locale is the source of truth — no cookie is required.
 */
export function LocaleSwitcher() {
  return (
    <Suspense fallback={null}>
      <LocaleSwitcherInner />
    </Suspense>
  );
}

function LocaleSwitcherInner() {
  const t = useTranslations('localeSwitcher');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const current = isLocale(locale) ? locale : defaultLocale;

  const searchParams = new URLSearchParams(
    typeof window === 'undefined' ? '' : window.location.search,
  );
  const queryString = searchParams.toString();

  return (
    <label>
      <span className="visually-hidden">{t('label')}</span>
      <select
        value={current}
        onChange={(event) => {
          const next = event.target.value;
          const href = queryString ? `${pathname}?${queryString}` : pathname;
          router.push(href, { locale: next });
        }}
        aria-label={t('current', { label: localeLabels[current] })}
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {localeLabels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
