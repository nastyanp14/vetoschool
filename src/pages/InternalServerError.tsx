import { RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Lang } from '../lib/i18n';

const pageCopy: Record<Lang, {
  title: string;
  subtitle: string;
  retry: string;
  home: string;
  retryAria: string;
  homeAria: string;
}> = {
  ru: {
    title: 'Что-то пошло не так',
    subtitle: 'Произошла неожиданная ошибка\nна нашей стороне. Мы уже всё\nисправляем!',
    retry: 'Попробовать снова',
    home: 'На главную',
    retryAria: 'Обновить страницу и попробовать снова',
    homeAria: 'Вернуться на главную Vetoschool',
  },
  en: {
    title: 'Something went wrong',
    subtitle: 'An unexpected error happened\non our side. We are already\nfixing it!',
    retry: 'Try again',
    home: 'Home',
    retryAria: 'Refresh the page and try again',
    homeAria: 'Return to the Vetoschool home page',
  },
  ua: {
    title: 'Щось пішло не так',
    subtitle: 'На нашому боці сталася\nнеочікувана помилка. Ми вже\nвсе виправляємо!',
    retry: 'Спробувати знову',
    home: 'На головну',
    retryAria: 'Оновити сторінку та спробувати знову',
    homeAria: 'Повернутися на головну Vetoschool',
  },
};

export default function InternalServerError({ lang = 'ru' }: { lang?: Lang }) {
  const copy = pageCopy[lang] || pageCopy.ru;

  return (
    <main className="fixed inset-0 overflow-hidden bg-white dark:bg-[#151742]">
      <img
        src="/errors/500-owl-server.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center dark:hidden"
        width="1672"
        height="941"
        fetchPriority="high"
      />
      <img
        src="/errors/500-owl-server-dark.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 hidden h-full w-full object-cover object-center dark:block"
        width="1672"
        height="941"
        fetchPriority="high"
      />

      <section className="relative z-10 flex h-full items-center px-5 py-6 sm:px-[6vw]">
        <div className="w-full max-w-[470px] rounded-[2rem] bg-white/78 p-5 text-left shadow-[0_20px_60px_rgba(157,104,237,0.12)] backdrop-blur-sm dark:bg-[#19163f]/78 sm:translate-y-[4vh] sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none sm:dark:bg-transparent">
          <p
            className="w-max whitespace-nowrap bg-clip-text pr-[0.08em] font-display text-[clamp(8rem,20vw,19rem)] font-black leading-[0.82] tracking-[-0.025em] text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #ef70b8 0%, #bd74ef 52%, #719cf6 100%)' }}
          >
            500
          </p>

          <h1 className="mt-7 font-display text-[clamp(1.9rem,2.8vw,2.7rem)] font-black leading-tight tracking-[-0.02em] text-[#5f25ce] dark:text-[#d8b4fe]">
            {copy.title}
          </h1>
          <p className="mt-5 whitespace-pre-line font-body text-[clamp(1.05rem,1.45vw,1.35rem)] font-extrabold leading-[1.35] text-[#9d68ed] dark:text-[#c4b5fd]">
            {copy.subtitle}
          </p>

          <div className="mt-7 flex w-full max-w-[340px] flex-col gap-4">
            <button
              type="button"
              onClick={() => window.location.reload()}
              aria-label={copy.retryAria}
              className="btn-magic inline-flex min-h-[60px] w-full items-center justify-center gap-4 px-8 font-display text-lg font-bold text-white shadow-[0_14px_32px_rgba(200,100,200,0.24)] focus:outline-none focus:ring-4 focus:ring-pink-200"
            >
              <RotateCcw className="h-7 w-7" aria-hidden="true" />
              {copy.retry}
            </button>

            <Link
              to="/"
              aria-label={copy.homeAria}
              className="btn-outline inline-flex min-h-[60px] w-full items-center justify-center gap-4 px-8 font-display text-lg font-bold shadow-[0_10px_26px_rgba(200,179,255,0.18)] focus:outline-none focus:ring-4 focus:ring-pink-200"
            >
              <img
                src="/errors/404-home-sticker.png"
                alt=""
                aria-hidden="true"
                className="h-10 w-10 shrink-0 object-contain"
              />
              {copy.home}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
