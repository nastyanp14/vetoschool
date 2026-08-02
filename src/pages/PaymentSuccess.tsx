import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CreditCard, LoaderCircle } from 'lucide-react';
import Footer from '../components/Footer';
import { Lang } from '../lib/i18n';
import { openBillingPortal } from '../lib/stripe';
import { getCurrentUser, refreshCurrentUser } from '../lib/auth';

const copy = {
  ru: {
    title: 'Оплата прошла успешно!',
    body: 'Спасибо! Доступ к платформе активируется автоматически в течение минуты.',
    dashboard: 'В личный кабинет',
    portal: 'Управлять подпиской',
  },
  en: {
    title: 'Payment successful!',
    body: 'Thank you! Your access is activated automatically within a minute.',
    dashboard: 'Go to dashboard',
    portal: 'Manage subscription',
  },
  ua: {
    title: 'Оплата пройшла успішно!',
    body: 'Дякуємо! Доступ до платформи активується автоматично протягом хвилини.',
    dashboard: 'До кабінету',
    portal: 'Керувати підпискою',
  },
} as const;

export default function PaymentSuccess({ lang }: { lang: Lang }) {
  const text = copy[lang] ?? copy.ru;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The webhook activates access; refresh the local profile so the UI catches up.
    const timer = setTimeout(() => { refreshCurrentUser?.().catch(() => {}); }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-[#fff8ff] px-4 pt-32 dark:bg-[#0a0613]">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-white/75 bg-white/60 p-8 text-center shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055]">
        <CheckCircle2 className="mx-auto mb-5 h-14 w-14 text-emerald-400" aria-hidden="true" />
        <h1 className="font-display text-3xl font-black text-purple-700 dark:text-purple-50">{text.title}</h1>
        <p className="mt-4 font-body text-purple-500 dark:text-purple-100/75">{text.body}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to={getCurrentUser() ? '/dashboard' : '/login'}
            className="pricing-button inline-flex min-h-12 items-center justify-center rounded-full px-6 py-3 font-display text-sm font-bold"
          >
            {text.dashboard}
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => { setBusy(true); openBillingPortal().catch(() => setBusy(false)); }}
            className="pricing-secondary-button inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 font-display text-sm font-bold disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            <span>{text.portal}</span>
          </button>
        </div>
      </div>
      <Footer lang={lang} />
    </main>
  );
}
