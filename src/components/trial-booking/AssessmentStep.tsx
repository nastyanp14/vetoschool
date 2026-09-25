import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, RefreshCcw, Volume2, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { t } from '@/lib/i18n';
import { determineEnglishLevel } from '@/lib/trialAssessment';
import { getAssessmentTestForAge, getMockRecommendation } from './MockAssessmentData';
import { getAssessmentAnswerReview } from './assessmentReview';
import type { AssessmentProgress, AssessmentResult, TrialBookingStepProps } from './types';

const ASSESSMENT_GAMEPAD_SRC = '/dashboard/grades-practice-gamepad.png';
const ASSESSMENT_STARS_SRC = '/trial-booking/assessment-stars.png';
const withoutTrailingPeriod = (value: string) => value.endsWith('.') ? value.slice(0, -1) : value;
const withoutInstructionPrefix = (value: string) => {
  const separatorIndex = value.indexOf(':');
  const taskText = value.slice(separatorIndex + 1).trim();
  return separatorIndex === -1 || !taskText ? value : taskText;
};

export default function AssessmentStep({ lang, data, updateData, onNext }: TrialBookingStepProps) {
  const assessmentTest = useMemo(() => getAssessmentTestForAge(data.child.age), [data.child.age]);
  const [started, setStarted] = useState(data.assessmentProgress.started || Boolean(data.assessment));
  const [questionIndex, setQuestionIndex] = useState(() => Math.min(data.assessmentProgress.questionIndex, assessmentTest.questions.length - 1));
  const [answers, setAnswers] = useState<Record<string, string>>(data.assessmentProgress.answers);
  const [selected, setSelected] = useState(data.assessmentProgress.selectedOptionId);
  const [result, setResult] = useState<AssessmentResult | null>(data.assessment);
  const [resultPanel, setResultPanel] = useState<'level' | 'group'>('level');
  const [resultView, setResultView] = useState<'summary' | 'review'>(data.assessmentProgress.resultView);
  const questionAudioRef = useRef<HTMLAudioElement | null>(null);

  const question = assessmentTest.questions[questionIndex];
  const questionPrompt = withoutTrailingPeriod(withoutInstructionPrefix(question.prompt[lang]));
  const questionHelper = question.helper ? withoutTrailingPeriod(question.helper[lang]) : null;
  const isOppositeWordQuestion = question.id === 'junior-q5';
  const renderQuestionPrompt = (value: string) =>
    value.split(/(_{2,})/).map((part, index) =>
      /^_{2,}$/.test(part) ? (
        <span
          key={`blank-${index}`}
          aria-hidden="true"
          className="mx-1 inline-block h-[0.85em] align-baseline border-b-[3px] border-solid border-current"
          style={{ width: `${part.length * 0.9}em` }}
        />
      ) : (
        <span key={`text-${index}`}>{part}</span>
      ),
    );
  const total = assessmentTest.questions.length;
  const answeredCount = Object.keys(answers).length;
  const answerReview = useMemo(
    () => getAssessmentAnswerReview(assessmentTest.questions, answers),
    [assessmentTest.questions, answers],
  );

  const currentResult = useMemo(() => {
    if (!result) return null;
    return result;
  }, [result]);

  const updateAssessmentProgress = (patch: Partial<AssessmentProgress>) => {
    updateData({ assessmentProgress: { ...data.assessmentProgress, ...patch } });
  };

  useEffect(() => {
    if (!currentResult) return;
    setResultPanel('level');
    setResultView(data.assessmentProgress.resultView);
    const timer = window.setInterval(() => {
      setResultPanel(current => current === 'level' ? 'group' : 'level');
    }, 3600);
    return () => window.clearInterval(timer);
  }, [currentResult, data.assessmentProgress.resultView]);

  const completeAssessment = (nextAnswers: Record<string, string>) => {
    // Keep the single, existing answer comparison as the source of truth.
    const correctAnswers = assessmentTest.questions.reduce((sum, item) => (
      nextAnswers[item.id] === item.correctOptionId ? sum + 1 : sum
    ), 0);
    const age = data.child.age;
    const recommendation = getMockRecommendation(age, correctAnswers);
    const { englishLevel, percentage } = determineEnglishLevel(
      age,
      correctAnswers,
      total,
      assessmentTest.testVersion,
    );
    const nextResult: AssessmentResult = {
      score: correctAnswers,
      total,
      recommendation,
      correctAnswers,
      totalQuestions: total,
      percentage,
      englishLevel,
      recommendedGroup: recommendation,
      ageGroup: assessmentTest.ageGroup,
      testVersion: assessmentTest.testVersion,
    };
    setResult(nextResult);
    updateData({
      assessment: nextResult,
      assessmentProgress: {
        started: true,
        questionIndex,
        answers: nextAnswers,
        selectedOptionId: '',
        resultView: 'summary',
      },
    });
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
    const nextQuestionIndex = questionIndex + 1;
    setQuestionIndex(nextQuestionIndex);
    updateAssessmentProgress({
      started: true,
      questionIndex: nextQuestionIndex,
      answers: nextAnswers,
      selectedOptionId: '',
    });
  };

  const handlePreviousQuestion = () => {
    if (questionIndex === 0) return;
    const previousQuestion = assessmentTest.questions[questionIndex - 1];
    const previousQuestionIndex = questionIndex - 1;
    const previousSelectedOptionId = answers[previousQuestion.id] ?? '';
    setSelected(previousSelectedOptionId);
    setQuestionIndex(previousQuestionIndex);
    updateAssessmentProgress({ questionIndex: previousQuestionIndex, selectedOptionId: previousSelectedOptionId });
  };

  const resetGame = () => {
    setQuestionIndex(0);
    setAnswers({});
    setSelected('');
    setResult(null);
    updateData({
      assessment: null,
      assessmentProgress: { started: false, questionIndex: 0, answers: {}, selectedOptionId: '', resultView: 'summary' },
    });
  };

  const playQuestionAudio = () => {
    if (question.audioSrc) {
      questionAudioRef.current?.pause();
      const audio = new Audio(question.audioSrc);
      questionAudioRef.current = audio;
      void audio.play();
      return;
    }

    if (!question.audioText || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question.audioText);
    utterance.lang = 'en-GB';
    window.speechSynthesis.speak(utterance);
  };

  if (!started) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <div className="relative mx-auto mt-10 mb-12 flex h-20 w-24 translate-y-5 items-center justify-center" aria-hidden="true">
          <img src={ASSESSMENT_GAMEPAD_SRC} alt="" className="h-20 w-24 object-contain drop-shadow-lg" />
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
                <img src={ASSESSMENT_STARS_SRC} alt="" className="mb-2 h-9 w-9 object-contain" aria-hidden="true" />
                <p className="font-body text-sm font-black leading-relaxed text-purple-600 dark:text-purple-100">
                  {t(lang, key as never)}
                </p>
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setStarted(true);
            updateAssessmentProgress({ started: true });
          }}
          className="trial-booking-primary-button mt-6 inline-flex w-full items-center justify-center gap-3 rounded-3xl px-8 py-4 font-display text-base font-black shadow-xl shadow-purple-200/60 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 dark:shadow-purple-950/50 sm:w-auto"
        >
          {t(lang, 'trial_assessment_start')}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (currentResult) {
    return (
      <div className="mx-auto mb-10 max-w-3xl">
        <div className="rounded-[2rem] border border-white/80 bg-white/90 p-5 text-center shadow-2xl shadow-purple-100/60 backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/90 dark:shadow-black/30 sm:min-h-[420px] sm:p-6">
          <div className="mx-auto mb-4 flex h-16 w-16 scale-[1.25] items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-green-300 to-blue-400 text-white shadow-xl">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <h2 className="font-display text-2xl font-black leading-tight text-purple-700 dark:text-purple-100 sm:text-3xl">
            {t(lang, 'trial_assessment_result_title')}
          </h2>
          <div className="mx-auto mt-4 flex h-[108px] max-w-md items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 p-4 dark:from-white/10 dark:via-white/10 dark:to-white/10" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              {resultPanel === 'level' ? (
                <motion.div
                  key="level"
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -14, scale: 0.97 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  <p className="font-body text-xs font-black uppercase tracking-[0.18em] text-pink-500 dark:text-pink-200">
                    {t(lang, 'trial_english_level_title')}
                  </p>
                  <p className="mt-1.5 font-display text-3xl font-black text-purple-700 dark:text-purple-100">
                    {currentResult.englishLevel}
                  </p>
                  <p className="mt-2 font-body text-sm font-black text-purple-600 dark:text-purple-100">
                    {t(lang, 'trial_correct_answers')
                      .replace('{correct}', String(currentResult.correctAnswers))
                      .replace('{total}', String(currentResult.totalQuestions))}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="group"
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -14, scale: 0.97 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  <p className="font-body text-xs font-black uppercase tracking-[0.18em] text-pink-500 dark:text-pink-200">
                    {t(lang, 'trial_recommended_group')}
                  </p>
                  <p className="mt-2 font-display text-3xl font-black text-purple-700 dark:text-purple-100">
                    {currentResult.recommendedGroup}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <p className="mx-auto mt-4 max-w-xl font-body text-sm font-bold leading-relaxed text-purple-500 dark:text-purple-200">
            {t(lang, `trial_level_description_${currentResult.englishLevel}` as never)}
          </p>
          <p className="mx-auto mt-1 max-w-xl font-body text-xs font-bold leading-relaxed text-purple-400 dark:text-purple-200">
            {t(lang, 'trial_final_level_note')}
          </p>
          {resultView === 'review' && (
          <section className="mt-6 border-t border-purple-100 pt-6 text-left dark:border-purple-700" aria-labelledby="assessment-review-title">
            <h3 id="assessment-review-title" className="font-display text-xl font-black text-purple-700 dark:text-purple-100">
              {t(lang, 'trial_assessment_review_title')}
            </h3>
            <p className="mt-1 font-body text-sm font-bold text-purple-400 dark:text-purple-200">
              {t(lang, 'trial_assessment_review_intro')}
            </p>
            <div className="mt-4 space-y-3">
              {answerReview.map(({ question: reviewQuestion, selectedOptionId, correct }, index) => {
                const selectedOption = reviewQuestion.options.find(option => option.id === selectedOptionId);
                const correctOption = reviewQuestion.options.find(option => option.id === reviewQuestion.correctOptionId);
                return (
                  <article
                    key={reviewQuestion.id}
                    data-testid={`assessment-review-${reviewQuestion.id}`}
                    className={`rounded-3xl border p-4 ${
                      correct
                        ? 'border-green-200 bg-green-50/70 dark:border-green-700/70 dark:bg-green-950/20'
                        : 'border-rose-200 bg-rose-50/70 dark:border-rose-700/70 dark:bg-rose-950/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-body text-xs font-black uppercase tracking-[0.12em] text-purple-500 dark:text-purple-100">
                        {t(lang, 'trial_question')} {index + 1}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 font-body text-xs font-black ${correct ? 'text-green-600 dark:text-green-300' : 'text-rose-600 dark:text-rose-300'}`}>
                        {correct ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
                        {correct ? t(lang, 'trial_answer_correct') : t(lang, 'trial_answer_incorrect')}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-line font-body text-sm font-black leading-relaxed text-purple-700 dark:text-purple-100">
                      {reviewQuestion.prompt[lang]}
                    </p>
                    <p className="mt-2 font-body text-sm font-bold text-purple-600 dark:text-purple-100">
                      <span className="text-purple-400 dark:text-purple-200">{t(lang, 'trial_your_answer')}:</span>{' '}
                      {selectedOption?.label[lang] ?? t(lang, 'trial_not_provided')}
                    </p>
                    {!correct && correctOption && (
                      <p className="mt-1 font-body text-sm font-bold text-green-700 dark:text-green-300">
                        <span className="text-green-600/70 dark:text-green-300/70">{t(lang, 'trial_correct_answer')}:</span>{' '}
                        {correctOption.label[lang]}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
          )}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
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
              onClick={resultView === 'summary'
                ? () => {
                    setResultView('review');
                    updateAssessmentProgress({ resultView: 'review' });
                  }
                : onNext}
              className="trial-booking-primary-button flex-1 rounded-3xl px-5 py-3 font-display text-sm font-black shadow-xl shadow-purple-200/60 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 dark:shadow-purple-950/50"
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
        <div className="flex items-center gap-2">
          {questionIndex > 0 && (
            <button
              type="button"
              onClick={handlePreviousQuestion}
              aria-label={t(lang, 'trial_back')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-purple-100 bg-white text-purple-500 transition hover:-translate-y-0.5 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <span className="font-body text-sm font-black text-purple-500 dark:text-purple-100">
            {t(lang, 'trial_question')} {questionIndex + 1} / {total}
          </span>
        </div>
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
          {questionHelper && isOppositeWordQuestion && (
            <p className="mb-2 font-display text-2xl font-black text-purple-700 dark:text-purple-100 sm:text-3xl">
              {questionHelper}
            </p>
          )}
          {question.illustration ? (
            <>
              <h2 className="whitespace-pre-line font-display text-2xl font-black text-purple-700 dark:text-purple-100 sm:text-3xl">
                {renderQuestionPrompt(questionPrompt)}
              </h2>
              <img
                src={question.illustration}
                alt=""
                aria-hidden="true"
                className="mx-auto mt-3 h-36 w-56 object-contain sm:h-40 sm:w-64"
              />
            </>
          ) : (
            <h2 className="whitespace-pre-line font-display text-2xl font-black text-purple-700 dark:text-purple-100 sm:text-3xl">
              {renderQuestionPrompt(questionPrompt)}
            </h2>
          )}
          {questionHelper && !isOppositeWordQuestion && (
            <p className="mt-2 font-body text-sm font-bold text-purple-400 dark:text-purple-200">
              {questionHelper}
            </p>
          )}
          {question.audioText && (
            <button
              type="button"
              onClick={playQuestionAudio}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-purple-100 bg-purple-50 px-4 py-2 font-body text-sm font-black text-purple-600 transition hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              {t(lang, 'trial_listen')}
            </button>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {question.options.map(option => {
              const active = selected === option.id;
              const isBalloonOption = option.id.endsWith('-balloon');
              const isStarOption = Array.isArray(option.visual);
              const isImageChoice = question.type === 'image_choice';
              const isActivityOwlOption = question.id === 'kids-q6';
              const isBallPositionOption = question.id === 'kids-q19';
              const isLampBookOption = question.id === 'junior-q22';
              const isClothingOption = question.id === 'junior-q24';
              const isPlaceStickerOption = ['library', 'shop', 'hospital'].includes(option.id);
              const hideOptionLabel = isImageChoice || isBalloonOption || isStarOption || isBallPositionOption || isLampBookOption || isClothingOption;
              const optionLabel = withoutTrailingPeriod(option.label[lang]);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelected(option.id);
                    updateAssessmentProgress({ started: true, selectedOptionId: option.id });
                  }}
                  className={`relative rounded-3xl border p-4 text-center transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 ${
                    active
                      ? 'scale-[1.01] border-pink-300 bg-gradient-to-br from-pink-100 to-blue-100 shadow-xl shadow-purple-100/70 ring-2 ring-pink-100 dark:border-pink-300 dark:from-white/20 dark:to-white/10 dark:ring-pink-300/30'
                      : 'border-purple-100 bg-white/80 hover:-translate-y-0.5 hover:border-pink-200 hover:bg-pink-50 dark:border-purple-700 dark:bg-white/10 dark:hover:bg-white/15'
                  }`}
                  aria-pressed={active}
                  aria-label={hideOptionLabel ? optionLabel : undefined}
                >
                  {active && (
                    <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-pink-500 dark:text-pink-200" aria-hidden="true" />
                  )}
                  {option.visual && (
                    isStarOption ? (
                      <span className="mx-auto flex h-20 items-center justify-center -space-x-2" aria-hidden="true">
                        {option.visual.map((starSrc, index) => (
                          <img key={`${option.id}-${index}`} src={starSrc} alt="" className="h-11 w-11 object-contain" />
                        ))}
                      </span>
                    ) : option.visual.startsWith('/') ? (
                      <img
                        src={option.visual}
                        alt=""
                        aria-hidden="true"
                        className={`mx-auto w-full object-contain ${
                          isBallPositionOption
                            ? 'h-28 max-w-[12rem]'
                            : isLampBookOption
                              ? 'h-28 max-w-[12rem]'
                            : isClothingOption
                              ? 'h-20 max-w-[8rem] sm:h-24 sm:max-w-[9rem]'
                            : isPlaceStickerOption
                              ? 'h-20 max-w-[7.5rem]'
                            : isBalloonOption
                              ? 'h-20 max-w-[5.5rem] scale-[1.2]'
                              : 'mb-2 h-14 max-w-[7.5rem]'
                        } ${
                          isActivityOwlOption
                            ? 'scale-[1.5]'
                            : option.id === 'bear'
                            ? 'scale-125'
                            : option.id === 'banana'
                              ? 'scale-[1.05]'
                              : ['apple', 'car', 'ball', 'train'].includes(option.id)
                              ? 'scale-[1.15]'
                              : ''
                        }`}
                      />
                    ) : (
                      <span className="mb-2 block text-5xl">{option.visual}</span>
                    )
                  )}
                  {!hideOptionLabel && (
                    <span className="font-display text-base font-black text-purple-700 dark:text-purple-100">
                      {optionLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleNextQuestion}
            disabled={!selected}
            className="trial-booking-primary-button mt-6 w-full rounded-3xl px-8 py-4 font-display text-base font-black shadow-xl shadow-purple-200/60 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:shadow-purple-950/50"
          >
            {questionIndex >= total - 1 ? t(lang, 'trial_assessment_finish') : t(lang, 'trial_next_question')}
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
