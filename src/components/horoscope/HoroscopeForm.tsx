'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ZODIAC_SIGNS, type ZodiacSignId } from '@/lib/astrology/zodiacSigns';
import {
  HOROSCOPE_PERIODS,
  HOROSCOPE_THEMES,
  type HoroscopePeriod,
  type HoroscopeTheme,
} from '@/lib/astrology/scopes';
import type { HoroscopeApiResponse, HoroscopeResult } from '@/lib/content/types';
import { HoroscopeResultView } from './HoroscopeResult';
import styles from './HoroscopeForm.module.css';

/**
 * Sign / period / theme selection and horoscope requests (spec §5.1, FR-03).
 *
 * Selections are mirrored into the URL query string so a locale switch (or a
 * shared link) preserves them; recently shown composition fingerprints live in
 * localStorage only and are capped at 20 (spec FR-12, §9.1).
 */
const RECENT_STORAGE_PREFIX = 'ac:recent:';
const MAX_RECENT = 20;

type SuccessPayload = { result: HoroscopeResult; repeated: boolean };
type RequestState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; code: string }
  | { kind: 'success'; payload: SuccessPayload };

function readRecentIds(locale: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_PREFIX + locale);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => /^[0-9a-f]{16}$/.test(String(v)))
      : [];
  } catch {
    return [];
  }
}

function rememberCompositionId(locale: string, id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const next = [id, ...readRecentIds(locale).filter((existing) => existing !== id)].slice(
      0,
      MAX_RECENT,
    );
    window.localStorage.setItem(RECENT_STORAGE_PREFIX + locale, JSON.stringify(next));
  } catch {
    // Storage may be unavailable (private mode); repetition avoidance degrades gracefully.
  }
}

export function HoroscopeForm() {
  const t = useTranslations();
  const locale = useLocale();

  const [signId, setSignId] = useState<ZodiacSignId>('aries');
  const [period, setPeriod] = useState<HoroscopePeriod>('daily');
  const [theme, setTheme] = useState<HoroscopeTheme>('general');
  const [state, setState] = useState<RequestState>({ kind: 'idle' });
  const requestSeq = useRef(0);

  // Restore selection from the URL once after hydration (preserved across
  // locale switches). Reading window here would break SSR markup equality,
  // so this is intentionally a post-hydration state sync.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const signParam = params.get('sign');
    const periodParam = params.get('period');
    const themeParam = params.get('theme');
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from external URL state */
    if (ZODIAC_SIGNS.some((s) => s.id === signParam)) setSignId(signParam as ZodiacSignId);
    if (HOROSCOPE_PERIODS.includes(periodParam as HoroscopePeriod))
      setPeriod(periodParam as HoroscopePeriod);
    if (HOROSCOPE_THEMES.includes(themeParam as HoroscopeTheme))
      setTheme(themeParam as HoroscopeTheme);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const syncUrl = useCallback((next: { sign: string; period: string; theme: string }) => {
    const params = new URLSearchParams(window.location.search);
    params.set('sign', next.sign);
    params.set('period', next.period);
    params.set('theme', next.theme);
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, []);

  const requestHoroscope = useCallback(async () => {
    const seq = ++requestSeq.current;
    setState({ kind: 'loading' });
    try {
      const response = await fetch('/api/horoscope', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          locale,
          signId,
          period,
          theme,
          recentCompositionIds: readRecentIds(locale),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = (await response.json()) as HoroscopeApiResponse;
      if (seq !== requestSeq.current) return; // a newer selection superseded this request
      if ('error' in data) {
        setState({ kind: 'error', code: data.error.code });
      } else {
        rememberCompositionId(locale, data.result.compositionId);
        setState({ kind: 'success', payload: data });
      }
    } catch {
      if (seq === requestSeq.current) setState({ kind: 'error', code: 'network' });
    }
  }, [locale, signId, period, theme]);

  // Auto-load: the reading appears right after the page loads and refreshes
  // whenever the selection changes (debounced, so quick clicks and the
  // post-hydration URL restore collapse into one request).
  useEffect(() => {
    const timer = setTimeout(() => void requestHoroscope(), 300);
    return () => clearTimeout(timer);
  }, [requestHoroscope]);

  const busy = state.kind === 'loading';
  const selectedSign = ZODIAC_SIGNS.find((s) => s.id === signId)!;

  return (
    <section className={styles.form} aria-busy={busy}>
      <fieldset className={styles.group}>
        <legend className="fieldset-label">{t('home.form.signLabel')}</legend>
        <div className={styles.signGrid} role="group" aria-label={t('home.form.signLabel')}>
          {ZODIAC_SIGNS.map((sign) => (
            <button
              key={sign.id}
              type="button"
              className={`${styles.signButton} ${sign.id === signId ? styles.signButtonActive : ''}`}
              aria-pressed={sign.id === signId}
              onClick={() => {
                setSignId(sign.id);
                syncUrl({ sign: sign.id, period, theme });
              }}
            >
              <span className={styles.signSymbol} aria-hidden="true">
                {sign.symbol}
              </span>
              <span className={styles.signName}>{t(`zodiac.${sign.id}.name`)}</span>
            </button>
          ))}
        </div>
        <p className="visually-hidden" aria-live="polite">
          {t('home.form.signSelected', { name: t(`zodiac.${selectedSign.id}.name`) })}
        </p>
      </fieldset>

      <div className={styles.row}>
        <fieldset className={styles.group}>
          <legend className="fieldset-label">{t('home.form.periodLabel')}</legend>
          <div className={styles.segmented} role="group" aria-label={t('home.form.periodLabel')}>
            {HOROSCOPE_PERIODS.map((value) => (
              <button
                key={value}
                type="button"
                className={value === period ? styles.segmentActive : ''}
                aria-pressed={value === period}
                onClick={() => {
                  setPeriod(value);
                  syncUrl({ sign: signId, period: value, theme });
                }}
              >
                {t(`periods.${value}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className="fieldset-label">{t('home.form.themeLabel')}</legend>
          <div className={styles.segmented} role="group" aria-label={t('home.form.themeLabel')}>
            {HOROSCOPE_THEMES.map((value) => (
              <button
                key={value}
                type="button"
                className={value === theme ? styles.segmentActive : ''}
                aria-pressed={value === theme}
                onClick={() => {
                  setTheme(value);
                  syncUrl({ sign: signId, period, theme: value });
                }}
              >
                {t(`themes.${value}`)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className={styles.actions}>
        {state.kind === 'success' && (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={requestHoroscope}
            disabled={busy}
          >
            {t('home.form.showAnother')}
          </button>
        )}
      </div>

      <div aria-live="polite">
        {state.kind === 'loading' && <p className={styles.loading}>{t('home.form.loading')}</p>}
        {state.kind === 'error' && (
          <div className="error-box" role="alert">
            <p>{t(`errors.${state.code}`)}</p>
            <button type="button" onClick={requestHoroscope}>
              {t('errors.retry')}
            </button>
          </div>
        )}
        {state.kind === 'success' && (
          <HoroscopeResultView result={state.payload.result} repeated={state.payload.repeated} />
        )}
      </div>
    </section>
  );
}
