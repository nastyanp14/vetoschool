import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Lang } from '../lib/i18n';

const blobs = [
  { className: 'left-[6%] top-[10%] h-64 w-64 bg-pink-300/40', x: [0, 28, -10, 0], y: [0, -18, 18, 0], duration: 14 },
  { className: 'right-[8%] top-[18%] h-72 w-72 bg-purple-300/45', x: [0, -22, 16, 0], y: [0, 20, -12, 0], duration: 16 },
  { className: 'bottom-[8%] left-[16%] h-72 w-72 bg-sky-300/35', x: [0, 18, -24, 0], y: [0, -18, 12, 0], duration: 18 },
  { className: 'bottom-[12%] right-[14%] h-56 w-56 bg-emerald-200/35', x: [0, -18, 14, 0], y: [0, 16, -10, 0], duration: 15 },
];

const sparkles = [
  { left: '12%', top: '28%', size: 'h-3 w-3', delay: 0.1 },
  { left: '22%', top: '72%', size: 'h-2.5 w-2.5', delay: 0.8 },
  { left: '42%', top: '14%', size: 'h-2 w-2', delay: 1.1 },
  { left: '72%', top: '18%', size: 'h-3.5 w-3.5', delay: 0.4 },
  { left: '83%', top: '62%', size: 'h-2.5 w-2.5', delay: 1.5 },
  { left: '58%', top: '82%', size: 'h-2 w-2', delay: 0.7 },
];

const pageCopy: Record<Lang, {
  title: string;
  subtitle: string;
  home: string;
  login: string;
  homeAria: string;
  loginAria: string;
  illustrationLabel: string;
}> = {
  ru: {
    title: 'Ой! Эту страницу не удалось найти',
    subtitle: 'Кажется, урок, который ты ищешь, немного заблудился.',
    home: 'Вернуться на главную',
    login: 'Войти в кабинет',
    homeAria: 'Вернуться на главную',
    loginAria: 'Войти в кабинет Vetoschool',
    illustrationLabel: 'Летающая волшебная книга с уроками и звёздами',
  },
  en: {
    title: "Oops! This page couldn't be found",
    subtitle: "The lesson you're looking for seems to have wandered off.",
    home: 'Back to Home',
    login: 'Log in',
    homeAria: 'Back to Home',
    loginAria: 'Log in to Vetoschool',
    illustrationLabel: 'Flying magic lesson book with stars',
  },
  ua: {
    title: 'Ой! Цю сторінку не знайдено',
    subtitle: 'Здається, урок, який ти шукаєш, трохи заблукав.',
    home: 'На головну',
    login: 'Увійти в кабінет',
    homeAria: 'Повернутися на головну',
    loginAria: 'Увійти в кабінет Vetoschool',
    illustrationLabel: 'Летюча чарівна книга з уроками та зірками',
  },
};

