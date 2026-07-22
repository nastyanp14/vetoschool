import { ArrowRight, Clock, Eye, GraduationCap, Sparkles, Timer, UserRoundCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { t } from '@/lib/i18n';
import type { TrialBookingStepProps } from './types';

export default function WelcomeStep({ lang, onNext }: TrialBookingStepProps) {
  const cards = [
    { icon: UserRoundCheck, label: t(lang, 'trial_welcome_meet_teacher') },
    { icon: GraduationCap, label: t(lang, 'trial_welcome_level') },
    { icon: Eye, label: t(lang, 'trial_welcome_platform') },
    { icon: Sparkles, label: t(lang, 'trial_welcome_recommendation') },
  ];

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex flex-wrap gap-2"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-pink-100 bg-white/75 px-4 py-2 font-body text-sm font-black text-pink-500 shadow-sm dark:border-purple-700 dark:bg-white/10 dark:text-pink-200">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {t(lang, 'trial_duration_label')}: {t(lang, 'trial_duration_value')}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/75 px-4 py-2 font-body text-sm font-black text-purple-500 shadow-sm dark:border-purple-700 dark:bg-white/10 dark:text-purple-100">
            <Timer className="h-4 w-4" aria-hidden="true" />
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
          className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 px-8 py-4 font-display text-lg font-black text-white shadow-2xl shadow-purple-200/70 transition hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 dark:shadow-purple-950/50 sm:w-auto"
        >
          {t(lang, 'trial_start')}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="rounded-[2rem] border border-white/80 bg-white/85 p-4 shadow-2xl shadow-purple-100/60 backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/85 dark:shadow-black/30 sm:p-6"
      >
        <div className="rounded-[1.5rem] bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-5 dark:from-purple-900/60 dark:via-fuchsia-900/40 dark:to-blue-900/40">
          <div className="mb-5 flex h-24 items-center justify-center rounded-3xl bg-white/75 text-6xl shadow-inner dark:bg-white/10">
            ✨
          </div>
          <h3 className="mb-4 font-display text-xl font-black text-purple-700 dark:text-purple-100">
            {t(lang, 'trial_welcome_list_title')}
          </h3>
          <div className="grid gap-3">
            {cards.map((card, index) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.18 + index * 0.05 }}
                className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm dark:border-purple-700 dark:bg-white/10"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-purple-400 text-white shadow-lg">
                  <card.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="font-body text-sm font-black text-purple-700 dark:text-purple-100">{card.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
