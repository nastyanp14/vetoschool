import type { Lang } from '../lib/i18n';

const loadingLabel: Record<Lang, string> = {
  ru: 'Загрузка…',
  en: 'Loading…',
  ua: 'Завантаження…',
};

export default function AppLoadingScreen({ lang }: { lang: Lang }) {
  return (
    <main
      className="app-loading-screen"
      role="status"
      aria-live="polite"
      aria-label={loadingLabel[lang]}
    >
      <section className="app-loader-card">
        <div className="app-loader-stage" aria-hidden="true">
          <img
            src="/owl/loading-owl-clock.png"
            alt=""
            className="app-loader-owl"
            draggable="false"
          />
        </div>

        <h1 className="app-loader-brand">Vetoschool</h1>
        <div className="app-loader-progress" aria-hidden="true"><span /></div>
      </section>
    </main>
  );
}
