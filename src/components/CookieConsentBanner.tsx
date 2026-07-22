import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { Lang, t } from '../lib/i18n';

type CookieConsentBannerProps = {
  lang: Lang;
};

export default function CookieConsentBanner({ lang }: CookieConsentBannerProps) {
  const { hasDecision, acceptAll, rejectOptional, openPreferences } = useCookieConsent();

  return (
    <AnimatePresence>
      {!hasDecision && (
        <motion.aside
          aria-label={t(lang, 'cookie_banner_label')}
          className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-5 sm:pb-5"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 28 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <div className="mx-auto max-h-[calc(100vh-1rem)] max-w-6xl overflow-y-auto rounded-3xl border border-pink-100/80 bg-white/95 p-4 shadow-2xl shadow-purple-200/40 backdrop-blur-xl dark:border-purple-700/70 dark:bg-[#1b0c2f]/95 dark:shadow-black/30 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 text-lg shadow-sm dark:from-purple-900 dark:to-pink-900">
                    🍪
                  </span>
                  <h2 className="font-display text-lg font-black text-purple-700 dark:text-purple-100">
                    {t(lang, 'cookie_banner_title')}
                  </h2>
                </div>
                <p className="font-body text-sm font-semibold leading-relaxed text-purple-500 dark:text-purple-200">
                  {t(lang, 'cookie_banner_text')}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:w-[27rem]">
                <button
                  type="button"
                  onClick={acceptAll}
                  className="rounded-2xl border border-purple-300 bg-purple-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-purple-200/50 transition hover:-translate-y-0.5 hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 dark:border-purple-400 dark:bg-purple-500 dark:shadow-purple-950/40"
                >
                  {t(lang, 'cookie_accept_all')}
                </button>
                <button
                  type="button"
                  onClick={rejectOptional}
                  className="rounded-2xl border border-purple-300 bg-white px-4 py-3 text-sm font-black text-purple-700 shadow-lg shadow-purple-100/60 transition hover:-translate-y-0.5 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 dark:border-purple-400 dark:bg-[#241331] dark:text-purple-100 dark:shadow-purple-950/40"
                >
                  {t(lang, 'cookie_reject_optional')}
                </button>
                <button
                  type="button"
                  onClick={openPreferences}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-pink-200 bg-pink-50 px-4 py-3 text-sm font-black text-purple-700 transition hover:-translate-y-0.5 hover:bg-pink-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  {t(lang, 'cookie_customize')}
                </button>
                <Link
                  to="/cookie-policy"
                  className="inline-flex items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-purple-700 transition hover:-translate-y-0.5 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
                >
                  {t(lang, 'cookie_policy')}
                </Link>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
