import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import { Lang, t, TranslationKey } from '../lib/i18n';

type PrivacyPolicyProps = {
  lang: Lang;
};

const sections: Array<{ title: TranslationKey; body: TranslationKey }> = [
  { title: 'privacy_intro_title', body: 'privacy_intro_body' },
  { title: 'privacy_controller_title', body: 'privacy_controller_body' },
  { title: 'privacy_collect_title', body: 'privacy_collect_body' },
  { title: 'privacy_user_provided_title', body: 'privacy_user_provided_body' },
  { title: 'privacy_auto_title', body: 'privacy_auto_body' },
  { title: 'privacy_auth_title', body: 'privacy_auth_body' },
  { title: 'privacy_contact_title', body: 'privacy_contact_body' },
  { title: 'privacy_cookies_title', body: 'privacy_cookies_body' },
  { title: 'privacy_legal_title', body: 'privacy_legal_body' },
  { title: 'privacy_use_title', body: 'privacy_use_body' },
  { title: 'privacy_sharing_title', body: 'privacy_sharing_body' },
  { title: 'privacy_transfers_title', body: 'privacy_transfers_body' },
  { title: 'privacy_retention_title', body: 'privacy_retention_body' },
  { title: 'privacy_rights_title', body: 'privacy_rights_body' },
  { title: 'privacy_children_title', body: 'privacy_children_body' },
  { title: 'privacy_security_title', body: 'privacy_security_body' },
  { title: 'privacy_contact_info_title', body: 'privacy_contact_info_body' },
  { title: 'privacy_changes_title', body: 'privacy_changes_body' },
];

export default function PrivacyPolicy({ lang }: PrivacyPolicyProps) {
  return (
    <div className="min-h-screen overflow-x-hidden page-bg-home">
      <main className="px-4 pb-16 pt-32">
        <section className="mx-auto max-w-4xl">
          <div className="mb-8 rounded-3xl border border-pink-100 bg-white/90 p-6 shadow-xl shadow-purple-100/50 backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/90 dark:shadow-black/20 sm:p-8">
            <p className="mb-3 inline-flex rounded-full bg-pink-50 px-4 py-2 font-body text-sm font-black text-purple-500 dark:bg-white/10 dark:text-purple-200">
              {t(lang, 'privacy_policy_updated_label')}: {t(lang, 'privacy_policy_updated_date')}
            </p>
            <h1 className="font-display text-4xl font-black text-purple-700 dark:text-purple-100 sm:text-5xl">
              {t(lang, 'privacy_policy_title')}
            </h1>
            <p className="mt-4 max-w-2xl font-body text-base font-semibold leading-relaxed text-purple-500 dark:text-purple-200">
              {t(lang, 'privacy_policy_meta_desc')}
            </p>
            <Link
              to="/cookie-policy"
              className="mt-6 inline-flex rounded-2xl border border-purple-300 bg-purple-600 px-5 py-3 font-body text-sm font-black text-white shadow-lg shadow-purple-200/50 transition hover:-translate-y-0.5 hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 dark:border-purple-400 dark:bg-purple-500 dark:shadow-purple-950/40"
            >
              {t(lang, 'privacy_cookie_link')}
            </Link>
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
          </div>
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
