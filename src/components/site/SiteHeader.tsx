import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './LocaleSwitcher';

export async function SiteHeader() {
  const t = await getTranslations('nav');
  return (
    <header className="site-header">
      <a href="#main" className="skip-link">
        {t('skipToContent')}
      </a>
      <div className="site-header-inner">
        <Link href="/" className="site-brand">
          ✷ AstralCanvas
        </Link>
        <nav className="site-nav" aria-label={t('home')}>
          <Link href="/">{t('home')}</Link>
          <Link href="/explorer">{t('explorer')}</Link>
          <Link href="/about">{t('about')}</Link>
        </nav>
        <LocaleSwitcher />
      </div>
    </header>
  );
}
