import { Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import Footer from '../components/Footer';
import { Lang } from '../lib/i18n';

const copy = {
  ru: { title: 'Оплата отменена', body: 'Ничего не списано. Вы можете вернуться к тарифам и попробовать снова.', back: 'К тарифам' },
  en: { title: 'Payment cancelled', body: 'Nothing was charged. You can go back to the plans and try again.', back: 'Back to pricing' },
  ua: { title: 'Оплату скасовано', body: 'Нічого не списано. Ви можете повернутись до тарифів і спробувати ще раз.', back: 'До тарифів' },
} as const;

export default function PaymentCancel({ lang }: { lang: Lang }) {
  const text = copy[lang] ?? copy.ru;
  return (
    <main className="min-h-screen bg-[#fff8ff] px-4 pt-32 dark:bg-[#0a0613]">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-white/75 bg-white/60 p-8 text-center shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055]">
        <XCircle className="mx-auto mb-5 h-14 w-14 text-pink-400" aria-hidden="true" />
        <h1 className="font-display text-3xl font-black text-purple-700 dark:text-purple-50">{text.title}</h1>
        <p className="mt-4 font-body text-purple-500 dark:text-purple-100/75">{text.body}</p>
        <Link to="/pricing" className="pricing-button mt-8 inline-flex min-h-12 items-center justify-center rounded-full px-6 py-3 font-display text-sm font-bold">
          {text.back}
        </Link>
      </div>
      <Footer lang={lang} />
    </main>
  );
}
