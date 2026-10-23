import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * Zodiac Explorer (spec §5.2). The interactive Three.js/GLSL scene is
 * Milestone 5 and not implemented yet; this page states that honestly
 * instead of shipping a placeholder canvas that claims to be the scene.
 */
export default async function ExplorerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'explorer' });

  return (
    <div className="stack">
      <section className="hero">
        <h1>{t('title')}</h1>
        <p className="hero-lead">{t('lead')}</p>
        <p>
          <span className="ai-badge">{t('status')}</span>
        </p>
      </section>
      <Link className="text-link" href="/">
        ← {t('back')}
      </Link>
    </div>
  );
}
