import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { CookieConsentPreferences } from '../lib/cookieConsent';
import { Lang, t } from '../lib/i18n';
import { Switch } from './ui/switch';

type CookiePreferencesModalProps = {
  lang: Lang;
};

const defaultPreferences: CookieConsentPreferences = {
  functional: false,
  analytics: false,
  marketing: false,
};

export default function CookiePreferencesModal({ lang }: CookiePreferencesModalProps) {
  const {
    consent,
    preferencesOpen,
    closePreferences,
    acceptAll,
    rejectOptional,
    savePreferences,
  } = useCookieConsent();
  const [draft, setDraft] = useState<CookieConsentPreferences>(defaultPreferences);

  useEffect(() => {
    if (!preferencesOpen) return;
    setDraft(consent ? {
      functional: consent.functional,
      analytics: consent.analytics,
      marketing: consent.marketing,
    } : defaultPreferences);
  }, [consent, preferencesOpen]);

  const updateDraft = (key: keyof CookieConsentPreferences, value: boolean) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

  const categories = [
    {
      id: 'necessary',
      title: t(lang, 'cookie_necessary_title'),
      desc: t(lang, 'cookie_necessary_desc'),
      checked: true,
      disabled: true,
      note: t(lang, 'cookie_always_on'),
    },
    {
      id: 'functional',
      title: t(lang, 'cookie_functional_title'),
      desc: t(lang, 'cookie_functional_desc'),
      checked: draft.functional,
      disabled: false,
      note: t(lang, 'cookie_optional_off'),
    },
    {
      id: 'analytics',
      title: t(lang, 'cookie_analytics_title'),
      desc: t(lang, 'cookie_analytics_desc'),
      checked: draft.analytics,
      disabled: false,
      note: t(lang, 'cookie_optional_off'),
    },
    {
      id: 'marketing',
      title: t(lang, 'cookie_marketing_title'),
      desc: t(lang, 'cookie_marketing_desc'),
      checked: draft.marketing,
      disabled: false,
      note: t(lang, 'cookie_optional_off'),
    },
  ] as const;

  return (
    <DialogPrimitive.Root open={preferencesOpen} onOpenChange={open => { if (!open) closePreferences(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-purple-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[71] max-h-[calc(100vh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-pink-100 bg-white p-4 shadow-2xl shadow-purple-200/50 outline-none dark:border-purple-700 dark:bg-[#1b0c2f] dark:shadow-black/40 sm:p-5"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <DialogPrimitive.Title className="font-display text-xl font-black text-purple-700 dark:text-purple-100">
                  {t(lang, 'cookie_modal_title')}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1.5 font-body text-xs font-semibold leading-relaxed text-purple-500 dark:text-purple-200 sm:text-sm">
                  {t(lang, 'cookie_modal_desc')}
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close
                aria-label={t(lang, 'cookie_close')}
                className="rounded-2xl border border-purple-100 bg-purple-50 p-2 text-purple-500 transition hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>

            <div className="space-y-2">
              {categories.map(category => (
                <section
                  key={category.id}
                  aria-labelledby={`cookie-category-${category.id}`}
                  className="rounded-2xl border border-purple-100 bg-gradient-to-br from-white to-purple-50/60 p-3 dark:border-purple-700 dark:from-[#241331] dark:to-[#1c1029]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 id={`cookie-category-${category.id}`} className="font-display text-sm font-black text-purple-700 dark:text-purple-100">
                        {category.title}
                      </h3>
                      <p id={`cookie-category-${category.id}-desc`} className="mt-1 font-body text-xs font-semibold leading-relaxed text-purple-500 dark:text-purple-200">
                        {category.desc}
                      </p>
                      <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-0.5 text-xs font-black text-purple-500 dark:bg-white/10 dark:text-purple-200">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        {category.note}
                      </p>
                    </div>
                    <Switch
                      id={`cookie-switch-${category.id}`}
                      checked={category.checked}
                      disabled={category.disabled}
                      aria-label={category.title}
                      aria-describedby={`cookie-category-${category.id}-desc`}
                      onCheckedChange={value => {
                        if (category.id !== 'necessary') updateDraft(category.id, value);
                      }}
                    />
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => savePreferences(draft)}
                className="rounded-2xl border border-purple-300 bg-purple-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-purple-200/50 transition hover:-translate-y-0.5 hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 dark:border-purple-400 dark:bg-purple-500 dark:shadow-purple-950/40"
              >
                {t(lang, 'cookie_save_preferences')}
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="rounded-2xl border border-purple-300 bg-white px-4 py-2.5 text-sm font-black text-purple-700 shadow-lg shadow-purple-100/60 transition hover:-translate-y-0.5 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 dark:border-purple-400 dark:bg-[#241331] dark:text-purple-100 dark:shadow-purple-950/40"
              >
                {t(lang, 'cookie_accept_all')}
              </button>
              <button
                type="button"
                onClick={rejectOptional}
                className="rounded-2xl border border-pink-200 bg-pink-50 px-4 py-2.5 text-sm font-black text-purple-700 transition hover:-translate-y-0.5 hover:bg-pink-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
              >
                {t(lang, 'cookie_reject_optional')}
              </button>
              <DialogPrimitive.Close
                className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-purple-700 transition hover:-translate-y-0.5 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
              >
                {t(lang, 'cookie_close')}
              </DialogPrimitive.Close>
            </div>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
