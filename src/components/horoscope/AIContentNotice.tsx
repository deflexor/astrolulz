import { useTranslations } from 'next-intl';

/**
 * Persistent AI-generated-content disclosure (spec §1.1, FR-04).
 * Rendered near the form and inside every result; also included in copied
 * text. Works in both server and client components.
 */
export function AIContentNotice({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('notice');
  if (compact) {
    return (
      <p className="ai-notice ai-notice-compact" role="note">
        {t('short')}
      </p>
    );
  }
  return (
    <aside className="ai-notice" role="note" aria-label={t('title')}>
      <strong>{t('title')}</strong>
      <p>{t('text')}</p>
    </aside>
  );
}
