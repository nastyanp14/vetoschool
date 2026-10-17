import type { Lang } from '@/lib/i18n';
import { meetCopy } from './copy';
import './meet.css';

export default function OnlineClassBanner({ lang, pageHeading = false }: { lang: Lang; pageHeading?: boolean }) {
  const c = meetCopy[lang];
  const Heading = pageHeading ? 'h1' : 'h2';

  return (
    <div className="meet-banner">
      <img src="/dashboard/meet/banner.png" alt="" width="2172" height="724" className="meet-banner-art dark:hidden" />
      <img src="/dashboard/meet/banner-dark.png" alt="" width="2170" height="725" className="meet-banner-art hidden dark:block" />
      <div className="meet-banner-copy">
        <p>Vetoschool Meet</p>
        <Heading>{c.title}</Heading>
        <p>{c.subtitle}</p>
      </div>
    </div>
  );
}
