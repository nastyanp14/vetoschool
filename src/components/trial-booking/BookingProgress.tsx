import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Lang, TranslationKey } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { Progress } from '@/components/ui/progress';

type BookingProgressProps = {
  lang: Lang;
  currentStep: number;
  totalSteps: number;
  stepTitle: TranslationKey;
  canGoBack: boolean;
  onBack: () => void;
};

export default function BookingProgress({
  lang,
  currentStep,
  totalSteps,
  stepTitle,
  canGoBack,
  onBack,
}: BookingProgressProps) {
  const progress = Math.round((currentStep / totalSteps) * 100);

  return (
    <header className="mb-6 rounded-3xl border border-white/70 bg-white/80 p-3 shadow-xl shadow-purple-100/50 backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/80 dark:shadow-black/20 sm:mb-8 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {canGoBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={t(lang, 'trial_back')}
              className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-purple-100 bg-white text-purple-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <div className="hidden h-10 w-10 sm:block" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="font-body text-xs font-black uppercase tracking-[0.18em] text-pink-500 dark:text-pink-200">
              {t(lang, 'trial_step')} {currentStep} / {totalSteps}
            </p>
            <h1 className="truncate font-display text-lg font-black text-purple-700 dark:text-purple-100 sm:text-xl">
              {t(lang, stepTitle)}
            </h1>
          </div>
        </div>
        <motion.span
          key={progress}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-r from-pink-100 to-blue-100 px-3 py-1.5 font-body text-sm font-black text-purple-600 dark:from-white/10 dark:to-white/10 dark:text-purple-100"
        >
          {progress}%
        </motion.span>
      </div>
      <Progress
        value={progress}
        aria-label={t(lang, 'trial_progress_label')}
        className="h-3 bg-purple-100 dark:bg-white/10"
      />
    </header>
  );
}
