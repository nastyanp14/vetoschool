import type { CSSProperties } from 'react';
import type { Lang } from '../lib/i18n';

const loadingCopy: Record<Lang, string> = {
  ru: 'Готовим немного волшебства…',
  en: 'Preparing a little magic…',
  ua: 'Готуємо трохи магії…',
};

const sparkles = [
  { left: '13%', top: '18%', size: 12, delay: '0s' },
  { left: '24%', top: '72%', size: 8, delay: '-1.4s' },
  { left: '38%', top: '12%', size: 7, delay: '-2.1s' },
  { left: '65%', top: '16%', size: 10, delay: '-0.8s' },
  { left: '80%', top: '31%', size: 7, delay: '-2.8s' },
  { left: '86%', top: '73%', size: 11, delay: '-1.9s' },
  { left: '59%', top: '84%', size: 6, delay: '-0.4s' },
  { left: '9%', top: '57%', size: 6, delay: '-2.5s' },
];

export default function AppLoadingScreen({ lang }: { lang: Lang }) {
  return (
    <main
      className="app-loading-screen"
      role="status"
      aria-live="polite"
      aria-label={loadingCopy[lang]}
    >
      <div className="app-loader-orb app-loader-orb--pink" aria-hidden="true" />
      <div className="app-loader-orb app-loader-orb--purple" aria-hidden="true" />
      <div className="app-loader-orb app-loader-orb--blue" aria-hidden="true" />

      {sparkles.map((sparkle, index) => (
        <span
          key={index}
          className="app-loader-sparkle"
          aria-hidden="true"
          style={{
            left: sparkle.left,
            top: sparkle.top,
            width: sparkle.size,
            height: sparkle.size,
            animationDelay: sparkle.delay,
          } as CSSProperties}
        />
      ))}

      <section className="app-loader-card">
        <div className="app-loader-stage" aria-hidden="true">
          <div className="app-loader-ring app-loader-ring--outer" />
          <div className="app-loader-ring app-loader-ring--inner" />
          <div className="app-loader-glow" />
          <img
            src="/owl/loading-owl-clock.png"
            alt=""
            className="app-loader-owl"
            draggable="false"
          />
          <img src="/home/hero-star.png" alt="" className="app-loader-magic-star app-loader-magic-star--one" />
          <img src="/home/hero-star.png" alt="" className="app-loader-magic-star app-loader-magic-star--two" />
        </div>

        <h1 className="app-loader-brand">Vetoschool</h1>
        <p className="app-loader-copy">{loadingCopy[lang]}</p>
        <div className="app-loader-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}
