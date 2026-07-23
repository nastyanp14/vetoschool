import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, CheckCircle2, Headphones, Mic, RotateCcw, Sparkles, Square, Trophy, Volume2, XCircle } from 'lucide-react';
import {
  Lesson, InteractiveTask, listTasks, markLessonComplete, signedUrlFor,
} from '../lib/workbooks';
import { MechanicType } from '../lib/mechanics';
import {
  LiveSession, abandonLiveSession, completeLiveSession, recordLiveEvent, startLiveSession,
  listLiveEvents, subscribeLiveSessionEvents, updateLiveSession,
} from '../lib/live';
import TheoryLessonView from './TheoryLessonView';
import type { Lang } from '../lib/i18n';

type TaskTelemetry = (eventType: string, payload?: unknown) => void;
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
const selectedTile = 'bg-gradient-to-r from-pink-400 to-purple-400 border-white text-white shadow-xl ring-4 ring-pink-200/70 dark:border-purple-200 dark:ring-purple-500/30';
const doneTile = 'bg-emerald-50 border-emerald-200 text-emerald-700 opacity-75 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-200';
const wrongTile = 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse dark:bg-rose-950 dark:border-rose-700 dark:text-rose-200';

function LessonProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full transition-all ${i <= current ? 'w-8 bg-gradient-to-r from-pink-400 to-purple-400' : 'w-2 bg-purple-100 dark:bg-purple-800'}`}
        />
      ))}
    </div>
  );
}

const mechanicCopy: Record<Lang, Partial<Record<MechanicType, { title: string; instruction: string }>>> = {
  ru: {
    matching: { title: 'Найди пары', instruction: 'Выбери карточку слева, затем соедини её с правильной карточкой справа.' },
    word_lego: { title: 'Собери слова', instruction: 'Соедини две части, чтобы получилось правильное слово или фраза.' },
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
  },
} as const;

const taskCopy = {
  ru: {
    matchingDone: 'Отлично! Все пары соединены',
    built: 'Собрано',
    partOne: 'Часть 1',
    partTwo: 'Часть 2',
    check: 'Проверить',
    undoLast: 'Убрать последнюю',
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
    answerHidden: 'Ответ появится после попытки.',
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
    answerHidden: 'The answer appears after you try.',
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
    answerHidden: 'Відповідь зʼявиться після спроби.',
    hintAnswer: 'Підказка',
    missingExpected: 'Правильну відповідь не додано до завдання.',
  },
} as const;

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

function CompletionCelebration({ stars, copy, onExit }: { stars: number; copy: { complete: string; great: string; toMap: string }; onExit: () => void }) {
  const confetti = [
    ['⭐', -132, -120, 0.02], ['✦', -94, -164, 0.08], ['●', -42, -138, 0.14], ['✧', 36, -158, 0.04],
    ['★', 86, -124, 0.12], ['●', 132, -92, 0.18], ['✦', -116, 42, 0.2], ['⭐', 116, 34, 0.1],
  ] as const;
  return (
    <motion.div initial={{ scale: 0.92, opacity: 0, y: 18 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[2rem] border border-pink-100 bg-gradient-to-br from-white via-pink-50 to-violet-50 px-5 py-8 text-center shadow-2xl shadow-purple-100/60 dark:border-purple-500/30 dark:from-[#241331] dark:via-[#1b1028] dark:to-[#261437] dark:shadow-none sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute inset-0">
        {confetti.map(([symbol, x, y, delay], index) => (
          <motion.span
            key={`${symbol}-${index}`}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.3, rotate: 0 }}
            animate={{ opacity: [0, 1, 1, 0], x, y, scale: [0.3, 1.25, 1], rotate: index % 2 ? 26 : -22 }}
            transition={{ duration: 1.45, delay, ease: 'easeOut', repeat: Infinity, repeatDelay: 1.7 }}
            className={`absolute left-1/2 top-[42%] text-xl ${symbol === '●' ? 'text-pink-400 dark:text-fuchsia-300' : 'text-yellow-400 dark:text-yellow-300'}`}
          >
            {symbol}
          </motion.span>
        ))}
      </div>
      <motion.div
        animate={{ scale: [1, 1.05, 1], rotate: [0, -2, 2, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-yellow-100 via-pink-100 to-purple-100 text-yellow-500 shadow-2xl shadow-pink-200/70 dark:from-yellow-300/20 dark:via-pink-400/20 dark:to-purple-500/25 dark:text-yellow-300 dark:shadow-purple-950/50"
      >
        <motion.span className="absolute inset-[-18px] rounded-[2.4rem] border border-yellow-200/70 dark:border-yellow-300/25" animate={{ scale: [0.9, 1.18, 0.9], opacity: [0.2, 0.7, 0.2] }} transition={{ duration: 1.7, repeat: Infinity }} />
        <Trophy className="relative h-12 w-12" />
      </motion.div>
      <div className="relative">
        <h3 className="mb-2 font-display text-3xl font-black text-purple-800 dark:text-purple-100 sm:text-4xl">{copy.complete}</h3>
        {stars > 0
          ? <p className="font-body text-xl font-black text-yellow-600 dark:text-yellow-300">+{stars} ⭐</p>
          : <p className="font-body text-lg font-bold text-purple-500 dark:text-purple-200">{copy.great}</p>}
        <button onClick={onExit} className="mt-6 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 px-7 py-3 font-body font-900 text-white shadow-xl shadow-pink-200/60 transition hover:-translate-y-0.5 hover:shadow-2xl dark:shadow-none">{copy.toMap}</button>
      </div>
    </motion.div>
  );
}

// ==================== Utility: signed image ====================
function SignedImg({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let a = true; signedUrlFor(path).then(u => { if (a) setUrl(u); }); return () => { a = false; }; }, [path]);
  if (!url) return <div className={`bg-purple-100 animate-pulse ${className}`} />;
  return <img src={url} alt="" className={className} />;
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

function speakingModeLabel(copy: typeof taskCopy.ru, mode: SpeakingMode) {
  return {
    repeat_word: copy.repeatWord,
    read_sentence: copy.readSentence,
    name_picture: copy.namePicture,
    answer_question: copy.answerQuestion,
    describe_animal: copy.describeAnimal,
    speak_20_seconds: copy.speakTwentySeconds,
  }[mode];
}

function defaultSpeakingPrompt(copy: typeof taskCopy.ru, mode: SpeakingMode) {
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
  const showAnswer = Boolean(expectedText) && (!hidesAnswerInitially || attempted || score?.result === 'great');

  useEffect(() => () => {
    recognitionRef.current?.stop?.();
    if (timerRef.current) window.clearInterval(timerRef.current);
    micStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

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
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="overflow-hidden rounded-[2rem] border border-pink-100 bg-gradient-to-br from-white via-pink-50/70 to-sky-50 p-5 text-center shadow-xl shadow-purple-100/40 dark:border-purple-500/25 dark:from-[#251331] dark:via-[#211231] dark:to-[#102039] dark:shadow-none">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-lg shadow-pink-200/50 dark:shadow-none">
          <Mic className="h-8 w-8" />
        </div>
        <div className="mb-2 font-body text-xs font-black uppercase tracking-wider text-pink-400">{speakingModeLabel(copy, mode)}</div>
        {showMainPrompt && <h3 className="mx-auto max-w-2xl font-display text-2xl font-black leading-tight text-purple-800 dark:text-purple-100 sm:text-3xl">{visiblePrompt}</h3>}
        {image && (
          <div className="mx-auto mt-4 max-w-sm overflow-hidden rounded-3xl border border-white bg-white/80 p-2 shadow-md dark:border-purple-500/20 dark:bg-white/5">
            <SignedImg path={image} className="aspect-[4/3] w-full rounded-2xl object-cover" />
          </div>
        )}
        {showAnswer && expectedText && (
          <div className="mt-5 rounded-3xl border border-purple-100 bg-white/70 p-4 dark:border-purple-500/20 dark:bg-white/5">
            {hidesAnswerInitially && attempted && score?.result !== 'great' && (
              <div className="mb-2 font-body text-xs font-black uppercase tracking-wider text-orange-400">{copy.hintAnswer}</div>
            )}
            <HighlightedSpeechTarget target={expectedText} transcript={transcript} />
          </div>
        )}
        {!showAnswer && expectedText && (
          <div className="mt-5 rounded-3xl border border-dashed border-purple-100 bg-white/50 px-4 py-3 font-body text-sm font-black text-purple-300 dark:border-purple-500/20 dark:bg-white/5 dark:text-purple-300">{copy.answerHidden}</div>
        )}
        {!expectedText && <p className="mt-4 font-body text-sm font-bold text-purple-500 dark:text-purple-200">{copy.sayAnything}</p>}
      </section>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className={`rounded-3xl border p-4 shadow-sm transition ${resultStyles(score?.result)}`}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="font-body text-xs font-black uppercase tracking-wider opacity-70">{score ? resultLabel : recording ? copy.listeningNow : copy.heard}</span>
            {recording && <span className="rounded-full bg-white/70 px-3 py-1 font-body text-xs font-black text-purple-600 dark:bg-white/10 dark:text-purple-100">{remaining} {copy.secondsLeft}</span>}
          </div>
          <div className="min-h-7 font-display text-lg font-black">
            {transcript || hint || '...'}
          </div>
          {score?.tricky && score.result !== 'great' && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-orange-100 bg-white/70 px-3 py-2 font-body text-xs font-black text-orange-600 dark:border-orange-500/20 dark:bg-white/5 dark:text-orange-100">
              <Headphones className="h-4 w-4" /> {copy.trickyPart}: {score.tricky}
            </div>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-purple-100 bg-white/80 p-3 shadow-sm dark:border-purple-500/25 dark:bg-white/5">
          {audio && (
            <button type="button" onClick={() => {
              if (!audioUrl) return;
              const audioElement = new Audio(audioUrl);
              audioElement.volume = 1;
              audioElement.play().catch(() => undefined);
            }} disabled={!audioUrl} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-500 transition hover:-translate-y-0.5 hover:bg-pink-50 hover:text-pink-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10 dark:text-purple-100" aria-label={copy.listen}>
              <Volume2 className="h-5 w-5" />
            </button>
          )}
          <button type="button" onClick={recording ? stop : start} className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition hover:-translate-y-0.5 ${recording ? 'bg-gradient-to-br from-rose-400 to-pink-500 shadow-rose-200/50' : 'bg-gradient-to-br from-pink-400 to-purple-500 shadow-pink-200/50'}`} aria-label={recording ? copy.stopSpeaking : copy.startSpeaking}>
            {recording ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-6 w-6" />}
          </button>
          <button type="button" onClick={() => { setTranscript(''); setHint(''); setAttempted(false); setRemaining(seconds); }} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-500 transition hover:-translate-y-0.5 hover:bg-purple-100 dark:bg-white/10 dark:text-purple-100" aria-label={copy.clear}>
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex justify-center">
        <button type="button" onClick={finishSpeakingTask} disabled={!transcript.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-500 px-6 py-3 font-body text-sm font-black text-white shadow-xl shadow-pink-200/50 transition hover:-translate-y-0.5 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none">
          <CheckCircle2 className="h-5 w-5" /> {copy.check}
        </button>
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
          x1: l.right - boardRect.left - 8,
          y1: l.top + l.height / 2 - boardRect.top,
          x2: r.left - boardRect.left + 8,
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

  const Side = ({ s }: { s: any }) => s?.image
    ? <SignedImg path={s.image} className="h-16 w-16 object-cover rounded-xl shadow-sm" />
    : <span className="font-body font-800">{s?.text}</span>;

  return (
    <div className="space-y-4">
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
      <div ref={boardRef} className="relative grid gap-4 sm:grid-cols-2">
      <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="matching-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <filter id="matching-line-shadow" x="-20%" y="-80%" width="140%" height="260%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#c084fc" floodOpacity="0.35" />
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
                filter="url(#matching-line-shadow)"
                stroke="url(#matching-line)"
                strokeLinecap="round"
                strokeWidth="6"
              />
              <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} cx={line.x1} cy={line.y1} r="7" fill="#f472b6" />
              <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} cx={line.x2} cy={line.y2} r="7" fill="#a855f7" />
            </g>
          );
        })}
      </svg>
      <div className="relative z-10 space-y-2">
        <div className="text-xs font-body font-800 uppercase tracking-wider text-purple-400">A</div>
        {pairs.map((p: any, i: number) => (
          <motion.button key={i} layout disabled={matches[i] !== undefined}
            animate={wrongLeft === i ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.35 }}
            ref={el => { leftRefs.current[i] = el; }}
            onClick={() => { setSelectedLeft(i); onEvent('choice_selected', { mechanic: 'matching', side: 'left', index: i }); }}
            className={`${tileBase} w-full flex items-center justify-center gap-3 ${
              matches[i] !== undefined ? doneTile :
              wrongLeft === i ? wrongTile :
              selectedLeft === i ? selectedTile : liveTile
            }`}>
            {matches[i] !== undefined && <CheckCircle2 className="h-5 w-5 shrink-0" />}
            <Side s={p.left} />
          </motion.button>
        ))}
      </div>
      <div className="relative z-10 space-y-2">
        <div className="text-xs font-body font-800 uppercase tracking-wider text-pink-400">B</div>
        {rights.map((rightIdx: number) => (
          <motion.button key={rightIdx} layout disabled={Object.values(matches).includes(rightIdx)}
            animate={wrong === rightIdx ? { x: [0, 6, -6, 4, -4, 0] } : { x: 0 }}
            transition={{ duration: 0.35 }}
            ref={el => { rightRefs.current[rightIdx] = el; }}
            onClick={() => clickRight(rightIdx)}
            className={`${tileBase} w-full flex items-center justify-center gap-3 ${
              Object.values(matches).includes(rightIdx) ? doneTile :
              wrong === rightIdx ? wrongTile : liveTile
            }`}>
            {wrong === rightIdx && <XCircle className="h-5 w-5 shrink-0" />}
            {Object.values(matches).includes(rightIdx) && <CheckCircle2 className="h-5 w-5 shrink-0" />}
            <Side s={pairs[rightIdx]?.right} />
          </motion.button>
        ))}
      </div>
      </div>
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
          x1: l.right - boardRect.left - 8,
          y1: l.top + l.height / 2 - boardRect.top,
          x2: r.left - boardRect.left + 8,
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
    <div className="space-y-4">
      {built.length > 0 && (
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm dark:border-emerald-800 dark:bg-emerald-950">
          <div className="mb-2 flex items-center gap-2 text-xs font-body font-800 uppercase tracking-wider text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> {copy.built}
          </div>
          <div className="flex flex-wrap gap-2">
            {built.map((b, i) => (
              <span key={i} className="rounded-2xl border border-emerald-100 bg-white px-4 py-2 font-body font-800 text-emerald-700 shadow-sm dark:border-emerald-800 dark:bg-[#1d2b2d] dark:text-emerald-200">
                {asText(pairs[b.left]?.left)} + {asText(pairs[b.right]?.right)}
              </span>
            ))}
          </div>
        </div>
      )}
      <div ref={boardRef} className="relative grid sm:grid-cols-2 gap-3">
        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id="word-lego-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="55%" stopColor="#f472b6" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          {lines.map(line => {
            const mid = Math.max(32, Math.abs(line.x2 - line.x1) / 2);
            return (
              <motion.path
                key={`${line.left}-${line.right}`}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                d={`M ${line.x1} ${line.y1} C ${line.x1 + mid} ${line.y1}, ${line.x2 - mid} ${line.y2}, ${line.x2} ${line.y2}`}
                fill="none"
                stroke="url(#word-lego-line)"
                strokeLinecap="round"
                strokeWidth="5"
              />
            );
          })}
        </svg>
        <div className="relative z-10">
          <div className="mb-2 text-xs font-body font-800 uppercase tracking-wider text-purple-400">{copy.partOne}</div>
          <div className="flex flex-wrap gap-2">
            {pairs.map((p: any, i: number) => (
              <button key={i} disabled={usedLefts.has(i)} ref={el => { leftRefs.current[i] = el; }} onClick={() => { setSelectedLeft(i); onEvent('choice_selected', { mechanic: 'word_lego', side: 'left', index: i }); }}
                className={`${tileBase} ${usedLefts.has(i) ? doneTile : selectedLeft === i ? selectedTile : liveTile}`}>
                {asText(p.left)}
              </button>
            ))}
          </div>
        </div>
        <div className="relative z-10">
          <div className="mb-2 text-xs font-body font-800 uppercase tracking-wider text-pink-400">{copy.partTwo}</div>
          <div className="flex flex-wrap gap-2">
            {rights.map((idx: number) => (
              <button key={idx} ref={el => { rightRefs.current[idx] = el; }} disabled={selectedLeft === null || usedRights.has(idx)} onClick={() => clickRight(idx)}
                className={`${tileBase} ${usedRights.has(idx) ? doneTile : wrong === idx ? wrongTile : liveTile} disabled:hover:translate-y-0 disabled:hover:shadow-sm`}>
                {asText(pairs[idx]?.right)}
              </button>
            ))}
          </div>
        </div>
      </div>
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

  const check = () => {
    playButtonSound('check');
    setChecked(true);
    const ok = values.every((v, i) => v.trim().toLowerCase() === (answers[i] || '').toLowerCase());
    onEvent(ok ? 'answer_correct' : 'answer_wrong', { mechanic: 'fill_letters', values, answers });
    if (ok) setTimeout(onDone, 600);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white bg-white p-5 text-lg leading-loose text-purple-800 shadow-sm dark:border-purple-800 dark:bg-[#241632] dark:text-purple-100">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <input type="text" value={values[i] || ''}
                onChange={e => { const n = [...values]; n[i] = e.target.value; setValues(n); setChecked(false); }}
                className={`mx-1 inline-block w-24 rounded-xl border-2 px-3 py-1 text-center font-body font-800 outline-none transition ${
                  checked
                    ? (values[i]?.trim().toLowerCase() === (answers[i]||'').toLowerCase() ? doneTile : wrongTile)
                    : 'bg-yellow-50 border-yellow-200 text-amber-700 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100'
                }`} />
            )}
          </span>
        ))}
      </div>
      <button onClick={check} className="rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 px-5 py-2.5 font-body font-800 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl">{copy.check}</button>
    </div>
  );
}

