import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { Lang } from '../lib/i18n';

const pageCopy: Record<Lang, {
  title: string;
  subtitle: string;
  home: string;
  login: string;
  homeAria: string;
  loginAria: string;
}> = {
  ru: {
    title: 'Упс! Кажется,\nмы заблудились',
    subtitle: 'Этой страницы здесь нет.\nНо сова знает дорогу обратно',
    home: 'На главную',
    login: 'В личный кабинет',
    homeAria: 'Вернуться на главную',
    loginAria: 'Перейти в личный кабинет Vetoschool',
  },
  en: {
    title: 'Oops! It looks like\nwe got lost',
    subtitle: "This page isn't here.\nBut the owl knows the way back",
    home: 'Home',
    login: 'My account',
    homeAria: 'Return to the home page',
    loginAria: 'Go to the Vetoschool account',
  },
  ua: {
    title: 'Упс! Здається,\nми заблукали',
    subtitle: 'Цієї сторінки тут немає.\nАле сова знає дорогу назад',
    home: 'На головну',
    login: 'В особистий кабінет',
    homeAria: 'Повернутися на головну',
    loginAria: 'Перейти в особистий кабінет Vetoschool',
  },
};

export default function NotFound({ lang = 'ru' }: { lang?: Lang }) {
  const copy = pageCopy[lang] || pageCopy.ru;
  const showNewArtwork = new URLSearchParams(window.location.search).get('art') === 'new';

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fffaff]">
      <img
        src={showNewArtwork ? '/errors/404-owl-map-clean.png' : '/errors/404-owl-map.png'}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-[62%_center] sm:object-center dark:hidden"
      />
      <img
        src="/errors/404-owl-map-dark.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 hidden h-full w-full object-cover object-[62%_center] sm:object-center dark:block"
      />

      {showNewArtwork && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[69.4%] top-[23.5%] z-[2] -translate-x-1/2 -translate-y-1/2 dark:hidden"
        >
          <motion.span
            animate={{ y: [0, -12, 0], rotate: [0, -7, 6, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            className="block font-display text-[clamp(3rem,5vw,5rem)] font-black leading-none text-[#8f42ed] drop-shadow-[0_10px_18px_rgba(143,66,237,0.22)]"
          >
            ?
          </motion.span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/35 via-white/5 to-transparent sm:from-white/10 dark:hidden" />

      <motion.section
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex min-h-screen items-center px-6 py-12 sm:px-[8vw]"
      >
        <div className="w-full max-w-[530px] -translate-y-[1.5vh] text-left sm:max-w-[43vw] lg:max-w-[520px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.55 }}
          >
            <motion.p
              animate={{ y: [0, -8, 0], rotate: [0, -1, 0] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
              className="w-fit bg-clip-text font-display text-[clamp(5.4rem,19vw,10rem)] font-black leading-none tracking-normal text-transparent drop-shadow-[0_18px_35px_rgba(168,85,247,0.18)]"
              style={{
                backgroundImage: 'linear-gradient(90deg, #ef5fba 0%, #bd6cf0 50%, #63a4f7 100%)',
              }}
            >
              404
            </motion.p>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.58 }}
            className="mt-4 whitespace-pre-line font-display text-[clamp(2rem,3.4vw,3.45rem)] font-black leading-[1.08] tracking-[-0.02em] text-[#5f25ce] dark:text-[#d8b4fe]"
          >
            {copy.title}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.58 }}
            className="mt-3 whitespace-pre-line font-body text-[clamp(1rem,1.55vw,1.45rem)] font-extrabold leading-[1.35] text-[#9d68ed] dark:text-[#c4b5fd]"
          >
            {copy.subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.58 }}
            className="mt-8 flex flex-col gap-4 sm:flex-row"
          >
            <motion.div className="w-full sm:w-auto" whileHover={{ scale: 1.04, y: -3 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/"
                aria-label={copy.homeAria}
                className="btn-magic inline-flex min-h-14 w-full items-center justify-center gap-3 px-8 text-base shadow-[0_14px_32px_rgba(200,100,200,0.24)] focus:outline-none focus:ring-4 focus:ring-pink-200 sm:min-w-[220px]"
              >
                <img src="/errors/404-home-sticker.png" alt="" aria-hidden="true" className="h-9 w-9 shrink-0 object-contain" />
                {copy.home}
              </Link>
            </motion.div>

            <motion.div className="w-full sm:w-auto" whileHover={{ scale: 1.04, y: -3 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/dashboard"
                aria-label={copy.loginAria}
                className="btn-outline inline-flex min-h-14 w-full items-center justify-center gap-3 px-8 text-base shadow-[0_10px_26px_rgba(200,179,255,0.18)] focus:outline-none focus:ring-4 focus:ring-pink-200 sm:min-w-[245px]"
              >
                <img src="/errors/404-key-sticker.png" alt="" aria-hidden="true" className="h-9 w-9 shrink-0 object-contain" />
                {copy.login}
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>
    </main>
  );
}
