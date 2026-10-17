import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Mic, Pause, Play, RotateCcw, Volume2, X } from 'lucide-react';
import type { DictWord } from '../lib/dictionary';
import { playDictionaryWordAudio, stopDictionaryAudio } from '../lib/dictionaryAudio';
import {
  alternateExercise,
  answerMatches,
  buildTranslationOptions,
  buildWordOptions,
  buildReviewQueue,
  completeReviewSession,
  DEFAULT_REVIEW_SESSION_SIZE,
  loadLocalReviewDays,
  loadReviewDays,
  loadReviewProgress,
  normalizeReviewAnswer,
  recordLocalReviewDay,
  ReviewItem,
  ReviewSessionHandle,
  ReviewSessionKind,
  startReviewSession,
  submitReviewAnswer,
} from '../lib/dailyReview';
import { currentWeekDayKeys, dictionaryStreak } from '../lib/dictionaryStreak';
import type { Lang } from '../lib/i18n';
import { WorkbookAssetImage } from './WorkbookAssetImage';

type AnswerPhase = 'idle' | 'answering' | 'checking' | 'feedback' | 'transition';
type ReviewScreen = 'loading' | 'empty' | 'done-today' | 'review' | 'complete';
type DeckPhase = 'idle' | 'lift' | 'out' | 'reinsert';
type DeckDirection = -1 | 1;
type DeckRole = 0 | 1 | 2;

interface BrowserSpeechRecognitionEvent {
  results?: ArrayLike<{ 0?: { transcript?: string } }>;
}

interface BrowserSpeechRecognitionErrorEvent {
  error?: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

const ASSET = {
  target: '/dashboard/practice-target.png',
  globe: '/dashboard/dictionary-progress.png',
  fire: '/dashboard/dictionary-streak-fire.png',
  tipIcon: '/backgrounds/theory-tip-bulb.png',
  tipArtwork: '/dashboard/daily-review-tip-bulb.png',
};

const WEEKDAY_LABELS = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  ua: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
} as const;

const CARD_POSITIONS = {
  active: { x: 0, y: 0, scale: 1, rotate: 0, rotateY: 0, zIndex: 30 },
  back1: { x: 10, y: 12, scale: 0.992, rotate: 0.65, rotateY: 0, zIndex: 20 },
  back2: { x: -8, y: 22, scale: 0.984, rotate: -0.8, rotateY: 0, zIndex: 10 },
} as const;

const CARD_SURFACES = [
  { name: 'white', background: '#FEFEFE', borderColor: '#eee7f5' },
] as const;

function deckAnimation(role: DeckRole, phase: DeckPhase, direction: DeckDirection) {
  if (phase === 'lift' && role === 0) return { ...CARD_POSITIONS.active, y: -10, scale: 1.008, rotate: direction * 0.35 };
  if (phase === 'out') {
    if (role === 0) return { ...CARD_POSITIONS.active, x: direction > 0 ? '64%' : '-64%', y: -20, scale: 0.992, rotate: direction * 5, rotateY: direction * -4 };
    if (role === 1) return { ...CARD_POSITIONS.active, scale: 1.008 };
    return CARD_POSITIONS.back1;
  }
  if (phase === 'reinsert') {
    if (role === 0) return {
      ...CARD_POSITIONS.back2,
      x: direction > 0 ? -8 : 8,
      rotate: direction > 0 ? -0.8 : 0.8,
      zIndex: 5,
    };
    if (role === 1) return CARD_POSITIONS.active;
    return CARD_POSITIONS.back1;
  }
  return role === 0 ? CARD_POSITIONS.active : role === 1 ? CARD_POSITIONS.back1 : CARD_POSITIONS.back2;
}

function deckTransition(phase: DeckPhase, reducedMotion: boolean) {
  if (reducedMotion) return { duration: 0.14, ease: 'easeOut' as const };
  if (phase === 'lift') return { duration: 0.14, ease: [0.22, 0.72, 0.28, 1] as const };
  if (phase === 'out') return { duration: 0.38, ease: [0.2, 0.72, 0.18, 1] as const };
  if (phase === 'reinsert') return { duration: 0.42, ease: [0.42, 0, 0.2, 1] as const };
  return { duration: 0.22, ease: [0.22, 0.72, 0.28, 1] as const };
}

function wrappedIndex(value: number, length: number) {
  return ((value % length) + length) % length;
}

function adjacentPendingIndex(queue: ReviewItem[], completedItemIds: Set<string>, fromIndex: number, direction: DeckDirection) {
  if (queue.length < 2) return null;
  for (let offset = 1; offset < queue.length; offset += 1) {
    const candidateIndex = wrappedIndex(fromIndex + direction * offset, queue.length);
    if (!completedItemIds.has(queue[candidateIndex].id)) return candidateIndex;
  }
  return null;
}

