import { Settings } from 'lucide-react';
import Footer from '../components/Footer';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { Lang, t, TranslationKey } from '../lib/i18n';

type CookiePolicyProps = {
  lang: Lang;
};

const sections: Array<{ title: TranslationKey; body: TranslationKey }> = [
  { title: 'cookie_policy_intro_title', body: 'cookie_policy_intro_body' },
  { title: 'cookie_policy_controller_title', body: 'cookie_policy_controller_body' },
  { title: 'cookie_policy_categories_title', body: 'cookie_policy_categories_body' },
  { title: 'cookie_necessary_title', body: 'cookie_policy_necessary_body' },
  { title: 'cookie_functional_title', body: 'cookie_policy_functional_body' },
  { title: 'cookie_analytics_title', body: 'cookie_policy_analytics_body' },
  { title: 'cookie_marketing_title', body: 'cookie_policy_marketing_body' },
  { title: 'cookie_policy_providers_title', body: 'cookie_policy_providers_body' },
  { title: 'cookie_policy_storage_title', body: 'cookie_policy_storage_body' },
  { title: 'cookie_policy_legal_title', body: 'cookie_policy_legal_body' },
  { title: 'cookie_policy_change_title', body: 'cookie_policy_change_body' },
  { title: 'cookie_policy_browser_title', body: 'cookie_policy_browser_body' },
  { title: 'cookie_policy_transfer_title', body: 'cookie_policy_transfer_body' },
];

export default function CookiePolicy({ lang }: CookiePolicyProps) {
  const { openPreferences } = useCookieConsent();

  return (
    <div className="min-h-screen overflow-x-hidden page-bg-home">
      <main className="px-4 pb-16 pt-32">
        <section className="mx-auto max-w-4xl">
          <div className="mb-8 rounded-3xl border border-pink-100 bg-white/90 p-6 shadow-xl shadow-purple-100/50 backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/90 dark:shadow-black/20 sm:p-8">
            <p className="mb-3 inline-flex rounded-full bg-pink-50 px-4 py-2 font-body text-sm font-black text-purple-500 dark:bg-white/10 dark:text-purple-200">
              {t(lang, 'cookie_policy_updated_label')}: {t(lang, 'cookie_policy_updated_date')}
            </p>
            <h1 className="font-display text-4xl font-black text-purple-700 dark:text-purple-100 sm:text-5xl">
              {t(lang, 'cookie_policy_title')}
            </h1>
            <p className="mt-4 max-w-2xl font-body text-base font-semibold leading-relaxed text-purple-500 dark:text-purple-200">
              {t(lang, 'cookie_policy_meta_desc')}
            </p>
            <button
              type="button"
              onClick={openPreferences}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-purple-300 bg-purple-600 px-5 py-3 font-body text-sm font-black text-white shadow-lg shadow-purple-200/50 transition hover:-translate-y-0.5 hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 dark:border-purple-400 dark:bg-purple-500 dark:shadow-purple-950/40"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              {t(lang, 'cookie_open_settings')}
            </button>
          </div>

          <div className="space-y-4">
            {sections.map(section => (
              <article
                key={section.title}
                className="rounded-3xl border border-purple-100 bg-white/85 p-5 shadow-sm backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/85 sm:p-6"
              >
                <h2 className="font-display text-xl font-black text-purple-700 dark:text-purple-100">
                  {t(lang, section.title)}
                </h2>
                <p className="mt-3 whitespace-pre-line font-body text-sm font-semibold leading-relaxed text-purple-500 dark:text-purple-200">
                  {t(lang, section.body)}
                </p>
              </article>
            ))}

            <article className="rounded-3xl border border-blue-100 bg-blue-50/80 p-5 dark:border-purple-700 dark:bg-white/10 sm:p-6">
              <h2 className="font-display text-xl font-black text-purple-700 dark:text-purple-100">
                {t(lang, 'cookie_policy_privacy_title')}
              </h2>
              <p className="mt-3 font-body text-sm font-semibold leading-relaxed text-purple-500 dark:text-purple-200">
                {t(lang, 'cookie_policy_privacy_missing')}
              </p>
            </article>
          </div>
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
