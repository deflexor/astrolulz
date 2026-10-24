import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ExplorerScene } from '@/components/explorer/ExplorerScene';

/**
 * Zodiac Explorer (spec §5.2, Milestone 5). The interactive scene is a
 * browser-only client component; this server shell only provides localized
 * copy and stays statically prerendered.
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
      </section>
      <ExplorerScene />
      <Link className="text-link" href="/">
        ← {t('back')}
      </Link>
    </div>
  );
}
