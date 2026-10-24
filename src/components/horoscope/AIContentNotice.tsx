import { useTranslations } from 'next-intl';

/**
 * AI-generated-content disclosure block (spec §1.1, FR-04).
 *
 * Shown on the About / disclaimer page, which is the single place the full
 * visible disclosure lives (owner decision, 2026-10-24: no repeated notice
 * panes elsewhere in the UI). The notice also remains part of copied/share
 * text and the API response metadata.
 */
export function AIContentNotice() {
  const t = useTranslations('notice');
  return (
    <aside className="ai-notice" role="note" aria-label={t('title')}>
      <strong>{t('title')}</strong>
      <p>{t('text')}</p>
    </aside>
  );
}
