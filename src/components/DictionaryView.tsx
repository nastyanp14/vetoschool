import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Grid2X2, List, RefreshCw, Search, Volume2 } from 'lucide-react';
import { Lang, t } from '../lib/i18n';
import { DictWord, loadDictionary } from '../lib/dictionary';
import { currentWeekDayKeys, dictionaryStreak, localDayKey } from '../lib/dictionaryStreak';
import { playDictionaryWordAudio } from '../lib/dictionaryAudio';
import { WorkbookAssetImage } from './WorkbookAssetImage';
import DailyReview from './DailyReview';
import { DictionaryReviewProgress, legacyProgress, loadReviewProgress, startDictionaryWordLearning } from '../lib/dailyReview';

type Status = 'all' | 'studying' | 'learned';
type WordStage = 'new' | 'studying' | 'reinforcing' | 'learned';
type Layout = 'grid' | 'list';

const WEEKDAY_LABELS = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  ua: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
} as const;

const ASSET = {
  hero: '/dashboard/dictionary-hero-candidate-03.png',
  heroDark: '/dashboard/dictionary-hero-dark.png',
  daily: '/dashboard/dictionary-daily-review.png',
  dailyDark: '/dashboard/dictionary-daily-review-dark.png',
  studying: '/dashboard/dictionary-studying.png',
  all: '/dashboard/dictionary-all-words.png',
  book: '/dashboard/dictionary-my-book.png',
  fire: '/dashboard/dictionary-streak-fire.png',
  learned: '/dashboard/checkpoint-completed-check.png',
  studyingCheck: '/dashboard/dictionary-studying-check.png',
  reviewLightning: '/dashboard/dictionary-review-lightning.png',
};

const CATEGORY_ICONS = ['🐘', '🍎', '✏️', '🌈', '👨‍👩‍👧', '🏠', '👕', '🍀'];
function categoryStyle(_category: string) {
  return 'bg-purple-50/90 text-purple-700 ring-purple-100 dark:bg-purple-500/15 dark:text-purple-100 dark:ring-purple-400/20';
}

const WORD_DETAILS: Record<string, { transcription: string; example: string; ru: string; ua: string }> = {
  elephant: { transcription: '/ˈel.ɪ.fənt/', example: 'An elephant is a very big animal.', ru: 'Слон — очень большое животное.', ua: 'Слон — дуже велика тварина.' },
  lion: { transcription: '/ˈlaɪ.ən/', example: 'The lion is a strong animal.', ru: 'Лев — сильное животное.', ua: 'Лев — сильна тварина.' },
  apple: { transcription: '/ˈæp.əl/', example: 'I eat an apple every day.', ru: 'Я ем яблоко каждый день.', ua: 'Я їм яблуко щодня.' },
  banana: { transcription: '/bəˈnɑː.nə/', example: 'The banana is yellow.', ru: 'Банан жёлтый.', ua: 'Банан жовтий.' },
  schoolbag: { transcription: '/ˈskuːl.bæɡ/', example: 'My schoolbag is purple.', ru: 'Мой школьный рюкзак фиолетовый.', ua: 'Мій шкільний рюкзак фіолетовий.' },
  pencil: { transcription: '/ˈpen.səl/', example: 'I write with a pencil.', ru: 'Я пишу карандашом.', ua: 'Я пишу олівцем.' },
  globe: { transcription: '/ɡləʊb/', example: 'The globe shows our world.', ru: 'Глобус показывает наш мир.', ua: 'Глобус показує наш світ.' },
  book: { transcription: '/bʊk/', example: 'This book is interesting.', ru: 'Эта книга интересная.', ua: 'Ця книга цікава.' },
  dog: { transcription: '/dɒɡ/', example: 'My dog is very friendly.', ru: 'Моя собака очень дружелюбная.', ua: 'Мій собака дуже дружній.' },
  cat: { transcription: '/kæt/', example: 'The cat is sleeping.', ru: 'Кошка спит.', ua: 'Кіт спить.' },
};

