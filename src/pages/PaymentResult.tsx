import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, CreditCard, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import Footer from '../components/Footer';
import type { Lang } from '../lib/i18n';
import { t } from '../lib/i18n';
import { pricingPlanNameKeys, type PricingPlanId } from '../lib/pricingCurrency';
import { supabase } from '@/integrations/supabase/client';
import { hasConfirmedStripePayment } from '../lib/subscriptionStatus';

type PaymentResultVariant = 'success' | 'cancel';

type PaymentResultProps = {
  lang: Lang;
  variant: PaymentResultVariant;
};

type PaymentProfile = {
  payment_status: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: string | null;
  lesson_format: string | null;
  lessons_total: number | null;
  lessons_remaining: number | null;
  next_payment_date: string | null;
  current_period_end: string | null;
};

const paymentResultCopy: Record<PaymentResultVariant, Record<Lang, {
  eyebrow: string;
  title: string;
  body: string;
  primary: string;
  secondary: string;
  note: string;
}>> = {
  success: {
    ru: {
      eyebrow: 'Оплата принята',
      title: 'Спасибо! Оплата прошла успешно',
      body: 'Мы получили платёж. Доступ и расписание можно проверить в личном кабинете после обработки заявки.',
      primary: 'В личный кабинет',
      secondary: 'На главную',
      note: 'Если доступ не появился сразу, администратор Vetoschool проверит оплату и активирует занятия.',
    },
    en: {
      eyebrow: 'Payment accepted',
      title: 'Thank you! Payment succeeded',
      body: 'We received the payment. You can check access and scheduling in the student account after processing.',
      primary: 'Open dashboard',
      secondary: 'Home',
      note: 'If access does not appear immediately, the Vetoschool administrator will verify the payment and activate lessons.',
    },
    ua: {
      eyebrow: 'Оплату прийнято',
      title: 'Дякуємо! Оплата успішна',
      body: 'Ми отримали платіж. Доступ і розклад можна перевірити в особистому кабінеті після обробки заявки.',
      primary: 'В особистий кабінет',
      secondary: 'На головну',
      note: 'Якщо доступ не з’явився одразу, адміністратор Vetoschool перевірить оплату й активує заняття.',
    },
  },
  cancel: {
    ru: {
      eyebrow: 'Оплата отменена',
      title: 'Платёж не был завершён',
      body: 'Ничего страшного: деньги не списаны. Можно вернуться к выбранному тарифу и попробовать снова.',
      primary: 'Вернуться к тарифам',
      secondary: 'На главную',
      note: 'Если Stripe закрылся случайно, просто выберите тариф ещё раз.',
    },
    en: {
      eyebrow: 'Payment canceled',
      title: 'The payment was not completed',
      body: 'No worries: no charge was made. You can return to pricing and try again.',
      primary: 'Back to pricing',
      secondary: 'Home',
      note: 'If Stripe was closed by mistake, choose the plan again.',
    },
    ua: {
      eyebrow: 'Оплату скасовано',
      title: 'Платіж не завершено',
      body: 'Усе добре: кошти не списано. Можна повернутися до тарифів і спробувати ще раз.',
      primary: 'Повернутися до цін',
      secondary: 'На головну',
      note: 'Якщо Stripe закрився випадково, просто оберіть тариф ще раз.',
    },
  },
};

