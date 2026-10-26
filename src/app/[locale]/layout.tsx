import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { Forum } from 'next/font/google';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { defaultLocale } from '@/lib/i18n/locales';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import '../globals.css';

// Forum (Google Fonts, OFL) — antique Roman capitals with Cyrillic support;
// the site-wide medieval face. Self-hosted by next/font at build time.
const forum = Forum({
  subsets: ['latin', 'cyrillic'],
  weight: '400',
  display: 'swap',
  variable: '--font-forum',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: requested } = await params;
  // The proxy guarantees valid locales for page routes; fall back to the
  // default locale defensively rather than rendering a broken tree.
  const locale = hasLocale(routing.locales, requested) ? requested : defaultLocale;
  setRequestLocale(locale);

  return (
    <html lang={locale} className={forum.variable}>
      <body>
        <NextIntlClientProvider>
          <SiteHeader />
          <main id="main" className="page-main">
            {children}
          </main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