const copy = {
  ru: {
    title: 'Мой словарик', subtitle: 'Учи новые слова, слушай произношение и запоминай легко!', search: 'Найти слово…',
    allWords: 'Все слова', studying: 'Изучаю', learned: 'Выучено',
    progress: 'Мой прогресс', newWords: 'Новые', reinforcing: 'Закрепляю',
    categories: 'Категории', cards: 'Карточки слов', list: 'Список слов', newCategory: 'Новая категория', daily: 'Ежедневное повторение',
    dailyText: 'Повторяй слова каждый день и закрепляй знания!', start: 'Начать повторение', streak: 'Серия дней',
    daysStraight: 'дней подряд', encouragement: 'Ты отлично справляешься!', empty: 'Слова появятся, когда преподаватель добавит их',
    noResults: 'По вашему запросу ничего не найдено', markLearned: 'Отметить как выученное', markStudying: 'Вернуть в изучаемые',
  },
  en: {
    title: 'My Dictionary', subtitle: 'Learn new words, listen to pronunciation and remember with ease!', search: 'Find a word…',
    allWords: 'All words', studying: 'Studying', learned: 'Learned',
    progress: 'My progress', newWords: 'New', reinforcing: 'Reinforcing',
    categories: 'Categories', cards: 'Word cards', list: 'Word list', newCategory: 'New category', daily: 'Daily review',
    dailyText: 'Review words every day and strengthen your knowledge!', start: 'Start review', streak: 'Day streak',
    daysStraight: 'days in a row', encouragement: 'You are doing great!', empty: 'Words will appear once your teacher adds them',
    noResults: 'No words match your search', markLearned: 'Mark as learned', markStudying: 'Return to studying',
  },
  ua: {
    title: 'Мій словничок', subtitle: 'Вивчай нові слова, слухай вимову та запамʼятовуй легко!', search: 'Знайти слово…',
    allWords: 'Усі слова', studying: 'Вивчаю', learned: 'Вивчено',
    progress: 'Мій прогрес', newWords: 'Нові', reinforcing: 'Закріплюю',
    categories: 'Категорії', cards: 'Картки слів', list: 'Список слів', newCategory: 'Нова категорія', daily: 'Щоденне повторення',
    dailyText: 'Повторюй слова щодня та закріплюй знання!', start: 'Почати повторення', streak: 'Серія днів',
    daysStraight: 'днів поспіль', encouragement: 'Ти чудово справляєшся!', empty: 'Слова зʼявляться, коли викладач їх додасть',
    noResults: 'За вашим запитом нічого не знайдено', markLearned: 'Позначити як вивчене', markStudying: 'Повернути до вивчення',
  },
} as const;

function detailFor(word: DictWord, lang: Lang) {
  const known = WORD_DETAILS[word.word.trim().toLocaleLowerCase()];
  if (known) return { transcription: known.transcription, example: known.example, translated: lang === 'ua' ? known.ua : lang === 'en' ? known.example : known.ru };
  const example = `I am learning the word ${word.word}.`;
  return { transcription: '', example, translated: lang === 'ua' ? `Я вивчаю слово «${word.translation}».` : lang === 'en' ? example : `Я учу слово «${word.translation}».` };
}

function HighlightedExample({ sentence, word }: { sentence: string; word: string }) {
  const index = sentence.toLocaleLowerCase().indexOf(word.toLocaleLowerCase());
  if (index < 0) return <>{sentence}</>;
  return <>{sentence.slice(0, index)}<strong className="font-black text-purple-700 dark:text-fuchsia-200">{sentence.slice(index, index + word.length)}</strong>{sentence.slice(index + word.length)}</>;
}

function getWordStage(wordId: string, studiedIds: Set<string>, learnedIds: Set<string>, progressRows: DictionaryReviewProgress[]): WordStage {
  const progress = progressRows.find(row => row.wordId === wordId);
  if (progress && progress.mastery >= 100) return 'learned';
  if (progress?.lastReviewedAt) return 'reinforcing';
  if (studiedIds.has(wordId) || learnedIds.has(wordId) || progress) return 'studying';
  return 'new';
}

