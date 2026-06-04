import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import FloatingElements from '../components/FloatingElements';
import BookHero from '../components/BookHero';
import { Lang, t } from '../lib/i18n';

function useScrollY() {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);
  return scrollY;
}

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface HomeProps { lang: Lang; }

export default function Home({ lang }: HomeProps) {
  const scrollY = useScrollY();
  const showcaseRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: showcaseRef, offset: ['start end', 'end start'] });
  const showcaseScale = useTransform(scrollYProgress, [0, 0.5], [0.85, 1]);
  const showcaseOpacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);

  // Courses: Lessons, Practice, Homework, Listening, Grammar (no Speaking Club)
  const courses = [
    { icon: '📚', titleKey: 'dash_lessons' as const, descKey: 'about_fun_desc' as const, color: 'from-pink-100 to-rose-100', border: 'border-pink-200' },
    { icon: '🎮', titleKey: 'courses_practice' as const, descKey: 'courses_practice_desc' as const, color: 'from-blue-100 to-cyan-100', border: 'border-blue-200' },
    { icon: '✏️', titleKey: 'courses_homework' as const, descKey: 'courses_homework_desc' as const, color: 'from-purple-100 to-violet-100', border: 'border-purple-200' },
    { icon: '🎧', titleKey: 'courses_listening' as const, descKey: 'courses_listening_desc' as const, color: 'from-green-100 to-teal-100', border: 'border-green-200' },
    { icon: '📝', titleKey: 'courses_grammar' as const, descKey: 'courses_grammar_desc' as const, color: 'from-yellow-100 to-amber-100', border: 'border-yellow-200' },
  ];

  // About cards: Fun, Anywhere, Progress, Safe (no Expert Teacher, no Small Groups)
  const aboutCards = [
    { icon: '🌈', titleKey: 'about_fun' as const, descKey: 'about_fun_desc' as const, color: 'from-pink-50 to-rose-50', border: 'border-pink-100' },
    { icon: '📱', titleKey: 'about_anywhere' as const, descKey: 'about_anywhere_desc' as const, color: 'from-blue-50 to-cyan-50', border: 'border-blue-100' },
    { icon: '📈', titleKey: 'about_progress' as const, descKey: 'about_progress_desc' as const, color: 'from-green-50 to-teal-50', border: 'border-green-100' },
    { icon: '❤️', titleKey: 'about_safe' as const, descKey: 'about_safe_desc' as const, color: 'from-orange-50 to-pink-50', border: 'border-orange-100' },
  ];

  return (
    <div className="overflow-x-hidden">
      {/* ===== HERO ===== */}
      <section
        id="hero"
        className="page-bg-home relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg,
            hsl(${340 + scrollY * 0.02}deg, 100%, 93%) 0%,
            hsl(${270 + scrollY * 0.01}deg, 100%, 93%) 40%,
            hsl(${210 + scrollY * 0.01}deg, 100%, 93%) 100%)`,
        }}
      >
        {/* Orbs */}
        <div className="absolute inset-0 overflow-hidden">
          {[
            { bg: 'rgba(255,179,209,0.4)', top: '10%', left: '5%', dur: 8 },
            { bg: 'rgba(200,179,255,0.4)', top: '20%', right: '10%', dur: 10 },
            { bg: 'rgba(179,217,255,0.4)', bottom: '15%', left: '20%', dur: 9 },
            { bg: 'rgba(179,240,224,0.3)', bottom: '20%', right: '15%', dur: 7 },
          ].map((orb, i) => (
            <motion.div key={i} className="absolute w-80 h-80 rounded-full blur-3xl"
              style={{ background: orb.bg, ...orb }}
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: orb.dur, repeat: Infinity, ease: 'easeInOut', delay: i }} />
          ))}
        </div>

        <FloatingElements scrollY={scrollY} />

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          {/* Badge — only age, no "Online school" text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 glass px-5 py-2.5 rounded-full mb-8 shadow-sm"
          >
            <span className="text-lg animate-bounce-soft">✨</span>
            <span className="font-body font-700 text-purple-600 text-sm">Ages 5–12</span>
            <span className="text-lg animate-bounce-soft delay-300">🌟</span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.8, type: 'spring', stiffness: 100 }}
            className="font-display font-black mb-4"
            style={{ fontSize: 'clamp(3.5rem, 10vw, 7rem)', lineHeight: 1.1 }}
          >
            <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">Veto</span>
            <span className="bg-gradient-to-r from-blue-400 via-teal-400 to-purple-400 bg-clip-text text-transparent">school</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="font-body text-xl md:text-2xl text-purple-500 font-600 mb-4"
          >
            {t(lang, 'hero_subtitle')}
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="font-body text-lg text-purple-400 mb-10 max-w-xl mx-auto leading-relaxed"
          >
            {t(lang, 'hero_desc')}
          </motion.p>

          {/* Free trial banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-100 to-purple-100 border border-pink-200 px-6 py-3 rounded-2xl mb-8"
          >
            <span className="text-2xl">🎁</span>
            <div className="text-left">
              {lang === 'ru' && <p className="font-body font-700 text-purple-700 text-sm">Запишитесь на <span className="text-pink-500">бесплатный пробный урок</span> через наш Telegram-бот!</p>}
              {lang === 'en' && <p className="font-body font-700 text-purple-700 text-sm">Sign up for a <span className="text-pink-500">free trial lesson</span> via our Telegram bot!</p>}
              {lang === 'ua' && <p className="font-body font-700 text-purple-700 text-sm">Запишіться на <span className="text-pink-500">безкоштовний пробний урок</span> через наш Telegram-бот!</p>}
            </div>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link to="/register">
              <button className="btn-magic px-10 py-4 text-lg text-white font-display font-bold shadow-xl">
                {t(lang, 'hero_cta')}
              </button>
            </Link>
            <a href="https://t.me/vetoschool_bot" target="_blank" rel="noopener noreferrer"
              className="btn-outline px-10 py-4 text-lg font-display font-bold">
              {t(lang, 'hero_contact')}
            </a>
          </motion.div>

          {/* Book */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.8, type: 'spring', stiffness: 80 }}
            className="mt-12 md:mt-16"
          >
            <BookHero />
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2" animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <div className="w-6 h-10 rounded-full border-2 border-purple-300 flex items-start justify-center pt-2">
            <div className="w-1.5 h-3 bg-purple-300 rounded-full animate-bounce" />
          </div>
        </motion.div>
      </section>

      {/* ===== ABOUT ===== */}
      <section id="about" className="section-pink py-24 px-4 relative overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-pink-100 px-4 py-2 rounded-full mb-4">
              <span className="text-pink-400 font-body font-700 text-sm">{t(lang, 'about_badge')}</span>
            </div>
            <h2 className="font-display font-black text-4xl md:text-5xl text-purple-700 mb-6">
              {t(lang, 'about_title')}
              <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">{t(lang, 'about_title2')}</span> ✨
            </h2>
            <p className="font-body text-lg text-purple-500 max-w-2xl mx-auto leading-relaxed">
              {t(lang, 'about_desc')}
            </p>
          </FadeIn>

          {/* 4 cards — no Expert Teacher, no Small Groups */}
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {aboutCards.map((card, i) => (
              <FadeIn key={card.titleKey} delay={i * 0.1}>
                <div className={`card-hover bg-gradient-to-br ${card.color} border ${card.border} rounded-3xl p-6 h-full`}>
                  <div className="text-4xl mb-4">{card.icon}</div>
                  <h3 className="font-display font-bold text-xl text-purple-700 mb-2">{t(lang, card.titleKey)}</h3>
                  <p className="font-body text-purple-500 text-sm leading-relaxed">
                    {/* Custom text for about_fun */}
                    {card.titleKey === 'about_fun'
                      ? (lang === 'ru' ? 'Яркие уроки, которые детям действительно нравятся' :
                         lang === 'ua' ? 'Яскраві уроки, які дітям дійсно подобаються' :
                         'Bright lessons that kids truly love')
                      : t(lang, card.descKey)}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Teacher block — NO name header, updated quote */}
          <FadeIn delay={0.3} className="mt-16">
            <div className="glass rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-50/50 to-purple-50/50" />
              <div className="relative z-10">
                <div className="text-6xl mb-4">👩‍🏫</div>
                <p className="font-body text-purple-500 max-w-lg mx-auto leading-relaxed text-lg">
                  {lang === 'ru' && '«Мы создали Vetoschool, потому что верим: изучение языка должно приносить радость. Каждый урок создан с любовью, чтобы ваш ребёнок развивал настоящие знания английского, получая при этом удовольствие!» 💕'}
                  {lang === 'en' && '"We created Vetoschool because we believe: learning a language should bring joy. Every lesson is crafted with love so your child builds real English skills while having the time of their life!" 💕'}
                  {lang === 'ua' && '«Ми створили Vetoschool, тому що віримо: вивчення мови має приносити радість. Кожен урок створений з любов\'ю, щоб ваша дитина розвивала справжні знання англійської, отримуючи при цьому задоволення!» 💕'}
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ===== COURSES ===== */}
      <section id="courses" className="section-blue py-24 px-4 relative overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-blue-100 px-4 py-2 rounded-full mb-4">
              <span className="text-blue-500 font-body font-700 text-sm">{t(lang, 'courses_badge')}</span>
            </div>
            <h2 className="font-display font-black text-4xl md:text-5xl text-purple-700 mb-4">
              {t(lang, 'courses_title')}
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{t(lang, 'courses_title2')}</span>
            </h2>
            <p className="font-body text-lg text-purple-500 max-w-xl mx-auto">{t(lang, 'courses_desc')}</p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course, i) => (
              <FadeIn key={course.titleKey} delay={i * 0.1}>
                <motion.div
                  className={`card-hover bg-gradient-to-br ${course.color} border ${course.border} rounded-3xl p-6 cursor-pointer`}
                  whileHover={{ scale: 1.03 }}
                >
                  <motion.div className="text-5xl mb-4 inline-block" whileHover={{ rotate: [0, -10, 10, 0], scale: 1.2 }} transition={{ duration: 0.4 }}>
                    {course.icon}
                  </motion.div>
                  <h3 className="font-display font-bold text-xl text-purple-700 mb-2">{t(lang, course.titleKey)}</h3>
                  <p className="font-body text-purple-500 text-sm leading-relaxed">
                    {course.titleKey === 'dash_lessons'
                      ? (lang === 'ru' ? 'Яркие уроки, которые детям действительно нравятся' :
                         lang === 'ua' ? 'Яскраві уроки, які дітям дійсно подобаються' :
                         'Engaging lessons kids truly love')
                      : t(lang, course.descKey)}
                  </p>
                </motion.div>
              </FadeIn>
            ))}
          </div>

          {/* Free trial CTA */}
          <FadeIn delay={0.3} className="mt-10">
            <div className="glass rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-4 border border-pink-100">
              <div className="text-4xl">🎁</div>
              <div className="flex-1 text-center sm:text-left">
                <h4 className="font-display font-bold text-xl text-purple-700 mb-1">
                  {lang === 'ru' && 'Запишитесь на бесплатный пробный урок!'}
                  {lang === 'en' && 'Sign up for a free trial lesson!'}
                  {lang === 'ua' && 'Запишіться на безкоштовний пробний урок!'}
                </h4>
                <p className="font-body text-sm text-purple-500">
                  {lang === 'ru' && 'Напишите нам в Telegram-бот — мы подберём удобное время'}
                  {lang === 'en' && 'Message us on Telegram — we\'ll find a convenient time'}
                  {lang === 'ua' && 'Напишіть нам у Telegram-бот — ми підберемо зручний час'}
                </p>
              </div>
              <a href="https://t.me/vetoschool_bot" target="_blank" rel="noopener noreferrer"
                className="btn-magic px-6 py-3 text-white font-display font-bold text-sm flex-shrink-0">
                📱 Telegram Bot
              </a>
            </div>
          </FadeIn>

          {/* CTA banner */}
          <FadeIn delay={0.4} className="mt-8">
            <div className="rounded-3xl p-8 md:p-12 text-center text-white relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #FF8DC7 0%, #C8B3FF 50%, #7EC8FF 100%)' }}>
              <div className="absolute inset-0 opacity-10">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className="absolute text-white text-2xl" style={{ left: `${(i * 5.3) % 100}%`, top: `${(i * 7.1) % 100}%`, opacity: 0.3 }}>✨</div>
                ))}
              </div>
              <div className="relative z-10">
                <h3 className="font-display font-black text-3xl md:text-4xl mb-4">{t(lang, 'courses_cta_title')}</h3>
                <p className="font-body text-white/90 text-lg mb-8 max-w-md mx-auto">{t(lang, 'courses_cta_desc')}</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a href="https://t.me/vetoschool_bot" target="_blank" rel="noopener noreferrer"
                    className="bg-white text-purple-600 font-display font-bold px-8 py-4 rounded-full hover:scale-105 transition-transform shadow-lg inline-flex items-center gap-2 justify-center">
                    {t(lang, 'courses_telegram')}
                  </a>
                  <Link to="/register">
                    <button className="bg-white/20 border-2 border-white text-white font-display font-bold px-8 py-4 rounded-full hover:bg-white/30 transition-all">
                      {t(lang, 'courses_signup')}
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ===== SHOWCASE ===== */}
      <section className="section-purple py-24 px-4 relative overflow-hidden" ref={showcaseRef}>
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-20">
            <h2 className="font-display font-black text-4xl md:text-5xl text-purple-700 mb-4">
              {t(lang, 'showcase_title')}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{t(lang, 'showcase_title2')}</span>
              <br />{t(lang, 'showcase_title3')}
            </h2>
          </FadeIn>

          <motion.div style={{ scale: showcaseScale, opacity: showcaseOpacity }} className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              {[
                { emoji: '🌈', tk: 'showcase_visual' as const, dk: 'showcase_visual_desc' as const },
                { emoji: '🎵', tk: 'showcase_music' as const, dk: 'showcase_music_desc' as const },
                { emoji: '🎮', tk: 'showcase_game' as const, dk: 'showcase_game_desc' as const },
              ].map((item, i) => (
                <motion.div key={item.tk} initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                  transition={{ delay: i * 0.15, duration: 0.6 }} className="flex items-start gap-4 glass rounded-2xl p-5 card-hover">
                  <div className="text-3xl flex-shrink-0">{item.emoji}</div>
                  <div>
                    <h4 className="font-display font-bold text-purple-700 text-lg">{t(lang, item.tk)}</h4>
                    <p className="font-body text-purple-500 text-sm mt-1">{t(lang, item.dk)}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
              <div className="rounded-3xl p-8 text-center relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #F5F0FF 0%, #FFE4F5 50%, #E4F5FF 100%)' }}>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {['📚', '✏️', '🌟', '🎨', '🔤', '🎵', '📖', '🌈', '💡'].map((emoji, i) => (
                    <motion.div key={i} className="text-4xl flex items-center justify-center h-16 bg-white/60 rounded-2xl"
                      animate={{ y: [0, -6, 0] }} transition={{ delay: i * 0.2, duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}>
                      {emoji}
                    </motion.div>
                  ))}
                </div>
                <p className="font-display font-bold text-purple-600 text-lg">{t(lang, 'showcase_toolkit')}</p>
                <p className="font-body text-purple-400 text-sm mt-2">{t(lang, 'showcase_toolkit_desc')}</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 animate-gradient"
          style={{ background: 'linear-gradient(135deg, #FFB3D1, #C8B3FF, #B3D9FF, #B3F0E0)', backgroundSize: '300% 300%' }} />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <FadeIn>
            <motion.div animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }} transition={{ duration: 4, repeat: Infinity }} className="text-7xl mb-6">🚀</motion.div>
            <h2 className="font-display font-black text-4xl md:text-6xl text-white mb-6" style={{ textShadow: '0 2px 20px rgba(150,100,200,0.3)' }}>
              {t(lang, 'cta_title')}
            </h2>
            <p className="font-body text-white/90 text-xl mb-2 leading-relaxed">{t(lang, 'cta_desc')}</p>
            <p className="font-body text-white/80 text-lg mb-10">{t(lang, 'cta_desc2')}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <button className="bg-white text-purple-600 font-display font-black text-xl px-12 py-5 rounded-full hover:scale-105 transition-transform shadow-2xl">
                  {t(lang, 'cta_free')}
                </button>
              </Link>
              <a href="https://t.me/vetoschool_bot" target="_blank" rel="noopener noreferrer"
                className="bg-white/20 border-2 border-white text-white font-display font-bold text-xl px-12 py-5 rounded-full hover:bg-white/30 transition-all inline-flex items-center gap-2 justify-center">
                {t(lang, 'cta_telegram')}
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer id="contact" className="bg-purple-900 text-white py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-3xl">📖</span>
                <span className="font-display font-black text-2xl bg-gradient-to-r from-pink-300 to-purple-300 bg-clip-text text-transparent">Vetoschool</span>
              </div>
              <p className="font-body text-purple-300 leading-relaxed mb-6 max-w-md">{t(lang, 'footer_desc')}</p>
            </div>
            <div>
              <h4 className="font-display font-bold text-lg text-white mb-4">{t(lang, 'footer_contact')}</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-2 font-body text-purple-300 text-sm">
                  <span>✈️</span>
                  <a href="https://t.me/vetoschool_bot" target="_blank" rel="noopener noreferrer" className="hover:text-pink-300 transition-colors">@vetoschool_bot</a>
                </li>
                <li className="flex items-center gap-2 font-body text-purple-300 text-sm">
                  <span>📧</span>
                  <a href="mailto:vetoschool.english@gmail.com" className="hover:text-pink-300 transition-colors">vetoschool.english@gmail.com</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-purple-700 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="font-body text-purple-400 text-sm">{t(lang, 'footer_copy')}</p>
            <div className="flex gap-6">
              <Link to="/login" className="font-body text-purple-400 hover:text-pink-300 text-sm transition-colors">{t(lang, 'footer_signin')}</Link>
              <Link to="/register" className="font-body text-purple-400 hover:text-pink-300 text-sm transition-colors">{t(lang, 'footer_register')}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
