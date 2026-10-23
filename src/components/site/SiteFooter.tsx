import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function SiteFooter() {
  const [tNav, tFooter, tNotice] = await Promise.all([
    getTranslations('nav'),
    getTranslations('footer'),
    getTranslations('notice'),
  ]);
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>{tFooter('projectInfo')}</span>
        <span>{tNotice('short')}</span>
        <Link href="/about">{tNav('about')}</Link>
      </div>
    </footer>
  );
}