// ==================== ANAGRAM ====================
function shuffleStr(s: string) {
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

  return (
    <div className="space-y-4 text-center">
      <div className={`inline-block min-w-[220px] rounded-3xl border-2 px-6 py-4 font-mono text-2xl font-black tracking-widest shadow-sm ${wrong ? wrongTile : 'bg-white border-white text-purple-700 dark:border-purple-800 dark:bg-[#241632] dark:text-purple-100'}`}>
        {built || '?'.repeat(answer.length)}
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {tiles.map((tl, i) => (
          <button key={i} onClick={() => pick(i)} disabled={tl.used}
            className={`h-12 w-12 rounded-2xl border-2 font-mono text-xl font-black transition ${tl.used ? 'border-gray-100 bg-gray-100 text-gray-300 dark:border-purple-900 dark:bg-[#1b1128] dark:text-purple-800' : 'border-white bg-gradient-to-br from-yellow-100 via-pink-100 to-purple-100 text-purple-700 shadow-md hover:-translate-y-1 hover:shadow-lg dark:border-purple-700 dark:from-purple-800 dark:via-fuchsia-800 dark:to-pink-800 dark:text-white'}`}>
            {tl.ch}
          </button>
        ))}
      </div>
      <button onClick={undo} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-body font-700 text-purple-500 shadow-sm transition hover:bg-white hover:text-purple-700 dark:bg-[#2b1a3d] dark:text-purple-200">
        <RotateCcw className="h-4 w-4" /> {copy.undoLast}
      </button>
    </div>
  );
}

// ==================== ODD ONE OUT ====================
function OddOneOutTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const items: Array<{ text?: string; image?: string; is_odd?: boolean }> = payload?.items || [];
  const [wrong, setWrong] = useState<number | null>(null);
  const [correct, setCorrect] = useState<number | null>(null);

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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => pick(i)}
          className={`min-h-28 rounded-3xl border-2 p-4 text-center font-body text-lg font-900 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
            correct === i ? doneTile : wrong === i ? wrongTile : liveTile
          }`}
        >
          {item.image && <SignedImg path={item.image} className="mx-auto mb-2 h-20 w-20 rounded-2xl object-cover" />}
          <span>{item.text || `${copy.option} ${i + 1}`}</span>
        </button>
      ))}
    </div>
  );
}