function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {blobs.map((blob, index) => (
        <motion.div
          key={index}
          className={`absolute rounded-full blur-3xl ${blob.className}`}
          animate={{ x: blob.x, y: blob.y, scale: [1, 1.12, 0.96, 1] }}
          transition={{ duration: blob.duration, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {sparkles.map((sparkle, index) => (
        <motion.span
          key={index}
          className={`absolute rounded-full bg-white shadow-lg shadow-pink-200/70 ${sparkle.size}`}
          style={{ left: sparkle.left, top: sparkle.top }}
          animate={{ opacity: [0.25, 0.95, 0.25], scale: [0.7, 1.35, 0.7], y: [0, -10, 0] }}
          transition={{ duration: 3.4, delay: sparkle.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {['A', 'B', 'C', '?'].map((letter, index) => (
        <motion.span
          key={letter}
          className="absolute select-none font-display text-4xl font-black opacity-40"
          style={{
            left: `${14 + index * 22}%`,
            top: `${18 + (index % 2) * 58}%`,
            color: ['#FF8DC7', '#A87EFF', '#7EC8FF', '#34d399'][index],
            filter: 'drop-shadow(0 10px 18px rgba(168, 85, 247, 0.22))',
          }}
          animate={{ y: [0, -16, 0], rotate: [0, index % 2 ? -7 : 7, 0] }}
          transition={{ duration: 5 + index, delay: index * 0.35, repeat: Infinity, ease: 'easeInOut' }}
        >
          {letter}
        </motion.span>
      ))}
    </div>
  );
}

function MagicBookIllustration({ label }: { label: string }) {
  return (
    <motion.svg
      viewBox="0 0 340 260"
      role="img"
      aria-label={label}
      className="mx-auto h-auto w-full max-w-[360px] overflow-visible drop-shadow-[0_34px_42px_rgba(168,85,247,0.26)]"
      animate={{ y: [0, -12, 0], rotate: [0, 1.6, -0.8, 0] }}
      transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <defs>
        <linearGradient id="book-cover" x1="58" x2="284" y1="89" y2="207" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F472B6" />
          <stop offset="0.5" stopColor="#A78BFA" />
          <stop offset="1" stopColor="#60A5FA" />
        </linearGradient>
        <linearGradient id="page-fill" x1="84" x2="254" y1="112" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF8FF" />
          <stop offset="0.58" stopColor="#FEF3FF" />
          <stop offset="1" stopColor="#EAF6FF" />
        </linearGradient>
        <filter id="soft-book-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="20" stdDeviation="16" floodColor="#A855F7" floodOpacity="0.26" />
        </filter>
      </defs>

      <motion.ellipse
        cx="170"
        cy="220"
        rx="96"
        ry="18"
        fill="#C8B3FF"
        opacity="0.16"
        animate={{ rx: [86, 104, 86], opacity: [0.12, 0.2, 0.12] }}
        transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.g animate={{ y: [0, -8, 0], rotate: [0, -2, 0] }} transition={{ duration: 5.3, repeat: Infinity, ease: 'easeInOut' }}>
        <path d="M70 100c36-23 71-20 100 8 29-28 64-31 100-8l13 91c-42-18-79-10-113 23-34-33-71-41-113-23l13-91Z" fill="url(#book-cover)" filter="url(#soft-book-shadow)" />
        <path d="M89 111c29-14 53-12 74 8l-2 69c-22-17-47-20-77-7l5-70Z" fill="url(#page-fill)" />
        <path d="M177 119c21-20 45-22 74-8l5 70c-30-13-55-10-77 7l-2-69Z" fill="url(#page-fill)" />
        <path d="M170 108c5 29 5 66 0 106" stroke="#8B5CF6" strokeLinecap="round" strokeWidth="5" opacity="0.34" />

        <motion.path
          d="M101 129c16-5 31-3 45 4M99 148c14-4 28-3 42 3M196 131c16-6 31-5 45-1M198 150c15-5 30-4 43 2"
          stroke="#B886F8"
          strokeLinecap="round"
          strokeWidth="5"
          opacity="0.42"
          animate={{ opacity: [0.35, 0.56, 0.35] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.path
          d="M158 116c-13-17-32-25-59-21 23-17 45-17 69 3l-10 18Z"
          fill="#FFFFFF"
          opacity="0.48"
          animate={{ d: [
            'M158 116c-13-17-32-25-59-21 23-17 45-17 69 3l-10 18Z',
            'M158 113c-14-14-33-20-59-18 24-15 47-14 69 4l-10 14Z',
            'M158 116c-13-17-32-25-59-21 23-17 45-17 69 3l-10 18Z',
          ] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          d="M182 116c13-17 32-25 59-21-23-17-45-17-69 3l10 18Z"
          fill="#FFFFFF"
          opacity="0.48"
          animate={{ d: [
            'M182 116c13-17 32-25 59-21-23-17-45-17-69 3l10 18Z',
            'M182 113c14-14 33-20 59-18-24-15-47-14-69 4l10 14Z',
            'M182 116c13-17 32-25 59-21-23-17-45-17-69 3l10 18Z',
          ] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
        />

        <path d="M184 115h18v53l-9-8-9 8v-53Z" fill="#F9A8D4" opacity="0.9" />
        <circle cx="128" cy="166" r="7" fill="#FACC15" opacity="0.8" />
        <path d="M214 166h28" stroke="#60A5FA" strokeLinecap="round" strokeWidth="6" opacity="0.7" />
      </motion.g>

      <motion.g animate={{ y: [0, -18, 0], x: [0, 8, 0], rotate: [0, 6, 0] }} transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}>
        <path d="M102 64h72l-36-21-36 21Z" fill="#7EC8FF" />
        <path d="M118 68h40v19c-12 9-26 9-40 0V68Z" fill="#A78BFA" />
        <path d="M175 66c19 6 27 17 22 34" fill="none" stroke="#C084FC" strokeLinecap="round" strokeWidth="5" />
        <circle cx="196" cy="105" r="6" fill="#F472B6" />
      </motion.g>

      <motion.g animate={{ x: [0, -12, 0], y: [0, 10, 0], rotate: [0, -8, 0] }} transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}>
        <path d="M257 63 305 48l-17 48-8-21-23-12Z" fill="#FFF8FF" stroke="#93C5FD" strokeLinejoin="round" strokeWidth="4" />
        <path d="m280 75 25-27" stroke="#F472B6" strokeLinecap="round" strokeWidth="4" />
      </motion.g>

      <motion.path
        d="M53 151c17-8 31-6 42 7-14-1-27 1-39 8l-3-15Z"
        fill="#F0ABFC"
        opacity="0.46"
        animate={{ y: [0, -7, 0], rotate: [0, 4, 0] }}
        transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {[
        { cx: 54, cy: 73, r: 7, color: '#FACC15', delay: 0.1 },
        { cx: 275, cy: 130, r: 6, color: '#F472B6', delay: 0.7 },
        { cx: 83, cy: 205, r: 5, color: '#60A5FA', delay: 1.1 },
        { cx: 231, cy: 41, r: 5, color: '#34D399', delay: 1.4 },
      ].map(star => (
        <motion.path
          key={`${star.cx}-${star.cy}`}
          d={`M${star.cx} ${star.cy - star.r}l${star.r * 0.32} ${star.r * 0.68} ${star.r * 0.75} ${star.r * 0.1}-${star.r * 0.54} ${star.r * 0.52} ${star.r * 0.13} ${star.r * 0.74}-${star.r * 0.66}-${star.r * 0.36}-${star.r * 0.66} ${star.r * 0.36} ${star.r * 0.13}-${star.r * 0.74}-${star.r * 0.54}-${star.r * 0.52} ${star.r * 0.75}-${star.r * 0.1} L${star.cx} ${star.cy - star.r}Z`}
          fill={star.color}
          animate={{ opacity: [0.45, 1, 0.45], scale: [0.8, 1.22, 0.8], rotate: [0, 180, 360] }}
          style={{ transformOrigin: `${star.cx}px ${star.cy}px` }}
          transition={{ duration: 3.2, delay: star.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </motion.svg>
  );
}

function ActionLink({
  to,
  variant,
  children,
  ariaLabel,
}: {
  to: string;
  variant: 'primary' | 'secondary';
  children: ReactNode;
  ariaLabel: string;
}) {
  return (
    <motion.div whileHover={{ scale: 1.04, y: -3 }} whileTap={{ scale: 0.98 }}>
      <Link
        to={to}
        aria-label={ariaLabel}
        className={`inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3 text-sm font-display font-bold shadow-lg focus:outline-none focus:ring-4 focus:ring-pink-200 sm:w-auto ${
          variant === 'primary' ? 'btn-magic text-white' : 'btn-outline bg-white/80'
        }`}
      >
        {children}
      </Link>
    </motion.div>
  );
}

export default function NotFound({ lang = 'ru' }: { lang?: Lang }) {
  const copy = pageCopy[lang] || pageCopy.ru;

  return (
    <main className="page-bg-home relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <AnimatedBackground />

      <motion.section
        initial={{ opacity: 0, y: 34, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="glass relative z-10 w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/80 p-5 text-center shadow-2xl shadow-purple-200/50 transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(200,150,220,0.32)] sm:p-8 lg:p-10"
      >
        <div className="pointer-events-none absolute -left-20 -top-20 h-44 w-44 rounded-full bg-pink-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-52 w-52 rounded-full bg-sky-200/50 blur-3xl" />

        <div className="relative mx-auto grid items-center gap-8 lg:grid-cols-[1fr_1.05fr] lg:text-left">
          <div className="order-2 lg:order-1">
            <motion.h1
              className="font-display text-[clamp(5.4rem,19vw,10rem)] font-black leading-none tracking-normal"
              animate={{ y: [0, -8, 0], rotate: [0, -1, 0] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_18px_35px_rgba(168,85,247,0.18)]">
                404
              </span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <h2 className="mx-auto mt-2 max-w-2xl font-display text-3xl font-black leading-tight text-purple-700 sm:text-4xl lg:mx-0">
                {copy.title}
              </h2>
              <p className="mx-auto mt-4 max-w-xl font-body text-base font-700 leading-relaxed text-purple-500 sm:text-lg lg:mx-0">
                {copy.subtitle}
              </p>
            </motion.div>

            <motion.div
              className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 0.58 }}
            >
              <ActionLink to="/" variant="primary" ariaLabel={copy.homeAria}>
                <span aria-hidden="true">🏠</span>
                {copy.home}
              </ActionLink>
              <ActionLink to="/login" variant="secondary" ariaLabel={copy.loginAria}>
                <span aria-hidden="true">🔐</span>
                {copy.login}
              </ActionLink>
            </motion.div>
          </div>

          <motion.div
            className="order-1 lg:order-2"
            initial={{ opacity: 0, y: 28, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.18, duration: 0.7, type: 'spring', stiffness: 90 }}
          >
            <div className="relative mx-auto max-w-[390px]">
              <MagicBookIllustration label={copy.illustrationLabel} />
            </div>
          </motion.div>
        </div>
      </motion.section>
    </main>
  );
}