const REVIEW_COPY = {
  ru: {
    title: 'Ежедневное повторение', subtitle: 'Повторяй слова каждый день и закрепляй знания!', word: 'Слово', of: 'из',
    progress: 'Твой прогресс', correct: 'Правильно', errors: 'Ошибок', reviewed: 'слов повторено', streak: 'Серия дней', days: 'дней подряд',
    tip: 'Полезный совет', tipText: 'Произноси слова вслух — это помогает лучше их запоминать!',
    translationTitle: 'Выбери перевод', translationQuestion: 'Что означает это слово?', speakingTitle: 'Повтори слово',
    pictureTitle: 'Выбери по картинке', pictureQuestion: 'Что изображено на картинке?',
    speakingPrompt: 'А теперь произнеси его', speak: 'Нажми и скажи', listening: 'Идёт запись…', stopRecording: 'Завершить запись', listenAgain: 'Послушать ещё раз', yourRecording: 'Твоя запись', playRecording: 'Прослушать запись', pauseRecording: 'Пауза',
    buildingTitle: 'Собери слово', check: 'Проверить', great: 'Отлично!', tryAgain: 'Попробуй ещё раз', correctAnswer: 'Правильный ответ',
    fixLetters: 'Проверь подсвеченные позиции и попробуй ещё раз.', hint: 'Подсказка', next: 'Перейти дальше',
    micDenied: 'Нет доступа к микрофону. Разреши его в браузере и попробуй снова.', micUnavailable: 'Распознавание речи недоступно в этом браузере.', recordingUnavailable: 'Запись голоса недоступна в этом браузере.',
    noSpeech: 'Я не расслышал слово. Попробуй ещё раз.', emptyTitle: 'Пока нечего повторять', emptyText: 'Сначала изучи несколько слов в словарике.',
    doneTitle: 'На сегодня всё готово!', doneText: 'Ты отлично справился.', back: 'Вернуться в словарик', completed: 'Повторение завершено!',
    known: 'Отлично знаешь', practice: 'Нужно закрепить', difficult: 'Сложные слова', repeat: 'Повторить сложные', finish: 'Завершить',
    persistenceWarning: 'Результат этой сессии сохранён только на этом устройстве.',
  },
  en: {
    title: 'Daily review', subtitle: 'Review words every day and make your knowledge stick!', word: 'Word', of: 'of',
    progress: 'Your progress', correct: 'Correct', errors: 'Mistakes', reviewed: 'words reviewed', streak: 'Day streak', days: 'days in a row',
    tip: 'Helpful tip', tipText: 'Say the words aloud — it helps you remember them better!',
    translationTitle: 'Choose the translation', translationQuestion: 'What does this word mean?', speakingTitle: 'Repeat the word',
    pictureTitle: 'Choose by picture', pictureQuestion: 'What is shown in the picture?',
    speakingPrompt: 'Now say it aloud', speak: 'Press and speak', listening: 'Recording…', stopRecording: 'Stop recording', listenAgain: 'Listen again', yourRecording: 'Your recording', playRecording: 'Play recording', pauseRecording: 'Pause',
    buildingTitle: 'Build the word', check: 'Check', great: 'Great job!', tryAgain: 'Try again', correctAnswer: 'Correct answer',
    fixLetters: 'Check the highlighted positions and try again.', hint: 'Hint', next: 'Continue',
    micDenied: 'Microphone access is blocked. Allow it in your browser and try again.', micUnavailable: 'Speech recognition is not available in this browser.', recordingUnavailable: 'Voice recording is not available in this browser.',
    noSpeech: 'I could not hear the word. Please try again.', emptyTitle: 'Nothing to review yet', emptyText: 'Learn a few words in your dictionary first.',
    doneTitle: 'All done for today!', doneText: 'You did a wonderful job.', back: 'Back to dictionary', completed: 'Review complete!',
    known: 'Know well', practice: 'Needs practice', difficult: 'Difficult words', repeat: 'Repeat difficult words', finish: 'Finish',
    persistenceWarning: 'This session was saved only on this device.',
  },
  ua: {
    title: 'Щоденне повторення', subtitle: 'Повторюй слова щодня та закріплюй знання!', word: 'Слово', of: 'з',
    progress: 'Твій прогрес', correct: 'Правильно', errors: 'Помилок', reviewed: 'слів повторено', streak: 'Серія днів', days: 'днів поспіль',
    tip: 'Корисна порада', tipText: 'Вимовляй слова вголос — це допомагає краще їх запамʼятовувати!',
    translationTitle: 'Обери переклад', translationQuestion: 'Що означає це слово?', speakingTitle: 'Повтори слово',
    pictureTitle: 'Обери за зображенням', pictureQuestion: 'Що зображено на картинці?',
    speakingPrompt: 'А тепер вимов його', speak: 'Натисни й скажи', listening: 'Триває запис…', stopRecording: 'Завершити запис', listenAgain: 'Послухати ще раз', yourRecording: 'Твій запис', playRecording: 'Прослухати запис', pauseRecording: 'Пауза',
    buildingTitle: 'Склади слово', check: 'Перевірити', great: 'Чудово!', tryAgain: 'Спробуй ще раз', correctAnswer: 'Правильна відповідь',
    fixLetters: 'Перевір підсвічені позиції та спробуй ще раз.', hint: 'Підказка', next: 'Перейти далі',
    micDenied: 'Немає доступу до мікрофона. Дозволь його в браузері й спробуй ще раз.', micUnavailable: 'Розпізнавання мовлення недоступне в цьому браузері.', recordingUnavailable: 'Запис голосу недоступний у цьому браузері.',
    noSpeech: 'Я не почув слово. Спробуй ще раз.', emptyTitle: 'Поки немає чого повторювати', emptyText: 'Спочатку вивчи кілька слів у словничку.',
    doneTitle: 'На сьогодні все готово!', doneText: 'Ти чудово впорався.', back: 'Повернутися до словничка', completed: 'Повторення завершено!',
    known: 'Чудово знаєш', practice: 'Треба закріпити', difficult: 'Складні слова', repeat: 'Повторити складні', finish: 'Завершити',
    persistenceWarning: 'Результат цієї сесії збережено лише на цьому пристрої.',
  },
} as const;

function WordArtwork({ word, className = '' }: { word: DictWord; className?: string }) {
  return <div className={`flex items-center justify-center ${className}`}>
    {word.imageUrl
      ? <WorkbookAssetImage path={word.imageUrl} className="h-full w-full object-contain" surface="DailyReview.WordArtwork" fallback={word.emoji} />
      : <span className="select-none text-[clamp(5rem,10vw,8rem)] leading-none" aria-label={word.word}>{word.emoji || '✨'}</span>}
  </div>;
}