export default function PaymentResult({ lang, variant }: PaymentResultProps) {
  const [searchParams] = useSearchParams();
  const copy = paymentResultCopy[variant][lang];
  const isSuccess = variant === 'success';
  const Icon = isSuccess ? CheckCircle2 : XCircle;
  const PrimaryIcon = isSuccess ? Sparkles : RefreshCw;
  const primaryPath = isSuccess ? '/dashboard' : '/pricing';
  const [profile, setProfile] = useState<PaymentProfile | null>(null);
  const [polling, setPolling] = useState(isSuccess);
  const sessionId = searchParams.get('session_id') || '';

  useEffect(() => {
    if (!isSuccess) return;

    let cancelled = false;
    let attempts = 0;
    const loadPaymentProfile = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        setPolling(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('payment_status,subscription_status,stripe_customer_id,stripe_subscription_id,plan_id,lesson_format,lessons_total,lessons_remaining,next_payment_date,current_period_end')
        .eq('id', userId)
        .maybeSingle();

      attempts += 1;
      if (!cancelled && data) {
        setProfile(data);
        if (hasConfirmedStripePayment({
          paymentStatus: data.payment_status,
          subscriptionStatus: data.subscription_status,
          stripeCustomerId: data.stripe_customer_id,
          stripeSubscriptionId: data.stripe_subscription_id,
        })) {
          setPolling(false);
        } else if (attempts >= 12) {
          setPolling(false);
        }
      } else if (!cancelled && attempts >= 12) {
        setPolling(false);
      }
    };

    void loadPaymentProfile();
    const interval = window.setInterval(() => void loadPaymentProfile(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isSuccess]);

  const profilePlanId = profile?.plan_id && profile.plan_id in pricingPlanNameKeys ? profile.plan_id as PricingPlanId : null;
  const planName = profilePlanId ? t(lang, pricingPlanNameKeys[profilePlanId]) : profile?.plan_id;
  const formatName = profile?.lesson_format === 'individual'
    ? (lang === 'en' ? 'Individual' : lang === 'ua' ? 'Індивідуально' : 'Индивидуально')
    : profile?.lesson_format === 'group'
      ? (lang === 'en' ? 'Group' : lang === 'ua' ? 'Група' : 'Группа')
      : '';
  const nextPaymentDate = profile?.next_payment_date || profile?.current_period_end;
  const isSynchronized = hasConfirmedStripePayment({
    paymentStatus: profile?.payment_status,
    subscriptionStatus: profile?.subscription_status,
    stripeCustomerId: profile?.stripe_customer_id,
    stripeSubscriptionId: profile?.stripe_subscription_id,
  }) && !!planName;
  const profileSummary = isSynchronized
    ? [
        lang === 'en' ? 'Subscription activated' : lang === 'ua' ? 'Підписку активовано' : 'Подписка активирована',
        planName,
        formatName,
        `${profile.lessons_remaining ?? 0}/${profile.lessons_total ?? 0}`,
        nextPaymentDate ? new Date(nextPaymentDate).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU') : '',
      ].filter(Boolean).join(' · ')
    : '';
  const waitingText = lang === 'en'
    ? 'Payment received. Your subscription is being activated.'
    : lang === 'ua'
      ? 'Оплату отримано. Ваша підписка активується.'
      : 'Оплата получена. Ваша подписка активируется.';
  const sessionText = sessionId
    ? `Stripe session: ${sessionId.slice(0, 18)}...`
    : '';

  return (
    <main className="pricing-page min-h-screen overflow-hidden bg-[#fff8ff] dark:bg-[#0a0613]">
      <section className="pricing-hero-gradient relative flex min-h-[calc(100vh-5rem)] items-center px-4 py-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute left-[12%] top-[18%] h-72 w-72 rounded-full bg-pink-200/42 blur-3xl dark:bg-pink-500/12"
            animate={{ scale: [1, 1.08, 1], x: [0, 12, 0], y: [0, -10, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-[12%] right-[12%] h-80 w-80 rounded-full bg-blue-200/36 blur-3xl dark:bg-blue-500/10"
            animate={{ scale: [1, 1.07, 1], x: [0, -10, 0], y: [0, 12, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/75 bg-white/64 p-6 text-center shadow-2xl shadow-purple-100/45 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-purple-950/28 sm:p-10"
        >
          <div className="pricing-card-sheen absolute inset-0 opacity-60" />
          <div className="relative z-10">
            <div className={`mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] shadow-xl ring-1 ring-white/70 ${
              isSuccess
                ? 'bg-gradient-to-br from-green-100 via-white to-blue-100 text-green-500'
                : 'bg-gradient-to-br from-pink-100 via-white to-purple-100 text-pink-500'
            } dark:ring-white/10`}>
              <Icon className="h-12 w-12" aria-hidden="true" />
            </div>

            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/62 px-5 py-2.5 shadow-lg shadow-purple-100/34 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.07]">
              <CreditCard className="h-4 w-4 text-pink-500 dark:text-pink-200" aria-hidden="true" />
              <span className="font-body text-sm font-900 uppercase tracking-[0.12em] text-purple-500 dark:text-purple-100">
                {copy.eyebrow}
              </span>
            </div>

            <h1 className="font-display text-4xl font-black leading-tight text-purple-700 dark:text-white sm:text-5xl">
              {copy.title}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl font-body text-lg font-700 leading-relaxed text-purple-500 dark:text-purple-100/78">
              {copy.body}
            </p>

            <div className="mx-auto mt-7 max-w-2xl rounded-[1.35rem] border border-white/75 bg-gradient-to-br from-white/68 via-purple-50/54 to-blue-50/58 p-5 font-body text-sm font-800 leading-relaxed text-purple-500 shadow-xl shadow-purple-100/24 backdrop-blur-xl dark:border-white/10 dark:from-white/[0.07] dark:via-purple-400/8 dark:to-blue-400/8 dark:text-purple-100/74">
              {isSuccess ? profileSummary || waitingText : copy.note}
              {isSuccess && polling && <RefreshCw className="mx-auto mt-3 h-4 w-4 animate-spin" aria-hidden="true" />}
              {isSuccess && sessionText && <div className="mt-3 text-xs text-purple-300">{sessionText}</div>}
            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to={primaryPath}
                className="pricing-button pricing-button-soft inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-pink-200/80 px-7 py-4 font-display text-base font-black shadow-xl"
              >
                <PrimaryIcon className="h-5 w-5" aria-hidden="true" />
                <span>{copy.primary}</span>
              </Link>
              <Link
                to="/"
                className="pricing-secondary-button inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-7 py-4 font-display text-base font-bold"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                <span>{copy.secondary}</span>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      <Footer lang={lang} />
    </main>
  );
}
