import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Footer from '../components/Footer';
import { Lang, t, type TranslationKey } from '../lib/i18n';
import {
  DisplayCurrency,
  formatCurrencyAmount,
  normalizeCurrency,
  pricingPlanNameKeys,
  pricingPlanPrices,
  supportedCurrencies,
  type PricingPlanId,
} from '../lib/pricingCurrency';
import { redirectToStripeCheckout } from '../lib/stripeCheckout';

interface CheckoutPlaceholderProps {
  lang: Lang;
}

type PlanMetadata = {
  descriptionKey: TranslationKey;
  formatKey: TranslationKey;
  lessonsPerMonth: number;
};

const checkoutPlanMetadata: Record<PricingPlanId, PlanMetadata> = {
  'group-lite': {
    descriptionKey: 'pricing_group_lite_desc',
    formatKey: 'pricing_switch_group',
    lessonsPerMonth: 4,
  },
  'group-progress': {
    descriptionKey: 'pricing_group_progress_desc',
    formatKey: 'pricing_switch_group',
    lessonsPerMonth: 8,
  },
  'group-intensive': {
    descriptionKey: 'pricing_group_intensive_desc',
    formatKey: 'pricing_switch_group',
    lessonsPerMonth: 12,
  },
  'individual-lite': {
    descriptionKey: 'pricing_individual_lite_desc',
    formatKey: 'pricing_switch_individual',
    lessonsPerMonth: 4,
  },
  'individual-progress': {
    descriptionKey: 'pricing_individual_progress_desc',
    formatKey: 'pricing_switch_individual',
    lessonsPerMonth: 8,
  },
  'individual-intensive': {
    descriptionKey: 'pricing_individual_intensive_desc',
    formatKey: 'pricing_switch_individual',
    lessonsPerMonth: 12,
  },
};

const paymentMethods: Array<{ label: string; icon: LucideIcon }> = [
  { label: 'Visa', icon: CreditCard },
  { label: 'Mastercard', icon: WalletCards },
  { label: 'Apple Pay', icon: Smartphone },
  { label: 'Google Pay', icon: Smartphone },
];

const afterPaymentItems: Array<{ key: TranslationKey; icon: LucideIcon }> = [
  { key: 'checkout_access_account', icon: CheckCircle2 },
  { key: 'checkout_access_materials', icon: CheckCircle2 },
  { key: 'checkout_homework', icon: CheckCircle2 },
  { key: 'checkout_games', icon: CheckCircle2 },
  { key: 'checkout_lesson_booking', icon: CheckCircle2 },
  { key: 'checkout_progress_tracking', icon: CheckCircle2 },
];

const checkoutAmountLabels: Record<Lang, { currency: string; total: string }> = {
  ru: { currency: 'Валюта', total: 'Итого к оплате' },
  en: { currency: 'Currency', total: 'Total price' },
  ua: { currency: 'Валюта', total: 'Разом до оплати' },
};

const checkoutStripeLabels: Record<Lang, {
  redirecting: string;
  error: string;
  authRequired: string;
  activeSubscription: string;
  manageSubscription: string;
}> = {
  ru: {
    redirecting: 'Переходим к защищённой оплате Stripe...',
    error: 'Не удалось открыть Stripe Checkout. Попробуйте ещё раз или напишите администратору Vetoschool.',
    authRequired: 'Войдите в аккаунт перед оплатой, чтобы мы привязали подписку к вашему профилю Vetoschool.',
    activeSubscription: 'У вас уже есть активная подписка. Управляйте ею через раздел «Управление подпиской».',
    manageSubscription: 'Управление подпиской',
  },
  en: {
    redirecting: 'Opening secure Stripe Checkout...',
    error: 'Could not open Stripe Checkout. Try again or message the Vetoschool administrator.',
    authRequired: 'Log in before paying so we can attach the subscription to your Vetoschool account.',
    activeSubscription: 'You already have an active subscription. Manage it in “Manage subscription”.',
    manageSubscription: 'Manage subscription',
  },
  ua: {
    redirecting: 'Переходимо до захищеної оплати Stripe...',
    error: 'Не вдалося відкрити Stripe Checkout. Спробуйте ще раз або напишіть адміністратору Vetoschool.',
    authRequired: 'Увійдіть в акаунт перед оплатою, щоб ми прив’язали підписку до вашого профілю Vetoschool.',
    activeSubscription: 'У вас вже є активна підписка. Керуйте нею в розділі «Керування підпискою».',
    manageSubscription: 'Керування підпискою',
  },
};


function getPlanId(planId: string | undefined): PricingPlanId {
  if (planId && planId in pricingPlanPrices) return planId as PricingPlanId;
  return 'group-progress';
}

