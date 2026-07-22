import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Gamepad2, RefreshCcw, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { t } from '@/lib/i18n';
import { getMockRecommendation, mockAssessmentQuestions } from './MockAssessmentData';
import type { AssessmentResult, TrialBookingStepProps } from './types';

export default function AssessmentStep({ lang, data, updateData, onNext }: TrialBookingStepProps) {
  const [started, setStarted] = useState(Boolean(data.assessment));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState<AssessmentResult | null>(data.assessment);

  const question = mockAssessmentQuestions[questionIndex];
  const total = mockAssessmentQuestions.length;
  const answeredCount = Object.keys(answers).length;

  const currentResult = useMemo(() => {
    if (!result) return null;
    return result;
  }, [result]);

  const completeAssessment = (nextAnswers: Record<string, string>) => {
    const score = mockAssessmentQuestions.reduce((sum, item) => (
      nextAnswers[item.id] === item.correctOptionId ? sum + 1 : sum
    ), 0);
    const recommendation = getMockRecommendation(data.child.age || 7, score);
    const nextResult = { score, total, recommendation };
    setResult(nextResult);
    updateData({ assessment: nextResult });
  };

  const handleNextQuestion = () => {
    if (!selected) return;
    const nextAnswers = { ...answers, [question.id]: selected };
    setAnswers(nextAnswers);
    setSelected('');

    if (questionIndex >= total - 1) {
      completeAssessment(nextAnswers);
      return;
    }
    setQuestionIndex(index => index + 1);
  };

  const resetGame = () => {
    setQuestionIndex(0);
    setAnswers({});
    setSelected('');
    setResult(null);
    updateData({ assessment: null });
  };

  if (!started) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-pink-400 to-blue-400 text-white shadow-2xl shadow-purple-200/60">
          <Gamepad2 className="h-9 w-9" aria-hidden="true" />
        </div>
        <h2 className="font-display text-3xl font-black text-purple-700 dark:text-purple-100">
          {t(lang, 'trial_assessment_title')}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl font-body text-base font-semibold leading-relaxed text-purple-500 dark:text-purple-200">
          {t(lang, 'trial_assessment_intro')}
        </p>
        <div className="mt-6 rounded-[2rem] border border-white/80 bg-white/85 p-5 text-left shadow-2xl shadow-purple-100/60 dark:border-purple-700 dark:bg-[#1b0c2f]/85 dark:shadow-black/30 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {['trial_assessment_not_exam', 'trial_assessment_friendly', 'trial_assessment_teacher_note'].map(key => (
              <div key={key} className="rounded-3xl bg-gradient-to-br from-pink-50 to-blue-50 p-4 dark:from-white/10 dark:to-white/10">
                <Sparkles className="mb-3 h-5 w-5 text-pink-500 dark:text-pink-200" aria-hidden="true" />
                <p className="font-body text-sm font-black leading-relaxed text-purple-600 dark:text-purple-100">
                  {t(lang, key as never)}
                </p>
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 px-8 py-4 font-display text-base font-black text-white shadow-xl shadow-purple-200/60 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 dark:shadow-purple-950/50 sm:w-auto"
        >
          {t(lang, 'trial_assessment_start')}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (currentResult) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[2rem] border border-white/80 bg-white/90 p-5 text-center shadow-2xl shadow-purple-100/60 backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/90 dark:shadow-black/30 sm:p-8">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-green-300 to-blue-400 text-white shadow-xl">
            <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
          </div>
          <h2 className="font-display text-3xl font-black text-purple-700 dark:text-purple-100">
            {t(lang, 'trial_assessment_result_title')}
          </h2>
          <div className="mx-auto mt-5 max-w-md rounded-3xl bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 p-5 dark:from-white/10 dark:via-white/10 dark:to-white/10">
            <p className="font-body text-xs font-black uppercase tracking-[0.18em] text-pink-500 dark:text-pink-200">
              {t(lang, 'trial_preliminary_recommendation')}
            </p>
            <p className="mt-2 font-display text-3xl font-black text-purple-700 dark:text-purple-100">
              {currentResult.recommendation}
            </p>
          </div>
          <p className="mx-auto mt-5 max-w-xl font-body text-sm font-bold leading-relaxed text-purple-500 dark:text-purple-200">
            {t(lang, 'trial_preliminary_note')}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={resetGame}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-3xl border border-purple-200 bg-white px-5 py-3 font-display text-sm font-black text-purple-600 transition hover:-translate-y-0.5 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              {t(lang, 'trial_assessment_try_again')}
            </button>
            <button
              type="button"
              onClick={onNext}
              className="flex-1 rounded-3xl bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 px-5 py-3 font-display text-sm font-black text-white shadow-xl shadow-purple-200/60 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 dark:shadow-purple-950/50"
            >
              {t(lang, 'trial_continue')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between rounded-3xl border border-white/70 bg-white/75 px-4 py-3 shadow-sm dark:border-purple-700 dark:bg-white/10">
        <span className="font-body text-sm font-black text-purple-500 dark:text-purple-100">
          {t(lang, 'trial_question')} {questionIndex + 1} / {total}
        </span>
        <span className="font-body text-sm font-black text-pink-500 dark:text-pink-200">
          {answeredCount}/{total}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -28 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-2xl shadow-purple-100/60 backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/90 dark:shadow-black/30 sm:p-7"
        >
          <p className="mb-2 font-body text-xs font-black uppercase tracking-[0.18em] text-pink-500 dark:text-pink-200">
            {t(lang, `trial_question_type_${question.type}` as never)}
          </p>
          <h2 className="font-display text-2xl font-black text-purple-700 dark:text-purple-100 sm:text-3xl">
            {question.prompt[lang]}
          </h2>
          {question.helper && (
            <p className="mt-2 font-body text-sm font-bold text-purple-400 dark:text-purple-200">
              {question.helper[lang]}
            </p>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {question.options.map(option => {
              const active = selected === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelected(option.id)}
                  className={`relative rounded-3xl border p-4 text-center transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 ${
                    active
                      ? 'scale-[1.01] border-pink-300 bg-gradient-to-br from-pink-100 to-blue-100 shadow-xl shadow-purple-100/70 ring-2 ring-pink-100 dark:border-pink-300 dark:from-white/20 dark:to-white/10 dark:ring-pink-300/30'
                      : 'border-purple-100 bg-white/80 hover:-translate-y-0.5 hover:border-pink-200 hover:bg-pink-50 dark:border-purple-700 dark:bg-white/10 dark:hover:bg-white/15'
                  }`}
                  aria-pressed={active}
                >
                  {active && (
                    <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-pink-500 dark:text-pink-200" aria-hidden="true" />
                  )}
                  {option.visual && <span className="mb-2 block text-5xl">{option.visual}</span>}
                  <span className="font-display text-base font-black text-purple-700 dark:text-purple-100">
                    {option.label[lang]}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleNextQuestion}
            disabled={!selected}
            className="mt-6 w-full rounded-3xl bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 px-8 py-4 font-display text-base font-black text-white shadow-xl shadow-purple-200/60 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:shadow-purple-950/50"
          >
            {questionIndex >= total - 1 ? t(lang, 'trial_assessment_finish') : t(lang, 'trial_next_question')}
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
