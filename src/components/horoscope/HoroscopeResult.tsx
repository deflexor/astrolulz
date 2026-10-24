'use client';

import { useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { buildShareText } from '@/lib/content/shareText';
import { getZodiacSign, type ZodiacSignId } from '@/lib/astrology/zodiacSigns';
import type { HoroscopeResult as HoroscopeResultData } from '@/lib/content/types';
import styles from './HoroscopeResult.module.css';

type CopyState = 'idle' | 'copied' | 'manual';

/**
 * Renders an assembled horoscope: title, meta line, sections, and reflection
 * prompt. Copied/share text keeps the localized AI notice (spec FR-04,
 * FR-10); the visible disclosure lives on the About page.
 */
export function HoroscopeResultView({
  result,
  repeated,
}: {
  result: HoroscopeResultData;
  repeated: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const signName = t(`zodiac.${result.signId}.name`);
  const periodLabel = t(`periods.${result.period}`);
  const themeLabel = t(`themes.${result.theme}`);
  const sign = getZodiacSign(result.signId as ZodiacSignId);

  const assembledAtLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(result.assembledAt),
      );
    } catch {
      return result.assembledAt;
    }
  }, [locale, result.assembledAt]);

  const shareText = useMemo(
    () =>
      buildShareText({
        result,
        labels: {
          signName,
          periodLabel,
          themeLabel,
          assembledAtLabel,
          reflectionLabel: t('result.reflectionLabel'),
          aiNotice: t('notice.text'),
          sourceLabel: 'AstralCanvas',
        },
      }),
    [result, signName, periodLabel, themeLabel, assembledAtLabel, t],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyState('copied');
    } catch {
      setCopyState('manual');
      requestAnimationFrame(() => textareaRef.current?.select());
    }
  };

  return (
    <article className={styles.card} aria-label={signName}>
      <header className={styles.header}>
        <span className={styles.symbol} aria-hidden="true">
          {sign.symbol}
        </span>
        <div>
          <h2 className={styles.title}>{result.title}</h2>
          <p className={styles.meta}>
            {signName} · {periodLabel} · {themeLabel} ·{' '}
            {t('result.assembledAt', { date: assembledAtLabel })}
          </p>
        </div>
      </header>

      <p className={styles.overview}>{result.overview}</p>

      {result.sections.map((section) => (
        <section key={section.heading} className={styles.section}>
          <h3>{section.heading}</h3>
          <p>{section.text}</p>
        </section>
      ))}

      {result.reflectionPrompt && (
        <section className={styles.reflection}>
          <h3>{t('result.reflectionLabel')}</h3>
          <p>{result.reflectionPrompt}</p>
        </section>
      )}

      {repeated && (
        <div className="info-box" role="status">
          {t('result.repeatedNotice')}
        </div>
      )}

      <div className={styles.copyRow}>
        <button type="button" className={styles.copyButton} onClick={copy}>
          {t('result.copy')}
        </button>
        {copyState === 'copied' && (
          <span role="status" className={styles.copyStatus}>
            {t('result.copied')}
          </span>
        )}
      </div>
      {copyState === 'manual' && (
        <div>
          <p>{t('result.manualCopy')}</p>
          <textarea
            ref={textareaRef}
            readOnly
            rows={8}
            value={shareText}
            className={styles.manualCopy}
          />
        </div>
      )}
    </article>
  );
}