function CheckoutCurrencySelector({
  value,
  onChange,
  lang,
}: {
  value: DisplayCurrency;
  onChange: (value: DisplayCurrency) => void;
  lang: Lang;
}) {
  return (
    <div className="pricing-currency-control flex w-fit items-center gap-1 rounded-full border border-white/80 bg-white/56 p-1.5 shadow-xl shadow-purple-100/40 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055] dark:shadow-purple-950/22">
      {supportedCurrencies.map((currency) => {
        const active = value === currency;

        return (
          <button
            key={currency}
            type="button"
            onClick={() => onChange(currency)}
            aria-pressed={active}
            aria-label={t(lang, currency === 'CZK' ? 'pricing_currency_czk' : 'pricing_currency_eur')}
            className={`relative min-w-16 rounded-full px-4 py-2 font-display text-sm font-bold transition-[background,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 dark:focus-visible:ring-purple-300/40 ${
              active
                ? 'bg-gradient-to-r from-pink-300 via-purple-300 to-blue-300 text-white shadow-lg shadow-purple-200/40 dark:shadow-black/24'
                : 'text-purple-500 hover:-translate-y-0.5 hover:bg-white/70 hover:text-pink-500 dark:text-purple-100 dark:hover:bg-white/10 dark:hover:text-pink-100'
            }`}
          >
            {currency}
          </button>
        );
      })}
    </div>
  );
}