const STAGE_LABELS = {
  ru: { new: 'Новое', studying: 'Изучаю', reinforcing: 'Закрепляю', learned: 'Выучено' },
  en: { new: 'New', studying: 'Studying', reinforcing: 'Reinforcing', learned: 'Learned' },
  ua: { new: 'Нове', studying: 'Вивчаю', reinforcing: 'Закріплюю', learned: 'Вивчено' },
} as const;
const STAGE_STYLES: Record<WordStage, { pill: string; dot: string }> = {
  new: { pill: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200', dot: 'bg-blue-400' },
  studying: { pill: 'bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-200', dot: 'bg-pink-500' },
  reinforcing: { pill: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200', dot: 'bg-amber-400' },
  learned: { pill: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-200', dot: 'bg-green-500' },
};

function WordVisual({ word }: { word: DictWord }) {
  return <div className="mx-auto flex h-32 w-full items-center justify-center text-8xl">{word.imageUrl
    ? <WorkbookAssetImage path={word.imageUrl} className="h-full w-full scale-[1.08] object-contain" surface="DictionaryView.WordVisual" fallback={word.emoji} />
    : word.emoji}</div>;
}

function WordCard({ word, lang, stage, onStudyActivity }: { word: DictWord; lang: Lang; stage: WordStage; onStudyActivity: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const [playing, setPlaying] = useState(false);
  const detail = detailFor(word, lang);
  const face = '!items-stretch !justify-start !overflow-hidden !rounded-[1.4rem] !border-purple-100 !bg-white/65 !p-4 shadow-[0_10px_25px_rgba(103,74,143,0.12)] dark:!border-purple-400/20 dark:!bg-[#17102a]/95 dark:shadow-[0_12px_30px_rgba(0,0,0,0.24)]';
  const categoryName = word.category || t(lang, 'dict_no_category');
  return <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`flip-card h-[19rem] min-w-0 cursor-pointer ${flipped ? 'flipped' : ''}`} onClick={() => { onStudyActivity(); setFlipped(value => !value); }} data-testid="dictionary-word-card">
      <div className="flip-card-inner">
      <div className={`flip-card-face ${face}`}>
        <button type="button" aria-label={`Play ${word.word}`} aria-pressed={playing} data-audio-playing={playing ? 'true' : 'false'} onClick={event => { event.stopPropagation(); onStudyActivity(); void playDictionaryWordAudio(word, setPlaying); }} className={`absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition ${playing ? 'scale-105 bg-purple-600 text-white' : 'bg-white text-purple-600 hover:scale-105 hover:bg-purple-50 dark:bg-purple-300/15 dark:text-purple-100 dark:hover:bg-purple-300/25'}`}><Volume2 className="h-5 w-5" /></button>
        <div className="mt-6 flex flex-1 -translate-y-6 flex-col items-center justify-center text-center"><WordVisual word={word} /><h3 className="mt-1 line-clamp-1 w-full text-center font-display text-[1.35rem] font-black text-purple-700 dark:text-purple-100">{word.word}</h3></div>
        <div className="flex items-center justify-between gap-2"><span className={`inline-flex min-h-8 max-w-[58%] items-center rounded-full px-3 py-1 text-center font-display text-[11px] font-bold leading-tight ring-1 ${categoryStyle(categoryName)}`}>{categoryName}</span><span role="status" aria-label={STAGE_LABELS[lang][stage]} data-word-status={stage} className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-[11px] font-bold leading-none ${STAGE_STYLES[stage].pill}`}><span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${STAGE_STYLES[stage].dot}`} /><span className="whitespace-nowrap">{STAGE_LABELS[lang][stage]}</span></span></div>
      </div>
      <div className={`flip-card-face flip-card-back ${face}`}>
        <RefreshCw className="absolute right-4 top-4 h-4 w-4 text-purple-400" />
        <div className="flex h-full flex-col items-center justify-center px-1 text-center"><p className="font-display text-2xl font-black text-purple-700 dark:text-purple-100">{word.translation}</p>{detail.transcription && <p className="mt-1 font-body text-xs font-700 text-purple-400">{detail.transcription}</p>}<div className="relative my-4 w-full border-t border-dashed border-purple-200"><RefreshCw className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 bg-[#fff9fb] px-0.5 text-purple-400 dark:bg-[#27193d]" /></div><p className="font-body text-[13px] font-700 leading-[1.4] text-slate-600 dark:text-purple-100"><HighlightedExample sentence={detail.example} word={word.word} /></p><p className="mt-3 font-body text-xs font-600 leading-[1.4] text-slate-500 dark:text-purple-200">{detail.translated}</p></div>
      </div>
    </div>
  </motion.article>;
}

function WordListItem({ word, lang, stage, onStudyActivity }: { word: DictWord; lang: Lang; stage: WordStage; onStudyActivity: () => void }) {
  const [playing, setPlaying] = useState(false);
  const detail = detailFor(word, lang);
  const categoryName = word.category || t(lang, 'dict_no_category');
  return <motion.article
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    data-testid="dictionary-word-list-item"
    className="flex min-w-0 items-center gap-4 rounded-[1.35rem] border border-pink-100/90 bg-white/75 p-3 shadow-[0_8px_22px_rgba(103,74,143,0.1)] dark:border-purple-400/20 dark:bg-[#17102a]/95 dark:shadow-[0_12px_30px_rgba(0,0,0,0.24)]"
  >
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-pink-50 to-purple-50 text-4xl dark:from-purple-900/40 dark:to-fuchsia-900/30">
      {word.imageUrl
        ? <WorkbookAssetImage path={word.imageUrl} className="h-full w-full object-contain" surface="DictionaryView.WordListItem" fallback={word.emoji} />
        : word.emoji}
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-baseline gap-2"><h3 className="truncate font-display text-xl font-black text-purple-700 dark:text-purple-100">{word.word}</h3>{detail.transcription && <span className="truncate font-display text-xs font-semibold text-slate-400">{detail.transcription}</span>}</div>
      <p className="truncate font-display text-sm font-bold text-slate-500 dark:text-purple-200">{word.translation}</p>
      <span className={`mt-1 inline-flex max-w-full rounded-full px-2.5 py-1 font-display text-[10px] font-bold leading-tight ring-1 ${categoryStyle(categoryName)}`}>{categoryName}</span>
    </div>
    <button type="button" aria-label={`Play ${word.word}`} aria-pressed={playing} data-audio-playing={playing ? 'true' : 'false'} onClick={() => { onStudyActivity(); void playDictionaryWordAudio(word, setPlaying); }} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-md transition ${playing ? 'scale-105 bg-purple-600 text-white' : 'bg-white text-purple-600 hover:scale-105 hover:bg-purple-50 dark:bg-white/10'}`}><Volume2 className="h-5 w-5" /></button>
    <span role="status" aria-label={STAGE_LABELS[lang][stage]} data-word-status={stage} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3 py-2 font-display text-xs font-bold leading-none ${STAGE_STYLES[stage].pill}`}>
      <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${STAGE_STYLES[stage].dot}`} />
      <span className="hidden sm:inline">{STAGE_LABELS[lang][stage]}</span>
    </span>
  </motion.article>;
}

function Stat({ image, value, label, accent }: { image: string; value: number; label: string; accent: string }) {
  return <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3"><img src={image} alt="" aria-hidden="true" className="h-12 w-12 shrink-0 object-contain" /><div><div className={`font-display text-2xl font-black ${accent}`}>{value}</div><div className="whitespace-nowrap font-body text-xs font-700 text-slate-500">{label}</div></div></div>;
}

function ProgressPanel({ words, studiedIds, learnedIds, progressRows, lang }: { words: DictWord[]; studiedIds: Set<string>; learnedIds: Set<string>; progressRows: DictionaryReviewProgress[]; lang: Lang }) {
  const ui = copy[lang];
  const counts = {
    fresh: words.filter(word => getWordStage(word.id, studiedIds, learnedIds, progressRows) === 'new').length,
    studying: words.filter(word => getWordStage(word.id, studiedIds, learnedIds, progressRows) === 'studying').length,
    reinforcing: words.filter(word => getWordStage(word.id, studiedIds, learnedIds, progressRows) === 'reinforcing').length,
    learned: words.filter(word => getWordStage(word.id, studiedIds, learnedIds, progressRows) === 'learned').length,
  };
  const percent = words.length ? Math.round((counts.learned / words.length) * 100) : 0;
  const rows = [
    { label: ui.newWords, value: counts.fresh, color: 'bg-blue-400', text: 'text-blue-600 dark:text-blue-300' },
    { label: ui.studying, value: counts.studying, color: 'bg-pink-400', text: 'text-pink-600 dark:text-pink-300' },
    { label: ui.reinforcing, value: counts.reinforcing, color: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-300' },
    { label: ui.learned, value: counts.learned, color: 'bg-green-400', text: 'text-green-600 dark:text-green-300' },
  ];
  const segments = [counts.fresh, counts.studying, counts.reinforcing, counts.learned];
  const colors = ['#60a5fa', '#f472b6', '#fbbf24', '#4ade80'];
  let offset = 0;
  const gradient = words.length ? segments.map((count, index) => {
    const start = offset / words.length * 100;
    offset += count;
    return `${colors[index]} ${start}% ${offset / words.length * 100}%`;
  }).join(', ') : '#e9d5ff 0% 100%';
  return <section aria-label={ui.progress} className="flex min-h-[17.5rem] flex-col justify-center rounded-[1.75rem] border border-white/80 bg-gradient-to-br from-white/95 via-purple-50/90 to-pink-50/90 p-5 shadow-[0_18px_40px_rgba(126,34,206,0.12)] dark:border-purple-300/15 dark:from-[#20132f] dark:via-[#191128] dark:to-[#24132b] dark:shadow-none sm:p-6">
    <h2 className="flex items-center gap-2 font-display text-xl font-black text-purple-700 dark:text-purple-100"><svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 shrink-0 text-violet-600 dark:text-violet-300"><rect x="2" y="18" width="7" height="12" rx="2.5" fill="currentColor" /><rect x="12.5" y="10" width="7" height="20" rx="2.5" fill="currentColor" /><rect x="23" y="2" width="7" height="28" rx="2.5" fill="currentColor" /></svg>{ui.progress}</h2>
    <div className="mt-4 flex flex-1 items-center justify-center gap-2 sm:gap-3">
      <div className="relative h-28 w-28 shrink-0 rounded-full p-3 sm:h-32 sm:w-32" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label={`${percent}% ${ui.progress}`}>
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white/95 text-center dark:bg-[#1c122b]">
          <span className="font-display text-3xl font-black text-purple-700 dark:text-purple-100">{percent}%</span>
          <span className="mt-0.5 font-body text-xs font-bold text-slate-500 dark:text-purple-200">{words.length} {lang === 'en' ? 'words' : lang === 'ua' ? 'слів' : 'слов'}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-3">
        {rows.map(row => <li key={row.label} className="flex items-center gap-2 text-sm"><span className={`h-3 w-3 shrink-0 rounded-full ${row.color}`} /><span className="min-w-0 flex-1 truncate font-body font-semibold text-slate-600 dark:text-purple-100">{row.label}</span><span className={`font-display font-black ${row.text}`}>{row.value}</span></li>)}
      </ul>
    </div>
  </section>;
}

export default function DictionaryView({ userId, lang, previewWords, previewDailyReview = false }: { userId: string; lang: Lang; previewWords?: DictWord[]; previewDailyReview?: boolean }) {
  const [words, setWords] = useState<DictWord[]>(previewWords || []);
  const [loading, setLoading] = useState(!previewWords);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [layout, setLayout] = useState<Layout>('grid');
  const [learnedIds, setLearnedIds] = useState<Set<string>>(() => new Set(previewDailyReview ? (previewWords || []).map(word => word.id) : []));
  const [studiedIds, setStudiedIds] = useState<Set<string>>(() => new Set());
  const [reviewProgress, setReviewProgress] = useState<DictionaryReviewProgress[]>([]);
  const [studyDays, setStudyDays] = useState<Set<string>>(() => new Set());
  const [reviewOpen, setReviewOpen] = useState(previewDailyReview);
  const ui = copy[lang];

  useEffect(() => {
    if (previewWords) { setWords(previewWords); setLoading(false); return; }
    setLoading(true); loadDictionary(userId).then(result => { setWords(result); setLoading(false); });
  }, [userId, previewWords]);
  useEffect(() => {
    let localLearned = new Set<string>();
    try {
      localLearned = previewDailyReview
        ? new Set((previewWords || []).map(word => word.id))
        : new Set(JSON.parse(localStorage.getItem(`dictionary-learned:${userId}`) || '[]'));
      setLearnedIds(localLearned);
    } catch { setLearnedIds(new Set()); }
    try {
      setStudyDays(new Set(JSON.parse(localStorage.getItem(`dictionary-study-days:${userId}`) || '[]')));
    } catch { setStudyDays(new Set()); }
    try {
      setStudiedIds(new Set(JSON.parse(localStorage.getItem(`dictionary-studied:${userId}`) || '[]')));
    } catch { setStudiedIds(new Set()); }
    void loadReviewProgress(userId, [...localLearned], Boolean(previewWords)).then(progress => {
      setReviewProgress(progress.rows);
      const merged = new Set([...localLearned, ...progress.rows.map(row => row.wordId)]);
      setLearnedIds(merged);
      localStorage.setItem(`dictionary-learned:${userId}`, JSON.stringify([...merged]));
    });
  }, [previewDailyReview, previewWords, userId]);
  useEffect(() => {
    if (reviewOpen) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [reviewOpen]);

  const recordStudyActivity = (wordId?: string) => {
    const today = localDayKey(new Date());
    if (!studyDays.has(today)) {
      const next = new Set(studyDays);
      next.add(today);
      const recentDays = [...next].sort().slice(-400);
      setStudyDays(new Set(recentDays));
      localStorage.setItem(`dictionary-study-days:${userId}`, JSON.stringify(recentDays));
    }
    if (wordId && !studiedIds.has(wordId)) {
      const nextStudied = new Set(studiedIds);
      nextStudied.add(wordId);
      setStudiedIds(nextStudied);
      localStorage.setItem(`dictionary-studied:${userId}`, JSON.stringify([...nextStudied]));
    }
    if (wordId && !learnedIds.has(wordId)) {
      const nextEligible = new Set(learnedIds);
      nextEligible.add(wordId);
      setLearnedIds(nextEligible);
      localStorage.setItem(`dictionary-learned:${userId}`, JSON.stringify([...nextEligible]));
      const initialProgress = legacyProgress(wordId);
      setReviewProgress(current => current.some(row => row.wordId === wordId) ? current : [...current, initialProgress]);
      void startDictionaryWordLearning(userId, wordId, Boolean(previewWords));
    }
  };
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    words.forEach(word => { const name = word.category?.trim() || t(lang, 'dict_no_category'); counts.set(name, (counts.get(name) || 0) + 1); });
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [words, lang]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return words.filter(word => {
      const stage = getWordStage(word.id, studiedIds, learnedIds, reviewProgress);
      const matchesCategory = !category || (word.category?.trim() || t(lang, 'dict_no_category')) === category;
      return matchesCategory
        && (status === 'all' || (status === 'learned' ? stage === 'learned' : stage !== 'learned'))
        && (!needle || `${word.word} ${word.translation} ${word.category}`.toLocaleLowerCase().includes(needle));
    });
  }, [words, learnedIds, studiedIds, reviewProgress, category, status, search, lang]);

  const learnedCount = words.filter(word => getWordStage(word.id, studiedIds, learnedIds, reviewProgress) === 'learned').length;
  const studyingCount = words.filter(word => getWordStage(word.id, studiedIds, learnedIds, reviewProgress) === 'studying').length;
  const streak = dictionaryStreak(studyDays);
  const weekDayKeys = currentWeekDayKeys();
  const startReview = () => { setReviewOpen(true); };

  if (loading) return <div className="glass rounded-[2rem] p-12 text-center text-purple-400">…</div>;

  if (reviewOpen) return <DailyReview userId={userId} lang={lang} words={words} learnedIds={learnedIds} preview={Boolean(previewWords)} onClose={() => {
    setReviewOpen(false);
    void loadReviewProgress(userId, [...learnedIds], Boolean(previewWords)).then(progress => setReviewProgress(progress.rows));
  }} />;

  return <div className="relative min-h-[calc(100dvh-5rem)] overflow-hidden rounded-[2rem] bg-[#fbf7ff] px-3 pb-5 pt-4 text-purple-950 shadow-[0_28px_80px_rgba(126,34,206,0.12)] dark:bg-[#0a0613] dark:text-purple-100 dark:shadow-none sm:px-5 lg:px-7" data-testid="dictionary-redesign">
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,240,251,0.86),rgba(240,246,255,0.94))] dark:bg-[linear-gradient(135deg,rgba(14,4,32,0.96),rgba(21,8,46,0.94)_50%,rgba(10,18,48,0.96))]" />
    <div className="relative z-10 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19.5rem] xl:grid-rows-[auto_auto_auto]">
    <section className="relative isolate min-h-[17.5rem] overflow-hidden rounded-[1.75rem] border border-white/70 shadow-xl shadow-purple-100/55 dark:border-0 dark:shadow-none xl:col-start-1 xl:row-start-1" aria-labelledby="dictionary-title">
      <img src={ASSET.hero} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-[center_46%] dark:hidden" />
      <img src={ASSET.heroDark} alt="" aria-hidden="true" className="absolute inset-0 hidden h-full w-full object-cover object-[center_46%] dark:block" />
      <div className="relative z-10 flex min-h-[17.5rem] flex-col justify-center gap-5 px-6 py-6 sm:px-9">
        <div>
          <h1 id="dictionary-title" className="font-display text-4xl font-black leading-tight text-purple-700 sm:text-5xl dark:text-white">{ui.title}</h1>
          <p className="mt-2 max-w-[28rem] font-display text-sm font-semibold leading-relaxed text-slate-600 sm:text-base dark:text-purple-100">{ui.subtitle}</p>
        </div>
        <div className="flex max-w-full flex-wrap gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-white/90 bg-white/80 px-3 py-2 shadow-sm dark:border-white/15 dark:bg-[#181027]/85 sm:px-4"><img src={ASSET.all} alt="" aria-hidden="true" className="h-8 w-8 object-contain sm:h-10 sm:w-10" /><span className="font-display text-xl font-black text-purple-700 dark:text-purple-200">{words.length}</span><span className="font-body text-xs font-bold text-slate-500 sm:text-sm dark:text-purple-100">{ui.allWords}</span></div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/90 bg-white/80 px-3 py-2 shadow-sm dark:border-white/15 dark:bg-[#181027]/85 sm:px-4"><img src={ASSET.studying} alt="" aria-hidden="true" className="h-8 w-8 object-contain sm:h-10 sm:w-10" /><span className="font-display text-xl font-black text-pink-500">{studyingCount}</span><span className="font-body text-xs font-bold text-slate-500 sm:text-sm dark:text-purple-100">{ui.studying}</span></div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/90 bg-white/80 px-3 py-2 shadow-sm dark:border-white/15 dark:bg-[#181027]/85 sm:px-4"><img src={ASSET.learned} alt="" aria-hidden="true" className="h-8 w-8 object-contain sm:h-10 sm:w-10" /><span className="font-display text-xl font-black text-green-500">{learnedCount}</span><span className="font-body text-xs font-bold text-slate-500 sm:text-sm dark:text-purple-100">{ui.learned}</span></div>
        </div>
      </div>
    </section>
    <main className="min-w-0 xl:contents">
    <section className="space-y-4 xl:col-start-1 xl:row-start-2">
        <div className="flex flex-col gap-3 rounded-[1.5rem] border border-purple-100 bg-white/70 p-3 shadow-[0_10px_30px_rgba(92,55,135,0.08)] dark:border-purple-500/20 dark:bg-white/5 sm:p-4 xl:flex-row xl:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-purple-500" />
            <input aria-label={ui.search} value={search} onChange={event => setSearch(event.target.value)} placeholder={ui.search} className="h-12 w-full rounded-xl border border-purple-100 bg-white/80 pl-12 pr-4 font-body font-bold text-purple-700 outline-none transition placeholder:text-slate-400 focus:border-purple-400 focus:ring-4 focus:ring-purple-100/70 dark:border-purple-400/20 dark:bg-white/5 dark:text-purple-100" />
          </label>
          <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
            <div aria-label={lang === 'en' ? 'Word status' : lang === 'ua' ? 'Статус слів' : 'Статус слов'} className="flex min-w-0 flex-1 rounded-xl bg-purple-50/80 p-1 dark:bg-white/5 sm:flex-none">
              {(['all', 'studying', 'learned'] as Status[]).map(item => <button key={item} type="button" aria-pressed={status === item} onClick={() => setStatus(item)} className={'flex-1 rounded-lg px-3 py-2 font-body text-xs font-extrabold transition sm:flex-none sm:px-4 sm:text-sm ' + (status === item ? 'bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-md' : 'text-slate-500 hover:text-purple-700 dark:text-purple-200')}>{item === 'all' ? (lang === 'en' ? 'All' : lang === 'ua' ? 'Усі' : 'Все') : item === 'studying' ? ui.studying : ui.learned}</button>)}
            </div>
            <div className="ml-auto flex rounded-xl bg-purple-50/80 p-1 dark:bg-white/5 sm:ml-0">
              <button type="button" aria-label={lang === 'en' ? 'Card view' : lang === 'ua' ? 'Картки' : 'Карточки'} aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')} className={'rounded-lg p-2 transition ' + (layout === 'grid' ? 'bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-md' : 'text-purple-500 hover:bg-purple-100 dark:hover:bg-white/10')}><Grid2X2 className="h-5 w-5" /></button>
              <button type="button" aria-label={lang === 'en' ? 'List view' : lang === 'ua' ? 'Список' : 'Список'} aria-pressed={layout === 'list'} onClick={() => setLayout('list')} className={'rounded-lg p-2 transition ' + (layout === 'list' ? 'bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-md' : 'text-purple-500 hover:bg-purple-100 dark:hover:bg-white/10')}><List className="h-5 w-5" /></button>
            </div>
          </div>
        </div>

    </section>

    <section className="space-y-4 xl:col-start-1 xl:row-start-3">
        <div aria-label={ui.categories} className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" aria-pressed={!category} onClick={() => setCategory('')} className={'inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 font-display text-sm font-black transition-all duration-300 ' + (!category ? 'bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-md' : 'glass text-purple-600 hover:bg-pink-50 dark:text-purple-200')}>
            <span className="text-lg">⭐</span><span>{lang === 'en' ? 'All categories' : lang === 'ua' ? 'Усі категорії' : 'Все категории'}</span><span className={'ml-1 font-display text-xs font-black ' + (!category ? 'text-white/90' : 'text-slate-400 dark:text-purple-200/70')}>{words.length}</span>
          </button>
          {categories.map(([name, count], index) => {
            const selected = category === name;
            return <button key={name} type="button" aria-pressed={selected} onClick={() => setCategory(name)} className={'inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 font-display text-sm font-black transition-all duration-300 ' + (selected ? 'bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-md' : 'glass text-purple-600 hover:bg-pink-50 dark:text-purple-200')}>
              <span className="text-lg">{CATEGORY_ICONS[index % CATEGORY_ICONS.length]}</span><span>{name}</span><span className={'ml-1 font-display text-xs font-black ' + (selected ? 'text-white/90' : 'text-slate-400 dark:text-purple-200/70')}>{count}</span>
            </button>;
          })}
        </div>

        {words.length === 0 ? <div className="glass flex min-h-[420px] flex-col items-center justify-center rounded-[2rem] text-center"><motion.img src={ASSET.book} alt="" animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }} className="h-44 w-44 object-contain" /><p className="mt-4 font-body font-bold text-purple-400">{ui.empty}</p></div> : filtered.length === 0 ? <div className="glass flex min-h-[320px] items-center justify-center rounded-[2rem] font-display text-lg font-black text-purple-400">{ui.noResults}</div> : layout === 'grid' ? <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 xl:grid-cols-4">{filtered.map(word => <WordCard key={word.id} word={word} lang={lang} stage={getWordStage(word.id, studiedIds, learnedIds, reviewProgress)} onStudyActivity={() => recordStudyActivity(word.id)} />)}</div> : <div className="grid grid-cols-1 gap-3">{filtered.map(word => <WordListItem key={word.id} word={word} lang={lang} stage={getWordStage(word.id, studiedIds, learnedIds, reviewProgress)} onStudyActivity={() => recordStudyActivity(word.id)} />)}</div>}
    </section>
    </main>

      <div className="relative aspect-[556/707] overflow-hidden rounded-[1.6rem] shadow-[0_18px_38px_rgba(116,56,195,0.28)] xl:col-start-2 xl:row-start-1 xl:row-span-2 xl:h-[23.75rem] xl:aspect-auto"><img src={ASSET.daily} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover dark:hidden" /><img src={ASSET.dailyDark} alt="" aria-hidden="true" className="absolute inset-0 hidden h-full w-full scale-[1.03] object-cover object-top dark:block" /><h2 className="absolute left-5 top-6 z-10 max-w-[125px] text-left font-display text-xl font-black leading-tight text-white">{ui.daily}</h2><div className="absolute inset-x-5 bottom-5 z-10 text-center text-white"><p className="font-body text-sm font-bold leading-relaxed text-white/95">{ui.dailyText}</p><button type="button" onClick={startReview} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 to-fuchsia-500 px-3 py-3 font-display text-sm font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl"><img src={ASSET.reviewLightning} alt="" aria-hidden="true" className="h-7 w-7 shrink-0 object-contain drop-shadow-[0_0_7px_rgba(216,180,254,0.8)]" /><span className="-translate-x-1">{ui.start}</span></button></div></div>

      <aside className="space-y-4 xl:col-start-2 xl:row-start-3">
        <ProgressPanel words={words} studiedIds={studiedIds} learnedIds={learnedIds} progressRows={reviewProgress} lang={lang} />
        <div className="relative overflow-hidden rounded-[1.6rem] border border-purple-100 bg-white/70 p-5 shadow-[0_12px_30px_rgba(92,55,135,0.1)] dark:border-purple-500/20 dark:bg-white/5"><h2 className="font-display text-lg font-black text-slate-600 dark:text-purple-100">{ui.streak}</h2><div className="mt-3 flex items-end gap-3"><img src={ASSET.fire} alt="" className="h-14 w-14 translate-y-2 object-contain" /><span className="font-display text-4xl font-black text-purple-700 dark:text-purple-100">{streak}</span><span className="pb-1 font-body text-xs font-bold text-slate-500 dark:text-purple-200">{ui.daysStraight}</span></div><div className="mt-4 grid grid-cols-7 gap-1">{WEEKDAY_LABELS[lang].map((day, index) => { const active = studyDays.has(weekDayKeys[index]); return <div key={weekDayKeys[index]} className="text-center"><span className={'mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs ' + (active ? 'bg-purple-600 text-white' : 'border border-purple-200 bg-purple-50 text-purple-200')}>{active ? '✓' : ''}</span><span className="mt-1 block font-body text-[10px] font-bold text-slate-500 dark:text-purple-200">{day}</span></div>; })}</div></div>
      </aside>
    </div>
  </div>;
}
