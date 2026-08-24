import { type ImgHTMLAttributes, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, CheckCircle2, ImageIcon, Lightbulb, Mic, RotateCcw, Sparkles, Square, Undo2, Volume2, X, XCircle } from 'lucide-react';
import {
  Lesson, InteractiveTask, completeAssignedInteractiveContent, listTasks, markLessonComplete, signedUrlFor,
} from '../lib/workbooks';
import { MechanicType, InteractiveScoreSummary, calculateInteractiveScore } from '../lib/mechanics';
import {
  LiveSession, abandonLiveSession, completeLiveSession, recordLiveEvent, startLiveSession,
  listLiveEvents, subscribeLiveSessionEvents, updateLiveSession,
} from '../lib/live';
import TheoryLessonView from './TheoryLessonView';
import type { Lang } from '../lib/i18n';
import { supabase } from '@/integrations/supabase/client';
import { findAvatar } from '../lib/stars';
import OwlPlayer, { type OwlPlayerState } from './OwlPlayer';

type TaskTelemetryPayload = Record<string, unknown>;
type TaskTelemetry = (eventType: string, payload?: TaskTelemetryPayload) => void;
const THINKING_OWL_DELAY_MS = 14000;
const REWARD_STAR_SRC = '/ui/reward-star.png';
const PROGRESS_STAR_SRC = '/ui/progress-star.png';
const DARK_STAR_LARGE_SRC = '/ui/word-search-star-dark-large.png';
const DARK_STAR_MEDIUM_SRC = '/ui/word-search-star-dark-medium.png';
const DARK_STAR_SMALL_SRC = '/ui/word-search-star-dark-small.png';
type SpeakingMode = 'repeat_word' | 'read_sentence' | 'name_picture' | 'answer_question' | 'describe_animal' | 'speak_20_seconds';
type SpeechRecognitionResult = 'great' | 'almost' | 'retry' | 'sound';
type SpeakingPayload = Partial<{ mode: SpeakingMode; target: string; prompt: string; seconds: number; image: string; audio: string }>;
type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<{ transcript?: string }>> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type RoomStudentProfile = {
  name: string;
  email: string;
  starBalance: number;
  avatarId: string | null;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function ThemedStarImage({
  lightSrc = REWARD_STAR_SRC,
  darkSrc = DARK_STAR_MEDIUM_SRC,
  className,
  lightClassName = 'dark:hidden',
  darkClassName = 'hidden dark:block',
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { lightSrc?: string; darkSrc?: string; lightClassName?: string; darkClassName?: string }) {
  return (
    <>
      <img {...props} src={lightSrc} className={cx(className, lightClassName)} />
      <img {...props} src={darkSrc} className={cx(className, darkClassName)} />
    </>
  );
}

function getSpeechRecognitionConstructor() {
  return ((window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }).SpeechRecognition || (window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }).webkitSpeechRecognition);
}

const tileBase = 'min-h-14 rounded-2xl border-2 px-4 py-3 font-body font-700 text-base shadow-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-pink-200/70';
const liveTile = 'bg-white/95 border-purple-100 text-purple-700 shadow-md shadow-purple-100/60 hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-lg dark:bg-[#2b1a3d] dark:border-purple-700 dark:text-purple-100 dark:shadow-none dark:hover:border-pink-400';
const selectedTile = 'student-accent-gradient border-white text-white shadow-xl ring-4 ring-pink-200/70 dark:border-purple-200 dark:ring-purple-500/30';
const doneTile = 'bg-emerald-50 border-emerald-200 text-emerald-700 opacity-75 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-200';
const wrongTile = 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse dark:bg-rose-950 dark:border-rose-700 dark:text-rose-200';
const speakingActionGradient = 'linear-gradient(90deg, #EFA4DE 0%, #D7A9E9 45%, #B6BDF9 100%)';
const masterProgressGradient = 'linear-gradient(90deg, #EFA4DE 0%, #D7A9E9 45%, #B6BDF9 100%)';
const masterConnectionSelectedClass = 'border-transparent bg-[linear-gradient(90deg,#EFA4DE_0%,#D7A9E9_45%,#B6BDF9_100%)] text-white shadow-[0_14px_28px_rgba(183,189,249,0.25)] ring-4 ring-purple-200/70';

function LessonProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full transition-all ${i <= current ? 'student-accent-gradient w-8' : 'w-2 bg-purple-100 dark:bg-purple-800'}`}
        />
      ))}
    </div>
  );
}

function StarRatingDisplay({ value, total = 5 }: { value: number; total?: number }) {
  return (
    <div className="flex items-center gap-[clamp(0.12rem,0.28vw,0.24rem)] rounded-full border border-purple-100 bg-white px-[clamp(0.7rem,1.05vw,0.9rem)] py-[clamp(0.28rem,0.58vh,0.44rem)] shadow-[0_8px_22px_rgba(168,85,247,0.10)]">
      {Array.from({ length: total }).map((_, index) => (
        <img
          key={index}
          src={REWARD_STAR_SRC}
          alt=""
          draggable={false}
          className={`h-[clamp(2.05rem,2.75vw,2.5rem)] w-[clamp(2.05rem,2.75vw,2.5rem)] select-none object-contain transition duration-300 ${index < value ? 'opacity-100' : 'opacity-25 grayscale'}`}
        />
      ))}
    </div>
  );
}

function CircularRatingDisplay({ value, total = 5 }: { value: number; total?: number }) {
  const safeTotal = Math.max(1, total);
  const safeValue = Math.min(safeTotal, Math.max(0, Math.round(value)));
  const circumference = 2 * Math.PI * 22;
  const progress = (safeValue / safeTotal) * circumference;

  return (
    <div className="relative flex h-[clamp(2.85rem,4.3vw,3.55rem)] w-[clamp(2.85rem,4.3vw,3.55rem)] shrink-0 items-center justify-center rounded-full bg-white shadow-[0_8px_22px_rgba(168,85,247,0.12)]">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(221, 214, 254, 0.72)" strokeWidth="3.5" />
        <circle
          cx="26"
          cy="26"
          r="22"
          fill="none"
          stroke="url(#master-rating-progress)"
          strokeLinecap="round"
          strokeWidth="3.5"
          strokeDasharray={`${progress} ${circumference}`}
        />
        <defs>
          <linearGradient id="master-rating-progress" x1="0" x2="52" y1="0" y2="52">
            <stop stopColor="#a855f7" />
            <stop offset="1" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      <span className="relative font-display text-[clamp(0.72rem,1.15vw,0.92rem)] font-bold text-purple-700">{safeValue}/{safeTotal}</span>
    </div>
  );
}

const mechanicCopy: Record<Lang, Partial<Record<MechanicType, { title: string; instruction: string }>>> = {
  ru: {
    matching: { title: 'Найди пары', instruction: 'Выбери карточку слева, затем соедини её с правильной карточкой справа.' },
    word_lego: { title: 'Собери слова', instruction: 'Соедини части, чтобы получилось правильное слово или фраза.' },
    fill_letters: { title: 'Заполни пропуски', instruction: 'Впиши недостающие буквы или слова.' },
    anagram_unscramble: { title: 'Собери анаграмму', instruction: 'Расставь перемешанные буквы в правильном порядке.' },
    odd_one_out: { title: 'Найди лишнее', instruction: 'Выбери карточку, которая не подходит к остальным.' },
    category_sorting: { title: 'Разложи по категориям', instruction: 'Выбирай карточки и отправляй их в подходящую группу.' },
    cipher_decoder: { title: 'Расшифруй слово', instruction: 'Найди в алфавите букву под каждым числом и запиши получившееся слово.' },
    word_search: { title: 'Найди слова', instruction: 'Нажми на первую и последнюю букву слова. Слова могут идти по горизонтали, вертикали и диагонали.' },
    speaking_practice: { title: 'Говорим вслух', instruction: 'Нажми на микрофон, скажи фразу и получи мягкую подсказку по произношению.' },
    digital_coloring: { title: 'Раскрась рисунок', instruction: 'Выбери цвет и закрась области с таким же кодом.' },
    true_false: { title: 'True / False', instruction: 'Прочитай утверждение и выбери, правда это или нет.' },
    mini_shop: { title: 'Mini-shop', instruction: 'Выбери товары так, чтобы сумма совпала с заданием.' },
  },
  en: {
    matching: { title: 'Match the pairs', instruction: 'Choose a card on the left, then connect it to the matching card on the right.' },
    word_lego: { title: 'Build the words', instruction: 'Join two parts to make the correct word or phrase.' },
    fill_letters: { title: 'Fill in the blanks', instruction: 'Type the missing letters or words.' },
    anagram_unscramble: { title: 'Unscramble the word', instruction: 'Put the shuffled letters in the correct order.' },
    odd_one_out: { title: 'Find the odd one out', instruction: 'Choose the card that does not belong with the others.' },
    category_sorting: { title: 'Sort into categories', instruction: 'Choose each card and place it in the correct group.' },
    cipher_decoder: { title: 'Decode the word', instruction: 'Find the letter for each number in the alphabet key, then type the word.' },
    word_search: { title: 'Find the words', instruction: 'Tap the first and last letters. Words can run horizontally, vertically, or diagonally.' },
    speaking_practice: { title: 'Speak out loud', instruction: 'Tap the microphone, say the phrase, and get a gentle pronunciation hint.' },
    digital_coloring: { title: 'Color the picture', instruction: 'Choose a color and fill the regions with the matching code.' },
    true_false: { title: 'True / False', instruction: 'Read the statement and choose whether it is true or false.' },
    mini_shop: { title: 'Mini-shop', instruction: 'Choose items so the total matches the target.' },
  },
  ua: {
    matching: { title: 'Знайди пари', instruction: 'Обери картку ліворуч, потім з’єднай її з правильною карткою праворуч.' },
    word_lego: { title: 'Склади слова', instruction: 'З’єднай дві частини, щоб утворити правильне слово або фразу.' },
    fill_letters: { title: 'Заповни пропуски', instruction: 'Впиши пропущені літери або слова.' },
    anagram_unscramble: { title: 'Склади анаграму', instruction: 'Розташуй перемішані літери у правильному порядку.' },
    odd_one_out: { title: 'Знайди зайве', instruction: 'Обери картку, яка не пасує до інших.' },
    category_sorting: { title: 'Розклади за категоріями', instruction: 'Обирай картки та відправляй їх до потрібної групи.' },
    cipher_decoder: { title: 'Розшифруй слово', instruction: 'Знайди в алфавіті літеру під кожним числом і впиши слово.' },
    word_search: { title: 'Знайди слова', instruction: 'Натисни першу та останню літери. Слова можуть бути по горизонталі, вертикалі чи діагоналі.' },
    speaking_practice: { title: 'Говоримо вголос', instruction: 'Натисни на мікрофон, скажи фразу й отримай мʼяку підказку щодо вимови.' },
    digital_coloring: { title: 'Розфарбуй малюнок', instruction: 'Обери колір і зафарбуй області з таким самим кодом.' },
    true_false: { title: 'True / False', instruction: 'Прочитай твердження та обери, правда це чи ні.' },
    mini_shop: { title: 'Mini-shop', instruction: 'Обери товари так, щоб сума збіглася із завданням.' },
  },
};

const roomCopy = {
  ru: {
    exit: 'Выйти',
    theoryLesson: 'Теоретический урок',
    taskProgress: (current: number, total: number) => `Задание ${current} из ${total}`,
    teacherHint: 'Учитель отправил подсказку',
    loading: 'Загрузка…',
    noTheory: 'Материал теоретического урока пока не добавлен.',
    noTasks: 'В этом уроке пока нет заданий.',
    backToMap: 'Назад к карте',
    studied: 'Я изучил(а) материал',
    mechanicWip: (name: string) => `Механика «${name}» ещё в разработке.`,
    skip: 'Пропустить',
    complete: 'Урок пройден!',
    great: 'Отличная работа!',
    toMap: 'На карту',
    completionResult: 'Итог',
    completionErrors: 'Ошибки',
    completionFirstTry: 'С первого раза',
    completionRetry: 'Повторные попытки',
    completionAward: 'Звёзды начислены',
    completionPractice: 'Тренировка сохранена: основная оценка уже была зачтена раньше.',
    completionSaved: 'Результат сохранён и отправлен учителю.',
    next: 'Далее',
    unit: 'Юнит',
    topic: 'Тема',
    keepGoing: 'Отлично! Можно идти дальше.',
    progressHint: 'Отлично! Продолжай!',
  },
  en: {
    exit: 'Exit',
    theoryLesson: 'Theory lesson',
    taskProgress: (current: number, total: number) => `Task ${current} of ${total}`,
    teacherHint: 'The teacher sent a hint',
    loading: 'Loading…',
    noTheory: 'Theory material has not been added yet.',
    noTasks: 'This lesson has no tasks yet.',
    backToMap: 'Back to map',
    studied: 'I studied the material',
    mechanicWip: (name: string) => `The “${name}” mechanic is still in progress.`,
    skip: 'Skip',
    complete: 'Lesson complete!',
    great: 'Great job!',
    toMap: 'To map',
    completionResult: 'Result',
    completionErrors: 'Mistakes',
    completionFirstTry: 'First try',
    completionRetry: 'Retry attempts',
    completionAward: 'Stars awarded',
    completionPractice: 'Practice saved: the main grade was already counted earlier.',
    completionSaved: 'Result saved and sent to the teacher.',
    next: 'Next',
    unit: 'Unit',
    topic: 'Topic',
    keepGoing: 'Great job! You can move on.',
    progressHint: 'Great job! Keep going!',
  },
  ua: {
    exit: 'Вийти',
    theoryLesson: 'Теоретичний урок',
    taskProgress: (current: number, total: number) => `Завдання ${current} з ${total}`,
    teacherHint: 'Учитель надіслав підказку',
    loading: 'Завантаження…',
    noTheory: 'Матеріал теоретичного уроку ще не додано.',
    noTasks: 'У цьому уроці поки немає завдань.',
    backToMap: 'Назад до карти',
    studied: 'Я вивчив/вивчила матеріал',
    mechanicWip: (name: string) => `Механіка «${name}» ще в розробці.`,
    skip: 'Пропустити',
    complete: 'Урок пройдено!',
    great: 'Чудова робота!',
    toMap: 'До карти',
    completionResult: 'Підсумок',
    completionErrors: 'Помилки',
    completionFirstTry: 'З першого разу',
    completionRetry: 'Повторні спроби',
    completionAward: 'Зірки нараховано',
    completionPractice: 'Тренування збережено: основну оцінку вже було зараховано раніше.',
    completionSaved: 'Результат збережено й надіслано вчителю.',
    next: 'Далі',
    unit: 'Юніт',
    topic: 'Тема',
    keepGoing: 'Чудово! Можна рухатися далі.',
    progressHint: 'Чудово! Продовжуй!',
  },
} as const;

type CompletionCopy = {
  complete: string;
  great: string;
  toMap: string;
  completionResult: string;
  completionErrors: string;
  completionFirstTry: string;
  completionRetry: string;
  completionAward: string;
  completionPractice: string;
  completionSaved: string;
};

const taskCopy = {
  ru: {
    matchingDone: 'Отлично! Все пары соединены',
    built: 'Собрано',
    partOne: 'Часть 1',
    partTwo: 'Часть 2',
    check: 'Проверить',
    undoLast: 'Убрать последнюю',
    reset: 'Сбросить',
    addOptions: 'Добавьте варианты в конструкторе.',
    option: 'Вариант',
    addCategories: 'Добавьте категории и элементы в конструкторе.',
    chooseCard: 'Выбери карточку',
    sendToCategory: 'Отправь в категорию',
    addWords: 'Добавьте слова в конструкторе.',
    clear: 'Очистить',
    addDots: 'Добавьте минимум две точки в конструкторе.',
    nextPoint: 'Следующая точка',
    addObjects: 'Добавьте объекты для поиска в конструкторе.',
    addPalette: 'Добавьте палитру и области в конструкторе.',
    addStatements: 'Добавьте утверждения в конструкторе.',
    trueAnswer: 'Правда',
    falseAnswer: 'Неправда',
    addShopItems: 'Добавьте товары и цель в конструкторе.',
    shopTarget: 'Нужно набрать',
    shopTotal: 'В корзине',
    shopOver: 'Слишком много',
    colored: 'Закрашено',
    choosePencil: 'Выбери карандаш',
    coloringTodo: 'Что раскрасить',
    listen: 'Послушать',
    startSpeaking: 'Сказать',
    stopSpeaking: 'Готово',
    listeningNow: 'Слушаю...',
    heard: 'Я услышал(а)',
    noSpeech: 'Микрофон не распознал речь. Попробуй ещё раз.',
    micUnsupported: 'Распознавание речи недоступно в этом браузере.',
    micPermission: 'Разреши доступ к микрофону и попробуй ещё раз.',
    greatPronunciation: 'Отлично',
    almostPronunciation: 'Почти правильно',
    retryPronunciation: 'Попробуй ещё раз',
    soundPronunciation: 'Послушай сложный звук',
    trickyPart: 'Сложный кусочек',
    sayAnything: 'Говори свободно',
    secondsLeft: 'сек.',
    repeatWord: 'Повтори слово',
    readSentence: 'Прочитай предложение',
    namePicture: 'Назови картинку',
    answerQuestion: 'Ответь на вопрос',
    describeAnimal: 'Опиши животное',
    speakTwentySeconds: 'Говори 20 секунд',
    defaultPrompt: 'Скажи ответ вслух',
    picturePrompt: 'Посмотри на картинку и скажи, что это.',
    answerHidden: 'Ответ скрыт. Попробуй ещё раз.',
    hintAnswer: 'Подсказка',
    missingExpected: 'Правильный ответ не добавлен в задании.',
  },
  en: {
    matchingDone: 'Great! All pairs are matched',
    built: 'Built',
    partOne: 'Part 1',
    partTwo: 'Part 2',
    check: 'Check',
    undoLast: 'Remove last',
    reset: 'Reset',
    addOptions: 'Add options in the builder.',
    option: 'Option',
    addCategories: 'Add categories and items in the builder.',
    chooseCard: 'Choose a card',
    sendToCategory: 'Send to category',
    addWords: 'Add words in the builder.',
    clear: 'Clear',
    addDots: 'Add at least two points in the builder.',
    nextPoint: 'Next point',
    addObjects: 'Add objects to find in the builder.',
    addPalette: 'Add a palette and regions in the builder.',
    addStatements: 'Add statements in the builder.',
    trueAnswer: 'True',
    falseAnswer: 'False',
    addShopItems: 'Add shop items and a target in the builder.',
    shopTarget: 'Target total',
    shopTotal: 'Cart total',
    shopOver: 'Too much',
    colored: 'Colored',
    choosePencil: 'Choose a pencil',
    coloringTodo: 'What to color',
    listen: 'Listen',
    startSpeaking: 'Speak',
    stopSpeaking: 'Done',
    listeningNow: 'Listening...',
    heard: 'I heard',
    noSpeech: 'The microphone did not catch speech. Try again.',
    micUnsupported: 'Speech recognition is not available in this browser.',
    micPermission: 'Allow microphone access and try again.',
    greatPronunciation: 'Great',
    almostPronunciation: 'Almost there',
    retryPronunciation: 'Try again',
    soundPronunciation: 'Listen to this sound',
    trickyPart: 'Tricky part',
    sayAnything: 'Speak freely',
    secondsLeft: 'sec.',
    repeatWord: 'Repeat the word',
    readSentence: 'Read the sentence',
    namePicture: 'Name the picture',
    answerQuestion: 'Answer the question',
    describeAnimal: 'Describe the animal',
    speakTwentySeconds: 'Speak for 20 seconds',
    defaultPrompt: 'Say the answer out loud',
    picturePrompt: 'Look at the picture and say what it is.',
    answerHidden: 'The answer stays hidden. Try again.',
    hintAnswer: 'Hint',
    missingExpected: 'The correct answer has not been added to this task.',
  },
  ua: {
    matchingDone: 'Чудово! Усі пари зʼєднано',
    built: 'Складено',
    partOne: 'Частина 1',
    partTwo: 'Частина 2',
    check: 'Перевірити',
    undoLast: 'Прибрати останню',
    reset: 'Скинути',
    addOptions: 'Додайте варіанти в конструкторі.',
    option: 'Варіант',
    addCategories: 'Додайте категорії та елементи в конструкторі.',
    chooseCard: 'Обери картку',
    sendToCategory: 'Відправ у категорію',
    addWords: 'Додайте слова в конструкторі.',
    clear: 'Очистити',
    addDots: 'Додайте щонайменше дві точки в конструкторі.',
    nextPoint: 'Наступна точка',
    addObjects: 'Додайте обʼєкти для пошуку в конструкторі.',
    addPalette: 'Додайте палітру та області в конструкторі.',
    addStatements: 'Додайте твердження в конструкторі.',
    trueAnswer: 'Правда',
    falseAnswer: 'Неправда',
    addShopItems: 'Додайте товари та ціль у конструкторі.',
    shopTarget: 'Потрібно набрати',
    shopTotal: 'У кошику',
    shopOver: 'Забагато',
    colored: 'Зафарбовано',
    choosePencil: 'Обери олівець',
    coloringTodo: 'Що розфарбувати',
    listen: 'Послухати',
    startSpeaking: 'Сказати',
    stopSpeaking: 'Готово',
    listeningNow: 'Слухаю...',
    heard: 'Я почув/почула',
    noSpeech: 'Мікрофон не розпізнав мовлення. Спробуй ще раз.',
    micUnsupported: 'Розпізнавання мовлення недоступне в цьому браузері.',
    micPermission: 'Дозволь доступ до мікрофона й спробуй ще раз.',
    greatPronunciation: 'Чудово',
    almostPronunciation: 'Майже правильно',
    retryPronunciation: 'Спробуй ще раз',
    soundPronunciation: 'Послухай складний звук',
    trickyPart: 'Складний шматочок',
    sayAnything: 'Говори вільно',
    secondsLeft: 'сек.',
    repeatWord: 'Повтори слово',
    readSentence: 'Прочитай речення',
    namePicture: 'Назви картинку',
    answerQuestion: 'Відповідай на запитання',
    describeAnimal: 'Опиши тварину',
    speakTwentySeconds: 'Говори 20 секунд',
    defaultPrompt: 'Скажи відповідь уголос',
    picturePrompt: 'Подивись на картинку і скажи, що це.',
    answerHidden: 'Відповідь прихована. Спробуй ще раз.',
    hintAnswer: 'Підказка',
    missingExpected: 'Правильну відповідь не додано до завдання.',
  },
} as const;
type TaskCopy = Record<keyof typeof taskCopy.ru, string>;

function TaskActionBar({
  copy,
  onHint,
  onReset,
  resetDisabled = false,
  className = '',
  resetClassName = '',
  centerContent = null,
}: {
  copy: TaskCopy;
  onHint?: () => void;
  onReset?: () => void;
  resetDisabled?: boolean;
  className?: string;
  resetClassName?: string;
  centerContent?: ReactNode;
}) {
  return (
    <div className={`mt-[clamp(0.75rem,1.6vh,1.2rem)] flex items-center justify-between gap-3 px-[clamp(0.2rem,1.2vw,1.45rem)] ${className}`}>
      <button
        type="button"
        onClick={onHint}
        className="inline-flex min-h-[2.35rem] items-center gap-2 rounded-full border border-purple-100 bg-white px-4 py-2 font-display text-sm font-bold text-indigo-800 shadow-[0_8px_18px_rgba(139,92,246,0.10)] transition hover:-translate-y-0.5 hover:border-yellow-200 dark:border-purple-800 dark:bg-[#2b1a3d] dark:text-purple-100"
      >
        <span className="text-lg leading-none">💡</span> {copy.hintAnswer}
      </button>
      <div className="flex min-w-0 flex-1 items-center justify-center">
        {centerContent}
      </div>
      <button
        type="button"
        onClick={onReset}
        disabled={resetDisabled}
        className={`inline-flex min-h-[2.35rem] items-center gap-2 rounded-full border border-purple-100 bg-white px-4 py-2 font-display text-sm font-bold text-indigo-800 shadow-[0_8px_18px_rgba(139,92,246,0.10)] transition hover:-translate-y-0.5 hover:border-violet-200 disabled:cursor-not-allowed disabled:opacity-45 dark:border-purple-800 dark:bg-[#2b1a3d] dark:text-purple-100 ${resetClassName}`}
      >
        <RotateCcw className="h-4 w-4 text-violet-500" /> {copy.reset}
      </button>
    </div>
  );
}