// ==================== CATEGORY SORTING ====================
function CategorySortingTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const categories: Array<{ name: string; items: Array<{ text?: string; image?: string }> }> = payload?.categories || [];
  const allItems = useMemo(() => categories.flatMap((cat, categoryIndex) =>
    (cat.items || []).map((item, itemIndex) => ({
      ...item,
      id: `${categoryIndex}-${itemIndex}`,
      categoryIndex,
    })),
  ), [categories]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Set<string>>(new Set());
  const [wrongCategory, setWrongCategory] = useState<number | null>(null);
  const selected = allItems.find(item => item.id === selectedId);

  useEffect(() => {
    if (allItems.length > 0 && placed.size === allItems.length) setTimeout(onDone, 700);
  }, [placed.size, allItems.length]);

  const chooseCategory = (categoryIndex: number) => {
    if (!selected) return;
    if (selected.categoryIndex === categoryIndex) {
      onEvent('answer_correct', { mechanic: 'category_sorting', item: selected.text, category: categories[categoryIndex]?.name });
      setPlaced(prev => new Set([...prev, selected.id]));
      setSelectedId(null);
      return;
    }
    onEvent('answer_wrong', { mechanic: 'category_sorting', item: selected.text, category: categories[categoryIndex]?.name, expected: categories[selected.categoryIndex]?.name });
    setWrongCategory(categoryIndex);
    setTimeout(() => setWrongCategory(null), 500);
  };

  if (categories.length === 0 || allItems.length === 0) {
    return <p className="text-center text-purple-500 dark:text-purple-200">{copy.addCategories}</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-xs font-body font-800 uppercase tracking-wider text-purple-400">{copy.chooseCard}</div>
        <div className="flex flex-wrap gap-2">
          {allItems.map(item => (
            <button
              key={item.id}
              disabled={placed.has(item.id)}
              onClick={() => {
                setSelectedId(item.id);
                onEvent('choice_selected', { mechanic: 'category_sorting', item: item.text });
              }}
              className={`${tileBase} ${placed.has(item.id) ? doneTile : selectedId === item.id ? selectedTile : liveTile}`}
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-body font-800 uppercase tracking-wider text-pink-400">{copy.sendToCategory}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((cat, i) => (
            <button
              key={i}
              onClick={() => chooseCategory(i)}
              disabled={!selected}
              className={`rounded-3xl border-2 p-4 text-left font-body font-900 shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60 ${
                wrongCategory === i ? wrongTile : 'border-purple-100 bg-white text-purple-700 dark:border-purple-700 dark:bg-[#2b1a3d] dark:text-purple-100'
              }`}
            >
              <div className="text-lg">{cat.name}</div>
              <div className="mt-1 text-xs text-purple-300">{placed.size}/{allItems.length}</div>
            </button>
          ))}
        </div>
      </div>
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
    <div className="mx-auto max-w-4xl space-y-5 text-center">
      <section className="rounded-3xl border border-purple-100 bg-gradient-to-br from-white to-purple-50/70 p-4 shadow-sm dark:border-purple-600/30 dark:from-[#2b1a3d] dark:to-[#241632] sm:p-5">
        <div className="mb-4 font-display text-lg font-black text-purple-700 dark:text-purple-100">{copy.key}</div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-9 lg:grid-cols-13">
          {cipherAlphabet.map(item => (
            <div key={item.letter} className="overflow-hidden rounded-xl border border-pink-100 bg-white shadow-sm dark:border-purple-500/25 dark:bg-[#321c47]">
              <div className="bg-gradient-to-r from-pink-100 to-purple-100 py-1 text-[11px] font-black text-pink-500 dark:from-pink-500/15 dark:to-purple-500/15 dark:text-pink-200">{item.number}</div>
              <div className="py-2 font-display text-lg font-black text-purple-700 dark:text-purple-100">{item.letter}</div>
            </div>
          ))}
        </div>
      </section>
      <div className="rounded-3xl border border-purple-100 bg-white p-5 shadow-sm dark:border-purple-600/30 dark:bg-[#241632]">
        <div className="mb-2 text-xs font-body font-800 uppercase tracking-wider text-pink-400">{copy.decode}</div>
        <div className="font-mono text-2xl font-black tracking-widest text-purple-800 dark:text-purple-100">{encodeCipherAnswer(answer)}</div>
      </div>
      <input
        value={value}
        onChange={e => { setValue(e.target.value); setChecked(null); }}
        onKeyDown={e => { if (e.key === 'Enter') check(); }}
        className={`input-magic w-full text-center text-lg font-900 ${checked === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : checked === 'wrong' ? 'border-rose-300 bg-rose-50 text-rose-600' : ''}`}
        placeholder={copy.placeholder}
      />
      <button onClick={check} className="rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 px-5 py-2.5 font-body font-800 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl">
        {copy.check}
      </button>
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
  const words = Array.from(new Set((payload?.words || []).map(normalizeSearchWord).filter(Boolean)));
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
    <div className="space-y-4">
      <div className="flex flex-wrap justify-center gap-2">
        {words.map(word => (
          <span key={word} className={`rounded-2xl px-3 py-1 text-sm font-body font-900 ${found.has(word) ? 'bg-emerald-100 text-emerald-700 line-through' : 'bg-purple-50 text-purple-500 dark:bg-[#2b1a3d] dark:text-purple-200'}`}>
            {word}
          </span>
        ))}
      </div>
      <div className={`mx-auto grid max-w-[min(92vw,560px)] gap-1 rounded-3xl border-2 bg-white p-3 shadow-sm dark:bg-[#241632] ${wrong ? 'border-rose-300' : 'border-purple-100 dark:border-purple-700'}`}
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
        {grid.flatMap((row, rowIndex) => row.map((letter, colIndex) => {
          const key = `${rowIndex}-${colIndex}`;
          const isSelected = selectedKeys.has(key);
          const isFound = foundCells.has(key);
          return (
            <button
              key={key}
              onClick={() => selectCell(rowIndex, colIndex)}
              className={`aspect-square rounded-xl font-mono text-sm font-black transition sm:text-base ${
                isFound ? 'bg-emerald-100 text-emerald-700' :
                isSelected ? 'bg-gradient-to-br from-pink-400 to-purple-400 text-white shadow-md' :
                'bg-purple-50 text-purple-700 hover:bg-pink-100 dark:bg-[#2b1a3d] dark:text-purple-100 dark:hover:bg-[#3a2451]'
              }`}
            >
              {letter}
            </button>
          );
        }))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="min-w-32 rounded-2xl bg-white px-4 py-2 text-center font-mono font-black text-purple-700 shadow-sm dark:bg-[#2b1a3d] dark:text-purple-100">
          {selectedWord || '...'}
        </span>
        <button onClick={check} disabled={selected.length === 0} className="rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 px-5 py-2.5 font-body font-800 text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50">
          {copy.check}
        </button>
        <button onClick={() => setSelected([])} className="rounded-2xl bg-white px-4 py-2 text-sm font-body font-800 text-purple-500 shadow-sm transition hover:bg-purple-50 dark:bg-[#2b1a3d] dark:text-purple-200">
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
            <motion.polyline
              points={polyline}
              fill="none"
              stroke="#ec4899"
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
                  current ? 'border-pink-200 bg-gradient-to-br from-pink-400 to-purple-400 text-white ring-4 ring-pink-100' :
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
function TrueFalseTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const statements: Array<{ text: string; is_true: boolean }> = (payload?.statements || []).filter((item: any) => String(item?.text || '').trim());
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [correct, setCorrect] = useState(false);
  const current = statements[index];

  const answer = (value: boolean) => {
    if (!current) return;
    onEvent('choice_selected', { mechanic: 'true_false', index, answer: value });
    if (Boolean(current.is_true) !== value) {
      setWrong(true);
      onEvent('answer_wrong', { mechanic: 'true_false', index, answer: value, expected: Boolean(current.is_true) });
      setTimeout(() => setWrong(false), 520);
      return;
    }
    setCorrect(true);
    onEvent('answer_correct', { mechanic: 'true_false', index, answer: value });
    window.setTimeout(() => {
      setCorrect(false);
      if (index + 1 >= statements.length) onDone();
      else setIndex(value => value + 1);
    }, 650);
  };

  if (statements.length === 0) {
    return <p className="text-center text-purple-500 dark:text-purple-200">{copy.addStatements}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 text-center">
      <div className="flex justify-center gap-2">
        {statements.map((_, i) => (
          <span key={i} className={`h-2 rounded-full transition-all ${i <= index ? 'w-8 bg-gradient-to-r from-pink-400 to-purple-400' : 'w-2 bg-purple-100 dark:bg-purple-800'}`} />
        ))}
      </div>
      <motion.div
        key={index}
        animate={wrong ? { x: [0, -8, 8, -5, 5, 0] } : correct ? { scale: [1, 1.03, 1] } : { x: 0, scale: 1 }}
        className={`rounded-[2rem] border-2 p-6 shadow-xl sm:p-8 ${
          correct ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100' :
          wrong ? 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100' :
          'border-purple-100 bg-white text-purple-800 dark:border-purple-700 dark:bg-[#241632] dark:text-purple-100'
        }`}
      >
        <div className="mb-3 font-body text-xs font-black uppercase tracking-wider opacity-60">#{index + 1} / {statements.length}</div>
        <div className="font-display text-2xl font-black leading-tight sm:text-3xl">{current.text}</div>
      </motion.div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button onClick={() => answer(true)} className="rounded-3xl border-2 border-emerald-100 bg-emerald-50 px-6 py-5 font-display text-xl font-black text-emerald-700 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100">
          <CheckCircle2 className="mx-auto mb-2 h-7 w-7" /> {copy.trueAnswer}
        </button>
        <button onClick={() => answer(false)} className="rounded-3xl border-2 border-rose-100 bg-rose-50 px-6 py-5 font-display text-xl font-black text-rose-600 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-100">
          <XCircle className="mx-auto mb-2 h-7 w-7" /> {copy.falseAnswer}
        </button>
      </div>
    </div>
  );
}

// ==================== MINI-SHOP ====================
function MiniShopTask({ payload, onDone, onEvent, lang }: { payload: any; onDone: () => void; onEvent: TaskTelemetry; lang: Lang }) {
  const copy = taskCopy[lang] || taskCopy.ru;
  const items: Array<{ name: string; price: number; image?: string }> = (payload?.items || []).filter((item: any) => String(item?.name || '').trim());
  const target = Math.max(0, Number(payload?.target_total) || 0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [completed, setCompleted] = useState(false);
  const total = items.reduce((sum, item, index) => selected.has(index) ? sum + (Number(item.price) || 0) : sum, 0);
  const over = target > 0 && total > target;

  useEffect(() => {
    if (!completed && target > 0 && total === target) {
      setCompleted(true);
      onEvent('answer_correct', { mechanic: 'mini_shop', total, target, items: Array.from(selected) });
      setTimeout(onDone, 850);
    }
  }, [completed, target, total, selected]);

  const toggle = (index: number) => {
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      const nextTotal = items.reduce((sum, item, itemIndex) => next.has(itemIndex) ? sum + (Number(item.price) || 0) : sum, 0);
      onEvent('choice_selected', { mechanic: 'mini_shop', index, total: nextTotal, target });
      if (target > 0 && nextTotal > target) onEvent('answer_wrong', { mechanic: 'mini_shop', total: nextTotal, target });
      return next;
    });
  };

  if (items.length === 0 || target <= 0) {
    return <p className="text-center text-purple-500 dark:text-purple-200">{copy.addShopItems}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="mx-auto grid max-w-xl grid-cols-2 gap-3">
        <div className="rounded-3xl border border-pink-100 bg-pink-50 p-4 text-center shadow-sm dark:border-pink-500/20 dark:bg-pink-500/10">
          <div className="font-body text-xs font-black uppercase tracking-wider text-pink-400">{copy.shopTarget}</div>
          <div className="font-display text-3xl font-black text-pink-600 dark:text-pink-100">{target}</div>
        </div>
        <div className={`rounded-3xl border p-4 text-center shadow-sm ${completed ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100' : over ? 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-100' : 'border-purple-100 bg-white text-purple-700 dark:border-purple-700 dark:bg-[#241632] dark:text-purple-100'}`}>
          <div className="font-body text-xs font-black uppercase tracking-wider opacity-65">{over ? copy.shopOver : copy.shopTotal}</div>
          <div className="font-display text-3xl font-black">{total}</div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => {
          const active = selected.has(index);
          return (
            <button
              key={index}
              onClick={() => toggle(index)}
              className={`min-h-36 rounded-[2rem] border-2 p-4 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
                active ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100' : liveTile
              }`}
            >
              {item.image ? <SignedImg path={item.image} className="mx-auto mb-3 h-20 w-24 rounded-2xl object-cover" /> : <div className="mx-auto mb-3 flex h-20 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-100 via-pink-100 to-purple-100 text-3xl">🛍️</div>}
              <div className="font-display text-lg font-black">{item.name}</div>
              <div className="mt-1 font-body text-sm font-black opacity-70">{Number(item.price) || 0}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==================== ROOM ====================
export default function InteractiveLessonRoom({
  lesson, userId, onExit, onCompleted, lang = 'ru',
}: {
  lesson: Lesson;
  userId: string;
  lang?: Lang;
  onExit: () => void;
  onCompleted: (starsAwarded: number) => void;
}) {
  const copy = roomCopy[lang] || roomCopy.ru;
  const [tasks, setTasks] = useState<InteractiveTask[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState<null | number>(null); // stars awarded
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [teacherHint, setTeacherHint] = useState<string | null>(null);
  const lastTeacherHintId = useRef<string | null>(null);
  const finishedRef = useRef<null | number>(null);
  const theoryTask = useMemo(() => tasks.find(task => task.mechanic_type === 'theory_content'), [tasks]);
  const playableTasks = useMemo(() => tasks.filter(task => !['theory_content', 'connect_dots', 'spot_and_count'].includes(task.mechanic_type)), [tasks]);
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
    window.setTimeout(() => setTeacherHint(current => current === message ? null : current), 9000);
  };

  useEffect(() => {
    listTasks(lesson.id).then(t => { setTasks(t); setLoading(false); });
  }, [lesson.id, userId]);

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

  const emitTaskEvent: TaskTelemetry = (eventType, payload = {}) => {
    if (eventType === 'answer_correct') playFeedbackSound('correct');
    if (eventType === 'answer_wrong') playFeedbackSound('wrong');
    const curTask = displayedTasks[idx];
    recordLiveEvent({
      sessionId: liveSession?.id ?? null,
      lessonId: lesson.id,
      studentId: userId,
      eventType,
      taskId: curTask?.id ?? null,
      payload,
    });
  };

  const finish = async () => {
    playCompletionSound();
    const stars = await markLessonComplete(userId, lesson);
    finishedRef.current = stars;
    if (liveSession) {
      await recordLiveEvent({
        sessionId: liveSession.id,
        lessonId: lesson.id,
        studentId: userId,
        eventType: 'lesson_completed',
        payload: { stars },
      });
      await completeLiveSession(liveSession.id);
    }
    setFinished(stars);
    onCompleted(stars);
  };
  const nextTask = () => {
    if (idx + 1 >= displayedTasks.length) finish();
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

  const room = (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-pink-50 via-violet-50 to-sky-50 dark:bg-[#150923] dark:bg-none">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
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
        <div className="flex flex-1 items-start justify-center pt-6 sm:pt-10">
          <div className="w-full rounded-[2rem] border border-white bg-gradient-to-br from-white via-white to-pink-50 p-4 shadow-2xl shadow-purple-100/60 sm:p-6 lg:p-8 dark:border-purple-800 dark:bg-[#211331] dark:bg-none dark:shadow-none">
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
          <div className="mb-6 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-2xl border border-purple-100 bg-white px-4 py-2 text-xs font-body font-800 uppercase tracking-wider text-purple-400 shadow-sm dark:border-purple-700 dark:bg-[#2b1a3d] dark:text-purple-200">
              <Sparkles className="h-4 w-4 text-pink-400" /> Vetoschool quest
            </div>
            {lesson.type !== 'theory' && <h2 className="font-display text-3xl font-black text-purple-800 sm:text-4xl dark:text-purple-100">{lesson.title}</h2>}
          </div>

          {loading && <p className="text-center text-purple-500 dark:text-purple-200">{copy.loading}</p>}
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
              <div className="flex justify-center border-t border-purple-100 pt-6 dark:border-purple-700">
                <button onClick={() => { playButtonSound('study'); finish(); }} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-500 px-6 py-3 font-display text-sm font-black text-white shadow-xl shadow-pink-200/50 transition hover:-translate-y-0.5 hover:shadow-2xl dark:shadow-none">
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
                      {mechanicCopy[lang][cur.mechanic_type]?.title}
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
            <CompletionCelebration stars={finished} copy={copy} onExit={exitLesson} />
          )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? room : createPortal(room, document.body);
}
