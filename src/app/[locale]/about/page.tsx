import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AIContentNotice } from '@/components/horoscope/AIContentNotice';

/**
 * About / Disclaimer (spec §5.3). Accessible without generating a horoscope;
 * every locale ships a reviewed, human-readable disclosure.
 */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'about' });

  const sections = [
    { key: 'how', heading: t('how.heading'), body: t('how.body') },
    { key: 'entertainment', heading: t('entertainment.heading'), body: t('entertainment.body') },
    { key: 'science', heading: t('science.heading'), body: t('science.body') },
    { key: 'limits', heading: t('limits.heading'), body: t('limits.body') },
    { key: 'planets', heading: t('planets.heading'), body: t('planets.body') },
    { key: 'privacy', heading: t('privacy.heading'), body: t('privacy.body') },
  ];

  return (
    <div className="stack">
      <section className="hero">
        <h1>{t('title')}</h1>
        <p className="hero-lead">{t('lead')}</p>
      </section>

      <AIContentNotice />

      {sections.map((section) => (
        <section key={section.key} className="panel">
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </div>
  );
}