function TaskHintBubble({
  hint,
  label = 'Подсказка',
  className = '',
  iconClassName = '-my-4 h-20 w-20',
}: {
  hint?: string;
  label?: string;
  className?: string;
  iconClassName?: string;
}) {
  if (!hint) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`mx-auto flex min-h-[3.45rem] max-w-[36rem] items-center gap-2 rounded-[1.15rem] border border-purple-200 bg-purple-50/85 px-4 py-0 text-left font-body text-[clamp(0.95rem,1.35vw,1.12rem)] font-medium leading-snug text-indigo-900 shadow-sm dark:border-purple-700 dark:bg-purple-950/40 dark:text-purple-100 ${className}`}
    >
      <img src="/ui/fill-blank-bulb.png" alt="" className={`${iconClassName} shrink-0 object-contain`} />
      <span><strong className="font-display font-semibold text-purple-700 dark:text-purple-100">{label}:</strong> {hint}</span>
    </motion.div>
  );
}

function playFeedbackSound(kind: 'correct' | 'wrong') {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(kind === 'correct' ? 0.28 : 0.23, context.currentTime + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.7);
    master.connect(context.destination);
    const notes = kind === 'correct' ? [523.25, 659.25, 783.99, 1046.5] : [220, 196, 164.81];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * (kind === 'correct' ? 0.075 : 0.105);
      oscillator.type = kind === 'correct' ? 'triangle' : 'sawtooth';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(kind === 'correct' ? 0.18 : 0.1, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (kind === 'correct' ? 0.28 : 0.24));
      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.34);
    });
    window.setTimeout(() => context.close(), 1000);
  } catch {
    // Sound feedback is optional when a browser blocks Web Audio.
  }
}

function playButtonSound(kind: 'check' | 'study' | 'task') {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(kind === 'study' ? 0.24 : 0.18, context.currentTime + 0.018);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.62);
    master.connect(context.destination);
    const notes = kind === 'study'
      ? [392, 523.25, 659.25, 783.99]
      : kind === 'task'
        ? [587.33, 739.99, 880]
        : [440, 554.37];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.065;
      oscillator.type = kind === 'check' ? 'square' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(kind === 'study' ? 0.12 : 0.08, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.22);
    });
    window.setTimeout(() => context.close(), 850);
  } catch {
    // Optional UI sound.
  }
}

function playCompletionSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.26, context.currentTime + 0.04);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.25);
    master.connect(context.destination);

    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.11;
      oscillator.type = index === 3 ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.02, start + 0.22);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.38);
    });

    [1318.51, 1567.98, 2093].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + 0.48 + index * 0.055;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
    });
    window.setTimeout(() => context.close(), 1300);
  } catch {
    // Celebration visuals still carry the moment when audio is blocked.
  }
}

