import { motion } from 'framer-motion';
import { ArrowLeft, CreditCard, LockKeyhole, Sparkles } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Footer from '../components/Footer';
import { Lang, t } from '../lib/i18n';
import {
  formatCurrencyAmount,
  normalizeCurrency,
  pricingPlanNameKeys,
  pricingPlanPrices,
  type PricingPlanId,
} from '../lib/pricingCurrency';

interface CheckoutPlaceholderProps {
  lang: Lang;
}

function getPlanId(planId: string | undefined): PricingPlanId {
  if (planId && planId in pricingPlanPrices) return planId as PricingPlanId;
  return 'group-progress';
}

export default function CheckoutPlaceholder({ lang }: CheckoutPlaceholderProps) {
  const { planId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedPlanId = getPlanId(planId);
  const selectedCurrency = normalizeCurrency(searchParams.get('currency'));
  const selectedPrice = pricingPlanPrices[selectedPlanId];
  const planNameKey = pricingPlanNameKeys[selectedPlanId];

  return (
    <main className="pricing-page min-h-screen overflow-x-hidden bg-[#fff8ff] dark:bg-[#0a0613]">
      <section className="pricing-hero-gradient relative flex min-h-[82vh] items-center overflow-hidden px-4 pb-16 pt-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute left-[8%] top-[16%] h-72 w-72 rounded-full bg-pink-200/42 blur-3xl dark:bg-pink-500/12"
            animate={{ scale: [1, 1.1, 1], x: [0, 14, 0], y: [0, -10, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-[14%] right-[10%] h-80 w-80 rounded-full bg-blue-200/36 blur-3xl dark:bg-blue-500/10"
            animate={{ scale: [1, 1.08, 1], x: [0, -12, 0], y: [0, 12, 0] }}
            transition={{ duration: 23, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/58 px-5 py-2.5 shadow-xl shadow-purple-100/50 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-purple-950/25"
          >
            <LockKeyhole className="h-4 w-4 text-pink-400 dark:text-pink-200" aria-hidden="true" />
            <span className="font-body text-sm font-700 text-purple-600 dark:text-purple-100">{t(lang, 'checkout_selected_plan')}</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.76, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[2rem] border border-white/75 bg-white/58 p-7 shadow-2xl shadow-purple-100/45 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055] dark:shadow-purple-950/28 sm:p-10"
          >
            <div className="pricing-card-sheen absolute inset-0 opacity-80" />
            <div className="relative z-10">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 text-purple-500 shadow-lg ring-1 ring-white/70 dark:from-pink-400/14 dark:via-purple-400/12 dark:to-blue-400/12 dark:text-purple-100 dark:ring-white/10">
                <CreditCard className="h-8 w-8" aria-hidden="true" />
              </div>

              <p className="mb-3 font-body text-sm font-700 uppercase text-purple-400 dark:text-purple-200/70">
                {t(lang, planNameKey)}
              </p>
              <h1 className="font-display text-4xl font-black leading-tight text-purple-700 dark:text-purple-50 md:text-5xl">
                {t(lang, 'checkout_title')}
              </h1>
              <p className="mx-auto mt-5 max-w-xl font-body text-xl font-700 leading-relaxed text-purple-500 dark:text-purple-100/78">
                {t(lang, 'checkout_subtitle')}
              </p>
              <p className="mx-auto mt-4 max-w-lg font-body leading-relaxed text-purple-400 dark:text-purple-100/66">
                {t(lang, 'checkout_body')}
              </p>

              <div className="mx-auto mt-7 flex max-w-lg flex-col gap-3 rounded-[1.35rem] border border-white/70 bg-white/56 p-4 shadow-lg shadow-purple-100/28 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/22 sm:flex-row sm:items-center sm:justify-center">
                <span className="font-body text-sm font-800 text-purple-500 dark:text-purple-100/74">
                  {t(lang, 'checkout_display_currency')}: {selectedCurrency === 'CZK' ? 'Kč' : '€'}
                </span>
                <span className="hidden h-5 w-px bg-purple-200/70 dark:bg-white/10 sm:block" aria-hidden="true" />
                <span className="font-display text-lg font-black text-purple-700 dark:text-purple-50">
                  {formatCurrencyAmount(selectedPrice.monthlyCzk, selectedCurrency, lang)} {t(lang, 'pricing_per_month')}
                </span>
              </div>
              {selectedCurrency === 'EUR' && (
                <p className="mx-auto mt-3 max-w-lg font-body text-xs font-bold leading-relaxed text-purple-400 dark:text-purple-100/62">
                  {t(lang, 'pricing_currency_note_eur')}
                </p>
              )}

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate('/pricing')}
                  className="pricing-secondary-button inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 font-display text-sm font-bold"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>{t(lang, 'checkout_back_pricing')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/trial-booking')}
                  className="pricing-button pricing-button-soft inline-flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-full border border-pink-200/80 px-6 py-3 font-display text-sm font-bold shadow-xl"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>{t(lang, 'checkout_trial')}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer lang={lang} />
    </main>
  );
}