export default function CheckoutPlaceholder({ lang }: CheckoutPlaceholderProps) {
  const { planId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const selectedPlanId = getPlanId(planId);
  const selectedCurrency = normalizeCurrency(searchParams.get('currency'));
  const selectedPrice = pricingPlanPrices[selectedPlanId];
  const planNameKey = pricingPlanNameKeys[selectedPlanId];
  const planMeta = checkoutPlanMetadata[selectedPlanId];
  const totalPrice = formatCurrencyAmount(selectedPrice.monthlyCzk, selectedCurrency, lang);
  const amountLabels = checkoutAmountLabels[lang];
  const stripeLabels = checkoutStripeLabels[lang];

  const handleCurrencyChange = (currency: DisplayCurrency) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('currency', currency);
    setSearchParams(nextParams, { replace: true });
  };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      await redirectToStripeCustomerPortal();
    } catch (error) {
      console.error('Stripe portal redirect failed', error);
      setPortalLoading(false);
      navigate('/dashboard');
    }
  };

  const handlePaySecurely = async () => {
    setPaymentError('');
    setHasActiveSubscription(false);
    setIsRedirectingToStripe(true);

    try {
      await redirectToStripeCheckout(selectedPlanId, selectedCurrency);
    } catch (error) {
      console.error('Stripe Checkout redirect failed', error);
      const code = error instanceof StripeCheckoutError ? error.code : '';
      const message = error instanceof Error ? error.message : '';

      if (code === 'active_subscription_exists') {
        setHasActiveSubscription(true);
        setPaymentError(stripeLabels.activeSubscription);
      } else if (code === 'authentication_required' || message.includes('Log in before paying')) {
        setPaymentError(stripeLabels.authRequired);
      } else {
        setPaymentError(message || stripeLabels.error);
      }
      setIsRedirectingToStripe(false);
    }
  };


  return (
    <main className="pricing-page min-h-screen overflow-x-hidden bg-[#fff8ff] dark:bg-[#0a0613]">
      <section className="pricing-hero-gradient relative overflow-hidden px-4 pb-16 pt-24 sm:pb-20 sm:pt-28">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute left-[8%] top-[12%] h-72 w-72 rounded-full bg-pink-200/42 blur-3xl dark:bg-pink-500/12"
            animate={{ scale: [1, 1.1, 1], x: [0, 14, 0], y: [0, -10, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-[10%] right-[10%] h-80 w-80 rounded-full bg-blue-200/36 blur-3xl dark:bg-blue-500/10"
            animate={{ scale: [1, 1.08, 1], x: [0, -12, 0], y: [0, 12, 0] }}
            transition={{ duration: 23, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/58 px-5 py-2.5 shadow-xl shadow-purple-100/50 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-purple-950/25"
          >
            <LockKeyhole className="h-4 w-4 text-pink-400 dark:text-pink-200" aria-hidden="true" />
            <span className="font-body text-sm font-700 text-purple-600 dark:text-purple-100">{t(lang, 'checkout_selected_plan')}</span>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_27rem]">
            <motion.section
              initial={{ opacity: 0, y: 24, scale: 0.98, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.76, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-[2rem] border border-white/75 bg-white/58 p-6 shadow-2xl shadow-purple-100/45 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055] dark:shadow-purple-950/28 sm:p-8"
            >
              <div className="pricing-card-sheen absolute inset-0 opacity-60" />
              <div className="relative z-10">
                <div className="mb-7 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="mb-3 font-body text-sm font-800 uppercase tracking-[0.14em] text-pink-500 dark:text-pink-200">
                      {t(lang, 'checkout_plan_details')}
                    </p>
                    <h1 className="font-display text-4xl font-black leading-tight text-purple-700 dark:text-purple-50 md:text-5xl">
                      {t(lang, planNameKey)}
                    </h1>
                    <p className="mt-4 max-w-2xl font-body text-lg font-700 leading-relaxed text-purple-500 dark:text-purple-100/78">
                      {t(lang, planMeta.descriptionKey)}
                    </p>
                  </div>
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 text-purple-500 shadow-lg ring-1 ring-white/70 dark:from-pink-400/14 dark:via-purple-400/12 dark:to-blue-400/12 dark:text-purple-100 dark:ring-white/10">
                    <CreditCard className="h-8 w-8" aria-hidden="true" />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.35rem] border border-white/70 bg-white/58 p-4 shadow-lg shadow-purple-100/22 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.055] dark:shadow-black/18">
                    <BookOpen className="mb-3 h-5 w-5 text-pink-500 dark:text-pink-200" aria-hidden="true" />
                    <p className="font-body text-xs font-800 uppercase tracking-[0.12em] text-purple-300 dark:text-purple-200/60">
                      {t(lang, 'checkout_lesson_format')}
                    </p>
                    <p className="mt-1 font-display text-lg font-black text-purple-700 dark:text-purple-50">
                      {t(lang, planMeta.formatKey)}
                    </p>
                  </div>
                  <div className="rounded-[1.35rem] border border-white/70 bg-white/58 p-4 shadow-lg shadow-purple-100/22 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.055] dark:shadow-black/18">
                    <CalendarDays className="mb-3 h-5 w-5 text-blue-500 dark:text-blue-200" aria-hidden="true" />
                    <p className="font-body text-xs font-800 uppercase tracking-[0.12em] text-purple-300 dark:text-purple-200/60">
                      {t(lang, 'pricing_lessons_month')}
                    </p>
                    <p className="mt-1 font-display text-lg font-black text-purple-700 dark:text-purple-50">
                      {planMeta.lessonsPerMonth}
                    </p>
                  </div>
                  <div className="rounded-[1.35rem] border border-white/70 bg-white/58 p-4 shadow-lg shadow-purple-100/22 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.055] dark:shadow-black/18">
                    <GraduationCap className="mb-3 h-5 w-5 text-purple-500 dark:text-purple-200" aria-hidden="true" />
                    <p className="font-body text-xs font-800 uppercase tracking-[0.12em] text-purple-300 dark:text-purple-200/60">
                      {t(lang, 'checkout_what_included')}
                    </p>
                    <p className="mt-1 font-body text-sm font-800 leading-snug text-purple-600 dark:text-purple-50">
                      {t(lang, 'checkout_everything_included')}
                    </p>
                  </div>
                </div>

                <div className="mt-7 flex flex-col gap-4 rounded-[1.5rem] border border-white/70 bg-white/50 p-5 shadow-xl shadow-purple-100/24 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p key={`checkout-currency-label-${lang}`} translate="no" className="font-body text-sm font-800 text-purple-400 dark:text-purple-100/66">
                      {amountLabels.currency}
                    </p>
                    <div className="mt-2">
                      <CheckoutCurrencySelector value={selectedCurrency} onChange={handleCurrencyChange} lang={lang} />
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <p key={`checkout-total-label-${lang}`} translate="no" className="font-body text-sm font-800 text-purple-400 dark:text-purple-100/66">
                      {amountLabels.total}
                    </p>
                    <p className="mt-1 whitespace-nowrap font-display text-4xl font-black text-purple-700 dark:text-white">
                      {totalPrice}
                    </p>
                  </div>
                </div>

                <div className="mt-7">
                  <h2 className="font-display text-2xl font-black text-purple-700 dark:text-purple-50">
                    {t(lang, 'checkout_payment_methods')}
                  </h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {paymentMethods.map((method) => {
                      const Icon = method.icon;

                      return (
                        <div
                          key={method.label}
                          className="flex min-h-20 items-center justify-center gap-2 rounded-[1.25rem] border border-white/70 bg-gradient-to-br from-white/70 via-pink-50/62 to-blue-50/62 p-4 font-display text-sm font-black text-purple-600 shadow-lg shadow-purple-100/22 backdrop-blur-xl dark:border-white/10 dark:from-white/[0.08] dark:via-pink-400/8 dark:to-blue-400/8 dark:text-purple-50 dark:shadow-black/18"
                        >
                          <Icon className="h-5 w-5 text-pink-500 dark:text-pink-200" aria-hidden="true" />
                          {method.label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-7">
                  <h2 className="font-display text-2xl font-black text-purple-700 dark:text-purple-50">
                    {t(lang, 'checkout_after_payment_title')}
                  </h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {afterPaymentItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.key} className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/54 p-4 shadow-md shadow-purple-100/18 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.055] dark:shadow-black/18">
                          <Icon className="h-5 w-5 shrink-0 text-green-500 dark:text-emerald-200" aria-hidden="true" />
                          <span className="font-body text-sm font-800 text-purple-600 dark:text-purple-50">{t(lang, item.key)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.aside
              initial={{ opacity: 0, y: 24, scale: 0.98, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.76, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="relative h-fit overflow-hidden rounded-[2rem] border border-white/75 bg-white/62 p-6 shadow-2xl shadow-purple-100/42 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-purple-950/28"
            >
              <div className="pricing-card-sheen absolute inset-0 opacity-60" />
              <div className="relative z-10">
                <h2 className="font-display text-2xl font-black text-purple-700 dark:text-purple-50">
                  {t(lang, 'checkout_order_summary')}
                </h2>
                <div className="mt-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-body text-sm font-800 text-purple-400 dark:text-purple-100/66">{t(lang, 'checkout_selected_plan')}</span>
                    <span className="text-right font-body text-sm font-900 text-purple-700 dark:text-purple-50">{t(lang, planNameKey)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-body text-sm font-800 text-purple-400 dark:text-purple-100/66">{t(lang, 'checkout_lesson_format')}</span>
                    <span className="text-right font-body text-sm font-900 text-purple-700 dark:text-purple-50">{t(lang, planMeta.formatKey)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-body text-sm font-800 text-purple-400 dark:text-purple-100/66">{t(lang, 'pricing_lessons_month')}</span>
                    <span className="text-right font-body text-sm font-900 text-purple-700 dark:text-purple-50">{planMeta.lessonsPerMonth}</span>
                  </div>
                </div>

                <div className="my-6 h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent dark:via-white/12" />

                <div>
                  <p key={`checkout-summary-total-label-${lang}`} translate="no" className="font-body text-sm font-800 text-purple-400 dark:text-purple-100/66">
                    {amountLabels.total}
                  </p>
                  <p className="mt-2 whitespace-nowrap font-display text-5xl font-black leading-none text-purple-700 dark:text-white">
                    {totalPrice}
                  </p>
                  <p className="mt-2 font-body text-sm font-800 text-purple-400 dark:text-purple-100/66">
                    {t(lang, 'pricing_per_month')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handlePaySecurely}
                  disabled={isRedirectingToStripe}
                  className="pricing-button pricing-button-soft mt-7 inline-flex min-h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-pink-200/80 px-6 py-4 text-center font-display text-base font-black shadow-xl disabled:cursor-wait disabled:opacity-70"
                >
                  <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                  <span>{isRedirectingToStripe ? stripeLabels.redirecting : t(lang, 'checkout_pay_securely')}</span>
                </button>

                <AnimatePresence>
                  {paymentError && (
                    <motion.p
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22 }}
                      className="mt-4 rounded-2xl border border-pink-200/80 bg-pink-50/78 p-4 font-body text-sm font-800 leading-relaxed text-purple-600 shadow-lg shadow-pink-100/30 dark:border-pink-300/15 dark:bg-pink-400/10 dark:text-purple-100"
                    >
                      {paymentError}
                    </motion.p>
                  )}
                </AnimatePresence>

                <button
                  type="button"
                  onClick={() => navigate('/pricing')}
                  className="pricing-secondary-button mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-display text-sm font-bold"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>{t(lang, 'checkout_back_pricing')}</span>
                </button>

                <div className="mt-6 rounded-[1.5rem] border border-white/70 bg-gradient-to-br from-white/62 via-purple-50/50 to-blue-50/56 p-5 shadow-xl shadow-purple-100/24 backdrop-blur-xl dark:border-white/10 dark:from-white/[0.07] dark:via-purple-400/8 dark:to-blue-400/8 dark:shadow-black/18">
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-pink-500 dark:text-pink-200" aria-hidden="true" />
                    <h3 className="font-display text-lg font-black text-purple-700 dark:text-purple-50">
                      {t(lang, 'checkout_security_title')}
                    </h3>
                  </div>
                  <p className="font-body text-sm font-700 leading-relaxed text-purple-500 dark:text-purple-100/74">
                    {t(lang, 'checkout_security_body')}
                  </p>
                </div>
              </div>
            </motion.aside>
          </div>
        </div>
      </section>

      <Footer lang={lang} />
    </main>
  );
}
