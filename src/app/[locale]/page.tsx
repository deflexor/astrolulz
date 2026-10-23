import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { HoroscopeForm } from '@/components/horoscope/HoroscopeForm';
import { AIContentNotice } from '@/components/horoscope/AIContentNotice';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <div className="stack">
      <section className="hero">
        <h1>{t('title')}</h1>
        <p className="hero-lead">{t('intro')}</p>
      </section>

      {/* Persistent AI disclosure — always visible near the controls (spec §5.1). */}
      <AIContentNotice />

      <HoroscopeForm />

      <section className="panel">
        <h2>{t('explorerTeaser.title')}</h2>
        <p>{t('explorerTeaser.text')}</p>
        <p>
          <Link className="text-link" href="/explorer">
            {t('explorerTeaser.cta')} →
          </Link>
        </p>
      </section>
    </div>
  );
}