function CompletionCelebration({ stars, summary, showScore, copy, onExit }: { stars: number; summary: InteractiveScoreSummary | null; showScore: boolean; copy: CompletionCopy; onExit: () => void }) {
  const rating = Math.min(5, Math.max(0, Math.round(showScore ? summary?.starRating ?? 0 : stars)));
  const trophyStars = [
    ['-43%', '19%', 'h-8 w-8', '-12deg', 0.08],
    ['-26%', '66%', 'h-6 w-6', '10deg', 0.28],
    ['88%', '18%', 'h-7 w-7', '14deg', 0.16],
    ['107%', '60%', 'h-8 w-8', '-8deg', 0.34],
    ['33%', '-22%', 'h-5 w-5', '8deg', 0.22],
  ] as const;
  const confetti = [
    ['30%', '18%', 'h-3 w-3 rounded-full bg-pink-300', 0.06],
    ['69%', '18%', 'h-2.5 w-6 rounded-full bg-violet-300', 0.16],
    ['24%', '44%', 'h-2.5 w-2.5 rounded-sm border border-pink-300', 0.22],
    ['76%', '43%', 'h-2.5 w-2.5 rounded-sm bg-yellow-300', 0.32],
    ['16%', '32%', 'h-2 w-5 rounded-full bg-purple-300', 0.26],
    ['86%', '33%', 'h-2 w-5 rounded-full bg-pink-300', 0.12],
    ['39%', '66%', 'h-2.5 w-2.5 rounded-full bg-yellow-300', 0.38],
    ['61%', '64%', 'h-2.5 w-2.5 rounded-full bg-purple-300', 0.44],
  ] as const;
  const summaryCards = showScore && summary
    ? [
      {
        label: copy.completionResult,
        value: `${summary.scorePercent}%`,
        icon: <BarChart3 className="h-5 w-5" />,
        iconClass: 'bg-purple-100 text-violet-500',
      },
      {
        label: copy.completionErrors,
        value: summary.errorsCount,
        icon: <XCircle className="h-5 w-5" />,
        iconClass: 'bg-pink-100 text-pink-500',
      },
      {
        label: copy.completionFirstTry,
        value: `${summary.firstTryCorrect}/${summary.totalQuestions}`,
        icon: <CheckCircle2 className="h-5 w-5" />,
        iconClass: 'bg-emerald-100 text-emerald-500 dark:bg-[#4b236b] dark:text-purple-100',
      },
      {
        label: copy.completionRetry,
        value: summary.retryAttempts,
        icon: <RotateCcw className="h-5 w-5" />,
        iconClass: 'bg-sky-100 text-sky-500 dark:bg-[#4b236b] dark:text-purple-100',
      },
    ]
    : [];

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0, y: 16 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      className="relative flex h-full min-h-[clamp(21rem,48vh,33rem)] items-center justify-center overflow-hidden rounded-[1.55rem] bg-gradient-to-br from-white via-pink-50/75 to-violet-50 px-[clamp(1rem,2.4vw,2.3rem)] py-[clamp(1.05rem,2.8vh,2.2rem)] text-center shadow-[0_20px_42px_rgba(168,85,247,0.12)] dark:from-[#241331] dark:via-[#1b1028] dark:to-[#261437] dark:shadow-none"
    >
      <div className="pointer-events-none absolute inset-0 z-0">
        {confetti.map(([left, top, className, delay], index) => (
          <motion.span
            key={`${left}-${top}-${index}`}
            initial={{ opacity: 0, scale: 0.5, y: 8 }}
            animate={{
              opacity: [0, 0.95, 0.85, 0],
              scale: [0.5, 1, 0.86],
              y: [8, -5, -10],
              rotate: index % 2 ? [12, -10, 16] : [-14, 12, -10],
            }}
            transition={{ duration: 1.8, delay, ease: 'easeOut', repeat: Infinity, repeatDelay: 2.35 }}
            className={`absolute ${className}`}
            style={{ left, top }}
          />
        ))}
      </div>

      <div className="relative z-10 flex w-full max-w-[58rem] flex-col items-center">
        <motion.div
          animate={{ scale: [1, 1.035, 1] }}
          transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
          className="relative mb-[clamp(0.35rem,0.9vh,0.65rem)] flex h-[clamp(5.25rem,9.2vw,7.1rem)] w-[clamp(5.25rem,9.2vw,7.1rem)] items-center justify-center rounded-[1.35rem] border border-purple-100 bg-gradient-to-br from-violet-100 via-purple-50 to-pink-100 shadow-[0_16px_36px_rgba(168,85,247,0.18)] dark:border-white/80 dark:from-white dark:via-white dark:to-white"
        >
          <motion.span
            className="absolute inset-[-0.65rem] rounded-[1.75rem] border border-yellow-200/50"
            animate={{ scale: [0.96, 1.09, 0.96], opacity: [0.24, 0.58, 0.24] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          {trophyStars.map(([left, top, sizeClass, rotate, delay], index) => (
            <motion.img
              key={`${left}-${top}-${index}`}
              src="/ui/reward-star.png"
              alt=""
              draggable={false}
              initial={{ opacity: 0, scale: 0.55, y: 8 }}
              animate={{ opacity: [0, 1, 0.95, 0], scale: [0.55, 1.08, 0.92], y: [8, -4, -9] }}
              transition={{ duration: 1.9, delay, ease: 'easeOut', repeat: Infinity, repeatDelay: 2.2 }}
              className={`pointer-events-none absolute select-none object-contain ${sizeClass}`}
              style={{ left, top, rotate }}
            />
          ))}
          <span className="pointer-events-none absolute -right-9 top-8 h-2 w-8 rounded-full bg-violet-300/80 rotate-[-18deg]" />
          <span className="pointer-events-none absolute -left-9 bottom-9 h-2 w-6 rounded-full bg-pink-300/80 rotate-[28deg]" />
          <img
            src="/ui/completion-trophy.png"
            alt=""
            draggable={false}
            className="relative h-[112%] w-[112%] max-w-[112%] select-none object-contain"
          />
        </motion.div>

        <h3 className="font-display text-[clamp(2rem,4.1vw,3.55rem)] font-bold leading-tight text-purple-800 dark:text-purple-100">{copy.complete}</h3>
        {showScore && (
          <div className="mt-[clamp(0.45rem,1.1vh,0.8rem)] flex justify-center gap-[clamp(0.16rem,0.45vw,0.34rem)]">
            {[1, 2, 3, 4, 5].map(value => (
              <img
                key={value}
                src={REWARD_STAR_SRC}
                alt=""
                draggable={false}
                className={`h-[clamp(1.55rem,3.15vw,2.5rem)] w-[clamp(1.55rem,3.15vw,2.5rem)] select-none object-contain transition ${value <= rating ? 'opacity-100' : 'opacity-25 grayscale'}`}
              />
            ))}
          </div>
        )}

        {summaryCards.length > 0 && (
          <div className="mt-[clamp(1rem,2.6vh,1.7rem)] grid w-full gap-[clamp(0.55rem,1vw,0.85rem)] sm:grid-cols-4">
            {summaryCards.map(item => (
              <div key={item.label} className="flex min-h-[clamp(4.6rem,8.8vh,6.1rem)] items-center gap-[clamp(0.55rem,0.9vw,0.78rem)] rounded-[1rem] border border-purple-100 bg-white px-[clamp(0.72rem,1.18vw,1rem)] py-[clamp(0.58rem,1.2vh,0.86rem)] text-left shadow-[0_9px_20px_rgba(168,85,247,0.09)]">
                <div className={`flex h-[clamp(2.15rem,3.8vw,2.75rem)] w-[clamp(2.15rem,3.8vw,2.75rem)] shrink-0 items-center justify-center rounded-full ${item.iconClass}`}>
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="font-body text-[clamp(0.56rem,0.8vw,0.68rem)] font-bold uppercase leading-tight text-purple-300">{item.label}</div>
                  <div className="font-display text-[clamp(1.35rem,2.45vw,2.1rem)] font-bold leading-tight text-purple-800">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-[clamp(0.85rem,2.1vh,1.35rem)] max-w-[52rem] font-display text-[clamp(0.9rem,1.35vw,1.12rem)] font-semibold leading-snug text-purple-500">
          {showScore && stars > 0 ? `${copy.completionAward}: +${stars}` : showScore && summary ? copy.completionPractice : copy.great}
        </p>
        {showScore && stars > 0 && (
          <p className="mt-1 font-body text-[clamp(0.74rem,1vw,0.86rem)] font-semibold text-emerald-600">{copy.completionSaved}</p>
        )}

        <button
          onClick={onExit}
          className="student-accent-gradient mt-[clamp(1rem,2.4vh,1.65rem)] inline-flex min-h-[clamp(3.05rem,5.6vh,4rem)] items-center justify-center gap-4 rounded-[1.25rem] px-[clamp(2.25rem,4.8vw,4.1rem)] font-display text-[clamp(1.02rem,1.5vw,1.32rem)] font-semibold text-white shadow-[0_14px_28px_rgba(139,92,246,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(139,92,246,0.3)]"
        >
          {copy.toMap}
          <ArrowRight className="h-6 w-6" />
        </button>
      </div>
    </motion.div>
  );
}

// ==================== Utility: signed image ====================
function SignedImg({ path, className, placeholderClassName, draggable }: { path: string; className?: string; placeholderClassName?: string; draggable?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let a = true; signedUrlFor(path).then(u => { if (a) setUrl(u); }); return () => { a = false; }; }, [path]);
  if (!url) return <div className={placeholderClassName || `bg-purple-100 animate-pulse ${className}`} />;
  return <img src={url} alt="" className={className} draggable={draggable} />;
}

function normalizeSpeechText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-zа-яёіїєґ0-9\s'-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinSimilarity(a: string, b: string) {
  const left = normalizeSpeechText(a);
  const right = normalizeSpeechText(b);
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  const rows = left.length + 1;
  const cols = right.length + 1;
  const dp = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => row === 0 ? col : col === 0 ? row : 0));
  for (let row = 1; row < rows; row++) for (let col = 1; col < cols; col++) {
    const cost = left[row - 1] === right[col - 1] ? 0 : 1;
    dp[row][col] = Math.min(dp[row - 1][col] + 1, dp[row][col - 1] + 1, dp[row - 1][col - 1] + cost);
  }
  const distance = dp[left.length][right.length];
  return 1 - distance / Math.max(left.length, right.length);
}

function wordSimilarityScores(expected: string, transcript: string) {
  const expectedWords = normalizeSpeechText(expected).split(' ').filter(Boolean);
  const heardWords = normalizeSpeechText(transcript).split(' ').filter(Boolean);
  return expectedWords.map((word, index) => ({
    word,
    heard: heardWords[index] || '',
    score: levenshteinSimilarity(word, heardWords[index] || ''),
  }));
}

function speakingScore(expected: string, transcript: string, mode: SpeakingMode): { result: SpeechRecognitionResult; score: number; tricky: string } {
  const cleanExpected = normalizeSpeechText(expected);
  const cleanTranscript = normalizeSpeechText(transcript);
  if (!cleanExpected) {
    const wordCount = cleanTranscript.split(/\s+/).filter(Boolean).length;
    const score = mode === 'speak_20_seconds' ? Math.min(1, wordCount / 18) : Math.min(1, wordCount / 8);
    return { result: score > 0.72 ? 'great' : score > 0.38 ? 'almost' : 'retry', score, tricky: '' };
  }
  const wordScores = wordSimilarityScores(cleanExpected, cleanTranscript);
  const averageWordScore = wordScores.length
    ? wordScores.reduce((sum, item) => sum + item.score, 0) / wordScores.length
    : levenshteinSimilarity(cleanExpected, cleanTranscript);
  const lengthPenalty = Math.abs(cleanExpected.split(' ').filter(Boolean).length - cleanTranscript.split(' ').filter(Boolean).length) * 0.08;
  const score = Math.max(0, Math.min(1, averageWordScore - lengthPenalty));
  const weakest = wordScores.reduce((min, item) => item.score < min.score ? item : min, wordScores[0] || { word: '', heard: '', score: 1 });
  const minWordScore = weakest.score;
  const trickyWord = weakest.word || cleanExpected.split(' ')[0] || '';
  if (score >= 0.9 && minWordScore >= 0.86) return { result: 'great', score, tricky: '' };
  if (score >= 0.7 && minWordScore >= 0.58) return { result: 'almost', score, tricky: trickyWord };
  if (score >= 0.42) return { result: 'sound', score, tricky: trickyWord };
  return { result: 'retry', score, tricky: trickyWord };
}

function resultStyles(result?: SpeechRecognitionResult) {
  if (result === 'great') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200';
  if (result === 'almost') return 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-100';
  if (result === 'sound') return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-100';
  return 'border-purple-100 bg-white/85 text-purple-600 dark:border-purple-500/25 dark:bg-white/5 dark:text-purple-200';
}

function HighlightedSpeechTarget({ target, transcript }: { target: string; transcript: string }) {
  const heardWords = normalizeSpeechText(transcript).split(' ').filter(Boolean);
  const words = target.split(/(\s+)/);
  let wordIndex = 0;
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {words.map((part, index) => {
        if (/^\s+$/.test(part)) return <span key={index} className="w-1" />;
        const heard = heardWords[wordIndex++] || '';
        const score = transcript ? levenshteinSimilarity(part, heard) : 1;
        const tone = !transcript
          ? 'bg-white text-purple-700 dark:bg-white/10 dark:text-purple-100'
          : score >= 0.86
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-100'
            : score >= 0.68
              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-100'
              : 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-100';
        return <span key={index} className={`rounded-2xl px-3 py-1.5 font-display text-lg font-black shadow-sm ${tone}`}>{part}</span>;
      })}
    </div>
  );
}

function speakText(text: string, lang: Lang) {
  if (!('speechSynthesis' in window) || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'ua' ? 'uk-UA' : lang === 'ru' ? 'ru-RU' : 'en-US';
  utterance.rate = 0.86;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function speakingModeLabel(copy: TaskCopy, mode: SpeakingMode) {
  return {
    repeat_word: copy.repeatWord,
    read_sentence: copy.readSentence,
    name_picture: copy.namePicture,
    answer_question: copy.answerQuestion,
    describe_animal: copy.describeAnimal,
    speak_20_seconds: copy.speakTwentySeconds,
  }[mode];
}

function defaultSpeakingPrompt(copy: TaskCopy, mode: SpeakingMode) {
  return {
    repeat_word: copy.repeatWord,
    read_sentence: copy.readSentence,
    name_picture: copy.picturePrompt,
    answer_question: copy.defaultPrompt,
    describe_animal: copy.describeAnimal,
    speak_20_seconds: copy.sayAnything,
  }[mode];
}

function SpeakingPracticeTask({ payload, onDone, onEvent, lang }: { payload: SpeakingPayload; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const mode = (payload?.mode || 'repeat_word') as SpeakingMode;
  const target = String(payload?.target || '').trim();
  const rawPrompt = String(payload?.prompt || '').trim();
  const prompt = rawPrompt === 'Say the word' && !['repeat_word', 'read_sentence'].includes(mode) ? '' : rawPrompt;
  const seconds = Math.max(5, Math.min(60, Number(payload?.seconds) || (mode === 'speak_20_seconds' ? 20 : 12)));
  const image = String(payload?.image || '').trim();
  const audio = String(payload?.audio || '').trim();
  const expectedText = (() => {
    if (mode === 'repeat_word' || mode === 'read_sentence') return target || prompt;
    if (mode === 'name_picture' || mode === 'answer_question') return target;
    return target;
  })();
  const visiblePrompt = mode === 'repeat_word' || mode === 'read_sentence'
    ? defaultSpeakingPrompt(copy, mode)
    : (prompt || defaultSpeakingPrompt(copy, mode));
  const hidesAnswerInitially = ['name_picture', 'answer_question', 'describe_animal'].includes(mode);
  const freeSpeakingMode = mode === 'speak_20_seconds' || mode === 'describe_animal';
  const needsExpectedAnswer = !freeSpeakingMode;
  const showMainPrompt = !['repeat_word', 'read_sentence'].includes(mode);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [hint, setHint] = useState('');
  const [hintRevealed, setHintRevealed] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(seconds);
  const [attempted, setAttempted] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const score = transcript && (expectedText || freeSpeakingMode) ? speakingScore(expectedText, transcript, mode) : null;
  const resultLabel = score?.result === 'great'
    ? copy.greatPronunciation
    : score?.result === 'almost'
      ? copy.almostPronunciation
      : score?.result === 'sound'
        ? copy.soundPronunciation
        : copy.retryPronunciation;
  const showAnswer = Boolean(expectedText) && (!hidesAnswerInitially || score?.result === 'great');
  const visibleAnswer = Boolean(expectedText) && (showAnswer || hintRevealed);
  const pronunciationHint = score?.tricky
    ? `${copy.trickyPart}: ${score.tricky}`
    : (prompt || visiblePrompt || copy.defaultPrompt);

  useEffect(() => () => {
    recognitionRef.current?.stop?.();
    if (timerRef.current) window.clearInterval(timerRef.current);
    micStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    setHintRevealed(false);
  }, [mode, expectedText]);

  useEffect(() => {
    let alive = true;
    if (!audio) {
      setAudioUrl(null);
      return;
    }
    if (/^(https?:|data:|blob:)/.test(audio)) setAudioUrl(audio);
    else signedUrlFor(audio, 3600).then(url => { if (alive) setAudioUrl(url); });
    return () => { alive = false; };
  }, [audio]);

  const stop = () => {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    micStreamRef.current?.getTracks().forEach(track => track.stop());
    micStreamRef.current = null;
  };

  const playPromptAudio = () => {
    const textToSpeak = expectedText || prompt || visiblePrompt;
    if (audioUrl) {
      const audioElement = new Audio(audioUrl);
      audioElement.volume = 1;
      audioElement.play().catch(() => undefined);
      return;
    }
    speakText(textToSpeak, lang);
  };

  const resetTask = () => {
    stop();
    setTranscript('');
    setHint('');
    setHintRevealed(false);
    setAttempted(false);
    setRemaining(seconds);
  };

  const start = async () => {
    const SpeechRecognitionClass = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionClass) {
      setHint(copy.micUnsupported);
      onEvent('speech_unsupported', { mechanic: 'speaking_practice' });
      return;
    }
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch {
      setHint(copy.micPermission);
      onEvent('speech_permission_denied', { mechanic: 'speaking_practice' });
      return;
    }
    setTranscript('');
    setHint('');
    setAttempted(false);
    setRemaining(seconds);
    const recognition = new SpeechRecognitionClass();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = mode === 'speak_20_seconds' || mode === 'describe_animal';
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const text = Array.from(event.results).map(result => Array.from(result)[0]?.transcript || '').join(' ').trim();
      setTranscript(text);
    };
    recognition.onerror = () => {
      setHint(copy.noSpeech);
      setRecording(false);
      micStreamRef.current?.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
      onEvent('speech_error', { mechanic: 'speaking_practice' });
    };
    recognition.onend = () => {
      setRecording(false);
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      micStreamRef.current?.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    };
    try {
      recognition.start();
      setRecording(true);
      onEvent('speech_started', { mechanic: 'speaking_practice', mode });
      timerRef.current = window.setInterval(() => {
        setRemaining(value => {
          if (value <= 1) {
            stop();
            return 0;
          }
          return value - 1;
        });
      }, 1000);
    } catch {
      setHint(copy.micUnsupported);
      setRecording(false);
      micStreamRef.current?.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
  };

  const finishSpeakingTask = () => {
    playButtonSound('check');
    if (needsExpectedAnswer && !expectedText) {
      setAttempted(true);
      setHint(copy.missingExpected);
      onEvent('answer_wrong', { mechanic: 'speaking_practice', mode, transcript, expected: '', score: 0, result: 'retry' });
      return;
    }
    const finalScore = speakingScore(expectedText, transcript, mode);
    setAttempted(true);
    onEvent(finalScore.result === 'great' ? 'answer_correct' : 'answer_wrong', {
      mechanic: 'speaking_practice',
      mode,
      transcript,
      expected: expectedText,
      score: Math.round(finalScore.score * 100),
      result: finalScore.result,
    });
    if (finalScore.result !== 'great') return;
    setTimeout(onDone, 650);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-2">
      <section className="overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-pink-50/80 via-white to-purple-50/85 px-2 pb-2 pt-5 text-center shadow-inner shadow-pink-100/50 dark:from-[#251331] dark:via-[#211231] dark:to-[#102039] sm:px-3 sm:pb-3 sm:pt-6">
        <div className="relative px-3 py-2 dark:from-white/5 dark:via-white/5 dark:to-purple-500/10 sm:px-6">
          <img src="/ui/word-search-star-pink.png" alt="" draggable={false} className="pointer-events-none absolute right-[3%] top-[8%] hidden h-10 w-10 rotate-12 select-none object-contain drop-shadow-[0_8px_14px_rgba(236,72,153,0.18)] sm:block dark:sm:hidden" />
          <img src="/ui/speaking-star-dark-large.png" alt="" draggable={false} className="pointer-events-none absolute right-[3%] top-[8%] hidden h-14 w-14 rotate-12 select-none object-contain dark:sm:block" />
          <img src="/ui/word-search-star-blue.png" alt="" draggable={false} className="pointer-events-none absolute right-[11%] top-[22%] hidden h-8 w-8 -rotate-12 select-none object-contain drop-shadow-[0_8px_14px_rgba(56,189,248,0.18)] sm:block dark:sm:hidden" />
          <img src="/ui/speaking-star-dark-small.png" alt="" draggable={false} className="pointer-events-none absolute right-[11%] top-[22%] hidden h-12 w-12 -rotate-12 select-none object-contain dark:sm:block" />
          <img src="/ui/word-search-star-yellow.png" alt="" draggable={false} className="pointer-events-none absolute right-[20%] top-[12%] hidden h-8 w-8 select-none object-contain drop-shadow-[0_8px_14px_rgba(250,204,21,0.18)] sm:block dark:sm:hidden" />
          <img src="/ui/speaking-star-dark-wide.png" alt="" draggable={false} className="pointer-events-none absolute right-[20%] top-[12%] hidden h-12 w-12 select-none object-contain dark:sm:block" />
          <button
            type="button"
            onClick={playPromptAudio}
            className={`student-accent-gradient group relative mx-auto -mt-4 mb-1 flex h-16 w-16 -translate-y-2 items-center justify-center rounded-full text-white shadow-[0_12px_26px_rgba(168,85,247,0.25)] ring-4 ring-white/85 transition hover:-translate-y-3 hover:shadow-[0_16px_32px_rgba(168,85,247,0.30)] focus:outline-none focus:ring-pink-200/90 dark:ring-white/10 sm:h-[4.5rem] sm:w-[4.5rem] ${recording ? 'animate-pulse' : ''}`}
            aria-label={copy.listen}
          >
            <span className="pointer-events-none absolute -left-8 top-1/2 h-8 w-4 -translate-y-1/2 rounded-l-full border-y-[4px] border-l-[4px] border-pink-200/80 opacity-80" />
            <span className="pointer-events-none absolute -left-12 top-1/2 h-11 w-5 -translate-y-1/2 rounded-l-full border-y-[4px] border-l-[4px] border-pink-100/75 opacity-75" />
            <span className="pointer-events-none absolute -right-8 top-1/2 h-8 w-4 -translate-y-1/2 rounded-r-full border-y-[4px] border-r-[4px] border-pink-200/80 opacity-80" />
            <span className="pointer-events-none absolute -right-12 top-1/2 h-11 w-5 -translate-y-1/2 rounded-r-full border-y-[4px] border-r-[4px] border-pink-100/75 opacity-75" />
            <span className="absolute inset-1 rounded-full border border-white/35" />
            <span className="absolute left-3 top-3 h-4 w-4 rounded-full bg-white/40 blur-[1px]" />
            <Volume2 className="relative h-7 w-7 drop-shadow-sm sm:h-8 sm:w-8" />
          </button>
          <div className="mb-1.5 font-body text-[0.68rem] font-black uppercase text-pink-400 sm:text-xs">{speakingModeLabel(copy, mode)}</div>
          {showMainPrompt && <h3 className="mx-auto mb-2 max-w-2xl font-display text-2xl font-black leading-tight text-purple-800 dark:text-purple-100 sm:text-3xl">{visiblePrompt}</h3>}

          {expectedText ? (
            <div className="relative mx-auto flex min-h-16 max-w-4xl items-center justify-center rounded-[1rem] bg-white/95 px-4 py-1.5 shadow-md shadow-purple-100/35 ring-1 ring-purple-100/70 dark:bg-white/10 dark:ring-purple-500/20 sm:min-h-[4.75rem] sm:px-7">
              <div className="flex min-w-0 justify-center px-20 [&_span]:text-xl sm:px-28 sm:[&_span]:text-2xl">
                {visibleAnswer ? (
                  <HighlightedSpeechTarget target={expectedText} transcript={transcript} />
                ) : (
                  <span className="rounded-2xl bg-purple-50 px-4 py-2 font-body text-sm font-black text-purple-300 dark:bg-white/10 dark:text-purple-200">{copy.answerHidden}</span>
                )}
              </div>
              {image && <SignedImg path={image} className="absolute right-3 top-1/2 h-24 w-32 -translate-y-1/2 object-contain sm:right-6 sm:h-32 sm:w-44" draggable={false} />}
            </div>
          ) : (
            <p className="mx-auto max-w-2xl rounded-[1.15rem] bg-white/90 px-4 py-3 font-body text-sm font-bold text-purple-500 shadow-sm ring-1 ring-purple-100/70 dark:bg-white/10 dark:text-purple-200 dark:ring-purple-500/20">{copy.sayAnything}</p>
          )}
        </div>
      </section>

      <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
        <div className={`rounded-[1rem] border px-4 py-2.5 shadow-sm transition ${resultStyles(score?.result)}`}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="font-body text-xs font-black uppercase opacity-70">{score ? resultLabel : recording ? copy.listeningNow : copy.heard}</span>
            {recording && <span className="rounded-full bg-white/70 px-3 py-1 font-body text-xs font-black text-purple-600 dark:bg-white/10 dark:text-purple-100">{remaining} {copy.secondsLeft}</span>}
          </div>
          <div className="min-h-7 font-display text-lg font-black">
            {transcript || hint || '...'}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-[1rem] bg-white/80 p-2 shadow-sm ring-1 ring-purple-100/80 dark:bg-white/5 dark:ring-purple-500/25">
          <button type="button" onClick={recording ? stop : start} style={{ background: speakingActionGradient }} className="inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-3.5 text-white shadow-lg shadow-purple-300/40 transition hover:-translate-y-0.5" aria-label={recording ? copy.stopSpeaking : copy.startSpeaking}>
            {recording ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-6 w-6" />}
          </button>
          <button type="button" onClick={resetTask} className="inline-flex h-11 items-center gap-2 rounded-xl bg-purple-50 px-3.5 font-body text-sm font-black text-purple-500 transition hover:-translate-y-0.5 hover:bg-purple-100 dark:bg-white/10 dark:text-purple-100" aria-label={copy.reset}>
            <RotateCcw className="h-5 w-5" /> {copy.reset}
          </button>
        </div>
      </div>

      <div className={`${hintRevealed ? 'grid items-center gap-2 lg:grid-cols-[1fr_auto]' : 'flex justify-center lg:justify-end'}`}>
        <AnimatePresence initial={false}>
          {hintRevealed && (
            <div>
              <TaskHintBubble
                hint={pronunciationHint}
                label={copy.hintAnswer}
                className="max-w-full"
              />
            </div>
          )}
        </AnimatePresence>
        <div className="flex flex-wrap justify-center gap-2 lg:justify-end">
          <button type="button" onClick={() => { setHintRevealed(true); onEvent('hint_requested', { mechanic: 'speaking_practice', mode }); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 font-body text-sm font-black text-purple-600 shadow-md shadow-purple-100/50 ring-1 ring-purple-100 transition hover:-translate-y-0.5 hover:bg-purple-50 dark:bg-white/10 dark:text-purple-100 dark:ring-purple-500/25">
            <Lightbulb className="h-4 w-4 text-yellow-400" /> {copy.hintAnswer}
          </button>
          <button type="button" onClick={finishSpeakingTask} disabled={!transcript.trim()} style={{ background: speakingActionGradient }} className="inline-flex h-10 items-center gap-2 rounded-xl px-5 font-body text-sm font-black text-white shadow-xl shadow-purple-300/40 transition hover:-translate-y-0.5 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none">
            <CheckCircle2 className="h-4 w-4" /> {copy.check}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== MATCHING ====================
function MatchingTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const pairs = payload?.pairs || [];
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [wrong, setWrong] = useState<number | null>(null);
  const [wrongLeft, setWrongLeft] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const leftRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const rightRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [lines, setLines] = useState<Array<{ left: number; right: number; x1: number; y1: number; x2: number; y2: number }>>([]);
  const rights = useMemo(() => {
    const arr = pairs.map((_: any, i: number) => i);
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }, [pairs.length]);

  const done = Object.keys(matches).length === pairs.length && pairs.length > 0;
  useEffect(() => { if (done) setTimeout(onDone, 1000); }, [done]);

  useLayoutEffect(() => {
    const draw = () => {
      const board = boardRef.current;
      if (!board) return;
      const boardRect = board.getBoundingClientRect();
      const next = Object.entries(matches).flatMap(([leftKey, rightIdx]) => {
        const left = Number(leftKey);
        const leftEl = leftRefs.current[left];
        const rightEl = rightRefs.current[rightIdx];
        if (!leftEl || !rightEl) return [];
        const l = leftEl.getBoundingClientRect();
        const r = rightEl.getBoundingClientRect();
        return [{
          left,
          right: rightIdx,
          x1: l.right - boardRect.left + 1,
          y1: l.top + l.height / 2 - boardRect.top,
          x2: r.left - boardRect.left - 1,
          y2: r.top + r.height / 2 - boardRect.top,
        }];
      });
      setLines(next);
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [matches, pairs.length, rights]);

  const clickRight = (rightIdx: number) => {
    if (selectedLeft === null) return;
    if (matches[selectedLeft] !== undefined || Object.values(matches).includes(rightIdx)) return;
    if (rightIdx === selectedLeft) {
      onEvent('answer_correct', { mechanic: 'matching', left: selectedLeft, right: rightIdx });
      setMatches(m => ({ ...m, [selectedLeft]: rightIdx }));
      setSelectedLeft(null);
    } else {
      onEvent('answer_wrong', { mechanic: 'matching', left: selectedLeft, right: rightIdx, expected: selectedLeft });
      setWrong(rightIdx);
      setWrongLeft(selectedLeft);
      setTimeout(() => { setWrong(null); setWrongLeft(null); }, 520);
    }
  };

  const readSideText = (s: any) => String(s?.text || s?.label || s?.word || '').trim();
  const readSideMiniImage = (s: any) => String(s?.miniImage || s?.mini_image || s?.thumbnail || s?.thumb || '').trim();
  const readSideFullImage = (s: any) => String(s?.image || s?.image_url || s?.imageUrl || '').trim();
  const renderSide = (s: any) => {
    const text = readSideText(s);
    const miniImage = readSideMiniImage(s);
    const fullImage = readSideFullImage(s);
    if (miniImage) {
      return (
        <span className="relative flex h-full min-h-[3.65rem] w-full min-w-0 items-center justify-center overflow-visible pl-[7.25rem] pr-8">
          <SignedImg
            path={miniImage}
            className="absolute left-4 top-1/2 h-28 w-28 -translate-y-1/2 object-contain drop-shadow-[0_10px_14px_rgba(124,58,237,0.22)]"
            placeholderClassName="absolute left-4 top-1/2 h-28 w-28 -translate-y-1/2"
          />
          <span className="min-w-0 truncate text-center font-display text-[clamp(1.05rem,1.45vw,1.26rem)] font-bold leading-tight">
            {text || ' '}
          </span>
        </span>
      );
    }
    if (fullImage) {
      return (
        <span className="flex aspect-square w-full items-center justify-center p-3">
          <SignedImg
            path={fullImage}
            className="h-full w-full object-contain drop-shadow-[0_10px_16px_rgba(124,58,237,0.18)]"
            placeholderClassName="h-full w-full"
          />
        </span>
      );
    }
    return (
      <span className="flex w-full min-w-0 items-center justify-center px-8">
        <span className="min-w-0 truncate text-center font-display text-[clamp(1rem,1.38vw,1.2rem)] font-bold leading-tight">
          {text || ' '}
        </span>
      </span>
    );
  };
  const matchedRightValues = Object.values(matches);
  const isFullImageOnly = (s: any) => Boolean(readSideFullImage(s) && !readSideMiniImage(s));
  const imageOnlyCard = 'px-3 py-2';
  const cardBase = 'relative h-[4.55rem] overflow-visible rounded-[1.05rem] border-2 px-4 py-2.5 text-purple-800 shadow-[0_7px_18px_rgba(124,58,237,0.10)] transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-purple-200/70 dark:text-purple-100';
  const cardLive = 'border-purple-100 bg-white hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-[0_11px_24px_rgba(124,58,237,0.15)] dark:border-purple-700 dark:bg-[#2b1a3d]';
  const cardSelected = masterConnectionSelectedClass;
  const cardDone = 'border-emerald-200 bg-emerald-50 text-emerald-700 opacity-80 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200';
  const cardWrong = 'border-rose-300 bg-rose-50 text-rose-600 animate-pulse dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200';
  const leftDot = 'after:absolute after:right-[-0.45rem] after:top-1/2 after:z-20 after:hidden after:h-3 after:w-3 after:-translate-y-1/2 after:rounded-full after:bg-purple-400 after:shadow-[0_0_0_4px_rgba(196,181,253,0.18)] sm:after:block';
  const rightDot = 'before:absolute before:left-[-0.45rem] before:top-1/2 before:z-20 before:hidden before:h-3 before:w-3 before:-translate-y-1/2 before:rounded-full before:bg-purple-400 before:shadow-[0_0_0_4px_rgba(196,181,253,0.18)] sm:before:block';

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-center space-y-[clamp(0.7rem,1.45vh,1.05rem)]">
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto flex w-fit items-center gap-2 rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-2 font-body text-sm font-800 text-emerald-600 shadow-sm dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          >
            <CheckCircle2 className="h-5 w-5" /> {copy.matchingDone}
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={boardRef} className="relative grid gap-x-[clamp(2.7rem,7vw,5rem)] gap-y-4 sm:grid-cols-2">
        <svg className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full overflow-visible sm:block" aria-hidden="true">
          <defs>
            <linearGradient id="matching-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EFA4DE" />
              <stop offset="45%" stopColor="#D7A9E9" />
              <stop offset="100%" stopColor="#B6BDF9" />
            </linearGradient>
            <filter id="matching-line-shadow" x="-20%" y="-80%" width="140%" height="260%">
              <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#c084fc" floodOpacity="0.28" />
            </filter>
          </defs>
          {lines.map(line => {
            const mid = Math.max(36, Math.abs(line.x2 - line.x1) / 2);
            return (
              <g key={`${line.left}-${line.right}`}>
                <motion.path
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  d={`M ${line.x1} ${line.y1} C ${line.x1 + mid} ${line.y1}, ${line.x2 - mid} ${line.y2}, ${line.x2} ${line.y2}`}
                  fill="none"
                  filter="url(#matching-line-shadow)"
                  stroke="url(#matching-line)"
                  strokeLinecap="round"
                  strokeWidth="5"
                />
                <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} cx={line.x1} cy={line.y1} r="7" fill="#EFA4DE" />
                <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} cx={line.x2} cy={line.y2} r="7" fill="#B6BDF9" />
              </g>
            );
          })}
        </svg>
        <div className="relative z-20 space-y-[clamp(0.55rem,1.05vh,0.8rem)]">
          <div className="pl-4 font-body text-xs font-900 uppercase tracking-wider text-purple-400">A</div>
          {pairs.map((p: any, i: number) => (
            <motion.button key={i} disabled={matches[i] !== undefined}
              animate={wrongLeft === i ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
              ref={el => { leftRefs.current[i] = el; }}
              onClick={() => { setSelectedLeft(i); onEvent('choice_selected', { mechanic: 'matching', side: 'left', index: i }); }}
              className={`${cardBase} ${leftDot} w-full ${isFullImageOnly(p.left) ? imageOnlyCard : ''} ${
                matches[i] !== undefined ? cardDone :
                wrongLeft === i ? cardWrong :
                selectedLeft === i ? cardSelected : cardLive
              }`}>
              {matches[i] !== undefined && <CheckCircle2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-500" />}
              {renderSide(p.left)}
            </motion.button>
          ))}
        </div>
        <div className="relative z-20 space-y-[clamp(0.55rem,1.05vh,0.8rem)]">
          <div className="pl-4 font-body text-xs font-900 uppercase tracking-wider text-purple-400">B</div>
          {rights.map((rightIdx: number) => (
            <motion.button key={rightIdx} disabled={matchedRightValues.includes(rightIdx)}
              animate={wrong === rightIdx ? { x: [0, 6, -6, 4, -4, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
              ref={el => { rightRefs.current[rightIdx] = el; }}
              onClick={() => clickRight(rightIdx)}
              className={`${cardBase} ${rightDot} w-full ${isFullImageOnly(pairs[rightIdx]?.right) ? imageOnlyCard : ''} ${
                matchedRightValues.includes(rightIdx) ? cardDone :
                wrong === rightIdx ? cardWrong : cardLive
              }`}>
              {wrong === rightIdx && <XCircle className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-rose-500" />}
              {matchedRightValues.includes(rightIdx) && <CheckCircle2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-500" />}
              {renderSide(pairs[rightIdx]?.right)}
            </motion.button>
          ))}
        </div>
      </div>
      {showHint && <TaskHintBubble hint={String(payload?.hint || '').trim()} label={copy.hintAnswer} />}
      <TaskActionBar
        copy={copy}
        onHint={() => {
          setShowHint(true);
          onEvent('hint_requested', { mechanic: 'matching' });
        }}
        onReset={() => {
          setSelectedLeft(null);
          setMatches({});
          setWrong(null);
          setWrongLeft(null);
          setShowHint(false);
          onEvent('reset_requested', { mechanic: 'matching' });
        }}
        resetDisabled={Object.keys(matches).length === 0 && selectedLeft === null && !showHint}
      />
    </div>
  );
}

// ==================== WORD LEGO ====================
function WordLegoTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  // For word_lego, user builds by joining halves. We use same matching interaction visually different.
  const pairs = payload?.pairs || [];
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [built, setBuilt] = useState<{ left: number; right: number }[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const leftRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const rightRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [lines, setLines] = useState<Array<{ left: number; right: number; x1: number; y1: number; x2: number; y2: number }>>([]);
  const done = built.length === pairs.length && pairs.length > 0;
  useEffect(() => { if (done) setTimeout(onDone, 700); }, [done]);

  const rights = useMemo(() => {
    const arr = pairs.map((_: any, i: number) => i);
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }, [pairs.length]);

  const usedLefts = new Set(built.map(b => b.left));
  const usedRights = new Set(built.map(b => b.right));

  useLayoutEffect(() => {
    const draw = () => {
      const board = boardRef.current;
      if (!board) return;
      const boardRect = board.getBoundingClientRect();
      const next = built.flatMap(({ left, right }) => {
        const leftEl = leftRefs.current[left];
        const rightEl = rightRefs.current[right];
        if (!leftEl || !rightEl) return [];
        const l = leftEl.getBoundingClientRect();
        const r = rightEl.getBoundingClientRect();
        return [{
          left,
          right,
          x1: l.right - boardRect.left + 1,
          y1: l.top + l.height / 2 - boardRect.top,
          x2: r.left - boardRect.left - 1,
          y2: r.top + r.height / 2 - boardRect.top,
        }];
      });
      setLines(next);
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [built, pairs.length, rights]);

  const clickRight = (rightIdx: number) => {
    if (selectedLeft === null) return;
    if (rightIdx === selectedLeft) {
      onEvent('answer_correct', { mechanic: 'word_lego', left: selectedLeft, right: rightIdx });
      setBuilt(b => [...b, { left: selectedLeft, right: rightIdx }]);
      setSelectedLeft(null);
    } else {
      onEvent('answer_wrong', { mechanic: 'word_lego', left: selectedLeft, right: rightIdx, expected: selectedLeft });
      setWrong(rightIdx); setTimeout(() => setWrong(null), 400);
    }
  };

  const asText = (s: any) => s?.text || '';

  return (
    <div className="flex h-full min-h-[clamp(15rem,34vh,23rem)] flex-col justify-between">
      <div ref={boardRef} className="relative grid flex-1 items-start gap-[clamp(2.2rem,12vw,9rem)] px-[clamp(0.25rem,1.4vw,1.6rem)] pt-[clamp(0.15rem,1vh,0.7rem)] sm:grid-cols-2">
        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id="word-lego-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EFA4DE" />
              <stop offset="45%" stopColor="#D7A9E9" />
              <stop offset="100%" stopColor="#B6BDF9" />
            </linearGradient>
            <filter id="word-lego-line-shadow" x="-20%" y="-80%" width="140%" height="260%">
              <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#c084fc" floodOpacity="0.28" />
            </filter>
          </defs>
          {lines.map(line => {
            const mid = Math.max(32, Math.abs(line.x2 - line.x1) / 2);
            return (
              <g key={`${line.left}-${line.right}`}>
                <motion.path
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  d={`M ${line.x1} ${line.y1} C ${line.x1 + mid} ${line.y1}, ${line.x2 - mid} ${line.y2}, ${line.x2} ${line.y2}`}
                  fill="none"
                  filter="url(#word-lego-line-shadow)"
                  stroke="url(#word-lego-line)"
                  strokeLinecap="round"
                  strokeWidth="5"
                />
                <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} cx={line.x1} cy={line.y1} r="7" fill="#EFA4DE" />
                <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} cx={line.x2} cy={line.y2} r="7" fill="#B6BDF9" />
              </g>
            );
          })}
        </svg>
        <div className="relative z-10 flex flex-col items-center">
          <div className="student-accent-gradient mb-[clamp(0.55rem,1.2vh,0.75rem)] rounded-full px-[clamp(1.15rem,2.8vw,2.1rem)] py-[clamp(0.28rem,0.7vh,0.46rem)] font-body text-[clamp(0.66rem,0.95vw,0.82rem)] font-bold uppercase tracking-[0.08em] text-white shadow-[0_8px_18px_rgba(139,92,246,0.22)]">
            {copy.partOne}
          </div>
          <div className="flex w-full max-w-[13rem] flex-col gap-[clamp(0.42rem,1.05vh,0.72rem)]">
            {pairs.map((p: any, i: number) => (
              <button key={i} disabled={usedLefts.has(i)} ref={el => { leftRefs.current[i] = el; }} onClick={() => { setSelectedLeft(i); onEvent('choice_selected', { mechanic: 'word_lego', side: 'left', index: i }); }}
                className={`relative flex min-h-[clamp(3rem,6.4vh,4.15rem)] w-full items-center justify-center rounded-[1rem] border bg-white/95 px-5 font-display text-[clamp(1.24rem,2.35vw,2rem)] font-bold text-indigo-800 shadow-[0_8px_20px_rgba(139,92,246,0.10)] transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-purple-100 ${
                  usedLefts.has(i)
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 opacity-80'
                    : selectedLeft === i
                      ? masterConnectionSelectedClass
                      : 'border-purple-100 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-[0_12px_24px_rgba(139,92,246,0.16)]'
                }`}
              >
                <span>{asText(p.left)}</span>
                <span className="absolute right-[-0.45rem] top-1/2 z-20 flex h-3 w-3 -translate-y-1/2 rounded-full bg-violet-500 shadow-[0_0_0_4px_rgba(196,181,253,0.18)]">
                  <span className={`absolute inset-0 rounded-full ${selectedLeft === i ? 'bg-violet-600' : usedLefts.has(i) ? 'bg-violet-400' : 'bg-violet-500'}`} />
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="student-accent-gradient mb-[clamp(0.55rem,1.2vh,0.75rem)] rounded-full px-[clamp(1.15rem,2.8vw,2.1rem)] py-[clamp(0.28rem,0.7vh,0.46rem)] font-body text-[clamp(0.66rem,0.95vw,0.82rem)] font-bold uppercase tracking-[0.08em] text-white shadow-[0_8px_18px_rgba(244,114,182,0.22)]">
            {copy.partTwo}
          </div>
          <div className="flex w-full max-w-[13rem] flex-col gap-[clamp(0.42rem,1.05vh,0.72rem)]">
            {rights.map((idx: number) => (
              <button key={idx} ref={el => { rightRefs.current[idx] = el; }} disabled={selectedLeft === null || usedRights.has(idx)} onClick={() => clickRight(idx)}
                className={`relative flex min-h-[clamp(3rem,6.4vh,4.15rem)] w-full items-center justify-center rounded-[1rem] border bg-pink-50/55 px-5 font-display text-[clamp(1.24rem,2.35vw,2rem)] font-bold text-indigo-800 shadow-[0_8px_20px_rgba(244,114,182,0.10)] transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-pink-100 disabled:hover:translate-y-0 ${
                  usedRights.has(idx)
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 opacity-80'
                    : wrong === idx
                      ? 'animate-pulse border-rose-300 bg-rose-50 text-rose-600'
                      : selectedLeft === null
                        ? 'border-pink-100 opacity-70'
                        : 'border-pink-100 hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-[0_12px_24px_rgba(244,114,182,0.16)]'
                }`}
              >
                <span className="absolute left-[-0.45rem] top-1/2 z-20 flex h-3 w-3 -translate-y-1/2 rounded-full bg-pink-500 shadow-[0_0_0_4px_rgba(244,114,182,0.16)]">
                  <span className={`absolute inset-0 rounded-full ${wrong === idx ? 'bg-rose-400' : usedRights.has(idx) ? 'bg-pink-400' : 'bg-pink-500'}`} />
                </span>
                <span>{asText(pairs[idx]?.right)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {showHint && <TaskHintBubble hint={String(payload?.hint || '').trim()} label={copy.hintAnswer} />}
      <TaskActionBar
        copy={copy}
        onHint={() => {
          setShowHint(true);
          onEvent('hint_requested', { mechanic: 'word_lego' });
        }}
        onReset={() => {
          setSelectedLeft(null);
          setBuilt([]);
          setWrong(null);
          setShowHint(false);
          onEvent('reset_requested', { mechanic: 'word_lego' });
        }}
        resetDisabled={built.length === 0 && selectedLeft === null && !showHint}
      />
    </div>
  );
}

// ==================== FILL LETTERS ====================
function FillLettersTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const text: string = payload?.text || '';
  const answers: string[] = payload?.answers || [];
  const parts = text.split('___');
  const [values, setValues] = useState<string[]>(Array(answers.length).fill(''));
  const [checked, setChecked] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const hintText = String(payload?.hint || '').trim();

  const check = () => {
    playButtonSound('check');
    setChecked(true);
    const ok = values.every((v, i) => v.trim().toLowerCase() === (answers[i] || '').toLowerCase());
    onEvent(ok ? 'answer_correct' : 'answer_wrong', { mechanic: 'fill_letters', values, answers });
    if (ok) setTimeout(onDone, 600);
  };
  const reset = () => {
    setValues(Array(answers.length).fill(''));
    setChecked(false);
    setShowHint(false);
    onEvent('reset_requested', { mechanic: 'fill_letters' });
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-center">
      <div className="relative p-0">
        <img
          src="/ui/fill-blank-tape.png"
          alt=""
          className="pointer-events-none absolute -left-20 -top-16 z-10 w-[clamp(10rem,16vw,13.5rem)] -rotate-12 object-contain drop-shadow-[0_12px_18px_rgba(139,92,246,0.18)] dark:hidden"
        />
        <img
          src="/ui/fill-blank-tape-dark.png"
          alt=""
          className="pointer-events-none absolute -left-[clamp(2.55rem,3.4vw,3.2rem)] -top-[clamp(2.15rem,2.9vw,2.65rem)] z-10 hidden w-[clamp(6.4rem,10.25vw,8.7rem)] -rotate-12 object-contain dark:block"
        />
        <div className="relative overflow-hidden rounded-[1.55rem] border-2 border-dashed border-pink-200/90 bg-gradient-to-br from-[#fff8ec] via-[#fffaf5] to-[#fff3f8] px-[clamp(1.2rem,3.2vw,3rem)] py-[clamp(1.8rem,4.8vh,3.6rem)] shadow-[0_10px_24px_rgba(236,72,153,0.10)] dark:border-purple-700 dark:from-[#2d2136] dark:via-[#291d34] dark:to-[#331b38]">
          <img
            src="/ui/fill-blank-notebook.png"
            alt=""
            className="pointer-events-none absolute -bottom-12 -right-24 hidden w-[clamp(22rem,38vw,33rem)] object-contain drop-shadow-[0_16px_24px_rgba(139,92,246,0.16)] lg:block dark:lg:hidden"
          />
          <img
            src="/ui/fill-blank-notebook-dark.png"
            alt=""
            className="pointer-events-none absolute bottom-[clamp(0rem,1.2vw,0.9rem)] -right-[clamp(0.5rem,1.2vw,0.9rem)] hidden w-[clamp(13.3rem,23vw,20rem)] object-contain dark:lg:block"
          />

          <div className="relative z-10 max-w-[42rem] lg:max-w-[calc(100%_-_21rem)]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-4 font-display text-[clamp(1.7rem,3.4vw,2.75rem)] font-semibold leading-tight text-indigo-900 dark:text-purple-100">
              {parts.map((part, i) => (
                <span key={i} className="contents">
                  {part && <span>{part}</span>}
                  {i < parts.length - 1 && (
                    <input
                      type="text"
                      value={values[i] || ''}
                      onChange={e => { const n = [...values]; n[i] = e.target.value; setValues(n); setChecked(false); }}
                      onKeyDown={e => { if (e.key === 'Enter') check(); }}
                      className={`inline-flex h-[clamp(3.4rem,7.4vh,4.55rem)] w-[clamp(8rem,15vw,11rem)] rounded-[1.1rem] border-2 bg-white/85 px-4 text-center font-display text-[clamp(1.4rem,2.8vw,2.25rem)] font-semibold outline-none shadow-[0_8px_16px_rgba(251,191,36,0.12)] transition focus:ring-4 dark:caret-fuchsia-200 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_0_20px_rgba(168,85,247,0.18)] ${
                        checked
                          ? (values[i]?.trim().toLowerCase() === (answers[i]||'').toLowerCase()
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 focus:ring-emerald-100 dark:border-emerald-300/80 dark:bg-[rgba(16,185,129,0.18)] dark:text-emerald-50 dark:focus:ring-emerald-300/25'
                            : 'border-rose-300 bg-rose-50 text-rose-600 focus:ring-rose-100 dark:border-rose-300/80 dark:bg-[rgba(244,63,94,0.18)] dark:text-rose-50 dark:focus:ring-rose-300/25')
                          : 'border-yellow-300 text-amber-700 focus:border-yellow-400 focus:ring-yellow-100 dark:border-violet-300/90 dark:bg-[rgba(31,21,51,0.92)] dark:text-white dark:focus:border-fuchsia-200 dark:focus:ring-fuchsia-300/25'
                      }`}
                    />
                  )}
                </span>
              ))}
            </div>

            <div className="my-[clamp(1.35rem,3vh,2rem)] h-px w-full max-w-[34rem] border-t-2 border-dashed border-pink-300/75" />

            {showHint && <TaskHintBubble hint={hintText} label={copy.hintAnswer} className="mx-0" />}

            <button
              type="button"
              onClick={check}
              className="student-accent-gradient relative mt-[clamp(1.35rem,3vh,2rem)] inline-flex min-h-[clamp(3rem,6.2vh,4rem)] items-center justify-center rounded-[1.2rem] px-[clamp(2rem,4.2vw,3.8rem)] font-display text-[clamp(1.08rem,1.8vw,1.45rem)] font-semibold text-white shadow-[0_12px_24px_rgba(168,85,247,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(168,85,247,0.24)] dark:shadow-[0_12px_28px_rgba(104,168,243,0.24)]"
            >
              {copy.check}
              <img src="/ui/fill-blank-wand.png" alt="" className="pointer-events-none absolute -bottom-12 -right-16 h-[9.5rem] w-[9.5rem] rotate-12 object-contain" />
            </button>
          </div>
        </div>
      </div>
      <TaskActionBar
        copy={copy}
        onHint={() => {
          setShowHint(true);
          onEvent('hint_requested', { mechanic: 'fill_letters' });
        }}
        onReset={reset}
        resetDisabled={!values.some(Boolean) && !checked && !showHint}
      />
    </div>
  );
}

// ==================== ANAGRAM ====================
function shuffleStr(s: string) {
  if (s.length <= 1) return s;
  const arr = s.split('');
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  const joined = arr.join('');
  return joined.toUpperCase() === s.toUpperCase() ? shuffleStr(s) : joined;
}
function AnagramTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const answer: string = (payload?.answer || '').trim();
  const [tiles, setTiles] = useState<{ ch: string; used: boolean }[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [wrong, setWrong] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setTiles(shuffleStr(answer).split('').map(ch => ({ ch, used: false })));
    setPicked([]); setWrong(false);
  }, [answer]);

  const built = picked.map(i => tiles[i]?.ch || '').join('');

  const pick = (i: number) => {
    if (tiles[i].used) return;
    onEvent('choice_selected', { mechanic: 'anagram_unscramble', letter: tiles[i].ch, index: i });
    setTiles(t => t.map((tl, idx) => idx === i ? { ...tl, used: true } : tl));
    setPicked(p => [...p, i]);
  };
  const undo = () => {
    if (picked.length === 0) return;
    const last = picked[picked.length - 1];
    onEvent('undo', { mechanic: 'anagram_unscramble', index: last });
    setTiles(t => t.map((tl, idx) => idx === last ? { ...tl, used: false } : tl));
    setPicked(p => p.slice(0, -1));
  };
  const reset = () => {
    setTiles(shuffleStr(answer).split('').map(ch => ({ ch, used: false })));
    setPicked([]);
    setWrong(false);
    setShowHint(false);
    onEvent('reset_requested', { mechanic: 'anagram_unscramble' });
  };
  const firstLetterHint = {
    ru: 'Первая буква',
    en: 'First letter',
    ua: 'Перша літера',
  }[lang] || 'Первая буква';
  const hintText = String(payload?.hint || '').trim()
    || (answer ? `${firstLetterHint}: ${answer[0]?.toUpperCase()}${' _'.repeat(Math.max(0, answer.length - 1))}` : '');
  const answerDisplay = built.padEnd(answer.length, '?').split('');

  useEffect(() => {
    if (built.length === answer.length && built.length > 0) {
      if (built.toUpperCase() === answer.toUpperCase()) {
        onEvent('answer_correct', { mechanic: 'anagram_unscramble', answer: built });
        setTimeout(onDone, 500);
      }
      else {
        onEvent('answer_wrong', { mechanic: 'anagram_unscramble', answer: built, expected: answer });
        setWrong(true); setTimeout(() => { setWrong(false); setTiles(t => t.map(x => ({ ...x, used: false }))); setPicked([]); }, 800);
      }
    }
  }, [built]);

  if (!answer) {
    return (
      <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center rounded-[1.7rem] border-2 border-dashed border-purple-200 bg-purple-50/70 p-8 text-center font-display text-lg font-bold text-purple-600">
        {copy.addWords}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col justify-center">
      <div className="relative min-h-[clamp(22rem,47dvh,29rem)] overflow-visible rounded-[2rem] border-2 border-dashed border-purple-200/80 bg-gradient-to-br from-white via-[#fff8ff] to-[#f8f3ff] px-[clamp(1rem,2.8vw,2.6rem)] py-[clamp(1.05rem,2.5vh,2rem)] shadow-inner shadow-purple-100/70">
	        <img src="/ui/anagram-tape-purple.png" alt="" draggable={false} className="pointer-events-none absolute -left-[clamp(1.05rem,1.58vw,1.42rem)] -top-[clamp(0.72rem,1.16vw,1.05rem)] z-30 w-[clamp(6.25rem,8.35vw,7.75rem)] -rotate-[25deg] select-none object-contain drop-shadow-[0_12px_18px_rgba(124,58,237,0.18)] dark:hidden" />
	        <img src="/ui/anagram-tape-purple-dark.png" alt="" draggable={false} className="pointer-events-none absolute -left-[clamp(1.05rem,1.58vw,1.42rem)] -top-[clamp(0.72rem,1.16vw,1.05rem)] z-30 hidden w-[clamp(6.25rem,8.35vw,7.75rem)] -rotate-[25deg] select-none object-contain drop-shadow-[0_12px_20px_rgba(168,85,247,0.32)] dark:block" />
	        <img src="/ui/anagram-cloud.png" alt="" draggable={false} className="pointer-events-none absolute bottom-[clamp(0.05rem,0.26vw,0.22rem)] left-[clamp(0.65rem,1vw,0.92rem)] z-10 w-[clamp(5.15rem,7.2vw,6.75rem)] select-none object-contain drop-shadow-[0_10px_18px_rgba(125,180,255,0.20)] dark:hidden" />
	        <img src="/ui/anagram-cloud-dark.png" alt="" draggable={false} className="pointer-events-none absolute bottom-[clamp(0.05rem,0.26vw,0.22rem)] left-[clamp(0.65rem,1vw,0.92rem)] z-10 hidden w-[clamp(5.15rem,7.2vw,6.75rem)] select-none object-contain drop-shadow-[0_10px_20px_rgba(124,58,237,0.32)] dark:block" />
	        <img src="/ui/anagram-star-blue.png" alt="" draggable={false} className="pointer-events-none absolute left-[15%] top-[28%] z-10 w-[clamp(2.8rem,4.25vw,3.95rem)] select-none object-contain drop-shadow-[0_8px_14px_rgba(124,58,237,0.18)] dark:hidden" />
	        <img src="/ui/anagram-star-blue-dark.png" alt="" draggable={false} className="pointer-events-none absolute left-[15%] top-[28%] z-10 hidden w-[clamp(2.8rem,4.25vw,3.95rem)] select-none object-contain drop-shadow-[0_8px_18px_rgba(147,51,234,0.34)] dark:block" />
	        <img src="/ui/anagram-star-pink.png" alt="" draggable={false} className="pointer-events-none absolute right-[8%] top-[16%] z-10 w-[clamp(2.95rem,4.5vw,4.2rem)] rotate-12 select-none object-contain drop-shadow-[0_10px_18px_rgba(236,72,153,0.20)] dark:hidden" />
	        <img src="/ui/anagram-star-pink-dark.png" alt="" draggable={false} className="pointer-events-none absolute right-[8%] top-[16%] z-10 hidden w-[clamp(2.95rem,4.5vw,4.2rem)] rotate-12 select-none object-contain drop-shadow-[0_10px_20px_rgba(147,51,234,0.36)] dark:block" />

	        <div className="relative z-20 flex h-full min-h-[inherit] -translate-y-[clamp(1.15rem,3.1vh,2.05rem)] flex-col items-center justify-center gap-[clamp(0.9rem,2vh,1.35rem)] text-center">
		          <div className={`relative flex aspect-[1350/600] w-[min(100%,clamp(16.2rem,24.2vw,21.5rem))] items-center justify-center overflow-visible transition ${wrong ? 'animate-pulse' : ''}`}>
		            <img src="/ui/anagram-answer-panel.png" alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain dark:hidden" />
		            <img src="/ui/anagram-answer-panel-dark.png" alt="" draggable={false} className="pointer-events-none absolute inset-0 hidden h-full w-full select-none object-contain dark:block" />
		            <div className={`relative z-10 flex max-w-[78%] items-center justify-center gap-[clamp(0.18rem,0.54vw,0.42rem)] font-display text-[clamp(1.55rem,3.2vw,2.55rem)] font-black leading-none tracking-[0.12em] ${wrong ? 'text-rose-500' : 'text-purple-800 dark:text-violet-100'}`}>
	              {answerDisplay.map((ch, index) => (
		                <span key={`${ch}-${index}`} className={ch === '?' ? 'text-purple-700 dark:text-white' : 'text-purple-800 dark:text-white'}>
	                  {ch}
	                </span>
	              ))}
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center justify-center gap-[clamp(0.48rem,1vw,0.82rem)]">
            {tiles.map((tl, i) => (
              <motion.button
                key={`${tl.ch}-${i}`}
                type="button"
                whileHover={!tl.used ? { y: -4 } : undefined}
                whileTap={!tl.used ? { scale: 0.95 } : undefined}
                onClick={() => pick(i)}
                disabled={tl.used}
                className={`flex h-[clamp(3rem,5.5vw,4.25rem)] w-[clamp(3rem,5.5vw,4.25rem)] items-center justify-center rounded-[0.78rem] border-2 font-display text-[clamp(1.55rem,3vw,2.45rem)] font-black leading-none shadow-[0_8px_0_rgba(124,58,237,0.16),0_13px_22px_rgba(124,58,237,0.14)] transition focus:outline-none focus:ring-4 focus:ring-purple-200/70 ${
	                  tl.used
	                    ? 'cursor-not-allowed border-purple-100 bg-purple-50/45 text-purple-200 shadow-none dark:text-white/45'
	                    : 'border-white bg-gradient-to-br from-white via-[#fff9f5] to-[#f7edff] text-purple-800 hover:border-pink-200 dark:text-white'
                }`}
              >
                {tl.ch.toUpperCase()}
              </motion.button>
            ))}
          </div>

          <AnimatePresence>
            {showHint && (
              <TaskHintBubble
                hint={hintText}
                label={copy.hintAnswer}
                className="my-0 min-h-[2.75rem] max-w-[31rem] border-[#d8c4ff]/80 bg-gradient-to-r from-[#efe4ff]/90 via-[#fbf7ff]/95 to-[#eadcff]/90 py-1 pl-3 pr-5 text-[clamp(0.78rem,1.02vw,0.92rem)] text-purple-800 shadow-[0_7px_16px_rgba(168,85,247,0.10)] dark:!border-[#8f6cf5]/70 dark:!bg-[#2a123f] dark:![background-image:none] dark:!shadow-[0_0_18px_rgba(168,85,247,0.24)]"
                iconClassName="-my-2 h-14 w-14"
              />
            )}
          </AnimatePresence>

          <div className="grid w-full max-w-[43rem] grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setShowHint(true);
                onEvent('hint_requested', { mechanic: 'anagram_unscramble' });
              }}
	              className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-full border border-yellow-200 bg-white px-4 py-2 font-display text-sm font-bold text-indigo-800 shadow-[0_8px_18px_rgba(139,92,246,0.10)] transition hover:-translate-y-0.5 hover:bg-yellow-50 dark:text-white"
            >
              <Lightbulb className="h-4 w-4 text-yellow-500" /> {copy.hintAnswer}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={picked.length === 0 && !wrong && !showHint}
	              className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-full border border-purple-100 bg-white px-4 py-2 font-display text-sm font-bold text-indigo-800 shadow-[0_8px_18px_rgba(139,92,246,0.10)] transition hover:-translate-y-0.5 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-white"
            >
              <RotateCcw className="h-4 w-4 text-violet-500" /> {copy.reset}
            </button>
            <button
              type="button"
              onClick={undo}
              disabled={picked.length === 0}
	              className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-full border border-purple-100 bg-white px-4 py-2 font-display text-sm font-bold text-indigo-800 shadow-[0_8px_18px_rgba(139,92,246,0.10)] transition hover:-translate-y-0.5 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-white"
            >
              <Undo2 className="h-4 w-4 text-violet-500" /> {copy.undoLast}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== ODD ONE OUT ====================
function OddOneOutTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const items: Array<{ text?: string; image?: string; is_odd?: boolean }> = payload?.items || [];
  const [wrong, setWrong] = useState<number | null>(null);
  const [correct, setCorrect] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);

  const pick = (i: number) => {
    onEvent('choice_selected', { mechanic: 'odd_one_out', index: i });
    if (items[i]?.is_odd) {
      setCorrect(i);
      onEvent('answer_correct', { mechanic: 'odd_one_out', index: i });
      setTimeout(onDone, 700);
      return;
    }
    setWrong(i);
    onEvent('answer_wrong', { mechanic: 'odd_one_out', index: i });
    setTimeout(() => setWrong(null), 500);
  };

  if (items.length === 0) {
    return <p className="text-center text-purple-500 dark:text-purple-200">{copy.addOptions}</p>;
  }

  return (
    <div className="relative mx-auto flex h-full w-full max-w-5xl flex-col justify-center pb-[clamp(4rem,7.5vh,5.5rem)]">
      <div className="mt-[clamp(2.55rem,4.5vh,3.35rem)] grid w-full gap-[clamp(0.9rem,1.8vw,1.4rem)] sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => pick(i)}
            className={`flex h-[clamp(12.5rem,24vh,15.25rem)] flex-col items-center justify-between overflow-hidden rounded-[1.35rem] border-2 px-5 pb-5 pt-4 text-center font-body text-lg font-900 shadow-[0_8px_20px_rgba(139,92,246,0.10)] transition hover:-translate-y-1 hover:shadow-xl ${/сыр|сир|cheese/i.test(item.text || '') ? '-mt-[clamp(0.55rem,1.3vh,0.95rem)]' : ''} ${
              correct === i ? doneTile : wrong === i ? wrongTile : liveTile
            }`}
          >
            <span className="flex h-[calc(100%-2.4rem)] w-full items-center justify-center">
              {item.image && (
                <SignedImg
                  path={item.image}
                  className="h-[240%] max-h-[24rem] w-[240%] object-contain drop-shadow-[0_10px_14px_rgba(124,58,237,0.14)]"
                  placeholderClassName="h-[240%] max-h-[24rem] w-[240%]"
                />
              )}
            </span>
            <span className="min-h-[1.9rem] shrink-0 font-display text-[clamp(1.12rem,1.55vw,1.35rem)] font-bold leading-tight text-purple-700 dark:text-purple-100">{item.text || `${copy.option} ${i + 1}`}</span>
          </button>
        ))}
      </div>
      <TaskActionBar
        copy={copy}
        className="!mt-0 absolute bottom-[-1.8rem] left-0 right-0 min-h-[3.3rem]"
        centerContent={showHint ? (
          <TaskHintBubble
            hint={String(payload?.hint || '').trim()}
            label={copy.hintAnswer}
            className="mx-0 min-h-[2.55rem] max-w-[min(22rem,100%)] translate-y-1 px-3 py-0 text-[clamp(0.78rem,1.05vw,0.92rem)]"
            iconClassName="-my-2.5 h-12 w-12"
          />
        ) : null}
        onHint={() => {
          setShowHint(true);
          onEvent('hint_requested', { mechanic: 'odd_one_out' });
        }}
        onReset={() => {
          setWrong(null);
          setCorrect(null);
          setShowHint(false);
          onEvent('reset_requested', { mechanic: 'odd_one_out' });
        }}
        resetDisabled={wrong === null && correct === null && !showHint}
      />
    </div>
  );
}

// ==================== CATEGORY SORTING ====================
type CategoryCardAsset = {
  light: string;
  dark?: string;
};

const categoryDarkCardsByLang = {
  toys: {
    ru: '/ui/category-toys-card-dark-wide.png',
    en: '/ui/category-toys-card-dark-en.png',
    ua: '/ui/category-toys-card-dark-ua.png',
  },
  food: {
    ru: '/ui/category-food-card-dark-wide.png',
    en: '/ui/category-food-card-dark-en.png',
    ua: '/ui/category-food-card-dark-ua.png',
  },
} satisfies Record<'toys' | 'food', Record<Lang, string>>;

const categoryLightCardsByLang = {
  toys: {
    ru: '/ui/category-toys-card.png',
    en: '/ui/category-toys-card-light-en.png',
    ua: '/ui/category-toys-card-light-ua.png',
  },
  food: {
    ru: '/ui/category-food-card.png',
    en: '/ui/category-food-card-light-en.png',
    ua: '/ui/category-food-card-light-ua.png',
  },
} satisfies Record<'toys' | 'food', Record<Lang, string>>;

function categoryCardAssetForName(name: string, lang: Lang) {
  const normalized = name.toLowerCase();
  if (normalized.includes('игруш') || normalized.includes('іграш') || normalized.includes('toy')) {
    return {
      light: categoryLightCardsByLang.toys[lang],
      dark: categoryDarkCardsByLang.toys[lang],
    };
  }
  if (normalized.includes('еда') || normalized.includes('food') || normalized.includes('їжа')) {
    return {
      light: categoryLightCardsByLang.food[lang],
      dark: categoryDarkCardsByLang.food[lang],
    };
  }
  return null;
}

function setCardDragPreview(event: React.DragEvent<HTMLElement>) {
  const source = event.currentTarget;
  const rect = source.getBoundingClientRect();
  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.left = '-9999px';
  clone.style.top = '-9999px';
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.style.pointerEvents = 'none';
  clone.style.opacity = '1';
  clone.style.transform = 'none';
  document.body.appendChild(clone);
  event.dataTransfer.setDragImage(clone, rect.width / 2, rect.height / 2);
  window.setTimeout(() => clone.remove(), 0);
}

function CategorySortingTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const categories: Array<{ name: string; image?: string; cardImage?: string; items: Array<{ text?: string; image?: string }> }> = payload?.categories || [];
  const allItems = useMemo(() => categories.flatMap((cat, categoryIndex) =>
    (cat.items || []).map((item, itemIndex) => ({
      ...item,
      id: `${categoryIndex}-${itemIndex}`,
      categoryIndex,
    })),
  ), [categories]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Set<string>>(new Set());
  const [wrongCategory, setWrongCategory] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const selected = allItems.find(item => item.id === selectedId);
  const availableItems = allItems.filter(item => !placed.has(item.id));

  useEffect(() => {
    if (allItems.length > 0 && placed.size === allItems.length) setTimeout(onDone, 700);
  }, [placed.size, allItems.length]);

  const chooseCategory = (categoryIndex: number, itemId = selectedId) => {
    const item = allItems.find(entry => entry.id === itemId);
    if (!item || placed.has(item.id)) return;
    if (item.categoryIndex === categoryIndex) {
      onEvent('answer_correct', { mechanic: 'category_sorting', item: item.text, category: categories[categoryIndex]?.name });
      setPlaced(prev => new Set([...prev, item.id]));
      setSelectedId(null);
      setDraggingId(null);
      return;
    }
    onEvent('answer_wrong', { mechanic: 'category_sorting', item: item.text, category: categories[categoryIndex]?.name, expected: categories[item.categoryIndex]?.name });
    setWrongCategory(categoryIndex);
    setTimeout(() => setWrongCategory(null), 500);
  };
  const reset = () => {
    setSelectedId(null);
    setDraggingId(null);
    setPlaced(new Set());
    setWrongCategory(null);
    setShowHint(false);
    onEvent('reset_requested', { mechanic: 'category_sorting' });
  };
  const categoryStyles = [
    {
      shell: 'border-violet-200/90 bg-violet-50/70 shadow-violet-100/70 dark:border-violet-700 dark:bg-violet-950/30',
      inner: 'border-violet-300/80 text-violet-500',
      title: 'text-violet-700 dark:text-violet-100',
      tape: 'from-violet-200 to-indigo-200 border-violet-300',
    },
    {
      shell: 'border-pink-200/90 bg-pink-50/70 shadow-pink-100/70 dark:border-pink-700 dark:bg-pink-950/30',
      inner: 'border-pink-300/80 text-pink-500',
      title: 'text-pink-600 dark:text-pink-100',
      tape: 'from-pink-200 to-rose-200 border-pink-300',
    },
    {
      shell: 'border-sky-200/90 bg-sky-50/70 shadow-sky-100/70 dark:border-sky-700 dark:bg-sky-950/30',
      inner: 'border-sky-300/80 text-sky-500',
      title: 'text-sky-700 dark:text-sky-100',
      tape: 'from-sky-200 to-cyan-200 border-sky-300',
    },
  ];

  if (categories.length === 0 || allItems.length === 0) {
    return <p className="text-center text-purple-500 dark:text-purple-200">{copy.addCategories}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-[clamp(0.55rem,1.2vh,0.85rem)]">
      <div className="shrink-0">
        <div className="mb-2 flex items-center gap-2 font-body text-xs font-black uppercase tracking-wider text-purple-400">
          {copy.chooseCard}
        </div>
        <div className="mx-auto grid w-full max-w-[37rem] grid-cols-2 gap-[clamp(0.5rem,0.85vw,0.7rem)] sm:grid-cols-4">
          {availableItems.map(item => (
            <motion.button
              key={item.id}
              layout
              draggable
              onDragStart={event => {
                event.dataTransfer.setData('text/category-item', item.id);
                event.dataTransfer.effectAllowed = 'move';
                setCardDragPreview(event);
                setDraggingId(item.id);
                setSelectedId(item.id);
                onEvent('choice_selected', { mechanic: 'category_sorting', item: item.text, source: 'drag' });
              }}
              onDragEnd={() => setDraggingId(null)}
              onClick={() => {
                setSelectedId(item.id);
                onEvent('choice_selected', { mechanic: 'category_sorting', item: item.text, source: 'click' });
              }}
              className={`flex aspect-square min-h-0 w-full flex-col items-center justify-end overflow-hidden rounded-[1rem] border-2 bg-white/90 px-2.5 pb-2.5 pt-1.5 text-center shadow-[0_10px_22px_rgba(168,85,247,0.10)] transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-pink-100 ${
                selectedId === item.id
                  ? 'border-pink-300 ring-4 ring-pink-100'
                  : 'border-purple-100 hover:-translate-y-0.5 hover:border-pink-200 hover:shadow-[0_14px_26px_rgba(168,85,247,0.14)]'
              } ${draggingId === item.id ? 'opacity-70 scale-[0.98]' : ''}`}
            >
              {item.image ? (
                <SignedImg
                  path={item.image}
                  className="mb-1 h-[clamp(4.85rem,7vw,6.1rem)] w-[142%] max-w-none scale-[1.22] object-contain drop-shadow-[0_8px_10px_rgba(124,58,237,0.12)]"
                  placeholderClassName="mb-1 h-[clamp(4.85rem,7vw,6.1rem)] w-full rounded-xl"
                  draggable={false}
                />
              ) : (
                <span className="mb-1 grid h-[clamp(4.85rem,7vw,6.1rem)] w-[82%] place-items-center rounded-xl bg-purple-50 text-2xl text-purple-200">
                  <ImageIcon className="h-8 w-8" />
                </span>
              )}
              <span className="font-display text-[clamp(0.92rem,1.25vw,1.12rem)] font-bold leading-tight text-indigo-800 dark:text-purple-100">{item.text}</span>
            </motion.button>
          ))}
        </div>
      </div>
      <div className="-mt-[clamp(0.1rem,0.65vh,0.45rem)] flex min-h-0 flex-1 flex-col">
        <div className="mb-1 flex items-center gap-2 font-body text-xs font-black uppercase tracking-wider text-pink-400">
          {copy.sendToCategory}
        </div>
        <div className={`mx-auto grid w-full max-w-[48rem] flex-1 content-start pt-[clamp(0.25rem,0.8vh,0.55rem)] sm:grid-cols-2 ${
          lang === 'ru' ? 'gap-x-[clamp(0.6rem,1.15vw,0.9rem)]' : 'gap-x-[clamp(0.75rem,1.35vw,1.05rem)]'
        }`}>
          {categories.map((cat, i) => (
            (() => {
              const categoryCardAsset: CategoryCardAsset | null = cat.cardImage
                ? { light: cat.cardImage }
                : categoryCardAssetForName(cat.name, lang);
              const sharedProps = {
                onClick: () => chooseCategory(i),
                onDragOver: (event: React.DragEvent<HTMLButtonElement>) => event.preventDefault(),
                onDrop: (event: React.DragEvent<HTMLButtonElement>) => {
                  event.preventDefault();
                  chooseCategory(i, event.dataTransfer.getData('text/category-item') || draggingId);
                },
                disabled: !selectedId && !draggingId,
              };

              if (categoryCardAsset) {
                const categoryPositionClass = i % 2 === 0
                  ? lang === 'ru'
                    ? 'sm:justify-self-end sm:-translate-y-[clamp(0.25rem,0.55vh,0.45rem)]'
                    : 'sm:justify-self-end sm:translate-x-[clamp(0.25rem,0.65vw,0.5rem)] sm:translate-y-[clamp(0.28rem,0.7vh,0.52rem)]'
                  : lang === 'ru'
                    ? 'sm:justify-self-start sm:-translate-y-[clamp(0.35rem,0.75vh,0.58rem)]'
                    : lang === 'en'
                      ? 'sm:justify-self-start sm:-translate-x-[clamp(0.35rem,0.85vw,0.65rem)] sm:translate-y-[clamp(1.62rem,3vh,2.25rem)]'
                    : 'sm:justify-self-start sm:-translate-x-[clamp(0.35rem,0.85vw,0.65rem)] sm:translate-y-[clamp(1.5rem,2.8vh,2.08rem)]';
                const categorySizeClass = i % 2 === 0
                  ? lang === 'ru'
                    ? 'h-[clamp(14rem,26vh,16.8rem)] w-[112%] scale-[1.02] sm:scale-[1.06]'
                    : 'h-[clamp(12.4rem,22.8vh,14.8rem)] w-[100%] scale-[1.09] sm:scale-[1.14]'
                  : lang === 'ru'
                    ? 'h-[clamp(14rem,26vh,16.8rem)] w-[107%] scale-[0.98] sm:scale-[1.01]'
                    : 'h-[clamp(11.9rem,21.8vh,14.2rem)] w-[97%] scale-[1.23] sm:scale-[1.29]';
                return (
                  <button
                    key={i}
                    {...sharedProps}
                    className={`group relative aspect-[1260/760] max-w-none origin-bottom translate-y-[clamp(0.4rem,1vh,0.72rem)] overflow-visible rounded-[1.4rem] bg-transparent p-0 text-left transition-[filter,opacity] duration-200 ease-out hover:brightness-[1.04] hover:saturate-[1.07] disabled:opacity-75 ${categorySizeClass} ${categoryPositionClass} ${
                      wrongCategory === i ? 'animate-pulse ring-4 ring-rose-200' : ''
                    }`}
                  >
                    <img
                      src={categoryCardAsset.light}
                      alt=""
                      className={`pointer-events-none absolute inset-0 h-full w-full object-contain transition-transform duration-200 ease-out group-hover:scale-[1.018] ${categoryCardAsset.dark ? 'dark:hidden' : ''}`}
                    />
                    {categoryCardAsset.dark && (
                      <img
                        src={categoryCardAsset.dark}
                        alt=""
                        className="pointer-events-none absolute inset-0 hidden h-full w-full object-contain transition-transform duration-200 ease-out group-hover:scale-[1.018] dark:block"
                      />
                    )}
                    <span className="sr-only">{cat.name}</span>
                  </button>
                );
              }

              return (
                <button
                  key={i}
                  {...sharedProps}
                  className={`relative min-h-[clamp(10rem,21vh,12.5rem)] overflow-visible rounded-[1.35rem] border-2 p-4 text-left shadow-lg transition hover:-translate-y-0.5 disabled:opacity-70 ${
                    wrongCategory === i ? wrongTile : categoryStyles[i % categoryStyles.length].shell
                  }`}
                >
                  <span className={`pointer-events-none absolute left-1/2 top-[-0.85rem] h-8 w-20 -translate-x-1/2 rotate-1 rounded-md border bg-gradient-to-r opacity-90 shadow-sm ${categoryStyles[i % categoryStyles.length].tape}`} />
                  {cat.image && (
                    <SignedImg
                      path={cat.image}
                      className="pointer-events-none absolute left-5 top-7 h-[clamp(4.6rem,10vh,6.5rem)] w-[clamp(4.6rem,10vh,6.5rem)] object-contain drop-shadow-[0_10px_14px_rgba(124,58,237,0.12)]"
                      placeholderClassName="pointer-events-none absolute left-5 top-7 h-[clamp(4.6rem,10vh,6.5rem)] w-[clamp(4.6rem,10vh,6.5rem)] rounded-xl"
                    />
                  )}
                  <div className={`mb-4 text-center font-display text-[clamp(1.25rem,2.3vw,1.8rem)] font-bold ${categoryStyles[i % categoryStyles.length].title}`}>
                    {cat.name}
                  </div>
                  <div className={`ml-auto flex min-h-[clamp(5.6rem,12vh,7.2rem)] w-[72%] flex-col items-center justify-center rounded-[1.1rem] border-2 border-dashed bg-white/72 px-4 text-center font-display text-[clamp(1rem,1.45vw,1.22rem)] font-medium leading-tight ${categoryStyles[i % categoryStyles.length].inner}`}>
                    <span>{copy.sendToCategory}</span>
                  </div>
                </button>
              );
            })()
          ))}
        </div>
      </div>
      <TaskActionBar
        copy={copy}
        className="translate-y-[clamp(0.22rem,0.58vh,0.45rem)]"
        resetClassName="translate-y-[clamp(0.24rem,0.62vh,0.48rem)]"
        centerContent={showHint ? (
          <div className="mx-3 flex flex-1 translate-y-[clamp(0.95rem,2.15vh,1.55rem)] justify-center">
            <TaskHintBubble
              hint={String(payload?.hint || '').trim()}
              label={copy.hintAnswer}
              className="mx-0 max-w-[25rem] flex-1"
            />
          </div>
        ) : null}
        onHint={() => {
          setShowHint(true);
          onEvent('hint_requested', { mechanic: 'category_sorting' });
        }}
        onReset={reset}
        resetDisabled={placed.size === 0 && selectedId === null && !showHint}
      />
    </div>
  );
}

// ==================== CIPHER DECODER ====================
function encodeCipherAnswer(answer: string) {
  return answer.toUpperCase().split('').map(ch => {
    if (ch === ' ') return '/';
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) return String(code - 64);
    return ch;
  }).join(' ');
}

const cipherCopy: Record<Lang, { key: string; decode: string; empty: string; placeholder: string; check: string }> = {
  ru: { key: 'Ключ шифра', decode: 'Расшифруй слово', empty: 'Добавьте ответ для шифра в конструкторе.', placeholder: 'Напиши слово', check: 'Проверить' },
  en: { key: 'Cipher key', decode: 'Decode the word', empty: 'Add a cipher answer in the builder.', placeholder: 'Type the word', check: 'Check' },
  ua: { key: 'Ключ шифру', decode: 'Розшифруй слово', empty: 'Додайте відповідь для шифру в конструкторі.', placeholder: 'Напиши слово', check: 'Перевірити' },
};

const cipherAlphabet = Array.from({ length: 26 }, (_, index) => ({
  letter: String.fromCharCode(65 + index),
  number: index + 1,
}));

function CipherDecoderTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const answer = String(payload?.answer || '').trim();
  const copy = cipherCopy[lang];
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState<'ok' | 'wrong' | null>(null);
  const cipherSequence = encodeCipherAnswer(answer).split(' ');
  const check = () => {
    playButtonSound('check');
    const ok = value.trim().toLowerCase() === answer.toLowerCase();
    setChecked(ok ? 'ok' : 'wrong');
    onEvent(ok ? 'answer_correct' : 'answer_wrong', { mechanic: 'cipher_decoder', answer: value, expected: answer });
    if (ok) setTimeout(onDone, 700);
  };

  if (!answer) {
    return <p className="text-center text-purple-500 dark:text-purple-200">{copy.empty}</p>;
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[61rem] flex-col justify-start gap-[clamp(0.55rem,1.2vh,0.9rem)] text-center">
      <section className="rounded-[1.55rem] border border-purple-100 bg-white/[0.92] px-[clamp(0.8rem,1.35vw,1.15rem)] py-[clamp(0.78rem,1.5vh,1.08rem)] shadow-[0_10px_28px_rgba(168,85,247,0.10)] dark:border-purple-600/30 dark:bg-[#241632]">
        <div className="mb-[clamp(0.52rem,1vh,0.78rem)] font-display text-[clamp(1.1rem,1.65vw,1.38rem)] font-black leading-none text-purple-700 dark:text-purple-100">{copy.key}</div>
        <div className="mx-auto grid max-w-[55.6rem] grid-cols-5 gap-[clamp(0.38rem,0.8vw,0.66rem)] sm:grid-cols-9">
          {cipherAlphabet.map(item => (
            <div key={item.letter} className="overflow-hidden rounded-[0.72rem] border border-purple-100 bg-white shadow-[0_5px_12px_rgba(168,85,247,0.08)] dark:border-purple-500/25 dark:bg-[#321c47]">
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 py-[0.22rem] font-body text-[clamp(0.62rem,0.82vw,0.76rem)] font-black leading-none text-pink-500 dark:from-pink-500/15 dark:to-purple-500/15 dark:text-pink-200">{item.number}</div>
              <div className="py-[clamp(0.34rem,0.75vh,0.52rem)] font-display text-[clamp(1rem,1.35vw,1.22rem)] font-black leading-none text-purple-700 dark:text-purple-100">{item.letter}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.55rem] border border-purple-100 bg-white/[0.94] px-[clamp(0.9rem,1.45vw,1.25rem)] py-[clamp(0.76rem,1.45vh,1.04rem)] shadow-[0_10px_28px_rgba(168,85,247,0.10)] dark:border-purple-600/30 dark:bg-[#241632]">
        <div className="mb-[clamp(0.4rem,0.75vh,0.62rem)] font-body text-[clamp(0.72rem,1vw,0.86rem)] font-black uppercase tracking-wide text-pink-400">{copy.decode}</div>
        <div className="mb-[clamp(0.55rem,1vh,0.78rem)] flex flex-wrap justify-center gap-x-[clamp(0.7rem,1.35vw,1.1rem)] gap-y-1 font-display text-[clamp(1.4rem,2.4vw,2.25rem)] font-black leading-none text-purple-800 dark:text-purple-100">
          {cipherSequence.map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
        <div className="mx-auto max-w-[43rem]">
          <div className="relative">
            <input
              value={value}
              onChange={e => { setValue(e.target.value); setChecked(null); }}
              onKeyDown={e => { if (e.key === 'Enter') check(); }}
              className={`h-[clamp(2.8rem,5.6vh,3.35rem)] w-full rounded-[1rem] border-2 bg-white px-5 text-center font-display text-[clamp(1.05rem,1.65vw,1.32rem)] font-black text-purple-700 shadow-inner shadow-purple-100/45 outline-none transition placeholder:text-purple-300 focus:border-purple-300 focus:ring-4 focus:ring-purple-100 dark:bg-white/10 dark:text-purple-100 dark:placeholder:text-purple-300 ${checked === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : checked === 'wrong' ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-purple-200'}`}
              placeholder={copy.placeholder}
            />
          </div>
          <button onClick={check} className="student-accent-gradient mt-[clamp(0.55rem,1.05vh,0.78rem)] inline-flex min-h-[2.45rem] min-w-[10.5rem] items-center justify-center rounded-full px-6 font-display text-[clamp(0.92rem,1.18vw,1.05rem)] font-bold text-white shadow-[0_10px_22px_rgba(139,92,246,0.28)] transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">
            {copy.check}
          </button>
        </div>
      </section>
    </div>
  );
}

// ==================== WORD SEARCH ====================
function normalizeSearchWord(word: string) {
  return word.trim().toUpperCase().replace(/\s+/g, '');
}

type SearchCell = { row: number; col: number; letter: string };

function makeWordSearchGrid(words: string[], requestedSize: number) {
  const cleanWords = words.map(normalizeSearchWord).filter(Boolean);
  const directions = [
    { dr: 0, dc: 1 },
    { dr: 0, dc: -1 },
    { dr: 1, dc: 0 },
    { dr: -1, dc: 0 },
    { dr: 1, dc: 1 },
    { dr: 1, dc: -1 },
    { dr: -1, dc: 1 },
    { dr: -1, dc: -1 },
  ];
  const longest = cleanWords.reduce((max, word) => Math.max(max, word.length), 0);
  const minimumSize = Math.max(6, requestedSize, longest, cleanWords.length);

  for (let size = minimumSize; size <= Math.max(20, minimumSize); size++) {
    const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ''));
    let allPlaced = true;
    for (const [wordIndex, word] of [...cleanWords].sort((a, b) => b.length - a.length).entries()) {
      const candidates: Array<{ row: number; col: number; dr: number; dc: number }> = [];
      for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) for (const direction of directions) {
        const endRow = row + direction.dr * (word.length - 1);
        const endCol = col + direction.dc * (word.length - 1);
        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;
        if (word.split('').every((letter, index) => {
          const current = grid[row + direction.dr * index][col + direction.dc * index];
          return current === '' || current === letter;
        })) candidates.push({ row, col, ...direction });
      }
      if (candidates.length === 0) { allPlaced = false; break; }
      const candidate = candidates[(wordIndex * 37 + word.length * 11) % candidates.length];
      word.split('').forEach((letter, index) => {
        grid[candidate.row + candidate.dr * index][candidate.col + candidate.dc * index] = letter;
      });
    }
    if (!allPlaced) continue;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      if (!grid[row][col]) grid[row][col] = alphabet[(row * 7 + col * 11 + size) % alphabet.length];
    }
    return { grid, size };
  }
  return { grid: [['A']], size: 1 };
}

function cellsOnLine(start: SearchCell, end: SearchCell, grid: string[][]): SearchCell[] | null {
  const rowDelta = end.row - start.row;
  const colDelta = end.col - start.col;
  if (rowDelta !== 0 && colDelta !== 0 && Math.abs(rowDelta) !== Math.abs(colDelta)) return null;
  const steps = Math.max(Math.abs(rowDelta), Math.abs(colDelta));
  if (steps === 0) return [start];
  const rowStep = Math.sign(rowDelta);
  const colStep = Math.sign(colDelta);
  return Array.from({ length: steps + 1 }, (_, index) => {
    const row = start.row + rowStep * index;
    const col = start.col + colStep * index;
    return { row, col, letter: grid[row][col] };
  });
}

function WordSearchTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const wordSource = Array.isArray(payload?.words) ? payload.words : String(payload?.words || '').split('\n');
  const words = Array.from(new Set<string>(wordSource.map((word: unknown) => normalizeSearchWord(String(word))).filter(Boolean)));
  const longestWord = words.reduce((max, word) => Math.max(max, word.length), 0);
  const requestedSize = Math.max(6, Math.min(18, Math.max(Number(payload?.size) || 10, longestWord)));
  const generated = useMemo(() => makeWordSearchGrid(words, requestedSize), [words.join('|'), requestedSize]);
  const { grid, size } = generated;
  const [selected, setSelected] = useState<SearchCell[]>([]);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    if (words.length > 0 && found.size === words.length) setTimeout(onDone, 800);
  }, [found.size, words.length]);

  const selectedWord = selected.map(cell => cell.letter).join('');
  const selectedKeys = new Set(selected.map(cell => `${cell.row}-${cell.col}`));

  const selectCell = (row: number, col: number) => {
    const letter = grid[row][col];
    const key = `${row}-${col}`;
    if (foundCells.has(key)) return;
    setWrong(false);
    setSelected(previous => {
      const current = { row, col, letter };
      if (previous.length !== 1) return [current];
      return cellsOnLine(previous[0], current, grid) || [current];
    });
    onEvent('choice_selected', { mechanic: 'word_search', row, col, letter });
  };

  const check = () => {
    playButtonSound('check');
    const reversed = selectedWord.split('').reverse().join('');
    const matched = words.find(word => !found.has(word) && (word === selectedWord || word === reversed));
    if (!matched) {
      setWrong(true);
      onEvent('answer_wrong', { mechanic: 'word_search', answer: selectedWord, expected: words });
      setTimeout(() => setWrong(false), 500);
      return;
    }
    setFound(prev => new Set([...prev, matched]));
    setFoundCells(prev => new Set([...prev, ...selected.map(cell => `${cell.row}-${cell.col}`)]));
    setSelected([]);
    onEvent('answer_correct', { mechanic: 'word_search', word: matched });
  };

  if (words.length === 0) {
    return <p className="text-center text-purple-500 dark:text-purple-200">{copy.addWords}</p>;
  }

  return (
    <div className="relative mx-auto grid h-full min-h-0 w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] items-center justify-items-center gap-[clamp(0.3rem,0.62vh,0.46rem)] overflow-hidden px-2 pb-[clamp(0.45rem,0.95vh,0.7rem)] pt-[clamp(0.05rem,0.45vh,0.22rem)]">
      <ThemedStarImage
        lightSrc="/ui/word-search-star-light-purple-new.png"
        darkSrc={DARK_STAR_MEDIUM_SRC}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute left-[6%] top-[22%] h-11 w-11 -rotate-12 object-contain opacity-95"
        lightClassName="hidden lg:block dark:hidden"
        darkClassName="hidden dark:lg:block"
      />
      <ThemedStarImage
        lightSrc="/ui/word-search-star-light-purple-new.png"
        darkSrc={DARK_STAR_MEDIUM_SRC}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute right-[5%] top-[28%] h-10 w-10 rotate-12 object-contain opacity-95"
        lightClassName="hidden lg:block dark:hidden"
        darkClassName="hidden dark:lg:block"
      />
      <ThemedStarImage
        lightSrc="/ui/word-search-star-light-blue-new.png"
        darkSrc={DARK_STAR_SMALL_SRC}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute left-[15%] bottom-[18%] h-12 w-12 -rotate-6 object-contain opacity-85 drop-shadow-[0_12px_18px_rgba(129,140,248,0.20)]"
        lightClassName="hidden lg:block dark:hidden"
        darkClassName="hidden dark:lg:block"
      />
      <ThemedStarImage
        lightSrc="/ui/word-search-star-light-blue-new.png"
        darkSrc={DARK_STAR_SMALL_SRC}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute right-[14%] bottom-[16%] h-10 w-10 rotate-12 object-contain opacity-82 drop-shadow-[0_12px_18px_rgba(129,140,248,0.18)]"
        lightClassName="hidden lg:block dark:hidden"
        darkClassName="hidden dark:lg:block"
      />
      <ThemedStarImage
        lightSrc="/ui/word-search-star-light-pink-new.png"
        darkSrc={DARK_STAR_LARGE_SRC}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute left-[12%] top-[42%] h-16 w-16 rotate-12 object-contain opacity-82 drop-shadow-[0_12px_18px_rgba(244,114,182,0.18)]"
        lightClassName="hidden lg:block dark:hidden"
        darkClassName="hidden dark:lg:block dark:h-10 dark:w-10"
      />
      <ThemedStarImage
        lightSrc="/ui/word-search-star-light-pink-new.png"
        darkSrc={DARK_STAR_LARGE_SRC}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute right-[12%] top-[50%] h-20 w-20 -rotate-12 object-contain opacity-82 drop-shadow-[0_12px_18px_rgba(244,114,182,0.18)]"
        lightClassName="hidden lg:block dark:hidden"
        darkClassName="hidden dark:lg:block dark:h-12 dark:w-12"
      />

      <div className="relative z-10 flex shrink-0 flex-wrap justify-center gap-[clamp(0.38rem,0.72vw,0.56rem)]">
        {words.map((word, index) => {
          const done = found.has(word);
          const chipTones = [
            'border-yellow-200 bg-yellow-50 text-purple-700 shadow-yellow-100/60',
            'border-pink-200 bg-pink-50 text-purple-700 shadow-pink-100/60',
            'border-purple-200 bg-purple-50 text-purple-700 shadow-purple-100/60',
            'border-sky-200 bg-sky-50 text-purple-700 shadow-sky-100/60',
          ];
          return (
            <span
              key={word}
              className={`inline-flex min-h-[1.95rem] min-w-[4.65rem] items-center justify-center rounded-full border px-4 py-1 font-display text-sm font-semibold uppercase tracking-wide shadow-sm transition ${
                done
                  ? 'student-accent-gradient border-transparent text-white line-through opacity-95 shadow-[0_0_16px_rgba(215,169,233,0.34)]'
                  : chipTones[index % chipTones.length]
              }`}
            >
              {word}
            </span>
          );
        })}
      </div>

      <div
        className={`relative z-10 grid w-full max-w-[min(82vw,21.6rem)] self-center rounded-[1.25rem] border-2 bg-white/92 p-[clamp(0.27rem,0.56vw,0.4rem)] shadow-[0_12px_28px_rgba(168,85,247,0.12)] backdrop-blur dark:bg-[#241632] ${
          wrong ? 'animate-pulse border-rose-300' : 'border-purple-100 dark:border-purple-700'
        }`}
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {grid.flatMap((row, rowIndex) => row.map((letter, colIndex) => {
          const key = `${rowIndex}-${colIndex}`;
          const isSelected = selectedKeys.has(key);
          const isFound = foundCells.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => selectCell(rowIndex, colIndex)}
              className={`aspect-square rounded-[0.66rem] border font-display text-[clamp(0.64rem,1vw,0.84rem)] font-bold leading-none shadow-[0_4px_9px_rgba(124,58,237,0.06)] transition duration-150 focus:outline-none focus:ring-4 focus:ring-purple-200/70 ${
                isFound
                  ? 'student-accent-gradient border-transparent text-white shadow-[0_0_16px_rgba(215,169,233,0.42)]'
                  : isSelected
                    ? 'student-accent-gradient border-transparent text-white shadow-[0_9px_18px_rgba(215,169,233,0.34)] dark:text-white dark:shadow-[0_0_18px_rgba(215,169,233,0.46)]'
                    : 'border-purple-100 bg-white text-purple-700 hover:-translate-y-0.5 hover:border-pink-200 hover:bg-pink-50 dark:border-purple-700 dark:bg-[#2b1a3d] dark:text-purple-100 dark:hover:bg-[#3a2451]'
              }`}
            >
              {letter}
            </button>
          );
        }))}
      </div>

      <div className="relative z-20 flex min-h-[2.65rem] shrink-0 flex-wrap items-center justify-center gap-[clamp(0.42rem,0.78vw,0.62rem)]">
        <span className={`inline-flex min-h-[2.25rem] min-w-[5.65rem] items-center justify-center rounded-full border px-5 py-1.5 text-center font-display text-base font-bold tracking-[0.2em] shadow-[0_8px_18px_rgba(168,85,247,0.08)] ${
          selectedWord
            ? 'student-accent-gradient border-transparent text-white'
            : 'border-purple-100 bg-white text-purple-700 dark:border-purple-700 dark:bg-[#2b1a3d] dark:text-purple-100'
        }`}>
          {selectedWord || '...'}
        </span>
        <button
          type="button"
          onClick={check}
          disabled={selected.length === 0}
          className="student-accent-gradient inline-flex min-h-[2.25rem] items-center justify-center gap-2 rounded-full px-6 py-1.5 font-display text-base font-semibold text-white shadow-[0_10px_20px_rgba(168,85,247,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(168,85,247,0.30)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <img src={REWARD_STAR_SRC} alt="" draggable={false} className="h-6 w-6 object-contain" />
          {copy.check}
        </button>
        <button
          type="button"
          onClick={() => setSelected([])}
          className="inline-flex min-h-[2.25rem] items-center justify-center gap-2 rounded-full border border-purple-100 bg-white px-6 py-1.5 font-display text-base font-semibold text-purple-700 shadow-[0_8px_18px_rgba(168,85,247,0.08)] transition hover:-translate-y-0.5 hover:border-purple-200 hover:bg-purple-50 dark:border-purple-700 dark:bg-[#2b1a3d] dark:text-purple-100"
        >
          <RotateCcw className="h-5 w-5 text-[#D7A9E9]" />
          {copy.clear}
        </button>
      </div>
    </div>
  );
}

// ==================== CONNECT THE DOTS ====================
function ConnectDotsTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const points: Array<{ x: number; y: number; order: number }> = [...(payload?.points || [])].sort((a, b) => a.order - b.order);
  const [nextOrder, setNextOrder] = useState(1);
  const [wrong, setWrong] = useState<number | null>(null);
  const connected = points.filter(point => point.order < nextOrder);

  useEffect(() => {
    if (points.length > 0 && nextOrder > points.length) setTimeout(onDone, 900);
  }, [nextOrder, points.length]);

  const pick = (point: { x: number; y: number; order: number }) => {
    onEvent('choice_selected', { mechanic: 'connect_dots', order: point.order });
    if (point.order === nextOrder) {
      setNextOrder(order => order + 1);
      onEvent('answer_correct', { mechanic: 'connect_dots', order: point.order });
      return;
    }
    setWrong(point.order);
    onEvent('answer_wrong', { mechanic: 'connect_dots', order: point.order, expected: nextOrder });
    setTimeout(() => setWrong(null), 500);
  };

  if (points.length < 2) {
    return <p className="text-center text-purple-500 dark:text-purple-200">{copy.addDots}</p>;
  }

  const polyline = connected.map(point => `${point.x},${point.y}`).join(' ');

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-3xl rounded-3xl border border-purple-100 bg-gradient-to-br from-sky-50 via-pink-50 to-purple-50 p-4 shadow-sm dark:border-purple-700 dark:from-[#211331] dark:via-[#25123a] dark:to-[#14253d]">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[1.5rem] bg-white/80 dark:bg-[#1a1028]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="connect-dots-line" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#EFA4DE" />
                <stop offset="45%" stopColor="#D7A9E9" />
                <stop offset="100%" stopColor="#B6BDF9" />
              </linearGradient>
            </defs>
            <motion.polyline
              points={polyline}
              fill="none"
              stroke="url(#connect-dots-line)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              initial={false}
              animate={{ opacity: polyline ? 1 : 0 }}
            />
          </svg>
          {points.map(point => {
            const done = point.order < nextOrder;
            const current = point.order === nextOrder;
            return (
              <motion.button
                key={point.order}
                animate={wrong === point.order ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
                onClick={() => pick(point)}
                className={`absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 font-display text-lg font-black shadow-lg transition ${
                  done ? 'border-emerald-200 bg-emerald-400 text-white' :
                  wrong === point.order ? 'border-rose-200 bg-rose-400 text-white' :
                  current ? 'student-accent-gradient border-pink-200 text-white ring-4 ring-pink-100' :
                  'border-white bg-purple-100 text-purple-600 hover:scale-110 dark:border-purple-700 dark:bg-[#2b1a3d] dark:text-purple-100'
                }`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                {done ? <CheckCircle2 className="h-6 w-6" /> : point.order}
              </motion.button>
            );
          })}
        </div>
      </div>
      <div className="text-center font-body text-sm font-800 text-purple-500 dark:text-purple-200">
        {copy.nextPoint}: #{Math.min(nextOrder, points.length)}
      </div>
    </div>
  );
}

// ==================== SPOT & COUNT ====================
function SpotAndCountTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const spots: Array<{ x: number; y: number; r: number }> = payload?.spots || [];
  const expected = Number(payload?.expected_count) || spots.length;
  const [found, setFound] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (expected > 0 && found.size >= expected) {
      onEvent('answer_correct', { mechanic: 'spot_and_count', count: found.size });
      setTimeout(onDone, 800);
    }
  }, [found.size, expected]);

  const tapSpot = (index: number) => {
    if (found.has(index)) return;
    setFound(prev => new Set([...prev, index]));
    onEvent('choice_selected', { mechanic: 'spot_and_count', index, count: found.size + 1 });
  };

  if (spots.length === 0) {
    return <p className="text-center text-purple-500 dark:text-purple-200">{copy.addObjects}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="rounded-3xl bg-white px-5 py-2 font-display text-2xl font-black text-purple-800 shadow-sm dark:bg-[#2b1a3d] dark:text-purple-100">
          {found.size} / {expected}
        </div>
      </div>
      <div className="mx-auto max-w-3xl rounded-3xl border border-purple-100 bg-gradient-to-br from-sky-50 via-pink-50 to-purple-50 p-4 shadow-sm dark:border-purple-700 dark:from-[#211331] dark:via-[#25123a] dark:to-[#14253d]">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[1.5rem] bg-white/80 dark:bg-[#1a1028]">
          {payload?.background_url ? (
            <SignedImg path={payload.background_url} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_25%_25%,#fbcfe8,transparent_26%),radial-gradient(circle_at_75%_35%,#bfdbfe,transparent_24%),radial-gradient(circle_at_52%_78%,#ddd6fe,transparent_30%)]" />
          )}
          {spots.map((spot, i) => {
            const isFound = found.has(i);
            return (
              <motion.button
                key={i}
                onClick={() => tapSpot(i)}
                initial={false}
                animate={isFound ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 shadow-lg transition ${
                  isFound
                    ? 'border-emerald-200 bg-emerald-400/80 text-white'
                    : 'border-white bg-pink-400/20 text-white hover:bg-pink-400/40'
                }`}
                style={{
                  left: `${spot.x}%`,
                  top: `${spot.y}%`,
                  width: `${Math.max(22, spot.r * 4)}px`,
                  height: `${Math.max(22, spot.r * 4)}px`,
                }}
                aria-label={`spot ${i + 1}`}
              >
                {isFound && <CheckCircle2 className="mx-auto h-5 w-5" />}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==================== DIGITAL COLORING ====================
function DigitalColoringTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const palette: Array<{ code: string; color: string }> = payload?.palette || [];
  const regions: Array<{ id: string; code: string; label?: string; x?: number; y?: number; size?: number }> = payload?.regions || [];
  const image = String(payload?.image || '').trim();
  const [selectedCode, setSelectedCode] = useState(palette[0]?.code || '');
  const [colored, setColored] = useState<Record<string, string>>({});
  const [wrongRegion, setWrongRegion] = useState<string | null>(null);
  const colorFor = (code: string) => palette.find(item => String(item.code) === String(code))?.color || '#f9a8d4';
  const regionPosition = (region: typeof regions[number], index: number) => ({
    x: Math.max(8, Math.min(92, Number(region.x ?? (24 + (index % 4) * 17)))),
    y: Math.max(8, Math.min(92, Number(region.y ?? (28 + Math.floor(index / 4) * 18)))),
    size: Math.max(8, Math.min(34, Number(region.size ?? 16))),
  });

  useEffect(() => {
    if (regions.length > 0 && Object.keys(colored).length === regions.length) setTimeout(onDone, 900);
  }, [colored, regions.length]);

  const paint = (region: { id: string; code: string }) => {
    onEvent('choice_selected', { mechanic: 'digital_coloring', region: region.id, selectedCode });
    if (String(selectedCode) !== String(region.code)) {
      setWrongRegion(region.id);
      onEvent('answer_wrong', { mechanic: 'digital_coloring', region: region.id, selectedCode, expected: region.code });
      setTimeout(() => setWrongRegion(null), 500);
      return;
    }
    setColored(prev => ({ ...prev, [region.id]: selectedCode }));
    onEvent('answer_correct', { mechanic: 'digital_coloring', region: region.id, code: selectedCode });
  };

  if (palette.length === 0 || regions.length === 0) {
    return <p className="text-center text-purple-500 dark:text-purple-200">{copy.addPalette}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="text-center font-display text-xl font-black text-purple-800 dark:text-purple-100">{copy.choosePencil}</div>
      <div className="flex flex-wrap justify-center gap-2">
        {palette.map(item => (
          <button
            key={item.code}
            onClick={() => setSelectedCode(String(item.code))}
            className={`flex items-center gap-2 rounded-2xl border-2 bg-white px-4 py-2 font-body text-sm font-900 text-purple-700 shadow-sm transition hover:-translate-y-0.5 dark:bg-[#2b1a3d] dark:text-purple-100 ${
              String(selectedCode) === String(item.code) ? 'border-pink-300 ring-4 ring-pink-100 dark:ring-purple-500/30' : 'border-purple-100 dark:border-purple-700'
            }`}
          >
            <span className="h-7 w-4 rounded-b-lg rounded-t-sm border border-white shadow-sm" style={{ background: item.color }} />
            {item.code}
          </button>
        ))}
      </div>
      {image ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white bg-white p-3 shadow-xl shadow-purple-100/50 dark:border-purple-500/20 dark:bg-white/5 dark:shadow-none">
            <SignedImg path={image} className="w-full rounded-[1.5rem] object-contain" />
            {regions.map((region, index) => {
              const paintedCode = colored[region.id];
              const painted = Boolean(paintedCode);
              const position = regionPosition(region, index);
              return (
                <motion.button
                  key={region.id}
                  animate={wrongRegion === region.id ? { x: ['-50%', 'calc(-50% - 7px)', 'calc(-50% + 7px)', 'calc(-50% - 4px)', 'calc(-50% + 4px)', '-50%'] } : { x: '-50%' }}
                  onClick={() => paint(region)}
                  className={`absolute flex items-center justify-center rounded-full border-4 text-xs font-black shadow-lg backdrop-blur-[1px] transition hover:scale-105 ${
                    wrongRegion === region.id ? 'border-rose-300 bg-rose-100/75 text-rose-600' :
                    painted ? 'border-white text-white' :
                    'border-purple-200 bg-white/35 text-purple-500 hover:bg-white/65 dark:border-purple-300/50 dark:bg-purple-950/30 dark:text-purple-100'
                  }`}
                  style={{
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                    width: `${position.size}%`,
                    aspectRatio: '1 / 1',
                    background: painted ? colorFor(paintedCode) : undefined,
                    opacity: painted ? 0.78 : undefined,
                  }}
                  title={region.label || region.code}
                >
                  {painted ? <CheckCircle2 className="h-6 w-6" /> : (region.label || region.code || index + 1)}
                </motion.button>
              );
            })}
          </div>
          <div className="rounded-[2rem] border border-purple-100 bg-white/85 p-4 shadow-sm dark:border-purple-500/25 dark:bg-white/5">
            <div className="mb-3 font-body text-xs font-black uppercase tracking-wider text-purple-400">{copy.coloringTodo}</div>
            <div className="space-y-2">
              {regions.map((region, index) => {
                const painted = Boolean(colored[region.id]);
                return (
                  <button key={region.id} type="button" onClick={() => paint(region)} className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition hover:-translate-y-0.5 ${painted ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100' : 'border-purple-100 bg-purple-50/70 text-purple-700 dark:border-purple-500/20 dark:bg-white/5 dark:text-purple-100'}`}>
                    <span className="h-5 w-5 rounded-full border border-white shadow-sm" style={{ background: colorFor(region.code) }} />
                    <span className="min-w-0 flex-1 font-body text-sm font-black">{region.label || `${copy.coloringTodo} ${index + 1}`}</span>
                    <span className="font-body text-xs font-black opacity-70">{region.code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
          {regions.map((region, index) => {
            const paintedCode = colored[region.id];
            const painted = Boolean(paintedCode);
            return (
              <motion.button
                key={region.id}
                animate={wrongRegion === region.id ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                onClick={() => paint(region)}
                className={`aspect-square rounded-[2rem] border-4 font-display text-3xl font-black shadow-lg transition hover:-translate-y-1 ${
                  wrongRegion === region.id ? 'border-rose-300 bg-rose-50 text-rose-500' :
                  painted ? 'border-white text-white' :
                  'border-purple-100 bg-white text-purple-300 dark:border-purple-700 dark:bg-[#2b1a3d] dark:text-purple-500'
                }`}
                style={painted ? { background: colorFor(paintedCode) } : undefined}
              >
                {painted ? <CheckCircle2 className="mx-auto h-9 w-9" /> : region.code || index + 1}
              </motion.button>
            );
          })}
        </div>
      )}
      <div className="text-center font-body text-sm font-800 text-purple-500 dark:text-purple-200">
        {copy.colored}: {Object.keys(colored).length} / {regions.length}
      </div>
    </div>
  );
}

// ==================== TRUE / FALSE ====================
function TrueFalseTask({ payload, onDone, onEvent, lang, variant = 'default' }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang; variant?: 'default' | 'master' }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const statements: Array<{ text: string; is_true: boolean; hint?: string; image?: string; photo?: string; image_url?: string; photo_url?: string }> = (payload?.statements || []).filter((item: any) => String(item?.text || '').trim());
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [selected, setSelected] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);
  const current = statements[index];
  const fallbackHint = lang === 'en'
    ? 'Look at the picture and compare it with the statement.'
    : lang === 'ua'
      ? 'Подивись на картинку і порівняй її з твердженням.'
      : 'Посмотри на картинку и сравни её с утверждением.';
  const hintText = String(current?.hint || payload?.hint || fallbackHint).trim();
  const currentImage = [
    current?.image,
    current?.photo,
    current?.image_url,
    current?.photo_url,
    payload?.image,
    payload?.photo,
    payload?.image_url,
    payload?.photo_url,
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

  useEffect(() => {
    setShowHint(false);
  }, [index]);

  const answer = (value: boolean) => {
    if (!current) return;
    setSelected(value);
    onEvent('choice_selected', { mechanic: 'true_false', index, answer: value });
    if (Boolean(current.is_true) !== value) {
      setWrong(true);
      onEvent('answer_wrong', { mechanic: 'true_false', index, answer: value, expected: Boolean(current.is_true) });
      setTimeout(() => { setWrong(false); setSelected(null); }, 520);
      return;
    }
    setCorrect(true);
    onEvent('answer_correct', { mechanic: 'true_false', index, answer: value });
    window.setTimeout(() => {
      setCorrect(false);
      setSelected(null);
      if (index + 1 >= statements.length) onDone();
      else setIndex(value => value + 1);
    }, 650);
  };

  if (statements.length === 0) {
    return <p className="text-center text-purple-500 dark:text-purple-200">{copy.addStatements}</p>;
  }

  return (
    <div className={`${variant === 'master' ? 'mx-auto flex h-full w-full max-w-[min(58rem,100%)] flex-col justify-start gap-[clamp(0.28rem,0.58vh,0.46rem)] text-center' : 'mx-auto flex max-w-5xl flex-col gap-4 text-center'} relative`}>
      {variant !== 'master' && (
        <div className="flex shrink-0 items-center justify-center gap-2 py-[clamp(0.02rem,0.18vh,0.12rem)]">
          {statements.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i <= index ? 'student-accent-gradient w-7' : 'w-1.5 bg-purple-100 dark:bg-purple-800'}`} />
          ))}
        </div>
      )}
      <motion.div
        key={index}
        animate={wrong ? { x: [0, -8, 8, -5, 5, 0] } : correct ? { scale: [1, 1.015, 1] } : { x: 0, scale: 1 }}
        className={`${variant === 'master' ? 'max-w-[min(43rem,88%)]' : 'max-w-[min(50rem,100%)]'} relative mx-auto aspect-[1296/792] w-full shrink-0`}
      >
        <img src="/ui/true-false-notebook.png" alt="" className="absolute inset-0 h-full w-full scale-[0.99] select-none object-contain dark:hidden" draggable={false} />
        <img src="/ui/true-false-notebook-dark.png" alt="" className="absolute inset-0 hidden h-full w-full scale-[1.08] select-none object-contain dark:block" draggable={false} />
        <div className="absolute left-[50%] top-[13.2%] z-10 aspect-[4/3] w-[25.8%] -translate-x-1/2 overflow-hidden rounded-[0.78rem] bg-white p-[0.36rem] shadow-[0_8px_18px_rgba(124,58,237,0.14)] ring-2 ring-white/95">
          {currentImage ? (
            <SignedImg path={currentImage} className="h-full w-full scale-[1.08] rounded-[0.5rem] object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-[0.56rem] bg-gradient-to-br from-purple-100 via-pink-50 to-sky-100 text-purple-300">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}
        </div>
        <img src="/ui/true-false-doodle-heart.png" alt="" className="absolute left-[28.6%] top-[30.7%] z-10 aspect-square w-[7.1%] select-none object-contain opacity-90" draggable={false} />
        <img src="/ui/true-false-doodle-star.png" alt="" className="absolute right-[25.7%] top-[30.4%] z-10 aspect-square w-[6.4%] select-none object-contain opacity-95" draggable={false} />
        <div className="absolute left-1/2 top-[50.2%] z-20 flex w-[58%] -translate-x-1/2 justify-center">
          <div className={`${variant === 'master' ? 'text-[clamp(1.34rem,2.15vw,1.94rem)]' : 'text-[clamp(1.45rem,3vw,2.35rem)]'} max-w-[78%] font-display font-semibold leading-[1.12] text-[#4130a3] drop-shadow-[0_2px_0_rgba(255,255,255,0.85)] dark:text-white dark:drop-shadow-[0_2px_8px_rgba(0,0,0,0.72)]`}>
            {current.text}
          </div>
        </div>
        <div className="absolute bottom-[7.6%] left-1/2 z-30 grid w-[62%] -translate-x-1/2 grid-cols-2 gap-[4%]">
          <button
            type="button"
            onClick={() => answer(true)}
            aria-label={copy.trueAnswer}
            className={`relative h-[clamp(4.3rem,6.7vw,5.75rem)] rounded-[1.25rem] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 ${
              selected === true && correct ? 'scale-[1.025] drop-shadow-[0_0_18px_rgba(34,197,94,0.34)]' :
              selected === true && wrong ? 'drop-shadow-[0_0_18px_rgba(244,63,94,0.32)]' :
              selected === true ? 'drop-shadow-[0_0_16px_rgba(168,85,247,0.25)]' :
              'drop-shadow-[0_10px_16px_rgba(34,197,94,0.10)]'
            }`}
          >
            <img src="/ui/true-button.png" alt="" className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain" draggable={false} />
          </button>
          <button
            type="button"
            onClick={() => answer(false)}
            aria-label={copy.falseAnswer}
            className={`relative h-[clamp(4.3rem,6.7vw,5.75rem)] rounded-[1.25rem] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 ${
              selected === false && correct ? 'scale-[1.025] drop-shadow-[0_0_18px_rgba(34,197,94,0.34)]' :
              selected === false && wrong ? 'drop-shadow-[0_0_18px_rgba(244,63,94,0.32)]' :
              selected === false ? 'drop-shadow-[0_0_16px_rgba(168,85,247,0.25)]' :
              'drop-shadow-[0_10px_16px_rgba(244,63,94,0.10)]'
            }`}
          >
            <img src="/ui/false-button.png" alt="" className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain" draggable={false} />
          </button>
        </div>
      </motion.div>
      <div className={`${variant === 'master' ? 'mx-auto mt-[clamp(0.1rem,0.36vh,0.3rem)] w-full max-w-[min(43rem,88%)] px-[clamp(0.18rem,0.6vw,0.45rem)]' : 'mx-auto w-full max-w-[min(50rem,100%)] px-[clamp(0.42rem,0.9vw,0.78rem)]'} relative flex shrink-0 items-center justify-between gap-3`}>
        <AnimatePresence initial={false}>
          {showHint && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              style={{ translate: '-50% -50%' }}
              className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex max-w-[min(21rem,42%)] items-center justify-center gap-1.5 rounded-[0.9rem] border border-purple-200 bg-white/95 px-3 py-1.5 text-center font-body text-[clamp(0.76rem,1vw,0.88rem)] font-semibold leading-tight text-indigo-900 shadow-[0_8px_18px_rgba(139,92,246,0.12)] dark:border-purple-700 dark:bg-[#2b1a3d]/95 dark:text-purple-100"
            >
              <img src="/ui/fill-blank-bulb.png" alt="" className="-my-2.5 h-12 w-12 shrink-0 object-contain" />
              <span className="min-w-0 -translate-x-3 truncate"><strong className="font-display text-purple-700 dark:text-purple-100">{copy.hintAnswer}:</strong> {hintText}</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={() => {
            setShowHint(true);
            onEvent('hint_requested', { mechanic: 'true_false', index });
          }}
          disabled={!hintText}
          className="inline-flex min-h-[2.35rem] items-center gap-2 rounded-full border border-purple-100 bg-white px-4 py-2 font-display text-sm font-bold text-indigo-800 shadow-[0_8px_18px_rgba(139,92,246,0.10)] transition hover:-translate-y-0.5 hover:border-yellow-200 disabled:cursor-not-allowed disabled:opacity-45 dark:border-purple-800 dark:bg-[#2b1a3d] dark:text-purple-100"
        >
          <span className="text-lg leading-none">💡</span> {copy.hintAnswer}
        </button>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setWrong(false);
            setCorrect(false);
            setShowHint(false);
            onEvent('reset_requested', { mechanic: 'true_false', index });
          }}
          className="inline-flex min-h-[2.35rem] items-center gap-2 rounded-full border border-purple-100 bg-white px-4 py-2 font-display text-sm font-bold text-indigo-800 shadow-[0_8px_18px_rgba(139,92,246,0.10)] transition hover:-translate-y-0.5 hover:border-violet-200 dark:border-purple-800 dark:bg-[#2b1a3d] dark:text-purple-100"
        >
          <RotateCcw className="h-4 w-4 text-violet-500" /> {lang === 'ru' ? 'Сбросить' : copy.clear}
        </button>
      </div>
    </div>
  );
}

// ==================== MINI-SHOP ====================
const miniShopAssets = {
  pinkBasket: '/ui/mini-shop-pink-basket.png',
  basketDark: '/ui/mini-shop-basket-dark.png',
  bag: '/ui/mini-shop-bag.png',
  bagDark: '/ui/mini-shop-bag-dark.png',
  purpleBasket: '/ui/mini-shop-purple-basket.png',
  targetStar: '/ui/mini-shop-target-star.png',
};

function MiniShopTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const items: Array<{ name: string; price: number; image?: string; photo?: string; image_url?: string }> = (payload?.items || []).filter((item: any) => String(item?.name || '').trim());
  const target = Math.max(0, Number(payload?.target_total) || 0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [completed, setCompleted] = useState(false);
  const total = items.reduce((sum, item, index) => selected.has(index) ? sum + (Number(item.price) || 0) : sum, 0);
  const over = target > 0 && total > target;

  const completeTask = (nextTotal: number, nextSelected: Set<number>) => {
    if (completed || target <= 0 || nextTotal !== target) return;
    setCompleted(true);
    onEvent('answer_correct', { mechanic: 'mini_shop', total: nextTotal, target, items: Array.from(nextSelected) });
    window.setTimeout(() => onDone(), 650);
  };

  useEffect(() => {
    if (!completed && target > 0 && total === target) {
      completeTask(total, selected);
    }
  }, [completed, target, total, selected]);

  const toggle = (index: number) => {
    if (completed) return;
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      const nextTotal = items.reduce((sum, item, itemIndex) => next.has(itemIndex) ? sum + (Number(item.price) || 0) : sum, 0);
      onEvent('choice_selected', { mechanic: 'mini_shop', index, total: nextTotal, target });
      if (target > 0 && nextTotal > target) onEvent('answer_wrong', { mechanic: 'mini_shop', total: nextTotal, target });
      completeTask(nextTotal, next);
      return next;
    });
  };

  if (items.length === 0 || target <= 0) {
    return <p className="text-center text-purple-500 dark:text-purple-200">{copy.addShopItems}</p>;
  }

  return (
    <div className="relative mx-auto flex h-full w-full max-w-[62rem] flex-col gap-[clamp(0.75rem,1.4vh,1.15rem)] pb-[clamp(3.8rem,7.6vw,5.8rem)]">
      <div className="mx-auto grid w-full max-w-[46rem] grid-cols-1 gap-[clamp(0.62rem,1.1vw,0.9rem)] sm:grid-cols-2">
        <div className="relative min-h-[clamp(4.75rem,8.2vh,5.8rem)] overflow-visible rounded-[1.35rem] border border-pink-200 bg-gradient-to-br from-white via-pink-50/80 to-white px-[clamp(1.2rem,2vw,1.65rem)] py-[clamp(0.62rem,1.2vh,0.86rem)] text-center shadow-[0_10px_24px_rgba(236,72,153,0.08)]">
          <div className="font-body text-[clamp(0.68rem,0.96vw,0.82rem)] font-black uppercase tracking-wide text-pink-400">{copy.shopTarget}</div>
          <div className="font-display text-[clamp(2rem,3.6vw,2.8rem)] font-black leading-none text-pink-600 dark:text-pink-100">{target}</div>
          <img src={miniShopAssets.targetStar} alt="" draggable={false} className="pointer-events-none absolute -bottom-[13%] -right-[5%] h-[clamp(2.05rem,3.95vw,3.1rem)] w-[clamp(2.55rem,4.86vw,3.82rem)] select-none object-contain drop-shadow-[0_8px_14px_rgba(251,191,36,0.2)]" />
        </div>
        <div className={`relative min-h-[clamp(4.75rem,8.2vh,5.8rem)] overflow-visible rounded-[1.35rem] border px-[clamp(1.2rem,2vw,1.65rem)] py-[clamp(0.62rem,1.2vh,0.86rem)] text-center shadow-[0_10px_24px_rgba(139,92,246,0.08)] ${completed ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100' : over ? 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-100' : 'border-purple-200 bg-white text-purple-700 dark:border-purple-700 dark:bg-[#241632] dark:text-purple-100'}`}>
          <div className="font-body text-[clamp(0.68rem,0.96vw,0.82rem)] font-black uppercase tracking-wide opacity-65">{over ? copy.shopOver : copy.shopTotal}</div>
          <div className="flex items-center justify-center gap-2 font-display text-[clamp(2rem,3.6vw,2.8rem)] font-black leading-none">
            <span>{total}</span>
            {completed && total === target && (
              <span className="flex h-[clamp(1.28rem,2.08vw,1.68rem)] w-[clamp(1.28rem,2.08vw,1.68rem)] items-center justify-center text-emerald-500 drop-shadow-[0_4px_8px_rgba(16,185,129,0.22)]">
                <CheckCircle2 className="h-full w-full" />
                <span className="sr-only">{lang === 'en' ? 'Result saved' : lang === 'ua' ? 'Результат збережено' : 'Результат сохранён'}</span>
              </span>
            )}
          </div>
          <img src={miniShopAssets.purpleBasket} alt="" draggable={false} className="pointer-events-none absolute -bottom-[16%] -right-[4%] h-[clamp(2.62rem,5.05vw,4rem)] w-[clamp(2.7rem,5.22vw,4.14rem)] select-none object-contain drop-shadow-[0_8px_16px_rgba(124,58,237,0.16)]" />
        </div>
      </div>
      <div className="relative z-10 grid gap-x-[clamp(1rem,1.75vw,1.45rem)] gap-y-[clamp(0.8rem,1.45vw,1.2rem)] sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => {
          const active = selected.has(index);
          const itemImage = item.image || item.photo || item.image_url;
          const isCheese = /сыр|сир|cheese/i.test(item.name || '');
          return (
            <button
              key={index}
              onClick={() => toggle(index)}
              disabled={completed}
              className={`mini-shop-card-shell relative flex min-h-[clamp(10.9rem,21.6vh,14.2rem)] flex-col items-center justify-end overflow-visible px-[clamp(1.18rem,2vw,1.7rem)] pb-[clamp(1.18rem,2.1vh,1.58rem)] pt-[clamp(1.65rem,3vh,2.15rem)] text-center transition hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 dark:focus-visible:ring-fuchsia-300/50 ${isCheese ? '-mt-[clamp(1rem,2.1vh,1.45rem)]' : ''} ${
                active ? 'text-emerald-700 drop-shadow-[0_12px_18px_rgba(16,185,129,0.18)] dark:text-emerald-100' : 'text-purple-700 drop-shadow-[0_10px_18px_rgba(168,85,247,0.08)] dark:text-white'
              }`}
            >
              <span className="student-accent-gradient absolute right-[10%] top-[10%] flex h-[clamp(1.72rem,3.15vw,2.34rem)] w-[clamp(1.72rem,3.15vw,2.34rem)] items-center justify-center rounded-full font-display text-[clamp(0.82rem,1.48vw,1.12rem)] font-black text-white shadow-[0_7px_14px_rgba(124,58,237,0.22)] ring-2 ring-white/90">
                {Number(item.price) || 0}
              </span>
              {itemImage ? (
                <SignedImg
                  path={itemImage}
                  className="mb-[clamp(0.12rem,0.35vh,0.28rem)] h-[clamp(7.05rem,13.1vh,9.25rem)] w-[clamp(9.2rem,16vw,12.85rem)] scale-[1.78] object-contain"
                  draggable={false}
                />
              ) : (
                <div aria-hidden="true" className="mb-[clamp(0.12rem,0.35vh,0.28rem)] h-[clamp(7.05rem,13.1vh,9.25rem)] w-[clamp(9.2rem,16vw,12.85rem)]" />
              )}
              <div className="max-w-full -translate-y-[clamp(0.32rem,0.72vh,0.52rem)] truncate font-display text-[clamp(1.02rem,1.65vw,1.34rem)] font-black leading-none">{item.name}</div>
            </button>
          );
        })}
      </div>
      <img src={miniShopAssets.pinkBasket} alt="" draggable={false} className="pointer-events-none absolute bottom-[-0.85rem] -right-[1.05rem] z-0 h-[clamp(5.4rem,9.6vw,7.7rem)] w-[clamp(5.4rem,9.6vw,7.7rem)] select-none object-contain drop-shadow-[0_14px_24px_rgba(236,72,153,0.16)] dark:hidden" />
      <img src={miniShopAssets.basketDark} alt="" draggable={false} className="pointer-events-none absolute bottom-[-1.35rem] right-[0.2rem] z-0 hidden h-[clamp(5.4rem,9.6vw,7.7rem)] w-[clamp(5.4rem,9.6vw,7.7rem)] select-none object-contain drop-shadow-[0_14px_26px_rgba(168,85,247,0.28)] dark:block" />
    </div>
  );
}

interface InteractiveAnswerStats {
  totalQuestions: number;
  errorsCount: number;
  firstTryCorrect: number;
  retryAttempts: number;
  erroredQuestions: Set<string>;
  completedQuestions: Set<string>;
}

function createAnswerStats(): InteractiveAnswerStats {
  return {
    totalQuestions: 0,
    errorsCount: 0,
    firstTryCorrect: 0,
    retryAttempts: 0,
    erroredQuestions: new Set(),
    completedQuestions: new Set(),
  };
}

function telemetryQuestionKey(task: InteractiveTask | undefined, payload: TaskTelemetryPayload = {}) {
  const taskId = task?.id || String(payload.mechanic || 'task');
  const mechanic = String(payload.mechanic || task?.mechanic_type || 'task');
  const candidate = payload.questionId
    ?? payload.question_id
    ?? payload.index
    ?? payload.left
    ?? payload.item
    ?? payload.region
    ?? payload.order
    ?? payload.word
    ?? payload.mode;
  if (candidate !== undefined && candidate !== null) return `${taskId}:${mechanic}:${String(candidate)}`;
  return `${taskId}:${mechanic}`;
}

function summarizeAnswerStats(stats: InteractiveAnswerStats, fallbackQuestions: number): InteractiveScoreSummary {
  const totalQuestions = Math.max(1, stats.totalQuestions || fallbackQuestions || 1);
  const errorsCount = Math.max(0, stats.errorsCount);
  const score = calculateInteractiveScore(totalQuestions, errorsCount);
  return {
    totalQuestions,
    errorsCount,
    firstTryCorrect: Math.min(totalQuestions, stats.firstTryCorrect),
    retryAttempts: Math.max(0, stats.retryAttempts),
    scorePercent: score.scorePercent,
    starRating: score.starRating,
  };
}

// ==================== ROOM ====================
export default function InteractiveLessonRoom({
  lesson, userId, contentItemId, onExit, onCompleted, lang = 'ru',
}: {
  lesson: Lesson;
  userId: string;
  contentItemId?: string | null;
  lang?: Lang;
  onExit: () => void;
  onCompleted: (starsAwarded: number) => void;
}) {
  const copy = roomCopy[lang] || roomCopy.ru;
  const [tasks, setTasks] = useState<InteractiveTask[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState<null | number>(null); // stars awarded
  const [finishSummary, setFinishSummary] = useState<InteractiveScoreSummary | null>(null);
  const [finishError, setFinishError] = useState('');
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [teacherHint, setTeacherHint] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<RoomStudentProfile | null>(null);
  const [unitTitle, setUnitTitle] = useState('');
  const [owlState, setOwlState] = useState<OwlPlayerState>('intro');
  const [masterTaskReady, setMasterTaskReady] = useState(false);
  const [scoreVersion, setScoreVersion] = useState(0);
  const [activityVersion, setActivityVersion] = useState(0);
  const lastTeacherHintId = useRef<string | null>(null);
  const introOwlPlayedRef = useRef(false);
  const finishedRef = useRef<null | number>(null);
  const answerStatsRef = useRef<InteractiveAnswerStats>(createAnswerStats());
  const theoryTask = useMemo(() => tasks.find(task => task.mechanic_type === 'theory_content'), [tasks]);
  const playableTasks = useMemo(() => tasks.filter(task => task.mechanic_type !== 'theory_content'), [tasks]);
  const displayedTasks = useMemo(
    () => lesson.type === 'theory' ? (theoryTask ? [theoryTask] : []) : playableTasks,
    [lesson.type, playableTasks, theoryTask],
  );

  useEffect(() => {
    finishedRef.current = finished;
  }, [finished]);

  const showTeacherHint = (id: string, message: string) => {
    if (lastTeacherHintId.current === id) return;
    lastTeacherHintId.current = id;
    setTeacherHint(message);
    setOwlState('hint');
    window.setTimeout(() => setTeacherHint(current => current === message ? null : current), 9000);
  };

  useEffect(() => {
    answerStatsRef.current = createAnswerStats();
    introOwlPlayedRef.current = false;
    setScoreVersion(0);
    listTasks(lesson.id).then(t => { setTasks(t); setLoading(false); });
  }, [lesson.id, userId]);

  useEffect(() => {
    let alive = true;
    const loadMasterData = async () => {
      const [{ data: profile }, { data: unit }] = await Promise.all([
        supabase
          .from('profiles')
          .select('name,email,star_balance,avatar_id')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('units')
          .select('title')
          .eq('id', lesson.unit_id)
          .maybeSingle(),
      ]);
      if (!alive) return;
      setStudentProfile({
        name: profile?.name || profile?.email?.split('@')[0] || 'Vetoschool',
        email: profile?.email || '',
        starBalance: profile?.star_balance ?? 0,
        avatarId: profile?.avatar_id ?? null,
      });
      setUnitTitle(unit?.title || `${copy.unit} ${lesson.lesson_number || 1}`);
    };
    void loadMasterData();
    return () => { alive = false; };
  }, [copy.unit, lesson.lesson_number, lesson.unit_id, userId]);

  useEffect(() => {
    let alive = true;
    startLiveSession(lesson.id, userId).then(session => {
      if (!alive) return;
      setLiveSession(session);
      if (session) {
        recordLiveEvent({
          sessionId: session.id,
          lessonId: lesson.id,
          studentId: userId,
          eventType: 'lesson_opened',
          payload: { lessonTitle: lesson.title },
        });
      }
    });
    return () => { alive = false; };
  }, [lesson.id, userId]);

  useEffect(() => {
    if (!liveSession) return;
    return subscribeLiveSessionEvents(liveSession.id, event => {
      if (event.actor_role !== 'teacher' || event.event_type !== 'teacher_hint') return;
      const message = event.payload_json?.message || copy.teacherHint;
      showTeacherHint(event.id, message);
    });
  }, [liveSession?.id]);

  useEffect(() => {
    if (!liveSession) return;
    let alive = true;
    const checkHints = async () => {
      try {
        const events = await listLiveEvents(liveSession.id);
        if (!alive) return;
        const latestHint = events.find(event => event.actor_role === 'teacher' && event.event_type === 'teacher_hint');
        if (!latestHint) return;
        const message = latestHint.payload_json?.message || copy.teacherHint;
        showTeacherHint(latestHint.id, message);
      } catch {
        // Realtime remains primary; polling is only a quiet backup for missed hint events.
      }
    };
    checkHints();
    const interval = window.setInterval(checkHints, 2500);
    return () => { alive = false; window.clearInterval(interval); };
  }, [liveSession?.id]);

  useEffect(() => {
    if (!liveSession) return;
    const closeUnfinishedSession = () => {
      if (finishedRef.current === null) abandonLiveSession(liveSession.id);
    };
    window.addEventListener('pagehide', closeUnfinishedSession);
    return () => {
      window.removeEventListener('pagehide', closeUnfinishedSession);
    };
  }, [liveSession?.id]);

  useEffect(() => {
    const curTask = displayedTasks[idx];
    if (!liveSession || !curTask) return;
    updateLiveSession(liveSession.id, { current_task_id: curTask.id, current_task_index: idx });
    recordLiveEvent({
      sessionId: liveSession.id,
      lessonId: lesson.id,
      studentId: userId,
      eventType: 'task_opened',
      taskId: curTask.id,
      payload: { index: idx, mechanic: curTask.mechanic_type },
    });
  }, [liveSession?.id, displayedTasks, idx, lesson.id, userId]);

  useEffect(() => {
    if (finishedRef.current !== null) return;
    setMasterTaskReady(false);
    if (lesson.type !== 'theory' && displayedTasks[idx]?.id && !introOwlPlayedRef.current) {
      introOwlPlayedRef.current = true;
      setOwlState('intro');
    } else {
      setOwlState('wave');
    }
    setActivityVersion(version => version + 1);
  }, [idx, displayedTasks[idx]?.id, lesson.type]);

  useEffect(() => {
    if (finished === null) return;
    const finalRating = finishSummary?.starRating ?? 0;
    setOwlState(lesson.type !== 'theory' && finalRating >= 5 ? 'finishPerfect' : 'finishIdle');
  }, [finishSummary?.starRating, finished, lesson.type]);

  const emitTaskEvent: TaskTelemetry = (eventType, payload = {}) => {
    setActivityVersion(version => version + 1);
    if (eventType === 'answer_correct') playFeedbackSound('correct');
    if (eventType === 'answer_wrong') playFeedbackSound('wrong');
    if (eventType === 'answer_correct') setOwlState('correct');
    if (eventType === 'answer_wrong') setOwlState('wrong');
    const curTask = displayedTasks[idx];
    const questionKey = telemetryQuestionKey(curTask, payload);
    let scoreChanged = false;
    if (eventType === 'answer_wrong') {
      answerStatsRef.current.errorsCount += 1;
      answerStatsRef.current.retryAttempts += 1;
      answerStatsRef.current.erroredQuestions.add(questionKey);
      scoreChanged = true;
    }
    if (eventType === 'answer_correct' && !answerStatsRef.current.completedQuestions.has(questionKey)) {
      answerStatsRef.current.totalQuestions += 1;
      if (!answerStatsRef.current.erroredQuestions.has(questionKey)) {
        answerStatsRef.current.firstTryCorrect += 1;
      }
      answerStatsRef.current.completedQuestions.add(questionKey);
      scoreChanged = true;
    }
    if (scoreChanged) setScoreVersion(version => version + 1);
    recordLiveEvent({
      sessionId: liveSession?.id ?? null,
      lessonId: lesson.id,
      studentId: userId,
      eventType,
      taskId: curTask?.id ?? null,
      payload: { ...payload, questionKey },
    });
  };

  const finish = async () => {
    if (finishedRef.current !== null) return;
    setFinishError('');
    try {
      playCompletionSound();
      const showScore = lesson.type !== 'theory';
      const summary = showScore ? summarizeAnswerStats(answerStatsRef.current, displayedTasks.length) : null;
      const stars = contentItemId
        ? await completeAssignedInteractiveContent(userId, contentItemId, lesson, summary?.scorePercent ?? 100, summary?.errorsCount ?? 0, summary?.starRating ?? 0)
        : await markLessonComplete(userId, lesson, summary?.scorePercent ?? 100, summary?.errorsCount ?? 0, summary?.starRating ?? 0);
      finishedRef.current = stars;
      if (liveSession) {
        await recordLiveEvent({
          sessionId: liveSession.id,
          lessonId: lesson.id,
          studentId: userId,
          eventType: 'lesson_completed',
          payload: { stars, contentItemId: contentItemId || null, ...(summary || {}) },
        });
        await completeLiveSession(liveSession.id);
      }
      setFinishSummary(summary);
      setFinished(stars);
      setOwlState(showScore && summary?.starRating === 5 ? 'finishPerfect' : 'finishIdle');
      onCompleted(stars);
    } catch (error) {
      console.error('Failed to complete interactive lesson', error);
      setFinishError(
        lang === 'en'
          ? 'The lesson is complete, but the result was not saved. Please try again.'
          : lang === 'ua'
            ? 'Урок пройдено, але результат не зберігся. Спробуйте ще раз.'
            : 'Урок пройден, но результат не сохранился. Попробуйте ещё раз.',
      );
    }
  };
  const nextTask = () => {
    if (idx + 1 >= displayedTasks.length) void finish();
    else {
      playButtonSound('task');
      setIdx(i => i + 1);
    }
  };

  const exitLesson = async () => {
    if (liveSession && finishedRef.current === null) await abandonLiveSession(liveSession.id);
    onExit();
  };

  const cur = displayedTasks[idx];
  const useMasterGameLayout = !loading && lesson.type !== 'theory' && Boolean(cur);
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, []);

  useEffect(() => {
    if (!useMasterGameLayout || finished !== null || masterTaskReady || !cur) return undefined;
    if (owlState !== 'idle' && owlState !== 'wave') return undefined;

    const timeout = window.setTimeout(() => {
      setOwlState(current => {
        if (current !== 'idle' && current !== 'wave') return current;
        return 'thinking';
      });
    }, THINKING_OWL_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [activityVersion, cur, finished, masterTaskReady, owlState, useMasterGameLayout]);

  const equippedAvatar = findAvatar(studentProfile?.avatarId);
  const taskMeta = cur ? mechanicCopy[lang][cur.mechanic_type] : null;
  const completedForProgress = finished !== null ? displayedTasks.length : idx + (masterTaskReady ? 1 : 0);
  const lessonProgressPercent = displayedTasks.length > 0
    ? Math.round((completedForProgress / displayedTasks.length) * 100)
    : 0;
  const liveDisplayRating = useMemo(
    () => Math.min(5, Math.max(0, 5 - answerStatsRef.current.errorsCount)),
    [scoreVersion],
  );
  const displayRating = Math.min(5, Math.max(0, finishSummary?.starRating ?? liveDisplayRating));
  const owlSpeech = teacherHint
    || (finished !== null ? `${copy.great} ${copy.complete} 💜` : masterTaskReady ? copy.keepGoing : taskMeta?.instruction)
    || copy.loading;
  const hideOwlSpeechBubble = owlState === 'thinking' || owlState === 'finishPerfect';
  const renderMasterTaskContent = (task: InteractiveTask, onDone: () => void) => {
    switch (task.mechanic_type) {
      case 'matching':
        return <MatchingTask payload={task.payload_json} onDone={onDone} onEvent={emitTaskEvent} lang={lang} />;
      case 'word_lego':
        return <WordLegoTask payload={task.payload_json} onDone={onDone} onEvent={emitTaskEvent} lang={lang} />;
      case 'fill_letters':
        return <FillLettersTask payload={task.payload_json} onDone={onDone} onEvent={emitTaskEvent} lang={lang} />;
      case 'anagram_unscramble':
        return <AnagramTask payload={task.payload_json} onDone={onDone} onEvent={emitTaskEvent} lang={lang} />;
      case 'odd_one_out':
        return <OddOneOutTask payload={task.payload_json} onDone={onDone} onEvent={emitTaskEvent} lang={lang} />;
      case 'category_sorting':
        return <CategorySortingTask payload={task.payload_json} onDone={onDone} onEvent={emitTaskEvent} lang={lang} />;
      case 'cipher_decoder':
        return <CipherDecoderTask payload={task.payload_json} onDone={onDone} onEvent={emitTaskEvent} lang={lang} />;
      case 'word_search':
        return <WordSearchTask payload={task.payload_json} onDone={onDone} onEvent={emitTaskEvent} lang={lang} />;
      case 'connect_dots':
        return <ConnectDotsTask payload={task.payload_json} onDone={onDone} onEvent={emitTaskEvent} lang={lang} />;
      case 'spot_and_count':
        return <SpotAndCountTask payload={task.payload_json} onDone={onDone} onEvent={emitTaskEvent} lang={lang} />;
      case 'speaking_practice':
        return <SpeakingPracticeTask payload={task.payload_json} onDone={onDone} onEvent={emitTaskEvent} lang={lang} />;
      case 'digital_coloring':
        return <DigitalColoringTask payload={task.payload_json} onDone={onDone} onEvent={emitTaskEvent} lang={lang} />;
      case 'true_false':
        return <TrueFalseTask payload={task.payload_json} onDone={onDone} onEvent={emitTaskEvent} lang={lang} variant="master" />;
      case 'mini_shop':
        return <MiniShopTask payload={task.payload_json} onDone={onDone} onEvent={emitTaskEvent} lang={lang} />;
      default:
        return (
          <div className="py-8 text-center">
            <div className="mb-2 text-4xl">🚧</div>
            <p className="text-purple-500">{copy.mechanicWip(task.mechanic_type)}</p>
            <button onClick={onDone} className="mt-4 rounded-2xl bg-purple-500 px-5 py-2 text-white shadow-lg">{copy.skip}</button>
          </div>
        );
    }
  };

  if (useMasterGameLayout) {
    const masterRoom = (
	      <div
	        className="interactive-master-room fixed inset-0 z-50 overflow-y-auto bg-[#f8efff] bg-[url('/backgrounds/vetoschool-interactive-room-bg.png')] bg-cover bg-center bg-no-repeat text-purple-950 dark:bg-[#080821] dark:bg-[url('/backgrounds/vetoschool-interactive-room-bg-dark.png')] md:h-[100dvh] md:overflow-hidden"
	        style={{ backgroundPosition: 'center bottom' }}
	      >

        <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1600px] flex-col px-[clamp(0.65rem,1.45vw,1.45rem)] py-[clamp(0.45rem,1vh,0.9rem)] md:h-[100dvh] md:min-h-0">
          <header className="flex shrink-0 items-center justify-end gap-[clamp(0.45rem,1vw,0.85rem)] pb-[clamp(0.35rem,1vh,0.75rem)]">
            <div className="flex items-center gap-[clamp(0.26rem,0.55vw,0.44rem)] rounded-full border border-purple-100 bg-white px-[clamp(0.82rem,1.28vw,1.04rem)] py-[clamp(0.4rem,0.75vh,0.58rem)] shadow-[0_10px_24px_rgba(168,85,247,0.14)]">
              <img
                src={REWARD_STAR_SRC}
                alt=""
                draggable={false}
                className="h-[clamp(2.05rem,2.75vw,2.45rem)] w-[clamp(2.05rem,2.75vw,2.45rem)] select-none object-contain"
              />
              <span className="font-display text-[clamp(1rem,1.55vw,1.25rem)] font-black text-purple-700">{studentProfile?.starBalance ?? 0}</span>
            </div>
            <div className="flex items-center gap-[clamp(0.45rem,0.9vw,0.75rem)] rounded-full border border-purple-100 bg-white py-[clamp(0.25rem,0.65vh,0.45rem)] pl-[clamp(0.35rem,0.7vw,0.5rem)] pr-[clamp(0.75rem,1.3vw,1rem)] shadow-[0_10px_24px_rgba(168,85,247,0.14)]">
              <div className="flex h-[clamp(2.35rem,4.8vw,3rem)] w-[clamp(2.35rem,4.8vw,3rem)] items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-100 to-pink-100 text-[clamp(1.35rem,2.5vw,1.8rem)] ring-[clamp(0.18rem,0.45vw,0.3rem)] ring-white">
                {equippedAvatar
                  ? equippedAvatar.imageSrc
                    ? <img src={equippedAvatar.imageSrc} alt="" className="h-full w-full object-contain" />
                    : equippedAvatar.emoji
                  : (studentProfile?.name?.[0] || 'V').toUpperCase()}
              </div>
              <span className="max-w-[10rem] truncate font-display text-sm font-black text-purple-700 sm:max-w-[14rem]">{studentProfile?.name || 'Vetoschool'}</span>
            </div>
            <button
              onClick={exitLesson}
              aria-label={copy.exit}
              className="flex h-[clamp(2.35rem,4.5vw,2.85rem)] w-[clamp(2.35rem,4.5vw,2.85rem)] items-center justify-center rounded-full border border-white/80 bg-white/85 text-purple-500 shadow-lg shadow-purple-200/30 transition hover:-translate-y-0.5 hover:text-pink-500"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <main className="grid min-h-0 flex-1 gap-[clamp(0.15rem,0.45vw,0.55rem)] md:grid-cols-[minmax(255px,0.30fr)_minmax(0,0.70fr)] lg:grid-cols-[minmax(330px,0.31fr)_minmax(0,0.69fr)]">
            <aside className="pointer-events-none relative z-30 flex min-h-[420px] min-w-0 flex-col justify-end gap-[clamp(0.28rem,0.65vh,0.48rem)] overflow-visible md:min-h-0">
              <div
                aria-hidden={hideOwlSpeechBubble}
                className={`relative z-10 mx-auto mb-[clamp(1.35rem,3.2vh,2.5rem)] aspect-[1055/570] w-[min(100%,21.5rem)] -translate-x-[clamp(0.45rem,1.4vw,1.15rem)] translate-y-[clamp(1.25rem,3.4vh,2.55rem)] transition-opacity duration-200 ease-in-out dark:w-[min(100%,27rem)] md:w-[min(100%,20.75rem)] md:-translate-x-[clamp(0.75rem,1.9vw,1.65rem)] md:translate-y-[clamp(1.7rem,4.4dvh,3.35rem)] dark:md:w-[min(100%,26rem)] lg:w-[min(100%,23rem)] dark:lg:w-[min(100%,29.5rem)] ${hideOwlSpeechBubble ? 'opacity-0' : 'opacity-100'}`}
              >
                <img
                  src="/ui/dialog-window.png"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain dark:hidden"
                />
                <img
                  src="/ui/dialog-window-dark.png"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="pointer-events-none absolute inset-0 hidden h-full w-full select-none object-fill dark:block"
                />
                <p className="absolute left-[11%] right-[15%] top-[17%] flex h-[54%] items-center justify-center text-center font-display text-[clamp(1.05rem,1.42vw,1.4rem)] font-bold leading-[1.15] text-purple-800">
                  {owlSpeech}
                </p>
              </div>
              <div className="relative z-20 flex min-h-0 flex-1 items-end justify-center overflow-visible">
                <OwlPlayer
                  state={owlState}
                  onStateComplete={state => {
                    if (state === 'finishPerfect') {
                      setOwlState('finishIdle');
                      return;
                    }
                    if (state !== 'finish' && state !== 'finishIdle') {
                      setOwlState('idle');
                      if (state === 'thinking') setActivityVersion(version => version + 1);
                    }
                  }}
                  className="h-[clamp(365px,57dvh,620px)] max-w-[min(118vw,670px)] -translate-x-[clamp(0.85rem,4vw,2rem)] translate-y-[clamp(4.5rem,10vh,7rem)] md:h-[clamp(425px,70dvh,740px)] md:max-w-[min(49vw,760px)] md:-translate-x-[clamp(1.75rem,4.4vw,4.5rem)] md:translate-y-[clamp(6rem,12.5dvh,9rem)]"
                />
              </div>
            </aside>

            <section className="relative z-20 flex min-h-0 flex-col rounded-[2rem] bg-white p-[clamp(0.78rem,1.35vw,1.14rem)] shadow-[0_18px_42px_rgba(168,85,247,0.16)] md:-ml-[clamp(0.05rem,0.25vw,0.25rem)]">
              <div className="mb-[clamp(0.48rem,1vh,0.76rem)] flex shrink-0 flex-col gap-[clamp(0.45rem,0.82vh,0.66rem)] xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-center gap-[clamp(0.46rem,0.9vw,0.72rem)]">
                  <div className="flex h-[clamp(2.28rem,3.55vw,2.9rem)] w-[clamp(2.28rem,3.55vw,2.9rem)] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 via-purple-100 to-sky-100 text-[clamp(1.05rem,1.75vw,1.38rem)] shadow-inner">
                    ✨
                  </div>
                  <div className="min-w-0">
	                    <div className="font-body text-[clamp(0.62rem,0.9vw,0.7rem)] font-medium uppercase tracking-[0.2em] text-purple-400 dark:text-white">{copy.unit}</div>
	                    <h2 className="truncate font-display text-[clamp(1.18rem,2.1vw,1.66rem)] font-bold leading-tight text-purple-800 dark:text-white">{unitTitle || copy.unit}</h2>
	                    <p className="mt-0.5 truncate font-body text-[clamp(0.72rem,1vw,0.84rem)] font-medium text-purple-500 dark:text-white">{copy.topic}: {lesson.title}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-center gap-[clamp(0.42rem,0.78vw,0.62rem)]">
                  <StarRatingDisplay value={displayRating} />
                  <CircularRatingDisplay value={displayRating} />
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col rounded-[1.7rem] bg-white p-[clamp(0.65rem,1.16vw,0.98rem)]">
                <AnimatePresence>
                  {teacherHint && finished === null && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="mb-5 rounded-3xl border border-yellow-200 bg-yellow-50 px-5 py-4 text-center font-body text-base font-black text-purple-800"
                    >
                      {teacherHint}
                    </motion.div>
                  )}
                </AnimatePresence>
                {finishError && finished === null && (
                  <div className="mb-5 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-center font-body text-sm font-black text-rose-600">
                    {finishError}
                  </div>
                )}
                {finished !== null ? (
                  <CompletionCelebration stars={finished} summary={finishSummary} showScore={lesson.type !== 'theory'} copy={copy} onExit={exitLesson} />
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div key={cur.id} className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                      <div className="mx-auto mb-[clamp(0.46rem,1.08vh,0.72rem)] w-full max-w-4xl rounded-[1.45rem] bg-white px-[clamp(0.9rem,1.7vw,1.48rem)] py-[clamp(0.44rem,1vh,0.74rem)] text-center shadow-[0_8px_22px_rgba(168,85,247,0.06)]">
	                        <h3 className="font-display text-[clamp(1.38rem,2.55vw,2.38rem)] font-bold leading-tight text-purple-800 dark:text-white">
                          <span className="inline-flex items-center justify-center gap-[clamp(0.32rem,0.68vw,0.56rem)]">
                            <span>{taskMeta?.title || lesson.title}</span>
                            {cur.mechanic_type === 'mini_shop' && (
                              <>
                                <img src={miniShopAssets.bag} alt="" draggable={false} className="h-[clamp(1.85rem,3.55vw,2.9rem)] w-[clamp(1.52rem,2.94vw,2.42rem)] select-none object-contain drop-shadow-[0_8px_14px_rgba(236,72,153,0.14)] dark:hidden" />
                                <img src={miniShopAssets.bagDark} alt="" draggable={false} className="hidden h-[clamp(2.15rem,4.1vw,3.35rem)] w-[clamp(1.75rem,3.38vw,2.8rem)] translate-y-1 select-none object-contain drop-shadow-[0_8px_18px_rgba(168,85,247,0.30)] dark:block" />
                              </>
                            )}
                          </span>
                        </h3>
	                        <p className="mt-0.5 font-body text-[clamp(0.72rem,1.14vw,0.88rem)] font-medium text-purple-500 dark:text-white">{taskMeta?.instruction}</p>
                      </div>
                      <div className="min-h-0 flex-1">
                        {renderMasterTaskContent(cur, () => setMasterTaskReady(true))}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </section>
          </main>

          <footer className="grid shrink-0 gap-[clamp(0.55rem,1vw,0.9rem)] pt-[clamp(0.45rem,1vh,0.75rem)] sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <button
              onClick={exitLesson}
              className="inline-flex min-h-[2.4rem] items-center justify-center gap-2 rounded-full border border-purple-100 bg-white px-[clamp(0.88rem,1.5vw,1.18rem)] py-[clamp(0.42rem,0.78vh,0.58rem)] font-display text-[clamp(0.78rem,1vw,0.9rem)] font-semibold text-purple-600 shadow-[0_8px_22px_rgba(168,85,247,0.12)] transition hover:-translate-y-0.5 hover:text-pink-500"
            >
              <ArrowLeft className="h-4 w-4" /> {copy.exit}
            </button>
            <div className="flex min-w-0 items-center gap-[clamp(0.68rem,1.28vw,0.98rem)] rounded-full border border-purple-100 bg-white px-[clamp(0.95rem,1.65vw,1.28rem)] py-[clamp(0.44rem,0.82vh,0.62rem)] shadow-[0_10px_28px_rgba(168,85,247,0.16)]">
              <span className="whitespace-nowrap font-display text-[clamp(0.9rem,1.16vw,1.02rem)] font-semibold leading-none text-[#55409b]">{copy.progressHint}</span>
              <div className="relative h-[clamp(0.48rem,0.98vh,0.64rem)] flex-1 overflow-visible rounded-full bg-purple-50 shadow-inner shadow-purple-100">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-100/80 via-purple-50 to-sky-50" />
                <div
                  className="absolute inset-y-0 left-0 rounded-full shadow-[0_0_18px_rgba(168,85,247,0.28)] transition-all duration-500"
                  style={{ width: `${lessonProgressPercent}%`, background: masterProgressGradient }}
                />
                <div
                  className="absolute top-[64%] h-[clamp(3.55rem,6.25vw,4.85rem)] w-[clamp(5.33rem,9.38vw,7.27rem)] -translate-x-1/2 -translate-y-1/2 transition-[left] duration-500 ease-in-out"
                  style={{ left: `clamp(1.15rem, ${lessonProgressPercent}%, calc(100% - 0.65rem))` }}
                  aria-hidden="true"
                >
                  <div className="progress-star-glow relative h-full w-full">
                    <span className="progress-star-sparkle progress-star-sparkle-a" />
                    <span className="progress-star-sparkle progress-star-sparkle-b" />
                    <span className="progress-star-sparkle progress-star-sparkle-c" />
                    <span className="progress-star-sparkle progress-star-sparkle-d" />
                    <img
                      src={PROGRESS_STAR_SRC}
                      alt=""
                      draggable={false}
                      className="relative z-10 h-full w-full select-none object-contain"
                    />
                    <span className="progress-star-shimmer" />
                  </div>
                </div>
              </div>
              <span className="min-w-[2.5rem] text-right font-display text-[clamp(0.76rem,1vw,0.88rem)] font-semibold text-purple-700">{lessonProgressPercent}%</span>
            </div>
            <button
              onClick={() => {
                if (!masterTaskReady || finished !== null) return;
                nextTask();
              }}
              disabled={!masterTaskReady || finished !== null}
              className="inline-flex min-h-[2.4rem] items-center justify-center gap-2 rounded-full px-[clamp(1.18rem,2vw,1.72rem)] py-[clamp(0.42rem,0.78vh,0.58rem)] font-display text-[clamp(0.82rem,1.15vw,0.98rem)] font-semibold text-white shadow-[0_10px_24px_rgba(168,85,247,0.28)] transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:text-white/90 disabled:shadow-[0_8px_18px_rgba(168,85,247,0.12)]"
              style={{ background: masterProgressGradient }}
            >
              {copy.next} <ArrowRight className="h-4 w-4" />
            </button>
          </footer>
        </div>
      </div>
    );

    return typeof document === 'undefined' ? masterRoom : createPortal(masterRoom, document.body);
  }

  const room = (
    <div className="fixed inset-0 z-50 overflow-x-hidden overflow-y-auto bg-gradient-to-br from-pink-50 via-violet-50 to-sky-50 dark:bg-[#150923] dark:bg-none">
      <div className={`mx-auto flex min-h-screen w-full flex-col px-4 sm:px-6 lg:px-8 ${lesson.type === 'theory' ? 'max-w-[1510px] py-2' : 'max-w-6xl py-5'}`}>
        <div className="mb-5 flex items-center justify-between gap-3 rounded-3xl border border-white bg-white px-4 py-3 shadow-sm dark:border-purple-800 dark:bg-[#211331] dark:shadow-none">
          <button onClick={exitLesson} className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-body font-800 text-purple-500 transition hover:bg-purple-50 hover:text-purple-700 dark:text-purple-200 dark:hover:bg-purple-900 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> {copy.exit}
          </button>
          <div className="flex items-center gap-3">
            {lesson.type !== 'theory' && displayedTasks.length > 0 && finished === null && <LessonProgress current={idx} total={displayedTasks.length} />}
            <div className="rounded-2xl border border-pink-100 bg-pink-50 px-3 py-2 text-sm font-body font-800 text-pink-500 dark:border-purple-700 dark:bg-[#2b1a3d] dark:text-pink-200">
              {finished === null && (lesson.type === 'theory' ? copy.theoryLesson : displayedTasks.length > 0 && copy.taskProgress(idx + 1, displayedTasks.length))}
            </div>
          </div>
        </div>
        <div className={`flex flex-1 items-start justify-center ${lesson.type === 'theory' ? 'pt-0' : 'pt-6 sm:pt-10'}`}>
          <div className={`w-full ${lesson.type === 'theory' ? '' : 'rounded-[2rem] border border-white bg-gradient-to-br from-white via-white to-pink-50 p-4 shadow-2xl shadow-purple-100/60 dark:border-purple-800 dark:bg-[#211331] dark:bg-none dark:shadow-none sm:p-6 lg:p-8'}`}>
          <AnimatePresence>
            {teacherHint && finished === null && (
              <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-5 rounded-3xl border border-yellow-200 bg-gradient-to-r from-yellow-50 via-pink-50 to-purple-50 px-5 py-4 text-center font-body text-base font-black text-purple-800 shadow-lg shadow-yellow-100/60 dark:border-yellow-500/30 dark:from-[#35240c] dark:via-[#311536] dark:to-[#211331] dark:text-yellow-100"
              >
                <span className="mr-2">💡</span>{teacherHint}
              </motion.div>
            )}
          </AnimatePresence>
          {lesson.type !== 'theory' && (
            <div className="mb-6 text-center">
              <div className="mb-3 inline-flex items-center gap-2 rounded-2xl border border-purple-100 bg-white px-4 py-2 text-xs font-body font-800 uppercase tracking-wider text-purple-400 shadow-sm dark:border-purple-700 dark:bg-[#2b1a3d] dark:text-purple-200">
                <Sparkles className="h-4 w-4 text-pink-400" /> Vetoschool quest
              </div>
              <h2 className="font-display text-3xl font-black text-purple-800 sm:text-4xl dark:text-purple-100">{lesson.title}</h2>
            </div>
          )}

          {loading && <p className="text-center text-purple-500 dark:text-purple-200">{copy.loading}</p>}
          {finishError && finished === null && (
            <div className="mx-auto mb-5 max-w-2xl rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-center font-body text-sm font-black text-rose-600 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
              {finishError}
            </div>
          )}
          {!loading && displayedTasks.length === 0 && (
            <div className="text-center py-8">
              <BookOpen className="mx-auto mb-3 h-12 w-12 text-purple-300" />
              <p className="font-body font-bold text-purple-500 dark:text-purple-200">{lesson.type === 'theory' ? copy.noTheory : copy.noTasks}</p>
              <button onClick={exitLesson} className="mt-4 rounded-2xl bg-purple-500 px-5 py-2 text-white shadow-lg">{copy.backToMap}</button>
            </div>
          )}
          {!loading && lesson.type === 'theory' && theoryTask && finished === null && (
            <div className="space-y-6">
              <TheoryLessonView content={theoryTask.payload_json} fallbackTitle={lesson.title} lang={lang} />
              <div className="flex justify-center pt-6">
                <button onClick={() => { playButtonSound('study'); void finish(); }} style={{ background: masterProgressGradient }} className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 font-display text-sm font-black text-white shadow-xl shadow-purple-200/50 transition hover:-translate-y-0.5 hover:brightness-105 hover:shadow-2xl dark:shadow-none">
                  <CheckCircle2 className="h-5 w-5" /> {copy.studied}
                </button>
              </div>
            </div>
          )}
          {!loading && lesson.type !== 'theory' && cur && finished === null && (
            <AnimatePresence mode="wait">
              <motion.div key={cur.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                {mechanicCopy[lang][cur.mechanic_type] && (
                  <div className="mx-auto mb-6 max-w-3xl rounded-3xl border border-pink-100 bg-gradient-to-r from-pink-50 via-purple-50 to-sky-50 px-5 py-4 text-center shadow-sm dark:border-purple-500/25 dark:from-pink-500/10 dark:via-purple-500/10 dark:to-sky-500/10">
                    <h3 className="font-display text-xl font-black text-purple-700 dark:text-purple-100 sm:text-2xl">
                      <span className="inline-flex items-center justify-center gap-2">
                        <span>{mechanicCopy[lang][cur.mechanic_type]?.title}</span>
                        {cur.mechanic_type === 'mini_shop' && (
                          <>
                            <img src={miniShopAssets.bag} alt="" draggable={false} className="h-8 w-7 select-none object-contain drop-shadow-[0_8px_14px_rgba(236,72,153,0.14)] dark:hidden sm:h-10 sm:w-8" />
                            <img src={miniShopAssets.bagDark} alt="" draggable={false} className="hidden h-9 w-8 translate-y-1 select-none object-contain drop-shadow-[0_8px_18px_rgba(168,85,247,0.30)] dark:block sm:h-12 sm:w-10" />
                          </>
                        )}
                      </span>
                    </h3>
                    <p className="mt-1 font-body text-sm font-bold text-purple-500 dark:text-purple-200 sm:text-base">
                      {mechanicCopy[lang][cur.mechanic_type]?.instruction}
                    </p>
                  </div>
                )}
                {cur.mechanic_type === 'matching' && <MatchingTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} lang={lang} />}
                {cur.mechanic_type === 'word_lego' && <WordLegoTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} lang={lang} />}
                {cur.mechanic_type === 'fill_letters' && <FillLettersTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} lang={lang} />}
                {cur.mechanic_type === 'anagram_unscramble' && <AnagramTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} lang={lang} />}
                {cur.mechanic_type === 'odd_one_out' && <OddOneOutTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} lang={lang} />}
                {cur.mechanic_type === 'category_sorting' && <CategorySortingTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} lang={lang} />}
                {cur.mechanic_type === 'cipher_decoder' && <CipherDecoderTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} lang={lang} />}
                {cur.mechanic_type === 'word_search' && <WordSearchTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} lang={lang} />}
                {cur.mechanic_type === 'speaking_practice' && <SpeakingPracticeTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} lang={lang} />}
                {cur.mechanic_type === 'digital_coloring' && <DigitalColoringTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} lang={lang} />}
                {cur.mechanic_type === 'true_false' && <TrueFalseTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} lang={lang} />}
                {cur.mechanic_type === 'mini_shop' && <MiniShopTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} lang={lang} />}
                {!['matching','word_lego','fill_letters','anagram_unscramble','odd_one_out','category_sorting','cipher_decoder','word_search','speaking_practice','digital_coloring','true_false','mini_shop'].includes(cur.mechanic_type) && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">🚧</div>
                    <p className="text-purple-500 dark:text-purple-200">{copy.mechanicWip(cur.mechanic_type)}</p>
                    <button onClick={nextTask} className="mt-4 rounded-2xl bg-purple-500 px-5 py-2 text-white shadow-lg">{copy.skip}</button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
          {finished !== null && (
            <CompletionCelebration stars={finished} summary={finishSummary} showScore={lesson.type !== 'theory'} copy={copy} onExit={exitLesson} />
          )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? room : createPortal(room, document.body);
}
