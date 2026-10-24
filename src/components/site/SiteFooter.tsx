import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function SiteFooter() {
  const [tNav, tFooter] = await Promise.all([getTranslations('nav'), getTranslations('footer')]);
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>{tFooter('projectInfo')}</span>
        <Link href="/about">{tNav('about')}</Link>
      </div>
    </footer>
  );
}