function AudioButton({ word, label, compact = false }: { word: DictWord; label: string; compact?: boolean }) {
  const [playing, setPlaying] = useState(false);
  return <button
    type="button"
    aria-label={`${label}: ${word.word}`}
    aria-pressed={playing}
    onClick={() => void playDictionaryWordAudio(word, setPlaying)}
    className={`relative inline-flex items-center justify-center rounded-2xl transition duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 ${compact ? 'h-10 w-10' : 'h-11 w-11'} ${playing ? 'scale-105 bg-gradient-to-br from-violet-600 via-purple-500 to-fuchsia-500 text-white shadow-[0_0_0_5px_rgba(217,70,239,0.12),0_10px_24px_rgba(168,85,247,0.4)] ring-1 ring-fuchsia-200' : 'bg-white text-purple-600 shadow-[0_7px_18px_rgba(110,67,170,0.18)] ring-1 ring-purple-100'}`}
  >
    {playing && <>
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-fuchsia-300"
        animate={{ scale: [0.88, 1.35], opacity: [0.65, 0] }}
        transition={{ duration: 1.15, repeat: Infinity, ease: 'easeOut' }}
      />
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-violet-300"
        animate={{ scale: [0.88, 1.35], opacity: [0.55, 0] }}
        transition={{ duration: 1.15, repeat: Infinity, ease: 'easeOut', delay: 0.48 }}
      />
    </>}
    <motion.span
      className="relative z-10 flex items-center justify-center"
      animate={playing ? { scale: [1, 1.18, 1], rotate: [0, -7, 7, 0] } : { scale: 1, rotate: 0 }}
      transition={playing ? { duration: 0.68, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
    >
      <Volume2 className={compact ? 'h-[1.15rem] w-[1.15rem]' : 'h-5 w-5'} />
    </motion.span>
  </button>;
}

function Feedback({ correct, message }: { correct: boolean; message: string }) {
  return <motion.div
    role="status"
    aria-live="polite"
    initial={{ opacity: 0, y: 5, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    className={`mx-auto mt-4 flex w-fit items-center gap-2 rounded-full px-5 py-2.5 font-display text-sm font-black ${correct ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}
  >{correct ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}{message}</motion.div>;
}

function RecordedAudioButton({ url, lang }: { url: string; lang: Lang }) {
  const ui = REVIEW_COPY[lang];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, [url]);

  const toggle = () => {
    if (!url) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    const audio = audioRef.current || new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  return <motion.button
    type="button"
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    onClick={toggle}
    aria-label={playing ? ui.pauseRecording : ui.playRecording}
    aria-pressed={playing}
    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-fuchsia-100 bg-fuchsia-50/80 px-4 font-display text-xs font-black text-fuchsia-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-fuchsia-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-100 sm:text-sm"
  >
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white">{playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}</span>
    {playing ? ui.pauseRecording : ui.yourRecording}
    <span
      aria-hidden="true"
      data-testid="recorded-audio-wave"
      data-playing={playing}
      className="flex h-5 items-center gap-0.5"
    >
      {[0, 1, 2, 3, 4].map((bar) => (
        <motion.span
          key={bar}
          className="w-0.5 rounded-full bg-current"
          animate={playing
            ? { height: [5 + (bar % 2) * 2, 17 - Math.abs(2 - bar) * 2, 7, 14 - Math.abs(2 - bar), 5 + (bar % 2) * 2] }
            : { height: 6 + Math.abs(2 - bar) * 2 }}
          transition={playing
            ? { duration: 0.72, repeat: Infinity, ease: 'easeInOut', delay: bar * 0.07 }
            : { duration: 0.18 }}
        />
      ))}
    </span>
  </motion.button>;
}

function TranslationExercise({ item, words, phase, selected, result, onSelect, lang }: {
  item: ReviewItem; words: DictWord[]; phase: AnswerPhase; selected: string; result: boolean | null;
  onSelect: (translation: string) => void; lang: Lang;
}) {
  const ui = REVIEW_COPY[lang];
  const options = useMemo(() => buildTranslationOptions(item, words), [item, words]);
  const disabled = phase !== 'idle';
  return <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-5 py-7 text-center sm:px-9">
    <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-8 h-44 w-44 rounded-full bg-fuchsia-100/45 blur-3xl" />
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-10 h-52 w-52 rounded-full bg-violet-100/55 blur-3xl" />
    <div className="relative z-10 flex w-full flex-col items-center">
      <motion.p
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-full border border-fuchsia-100 bg-gradient-to-r from-fuchsia-50 to-purple-50 px-4 py-2 font-display text-xs font-black uppercase tracking-[0.18em] text-fuchsia-500 shadow-sm sm:text-sm"
      >{ui.translationTitle}</motion.p>
      <div className="mt-4 flex items-center gap-3"><h2 className="font-display text-[clamp(2.25rem,5vw,3.5rem)] font-black uppercase leading-none text-purple-700 drop-shadow-[0_7px_16px_rgba(126,34,206,0.12)]">{item.word.word}</h2><AudioButton word={item.word} label={ui.listenAgain} compact /></div>
      <p className="mt-4 font-display text-sm font-black text-purple-700 sm:text-base">{ui.translationQuestion}</p>
      <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map(option => {
        const isSelected = selected === option;
        const isCorrectOption = option === item.word.translation;
        const stateClass = result !== null && isCorrectOption
          ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700 shadow-[0_10px_24px_rgba(16,185,129,0.16)]'
          : result === false && isSelected
            ? 'border-rose-300 bg-gradient-to-br from-rose-50 to-rose-100 text-rose-600 shadow-[0_10px_24px_rgba(244,63,94,0.14)]'
            : isSelected
              ? 'border-purple-400 bg-gradient-to-br from-purple-50 to-fuchsia-100 text-purple-700 shadow-[0_10px_24px_rgba(147,51,234,0.16)]'
              : 'border-purple-100 bg-gradient-to-br from-white via-white to-purple-50/80 text-purple-700 shadow-[0_7px_18px_rgba(109,40,217,0.07)] hover:border-purple-300 hover:shadow-[0_13px_26px_rgba(109,40,217,0.14)]';
        return <motion.button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(option)}
          whileHover={disabled ? undefined : { y: -3, scale: 1.015 }}
          whileTap={disabled ? undefined : { scale: 0.985 }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}
          className={`group relative min-h-14 overflow-hidden rounded-[1.25rem] border px-3 py-2.5 font-display text-sm font-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 disabled:cursor-default sm:text-base ${stateClass}`}
        >
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-transparent via-white/75 to-transparent opacity-0 transition duration-300 group-hover:translate-x-4 group-hover:opacity-100" />
          <span className="relative grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-2">
            <span aria-hidden="true" />
            <span>{option}</span>
            <span className="flex h-8 w-8 items-center justify-center">{result !== null && isCorrectOption && <Check className="h-5 w-5" />}{result === false && isSelected && !isCorrectOption && <X className="h-5 w-5" />}</span>
          </span>
        </motion.button>;
      })}
      </div>
      {result !== null && <Feedback correct={result} message={result ? ui.great : `${ui.correctAnswer}: ${item.word.translation}`} />}
    </div>
  </div>;
}

function SpeakingExercise({ item, phase, result, attempts, voiceMessage, recordedAudioUrl, onSpeak, onContinue, lang }: {
  item: ReviewItem; phase: AnswerPhase; result: boolean | null; attempts: number; voiceMessage: string;
  recordedAudioUrl: string; onSpeak: () => void; onContinue: () => void; lang: Lang;
}) {
  const ui = REVIEW_COPY[lang];
  const listening = phase === 'answering';
  const blocked = phase === 'checking' || phase === 'transition';
  return <div className="flex h-full flex-col items-center justify-center px-5 py-6 text-center sm:px-9" data-testid="daily-review-speaking" data-voice-attempts={attempts}>
    <div className="relative flex h-[clamp(7.8rem,17vh,9.4rem)] w-full items-center justify-center">
      <div className="absolute inset-x-[18%] bottom-2 h-10 rounded-full bg-fuchsia-200/25 blur-2xl" />
      <WordArtwork word={item.word} className="relative h-full w-full transition-transform duration-300 hover:scale-105" />
    </div>
    <div className="mt-2 flex items-center gap-2.5"><h2 className="font-display text-[clamp(2rem,4vw,2.9rem)] font-black leading-none text-purple-700">{item.word.word}</h2><AudioButton word={item.word} label={ui.listenAgain} compact /></div>
    <p className="mt-2 font-body text-sm font-800 text-slate-500 sm:text-base">{ui.speakingPrompt}</p>
    <button type="button" disabled={blocked} onClick={onSpeak} aria-label={listening ? ui.stopRecording : ui.speak} aria-pressed={listening} className={`group relative mt-4 flex min-h-[4.5rem] w-full max-w-[29rem] items-center justify-center gap-3 overflow-hidden rounded-[1.65rem] border px-5 py-3 shadow-[0_14px_32px_rgba(113,64,180,0.2)] transition duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 disabled:cursor-wait ${listening ? 'border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 via-white to-purple-50 text-purple-700' : 'border-transparent bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500 text-white hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(124,58,237,0.3)]'}`}>
      <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center transition ${listening ? 'text-fuchsia-500' : 'text-white group-hover:scale-105'}`}><Mic className={`h-7 w-7 ${listening ? 'animate-pulse' : ''}`} /></span>
      {listening && <span className="relative flex h-8 items-center gap-1" aria-hidden="true">{[0, 1, 2, 3, 4].map(bar => <motion.span key={bar} className="w-1 rounded-full bg-gradient-to-t from-violet-500 to-fuchsia-400" animate={{ height: [8, 26 - Math.abs(2 - bar) * 4, 11, 21 - Math.abs(2 - bar) * 3, 8] }} transition={{ duration: 0.95, repeat: Infinity, ease: 'easeInOut', delay: bar * 0.08 }} />)}</span>}
      <strong className="relative font-display text-base font-black leading-tight sm:text-lg">{listening ? ui.listening : ui.speak}</strong>
    </button>
    {recordedAudioUrl && <div className="mt-2"><RecordedAudioButton url={recordedAudioUrl} lang={lang} /></div>}
    {voiceMessage && <Feedback correct={result === true} message={voiceMessage} />}
    {attempts >= 3 && result !== true && <button type="button" onClick={onContinue} className="mt-3 min-h-11 rounded-full px-5 font-display text-sm font-black text-purple-500 underline decoration-purple-200 underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200">{ui.next}</button>}
  </div>;
}

function PictureChoiceExercise({ item, words, phase, selected, result, onSelect, lang }: {
  item: ReviewItem; words: DictWord[]; phase: AnswerPhase; selected: string; result: boolean | null;
  onSelect: (label: string, answer: string) => void; lang: Lang;
}) {
  const ui = REVIEW_COPY[lang];
  const options = useMemo(() => buildWordOptions(item, words), [item, words]);
  const disabled = phase !== 'idle';

  return <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-5 py-7 text-center sm:px-9" data-testid="daily-review-picture-choice">
    <div aria-hidden="true" className="pointer-events-none absolute -left-16 top-16 h-48 w-48 rounded-full bg-fuchsia-100/50 blur-3xl" />
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-12 h-56 w-56 rounded-full bg-violet-100/60 blur-3xl" />
    <div className="relative z-10 flex w-full flex-col items-center">
      <motion.p
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-full border border-fuchsia-100 bg-gradient-to-r from-fuchsia-50 to-purple-50 px-5 py-2 font-display text-xs font-black uppercase tracking-[0.18em] text-fuchsia-500 shadow-sm sm:text-sm"
      >{ui.pictureTitle}</motion.p>
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="relative mt-4 flex h-[clamp(9rem,20vh,11.5rem)] w-full max-w-[21rem] items-center justify-center"
      >
        <WordArtwork word={item.word} className="relative h-full w-full transition-transform duration-300 hover:scale-105" />
      </motion.div>
      <p className="mt-4 font-display text-sm font-black text-purple-700 sm:text-base">{ui.pictureQuestion}</p>
      <div className="mt-5 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map(option => {
          const isSelected = selected === option;
          const isCorrectOption = normalizeReviewAnswer(option) === normalizeReviewAnswer(item.word.word);
          const stateClass = result !== null && isCorrectOption
            ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700 shadow-[0_10px_24px_rgba(16,185,129,0.16)]'
            : result === false && isSelected
              ? 'border-rose-300 bg-gradient-to-br from-rose-50 to-rose-100 text-rose-600 shadow-[0_10px_24px_rgba(244,63,94,0.14)]'
              : isSelected
                ? 'border-purple-400 bg-gradient-to-br from-purple-50 to-fuchsia-100 text-purple-700 shadow-[0_10px_24px_rgba(147,51,234,0.16)]'
                : 'border-purple-100 bg-gradient-to-br from-white via-white to-purple-50/80 text-purple-700 shadow-[0_7px_18px_rgba(109,40,217,0.07)] hover:border-purple-300 hover:shadow-[0_13px_26px_rgba(109,40,217,0.14)]';
          return <motion.button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option, option)}
            whileHover={disabled ? undefined : { y: -3, scale: 1.015 }}
            whileTap={disabled ? undefined : { scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            className={`group relative min-h-14 overflow-hidden rounded-[1.25rem] border px-3 py-2.5 font-display text-sm font-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 disabled:cursor-default sm:text-base ${stateClass}`}
          >
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-transparent via-white/75 to-transparent opacity-0 transition duration-300 group-hover:translate-x-4 group-hover:opacity-100" />
            <span className="relative grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-2">
              <span aria-hidden="true" />
              <span>{option}</span>
              <span className="flex h-8 w-8 items-center justify-center">{result !== null && isCorrectOption && <Check className="h-5 w-5" />}{result === false && isSelected && !isCorrectOption && <X className="h-5 w-5" />}</span>
            </span>
          </motion.button>;
        })}
      </div>
      {result !== null && <Feedback correct={result} message={result ? ui.great : `${ui.correctAnswer}: ${item.word.word}`} />}
    </div>
  </div>;
}

function ProgressWidget({ percent, correct, errors, completed, total, lang }: { percent: number; correct: number; errors: number; completed: number; total: number; lang: Lang }) {
  const ui = REVIEW_COPY[lang];
  return <section className="relative min-h-[220px] overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-500 via-purple-400 to-fuchsia-300 p-6 text-white shadow-[0_18px_36px_rgba(107,70,180,0.2)]" data-testid="daily-review-progress-widget">
    <h2 className="relative z-10 font-display text-xl font-black">{ui.progress}</h2>
    <div className="relative z-10 mt-5 flex items-center gap-5">
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#a7f36b ${percent}%, rgba(255,255,255,.28) ${percent}% 100%)` }}><div className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-purple-400/95 font-display text-2xl font-black">{percent}%</div></div>
      <div className="space-y-3 font-body text-sm font-800"><p className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400"><Check className="h-4 w-4" /></span><strong>{correct}</strong> {ui.correct}</p><p className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-400"><X className="h-4 w-4" /></span><strong>{errors}</strong> {ui.errors}</p></div>
    </div>
    <p className="relative z-10 mt-5 font-body text-sm font-800">{completed} {ui.of} {total} {ui.reviewed}</p>
    <img src={ASSET.globe} alt="" aria-hidden="true" className="absolute -bottom-4 -right-4 h-32 w-32 object-contain drop-shadow-xl" />
  </section>;
}

function SideWidgets({ percent, correct, errors, completed, total, reviewDays, lang }: { percent: number; correct: number; errors: number; completed: number; total: number; reviewDays: Set<string>; lang: Lang }) {
  const ui = REVIEW_COPY[lang];
  const streak = dictionaryStreak(reviewDays);
  const week = currentWeekDayKeys();
  return <aside className="relative z-0 isolate grid gap-4 md:grid-cols-3 xl:grid-cols-1">
    <ProgressWidget percent={percent} correct={correct} errors={errors} completed={completed} total={total} lang={lang} />
    <section className="relative min-h-[178px] overflow-hidden rounded-[2rem] border border-purple-100 bg-white/85 p-6 shadow-[0_14px_32px_rgba(99,67,150,0.12)]">
      <h2 className="font-display text-xl font-black text-purple-700">{ui.streak}</h2>
      <div className="mt-3 flex items-center gap-3"><img src={ASSET.fire} alt="" aria-hidden="true" className="h-14 w-14 object-contain" /><strong className="font-display text-4xl font-black text-purple-700">{streak}</strong><span className="font-body text-xs font-800 text-slate-500">{ui.days}</span></div>
      <div className="mt-4 grid grid-cols-7 gap-1">{WEEKDAY_LABELS[lang].map((label, index) => { const active = reviewDays.has(week[index]); return <div key={week[index]} className="text-center"><span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs ${active ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white' : 'border border-purple-100 bg-purple-50 text-purple-200'}`}>{active ? <Check className="h-4 w-4" /> : ''}</span><span className="mt-1 block font-body text-[10px] font-800 text-slate-500">{label}</span></div>; })}</div>
    </section>
    <section className="relative min-h-[170px] overflow-hidden rounded-[2rem] border border-purple-100 bg-gradient-to-br from-white via-white to-amber-50/55 p-6 shadow-[0_14px_32px_rgba(99,67,150,0.12)]">
      <h2 className="relative z-10 flex items-center gap-0 font-display text-lg font-black text-purple-700"><img src={ASSET.tipIcon} alt="" aria-hidden="true" className="h-10 w-10 shrink-0 scale-[1.2] object-contain" /><span className="-ml-1">{ui.tip}</span></h2>
      <p className="relative z-10 mt-3 max-w-[64%] font-body text-sm font-800 leading-6 text-slate-500">{ui.tipText}</p>
      <img src={ASSET.tipArtwork} alt="" aria-hidden="true" className="absolute bottom-2 right-2 w-[7.5rem] rotate-[2deg] object-contain drop-shadow-[0_10px_16px_rgba(126,62,201,0.18)]" />
    </section>
  </aside>;
}

export default function DailyReview({ userId, lang, words, learnedIds, onClose, preview = false, sessionSize = DEFAULT_REVIEW_SESSION_SIZE }: {
  userId: string; lang: Lang; words: DictWord[]; learnedIds: Set<string>; onClose: () => void; preview?: boolean; sessionSize?: number;
}) {
  const ui = REVIEW_COPY[lang];
  const reduceMotion = useReducedMotion();
  const [screen, setScreen] = useState<ReviewScreen>('loading');
  const [phase, setPhase] = useState<AnswerPhase>('idle');
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [session, setSession] = useState<ReviewSessionHandle | null>(null);
  const [sessionKind, setSessionKind] = useState<ReviewSessionKind>('daily');
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [result, setResult] = useState<boolean | null>(null);
  const [completedWords, setCompletedWords] = useState<Set<string>>(new Set());
  const [completedItemIds, setCompletedItemIds] = useState<Set<string>>(new Set());
  const [correctWords, setCorrectWords] = useState<Set<string>>(new Set());
  const [mistakeWords, setMistakeWords] = useState<Set<string>>(new Set());
  const [attemptCount, setAttemptCount] = useState(0);
  const [voiceAttempts, setVoiceAttempts] = useState(0);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [recordedAudioUrl, setRecordedAudioUrl] = useState('');
  const [reviewDays, setReviewDays] = useState<Set<string>>(() => loadLocalReviewDays(userId));
  const [persistedCompletion, setPersistedCompletion] = useState(true);
  const [deckPhase, setDeckPhase] = useState<DeckPhase>('idle');
  const [deckDirection, setDeckDirection] = useState<DeckDirection>(1);
  const finishStarted = useRef(false);
  const deckTransitionStarted = useRef(false);
  const queueRef = useRef<ReviewItem[]>([]);
  const indexRef = useRef(0);
  const completedItemIdsRef = useRef<Set<string>>(new Set());
  const feedbackTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const voiceTimeoutRef = useRef<number | null>(null);
  const recordedAudioUrlRef = useRef('');
  const timers = useRef<number[]>([]);
  const currentItem = queue[index];
  const deckItems = useMemo(() => {
    if (!currentItem || !queue.length) return [];
    const direction = deckPhase === 'idle' ? 1 : deckDirection;
    const visible = Array.from({ length: 3 }, (_, slot) => {
      const queueIndex = wrappedIndex(index + slot * direction, queue.length);
      return { item: queue[queueIndex], queueIndex };
    });
    const occurrences = new Map<string, number>();
    return visible.map(({ item, queueIndex }) => {
      const occurrence = occurrences.get(item.id) || 0;
      occurrences.set(item.id, occurrence + 1);
      return {
        item,
        layerKey: occurrence === 0 ? item.id : `${item.id}:deck-copy-${occurrence}`,
        surface: CARD_SURFACES[queueIndex % CARD_SURFACES.length],
      };
    });
  }, [currentItem, deckDirection, deckPhase, index, queue]);
  const previousCardIndex = useMemo(() => adjacentPendingIndex(queue, completedItemIds, index, -1), [completedItemIds, index, queue]);
  const nextCardIndex = useMemo(() => adjacentPendingIndex(queue, completedItemIds, index, 1), [completedItemIds, index, queue]);
  const targetWordIds = useMemo(() => new Set(queue.map(item => item.word.id)), [queue]);
  const total = Math.max(1, targetWordIds.size || Math.min(sessionSize, learnedIds.size));
  const completed = Math.min(total, completedWords.size);
  const percent = Math.round((completed / total) * 100);
  const cleanCorrectCount = [...correctWords].filter(id => !mistakeWords.has(id)).length;

  const replaceRecordedAudio = useCallback((url = '') => {
    if (recordedAudioUrlRef.current) URL.revokeObjectURL(recordedAudioUrlRef.current);
    recordedAudioUrlRef.current = url;
    setRecordedAudioUrl(url);
  }, []);

  const stopVoiceCapture = useCallback(() => {
    if (voiceTimeoutRef.current !== null) window.clearTimeout(voiceTimeoutRef.current);
    voiceTimeoutRef.current = null;
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    }
    recognitionRef.current = null;
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state === 'recording') recorder.stop();
    }
    mediaRecorderRef.current = null;
    microphoneStreamRef.current?.getTracks().forEach(track => track.stop());
    microphoneStreamRef.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(timer => window.clearTimeout(timer));
    timers.current = [];
    feedbackTimerRef.current = null;
  }, []);

  useEffect(() => () => {
    clearTimers();
    stopDictionaryAudio();
    stopVoiceCapture();
    if (recordedAudioUrlRef.current) URL.revokeObjectURL(recordedAudioUrlRef.current);
  }, [clearTimers, stopVoiceCapture]);

  const beginQueue = useCallback(async (items: ReviewItem[], kind: ReviewSessionKind) => {
    clearTimers();
    stopDictionaryAudio();
    stopVoiceCapture();
    replaceRecordedAudio();
    finishStarted.current = false;
    deckTransitionStarted.current = false;
    setDeckPhase('idle');
    setDeckDirection(1);
    queueRef.current = items;
    indexRef.current = 0;
    completedItemIdsRef.current = new Set();
    setQueue(items);
    setIndex(0);
    setSessionKind(kind);
    setCompletedWords(new Set());
    setCompletedItemIds(new Set());
    setCorrectWords(new Set());
    setMistakeWords(new Set());
    setAttemptCount(0);
    setPersistedCompletion(true);
    setPhase('idle');
    const handle = await startReviewSession(userId, kind, preview);
    setSession(handle);
    setScreen('review');
  }, [clearTimers, preview, replaceRecordedAudio, stopVoiceCapture, userId]);

  useEffect(() => {
    let active = true;
    const prepare = async () => {
      if (!learnedIds.size) { setScreen('empty'); return; }
      const [progress, storedReviewDays] = await Promise.all([
        loadReviewProgress(userId, [...learnedIds], preview),
        loadReviewDays(userId, preview),
      ]);
      if (!active) return;
      setReviewDays(storedReviewDays);
      const queueItems = buildReviewQueue(words.filter(word => learnedIds.has(word.id)), new Map(progress.rows.map(row => [row.wordId, row])), new Date(), sessionSize);
      if (!queueItems.length) { setScreen('done-today'); return; }
      await beginQueue(queueItems, 'daily');
    };
    void prepare();
    return () => { active = false; };
  }, [beginQueue, learnedIds, preview, sessionSize, userId, words]);

  useEffect(() => {
    if (!currentItem) return;
    deckTransitionStarted.current = false;
    setDeckPhase('idle');
    setSelectedAnswer('');
    setResult(null);
    setVoiceAttempts(0);
    setVoiceMessage('');
    stopVoiceCapture();
    replaceRecordedAudio();
    setPhase('idle');
  }, [currentItem, replaceRecordedAudio, stopVoiceCapture]);

  const addWeakWordRetry = useCallback((item: ReviewItem) => {
    setMistakeWords(current => new Set(current).add(item.word.id));
    setQueue(current => {
      if (current.slice(index + 1).some(candidate => candidate.word.id === item.word.id && candidate.retry)) return current;
      const exerciseType = alternateExercise(item.exerciseType, index + 3);
      const retry: ReviewItem = { id: `${item.word.id}:${exerciseType}:retry-${attemptCount + 1}`, word: item.word, exerciseType, retry: true };
      const insertionIndex = Math.min(current.length, index + 4);
      const nextQueue = [...current.slice(0, insertionIndex), retry, ...current.slice(insertionIndex)];
      queueRef.current = nextQueue;
      return nextQueue;
    });
  }, [attemptCount, index]);

  const finishSession = useCallback(async () => {
    if (!session || finishStarted.current) return;
    finishStarted.current = true;
    stopDictionaryAudio();
    const completion = await completeReviewSession(session, preview);
    setPersistedCompletion(completion.persisted || preview);
    if (sessionKind === 'daily' && (completion.persisted || preview)) setReviewDays(recordLocalReviewDay(userId, session.localDay));
    setScreen('complete');
  }, [preview, session, sessionKind, userId]);

  useEffect(() => {
    if (screen === 'review' && session && queue.length > 0 && index >= queue.length) void finishSession();
  }, [finishSession, index, queue.length, screen, session]);

  const startDeckTransition = useCallback((requestedDirection: DeckDirection, targetIndex: number) => {
    if (deckTransitionStarted.current || !currentItem) return;
    deckTransitionStarted.current = true;
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    stopDictionaryAudio();
    setPhase('transition');
    setDeckDirection(requestedDirection);
    const selectCard = () => {
      indexRef.current = targetIndex;
      setIndex(targetIndex);
    };

    if (reduceMotion) {
      setDeckPhase('reinsert');
      const timer = window.setTimeout(selectCard, 150);
      timers.current.push(timer);
      return;
    }

    setDeckPhase('lift');
    const liftTimer = window.setTimeout(() => {
      setDeckPhase('out');
      const outTimer = window.setTimeout(() => {
        setDeckPhase('reinsert');
        const reinsertTimer = window.setTimeout(selectCard, 420);
        timers.current.push(reinsertTimer);
      }, 380);
      timers.current.push(outTimer);
    }, 140);
    timers.current.push(liftTimer);
  }, [currentItem, reduceMotion]);

  const advance = useCallback((item: ReviewItem, delay = 1250) => {
    setCompletedWords(current => new Set(current).add(item.word.id));
    const nextCompletedItemIds = new Set(completedItemIdsRef.current).add(item.id);
    completedItemIdsRef.current = nextCompletedItemIds;
    setCompletedItemIds(nextCompletedItemIds);
    setPhase('feedback');
    const feedbackTimer = window.setTimeout(() => {
      const nextIndex = adjacentPendingIndex(queueRef.current, completedItemIdsRef.current, indexRef.current, 1);
      startDeckTransition(1, nextIndex ?? queueRef.current.length);
    }, delay);
    feedbackTimerRef.current = feedbackTimer;
    timers.current.push(feedbackTimer);
  }, [startDeckTransition]);

  const recordAnswer = useCallback(async (item: ReviewItem, answer: string) => {
    if (!session || phase === 'checking' || phase === 'transition') return null;
    setPhase('checking');
    const response = await submitReviewAnswer(session, item, answer, userId);
    setAttemptCount(value => value + 1);
    setResult(response.correct);
    if (response.correct) setCorrectWords(current => new Set(current).add(item.word.id));
    else addWeakWordRetry(item);
    return response.correct;
  }, [addWeakWordRetry, phase, session, userId]);

  const chooseTranslation = async (answer: string) => {
    if (!currentItem || phase !== 'idle') return;
    setSelectedAnswer(answer);
    const correct = await recordAnswer(currentItem, answer);
    if (correct === null) return;
    advance(currentItem);
  };

  const choosePictureAnswer = async (label: string, answer: string) => {
    if (!currentItem || phase !== 'idle') return;
    setSelectedAnswer(label);
    const correct = await recordAnswer(currentItem, answer);
    if (correct === null) return;
    advance(currentItem);
  };

  const speak = async () => {
    if (!currentItem || phase === 'checking' || phase === 'transition') return;
    if (phase === 'answering') {
      if (recognitionRef.current) recognitionRef.current.stop();
      else {
        if (voiceTimeoutRef.current !== null) window.clearTimeout(voiceTimeoutRef.current);
        voiceTimeoutRef.current = null;
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
        setResult(false);
        setVoiceMessage(ui.micUnavailable);
        setVoiceAttempts(value => value + 1);
        setPhase('idle');
      }
      return;
    }

    stopDictionaryAudio();
    stopVoiceCapture();
    replaceRecordedAudio();
    setResult(null);
    setVoiceMessage('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setResult(false);
      setVoiceMessage(ui.recordingUnavailable);
      setVoiceAttempts(value => value + 1);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = stream;
    } catch {
      setResult(false);
      setVoiceMessage(ui.micDenied);
      setVoiceAttempts(value => value + 1);
      setPhase('idle');
      return;
    }

    const chunks: Blob[] = [];
    const finishRecording = () => {
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      else {
        microphoneStreamRef.current?.getTracks().forEach(track => track.stop());
        microphoneStreamRef.current = null;
      }
    };

    if (typeof MediaRecorder !== 'undefined') {
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = () => {
        if (chunks.length) replaceRecordedAudio(URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })));
        stream.getTracks().forEach(track => track.stop());
        if (microphoneStreamRef.current === stream) microphoneStreamRef.current = null;
        if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null;
      };
      recorder.start();
    } else {
      setVoiceMessage(ui.recordingUnavailable);
    }

    setPhase('answering');
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionConstructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) {
      voiceTimeoutRef.current = window.setTimeout(() => {
        finishRecording();
        setResult(false);
        setVoiceMessage(ui.micUnavailable);
        setVoiceAttempts(value => value + 1);
        setPhase('idle');
      }, 5000);
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    let received = false;
    recognition.onresult = async (event: BrowserSpeechRecognitionEvent) => {
      received = true;
      if (voiceTimeoutRef.current !== null) window.clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
      recognitionRef.current = null;
      finishRecording();
      const transcript = String(event.results?.[0]?.[0]?.transcript || '');
      const submittedAnswer = answerMatches('speaking', currentItem.word, transcript) ? currentItem.word.word : transcript;
      const correct = await recordAnswer(currentItem, submittedAnswer);
      if (correct === null) return;
      setVoiceMessage(correct ? ui.great : ui.tryAgain);
      if (correct) advance(currentItem, 2800);
      else {
        setVoiceAttempts(value => value + 1);
        setPhase('feedback');
        const timer = window.setTimeout(() => setPhase('idle'), 900);
        timers.current.push(timer);
      }
    };
    recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
      received = true;
      if (voiceTimeoutRef.current !== null) window.clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
      recognitionRef.current = null;
      finishRecording();
      setResult(false);
      setVoiceMessage(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? ui.micDenied : ui.noSpeech);
      setVoiceAttempts(value => value + 1);
      setPhase('idle');
    };
    recognition.onend = () => {
      if (voiceTimeoutRef.current !== null) window.clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
      recognitionRef.current = null;
      finishRecording();
      if (!received) { setResult(false); setVoiceMessage(ui.noSpeech); setVoiceAttempts(value => value + 1); setPhase('idle'); }
    };
    try {
      recognition.start();
      voiceTimeoutRef.current = window.setTimeout(() => recognition.stop(), 8000);
    } catch {
      recognitionRef.current = null;
      finishRecording();
      setResult(false);
      setVoiceMessage(ui.micUnavailable);
      setVoiceAttempts(value => value + 1);
      setPhase('idle');
    }
  };

  const continueSpeaking = async () => {
    if (!currentItem) return;
    if (!mistakeWords.has(currentItem.word.id)) await recordAnswer(currentItem, '');
    advance(currentItem);
  };

  const repeatDifficult = async () => {
    const difficult = words.filter(word => mistakeWords.has(word.id));
    const items = difficult.map((word, itemIndex): ReviewItem => {
      const previous = queue.find(item => item.word.id === word.id)?.exerciseType || 'translation';
      const exerciseType = alternateExercise(previous, itemIndex + 1);
      return { id: `${word.id}:${exerciseType}:difficult`, word, exerciseType, retry: true };
    });
    if (items.length) await beginQueue(items, 'difficult');
  };

  if (screen === 'loading') return <div className="glass flex min-h-[540px] items-center justify-center rounded-[2rem] font-display text-xl font-black text-purple-400">…</div>;
  if (screen === 'empty' || screen === 'done-today') return <section className="glass flex min-h-[540px] flex-col items-center justify-center rounded-[2.5rem] px-6 text-center" data-testid={`daily-review-${screen}`}>
    <img src={screen === 'empty' ? ASSET.globe : ASSET.target} alt="" aria-hidden="true" className="h-44 w-44 object-contain drop-shadow-xl" />
    <h1 className="mt-3 w-full text-center font-display text-3xl font-black text-purple-700">{screen === 'empty' ? `${ui.emptyTitle} 💜` : ui.doneTitle}</h1>
    <p className="mt-3 font-body font-700 text-slate-500">{screen === 'empty' ? ui.emptyText : ui.doneText}</p>
    <button type="button" onClick={onClose} className="mt-7 min-h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-6 py-3 font-display font-black text-white shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200">{ui.back}</button>
  </section>;

  if (screen === 'complete') {
    const known = words.filter(word => correctWords.has(word.id) && !mistakeWords.has(word.id));
    const practice = words.filter(word => correctWords.has(word.id) && mistakeWords.has(word.id));
    const difficult = words.filter(word => mistakeWords.has(word.id) && !correctWords.has(word.id));
    const repeatWords = words.filter(word => mistakeWords.has(word.id));
    return <section className="relative mx-auto max-w-[980px] overflow-hidden rounded-[2.75rem] border border-white/90 bg-gradient-to-br from-white via-purple-50 to-pink-50 px-5 py-7 text-center shadow-[0_24px_70px_rgba(104,70,158,0.16)] sm:px-9" data-testid="daily-review-completion">
      <img src={ASSET.target} alt="" aria-hidden="true" className="mx-auto h-32 w-32 object-contain drop-shadow-xl" />
      <h1 className="mx-auto mt-1 max-w-3xl text-center font-display text-[clamp(1.8rem,4vw,2.8rem)] font-black text-purple-700">{ui.completed}</h1>
      <div className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-3">
        <div className="rounded-3xl bg-emerald-50 p-4 text-left"><h2 className="font-display font-black text-emerald-700">✅ {ui.known}</h2><p className="mt-2 font-body text-sm font-800 text-emerald-600">{known.length ? known.map(word => word.word).join(' · ') : '—'}</p></div>
        <div className="rounded-3xl bg-purple-50 p-4 text-left"><h2 className="font-display font-black text-purple-700">🧠 {ui.practice}</h2><p className="mt-2 font-body text-sm font-800 text-purple-500">{practice.length ? practice.map(word => word.word).join(' · ') : '—'}</p></div>
        <div className="rounded-3xl bg-rose-50 p-4 text-left"><h2 className="font-display font-black text-rose-600">🔥 {ui.difficult}</h2><p className="mt-2 font-body text-sm font-800 text-rose-500">{difficult.length ? difficult.map(word => word.word).join(' · ') : '—'}</p></div>
      </div>
      {!persistedCompletion && <p role="status" className="mx-auto mt-5 max-w-xl rounded-2xl bg-amber-50 px-4 py-3 font-body text-sm font-800 text-amber-700">{ui.persistenceWarning}</p>}
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">{repeatWords.length > 0 && <button type="button" onClick={() => void repeatDifficult()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-purple-200 bg-white px-6 py-3 font-display font-black text-purple-700 shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200"><RotateCcw className="h-5 w-5" />{ui.repeat}</button>}<button type="button" onClick={onClose} className="min-h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-7 py-3 font-display font-black text-white shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200">{ui.finish}</button></div>
    </section>;
  }

  const displayNumber = Math.min(total, completed + 1);
  return <div className="space-y-5" data-testid="daily-review-screen">
    <header className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(290px,440px)_auto]">
      <div className="flex min-w-0 items-center gap-3 sm:gap-5"><img src={ASSET.target} alt="" aria-hidden="true" className="h-20 w-20 shrink-0 object-contain drop-shadow-lg sm:h-24 sm:w-24" /><div><h1 className="font-display text-[clamp(1.65rem,3vw,2.6rem)] font-black leading-tight text-purple-700">{ui.title}</h1><p className="mt-1 font-body text-sm font-800 text-slate-500 sm:text-base">{ui.subtitle}</p></div></div>
      <div className="rounded-[1.7rem] border border-purple-100 bg-white/85 px-5 py-4 shadow-[0_12px_28px_rgba(101,66,160,0.1)]"><div className="flex items-center justify-between gap-4"><span className="font-display font-black text-purple-700">{ui.word} {displayNumber} {ui.of} {total}</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-purple-100"><motion.div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400" animate={{ width: `${percent}%` }} /></div></div>
      <button type="button" onClick={onClose} aria-label={ui.back} className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-purple-500 shadow-lg transition hover:scale-105 hover:text-red-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 lg:static"><X className="h-7 w-7" /></button>
    </header>

    <div className="relative isolate grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <main className="relative z-10 flex min-h-[640px] min-w-0 items-start justify-center overflow-visible px-12 pb-10 pt-2 sm:px-16" aria-busy={phase === 'checking' || phase === 'transition'}>
        <div className="review-deck relative h-[clamp(520px,62vh,580px)] w-full max-w-[920px] lg:w-[76%] xl:w-[74%]" data-testid="daily-review-deck" data-deck-phase={deckPhase} data-deck-direction={deckDirection}>
          {[...deckItems].reverse().map(({ item, layerKey, surface }, reverseIndex) => {
            const role = (deckItems.length - 1 - reverseIndex) as DeckRole;
            const isActive = role === 0;
            const exercisePhase = isActive ? phase : 'idle';
            return <motion.section
              key={layerKey}
              initial={false}
              animate={deckAnimation(role, deckPhase, deckDirection)}
              transition={deckTransition(deckPhase, Boolean(reduceMotion))}
              data-testid={`daily-review-card-${role}`}
              data-card-role={role === 0 ? 'active' : role === 1 ? 'back1' : 'back2'}
              data-card-word={item.word.word}
              data-card-color={surface.name}
              aria-hidden={!isActive}
              className={`absolute inset-0 overflow-hidden rounded-[2.75rem] border will-change-transform ${isActive ? 'shadow-[0_28px_75px_rgba(104,70,158,0.2),0_7px_18px_rgba(104,70,158,0.09)]' : 'shadow-[0_12px_34px_rgba(119,82,175,0.13)]'}`}
              style={{
                background: surface.background,
                borderColor: surface.borderColor,
                transformOrigin: '50% 55%',
                transformPerspective: 1200,
                pointerEvents: isActive && deckPhase === 'idle' ? 'auto' : 'none',
              }}
            >
              <fieldset disabled={!isActive || deckPhase !== 'idle'} className="m-0 h-full min-w-0 border-0 p-0">
                {item.exerciseType === 'translation' && <TranslationExercise item={item} words={words} phase={exercisePhase} selected={isActive ? selectedAnswer : ''} result={isActive ? result : null} onSelect={answer => void chooseTranslation(answer)} lang={lang} />}
                {item.exerciseType === 'speaking' && <SpeakingExercise item={item} phase={exercisePhase} result={isActive ? result : null} attempts={isActive ? voiceAttempts : 0} voiceMessage={isActive ? voiceMessage : ''} recordedAudioUrl={isActive ? recordedAudioUrl : ''} onSpeak={() => void speak()} onContinue={continueSpeaking} lang={lang} />}
                {item.exerciseType === 'word_building' && <PictureChoiceExercise item={item} words={words} phase={exercisePhase} selected={isActive ? selectedAnswer : ''} result={isActive ? result : null} onSelect={(label, answer) => void choosePictureAnswer(label, answer)} lang={lang} />}
              </fieldset>
            </motion.section>;
          })}
          <button type="button" aria-label="Choose previous card" disabled={(phase !== 'idle' && phase !== 'feedback') || previousCardIndex === null} onClick={() => { if (previousCardIndex !== null) startDeckTransition(-1, previousCardIndex); }} className="absolute -left-11 top-1/2 z-40 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-purple-100 bg-white text-purple-500 shadow-[0_12px_28px_rgba(91,58,143,0.18)] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 disabled:cursor-default disabled:opacity-70 sm:-left-16"><ChevronLeft className="h-7 w-7" /></button>
          <button type="button" aria-label="Choose next card" disabled={(phase !== 'idle' && phase !== 'feedback') || nextCardIndex === null} onClick={() => { if (nextCardIndex !== null) startDeckTransition(1, nextCardIndex); }} className="absolute -right-11 top-1/2 z-40 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-purple-100 bg-white text-purple-500 shadow-[0_12px_28px_rgba(91,58,143,0.18)] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 disabled:cursor-default disabled:opacity-70 sm:-right-16"><ChevronRight className="h-7 w-7" /></button>
        </div>
      </main>
      <SideWidgets percent={percent} correct={cleanCorrectCount} errors={mistakeWords.size} completed={completed} total={total} reviewDays={reviewDays} lang={lang} />
    </div>
  </div>;
}
