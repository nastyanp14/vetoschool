import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { t } from '@/lib/i18n';
import type { TrialBookingStepProps } from './types';

export default function WelcomeStep({ lang, onNext }: TrialBookingStepProps) {
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const teleprompterLines = [
    t(lang, 'trial_welcome_list_title'),
    t(lang, 'trial_welcome_meet_teacher'),
    t(lang, 'trial_welcome_level'),
    t(lang, 'trial_welcome_platform'),
    t(lang, 'trial_welcome_recommendation'),
  ];

  useEffect(() => {
    setActiveLineIndex(0);
    const interval = window.setInterval(() => {
      setActiveLineIndex(index => (index + 1) % teleprompterLines.length);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [lang, teleprompterLines.length]);

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex flex-wrap gap-2"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-pink-100 bg-white/75 px-3 py-2 font-body text-sm font-black text-pink-500 shadow-sm dark:border-purple-700 dark:bg-white/10 dark:text-pink-200">
            <img src="/trial-booking/trial-duration-clock.png" alt="" aria-hidden="true" className="relative -top-0.5 -mx-0.5 -my-1 h-6 w-6 shrink-0 object-contain" />
            {t(lang, 'trial_duration_label')}: {t(lang, 'trial_duration_value')}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/75 px-3 py-2 font-body text-sm font-black text-purple-500 shadow-sm dark:border-purple-700 dark:bg-white/10 dark:text-purple-100">
            <img src="/trial-booking/trial-application-pencil.png" alt="" aria-hidden="true" className="relative -top-0.5 -mx-0.5 -my-1 h-6 w-6 shrink-0 object-contain" />
            {t(lang, 'trial_application_time_note')}
          </span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="font-display text-4xl font-black leading-tight text-purple-700 dark:text-purple-100 sm:text-5xl"
        >
          {t(lang, 'trial_welcome_title')}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4 max-w-xl font-body text-lg font-semibold leading-relaxed text-purple-500 dark:text-purple-200"
        >
          {t(lang, 'trial_welcome_intro')}
        </motion.p>
        <motion.button
          type="button"
          onClick={onNext}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="trial-booking-primary-button mt-8 inline-flex w-full items-center justify-center gap-3 rounded-3xl px-8 py-4 font-display text-lg font-black shadow-2xl shadow-purple-200/70 transition hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 dark:shadow-purple-950/50 sm:w-auto"
        >
          {t(lang, 'trial_start')}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12 }}
        className="grid gap-3 lg:relative lg:top-6 lg:-mt-4 lg:min-h-[520px] lg:self-start"
      >
        <div className="flex min-h-14 items-center justify-center px-3 text-center sm:min-h-16 lg:h-16 lg:relative lg:top-8">
          <AnimatePresence mode="wait">
            <motion.p
              key={teleprompterLines[activeLineIndex]}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
              className="font-display text-lg font-black leading-tight text-purple-700 dark:text-purple-100 sm:text-xl"
            >
              {teleprompterLines[activeLineIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="mt-2 aspect-[1.63/1] overflow-hidden rounded-[2rem] border border-white/80 bg-purple-100 shadow-2xl shadow-purple-100/60 dark:border-purple-700 dark:bg-purple-950 dark:shadow-black/30 lg:relative lg:-top-9">
          <video
            className="block h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-label={lang === 'ru' ? 'Рекламный ролик Vetoschool' : lang === 'ua' ? 'Рекламний ролик Vetoschool' : 'Vetoschool promotional video'}
          >
            <source src="/trial-booking/promotional-video.mp4" type="video/mp4" />
          </video>
        </div>
      </motion.div>
    </div>
  );
}
