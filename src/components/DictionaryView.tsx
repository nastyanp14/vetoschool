import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Grid2X2, List, RefreshCw, Search, SlidersHorizontal, Volume2 } from 'lucide-react';
import { Lang, t } from '../lib/i18n';
import { DictWord, loadDictionary } from '../lib/dictionary';
import { currentWeekDayKeys, dictionaryStreak, localDayKey } from '../lib/dictionaryStreak';
import { playDictionaryWordAudio } from '../lib/dictionaryAudio';
import { WorkbookAssetImage } from './WorkbookAssetImage';
import DailyReview from './DailyReview';
import { loadReviewProgress, setDictionaryWordLearned } from '../lib/dailyReview';

type Status = 'all' | 'studying' | 'learned';
type Layout = 'grid' | 'list';

const FAVORITES_CATEGORY = '__favorites__';
const WEEKDAY_LABELS = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  ua: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
} as const;

const ASSET = {
  daily: '/dashboard/dictionary-daily-review.png',
  studying: '/dashboard/dictionary-studying.png',
  progress: '/dashboard/dictionary-progress.png',
  all: '/dashboard/dictionary-all-words.png',
  book: '/dashboard/dictionary-my-book.png',
  fire: '/dashboard/dictionary-streak-fire.png',
  owl: '/dashboard/dictionary-encouragement-owl.png',
  learned: '/dashboard/checkpoint-completed-check.png',
  studyingCheck: '/dashboard/dictionary-studying-check.png',
  favoriteHeart: '/dashboard/dictionary-favorites-heart.png',
  favoriteHeartOutline: '/dashboard/dictionary-favorite-heart-outline.png',
  reviewLightning: '/dashboard/dictionary-review-lightning.png',
};

const CATEGORY_ICONS = ['🐘', '🍎', '✏️', '🌈', '👨‍👩‍👧', '🏠', '👕', '🍀'];
function categoryStyle(_category: string) {
  return 'bg-purple-50/90 text-purple-700 ring-purple-100 dark:bg-purple-500/15 dark:text-purple-100 dark:ring-purple-400/20';
}

function sidebarCategoryStyle(_category: string, _uncategorized: string, selected: boolean) {
  if (selected) return 'scale-[1.01] bg-white text-purple-700 shadow-lg';
  return 'text-slate-600 hover:-translate-y-0.5 hover:bg-white/40 hover:text-purple-700 hover:shadow-md dark:text-purple-100';
}

function filterCategoryStyle(_category: string, _uncategorized: string, selected: boolean) {
  return selected
    ? 'bg-purple-600 text-white shadow-md'
    : 'bg-purple-50/90 text-purple-700 ring-purple-100 hover:bg-purple-100 dark:bg-purple-500/15 dark:text-purple-100 dark:ring-purple-400/20';
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
    allWords: 'Все слова', studying: 'Изучаю', learned: 'Выучено', progress: 'Твой прогресс', learnedOf: 'слов выучено',
    categories: 'Категории', cards: 'Карточки слов', list: 'Список слов', newCategory: 'Новая категория', daily: 'Ежедневное повторение',
    dailyText: 'Повторяй слова каждый день и закрепляй знания!', start: 'Начать повторение', streak: 'Серия дней',
    daysStraight: 'дней подряд', encouragement: 'Ты отлично справляешься!', empty: 'Слова появятся, когда преподаватель добавит их',
    favorites: 'Избранное', addFavorite: 'Добавить в избранное', removeFavorite: 'Убрать из избранного',
    noResults: 'По вашему запросу ничего не найдено', markLearned: 'Отметить как выученное', markStudying: 'Вернуть в изучаемые',
  },
  en: {
    title: 'My Dictionary', subtitle: 'Learn new words, listen to pronunciation and remember with ease!', search: 'Find a word…',
    allWords: 'All words', studying: 'Studying', learned: 'Learned', progress: 'Your progress', learnedOf: 'words learned',
    categories: 'Categories', cards: 'Word cards', list: 'Word list', newCategory: 'New category', daily: 'Daily review',
    dailyText: 'Review words every day and strengthen your knowledge!', start: 'Start review', streak: 'Day streak',
    daysStraight: 'days in a row', encouragement: 'You are doing great!', empty: 'Words will appear once your teacher adds them',
    favorites: 'Favorites', addFavorite: 'Add to favorites', removeFavorite: 'Remove from favorites',
    noResults: 'No words match your search', markLearned: 'Mark as learned', markStudying: 'Return to studying',
  },
  ua: {
    title: 'Мій словничок', subtitle: 'Вивчай нові слова, слухай вимову та запамʼятовуй легко!', search: 'Знайти слово…',
    allWords: 'Усі слова', studying: 'Вивчаю', learned: 'Вивчено', progress: 'Твій прогрес', learnedOf: 'слів вивчено',
    categories: 'Категорії', cards: 'Картки слів', list: 'Список слів', newCategory: 'Нова категорія', daily: 'Щоденне повторення',
    dailyText: 'Повторюй слова щодня та закріплюй знання!', start: 'Почати повторення', streak: 'Серія днів',
    daysStraight: 'днів поспіль', encouragement: 'Ти чудово справляєшся!', empty: 'Слова зʼявляться, коли викладач їх додасть',
    favorites: 'Обране', addFavorite: 'Додати до обраного', removeFavorite: 'Прибрати з обраного',
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

function WordVisual({ word }: { word: DictWord }) {
  return <div className="mx-auto flex h-40 w-full items-center justify-center text-8xl">{word.imageUrl
    ? <WorkbookAssetImage path={word.imageUrl} className="h-full w-full scale-[1.08] object-contain" surface="DictionaryView.WordVisual" fallback={word.emoji} />
    : word.emoji}</div>;
}

function WordCard({ word, lang, learned, favorite, onLearned, onFavorite, onStudyActivity }: { word: DictWord; lang: Lang; learned: boolean; favorite: boolean; onLearned: () => void; onFavorite: () => void; onStudyActivity: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const [playing, setPlaying] = useState(false);
  const ui = copy[lang];
  const detail = detailFor(word, lang);
  const face = '!items-stretch !justify-start !overflow-hidden !rounded-[1.4rem] !border-purple-100 !bg-white/65 !p-4 shadow-[0_10px_25px_rgba(103,74,143,0.12)] dark:!border-purple-500/25 dark:!bg-white/5';
  const categoryName = word.category || t(lang, 'dict_no_category');
  return <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`flip-card h-[19rem] min-w-0 cursor-pointer ${flipped ? 'flipped' : ''}`} onClick={() => { onStudyActivity(); setFlipped(value => !value); }} data-testid="dictionary-word-card">
      <div className="flip-card-inner">
      <div className={`flip-card-face ${face}`}>
        <button type="button" aria-label={favorite ? ui.removeFavorite : ui.addFavorite} aria-pressed={favorite} onClick={event => { event.stopPropagation(); onFavorite(); }} className={`absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border bg-white/90 shadow-md transition hover:scale-110 ${favorite ? 'border-pink-200' : 'border-pink-100'}`}><img src={favorite ? ASSET.favoriteHeart : ASSET.favoriteHeartOutline} alt="" aria-hidden="true" className="h-7 w-7 object-contain" /></button>
        <button type="button" aria-label={`Play ${word.word}`} aria-pressed={playing} data-audio-playing={playing ? 'true' : 'false'} onClick={event => { event.stopPropagation(); onStudyActivity(); void playDictionaryWordAudio(word, setPlaying); }} className={`absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition ${playing ? 'scale-105 bg-purple-600 text-white' : 'bg-white text-purple-600 hover:scale-105 hover:bg-purple-50'}`}><Volume2 className="h-5 w-5" /></button>
        <div className="mt-6 flex flex-1 -translate-y-8 flex-col items-center justify-center text-center"><WordVisual word={word} /><h3 className="mt-1 line-clamp-1 w-full text-center font-display text-[1.35rem] font-black text-purple-700 dark:text-purple-100">{word.word}</h3></div>
        <div className="flex items-center justify-between gap-2"><span className={`inline-flex min-h-8 max-w-[58%] items-center rounded-full px-3 py-1 text-center font-display text-[11px] font-bold leading-tight ring-1 ${categoryStyle(categoryName)}`}>{categoryName}</span><button type="button" title={learned ? ui.markStudying : ui.markLearned} onClick={event => { event.stopPropagation(); onLearned(); }} className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-[11px] font-bold leading-none transition hover:scale-105 ${learned ? 'bg-green-100 text-green-600' : 'bg-orange-50 text-orange-600'}`}>{learned ? <img src={ASSET.learned} alt="" aria-hidden="true" className="h-5 w-5 object-contain" /> : <img src={ASSET.studyingCheck} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />}<span className="whitespace-nowrap">{learned ? ui.learned : ui.studying}</span></button></div>
      </div>
      <div className={`flip-card-face flip-card-back ${face}`}>
        <RefreshCw className="absolute right-4 top-4 h-4 w-4 text-purple-400" />
        <div className="flex h-full flex-col items-center justify-center px-1 text-center"><p className="font-display text-2xl font-black text-purple-700 dark:text-purple-100">{word.translation}</p>{detail.transcription && <p className="mt-1 font-body text-xs font-700 text-purple-400">{detail.transcription}</p>}<div className="relative my-4 w-full border-t border-dashed border-purple-200"><RefreshCw className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 bg-[#fff9fb] px-0.5 text-purple-400 dark:bg-[#27193d]" /></div><p className="font-body text-[13px] font-700 leading-[1.4] text-slate-600 dark:text-purple-100"><HighlightedExample sentence={detail.example} word={word.word} /></p><p className="mt-3 font-body text-xs font-600 leading-[1.4] text-slate-500 dark:text-purple-200">{detail.translated}</p></div>
      </div>
    </div>
  </motion.article>;
}

function WordListItem({ word, lang, learned, onLearned, onStudyActivity }: { word: DictWord; lang: Lang; learned: boolean; onLearned: () => void; onStudyActivity: () => void }) {
  const [playing, setPlaying] = useState(false);
  const ui = copy[lang];
  const detail = detailFor(word, lang);
  const categoryName = word.category || t(lang, 'dict_no_category');
  return <motion.article
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    data-testid="dictionary-word-list-item"
    className="flex min-w-0 items-center gap-4 rounded-[1.35rem] border border-pink-100/90 bg-white/75 p-3 shadow-[0_8px_22px_rgba(103,74,143,0.1)] dark:border-purple-500/25 dark:bg-white/5"
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
    <button type="button" title={learned ? ui.markStudying : ui.markLearned} onClick={onLearned} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3 py-2 font-display text-xs font-bold leading-none transition hover:scale-105 ${learned ? 'bg-green-100 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
      {learned ? <img src={ASSET.learned} alt="" aria-hidden="true" className="h-6 w-6 object-contain" /> : <img src={ASSET.studyingCheck} alt="" aria-hidden="true" className="h-6 w-6 object-contain" />}
      <span className="hidden sm:inline">{learned ? ui.learned : ui.studying}</span>
    </button>
  </motion.article>;
}

function Stat({ image, value, label, accent }: { image: string; value: number; label: string; accent: string }) {
  return <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3"><img src={image} alt="" aria-hidden="true" className="h-12 w-12 shrink-0 object-contain" /><div><div className={`font-display text-2xl font-black ${accent}`}>{value}</div><div className="whitespace-nowrap font-body text-xs font-700 text-slate-500">{label}</div></div></div>;
}

export default function DictionaryView({ userId, lang, previewWords, previewDailyReview = false }: { userId: string; lang: Lang; previewWords?: DictWord[]; previewDailyReview?: boolean }) {
  const [words, setWords] = useState<DictWord[]>(previewWords || []);
  const [loading, setLoading] = useState(!previewWords);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [layout, setLayout] = useState<Layout>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [learnedIds, setLearnedIds] = useState<Set<string>>(() => new Set(previewDailyReview ? (previewWords || []).map(word => word.id) : []));
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
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
      setFavoriteIds(new Set(JSON.parse(localStorage.getItem(`dictionary-favorites:${userId}`) || '[]')));
    } catch { setFavoriteIds(new Set()); }
    try {
      setStudyDays(new Set(JSON.parse(localStorage.getItem(`dictionary-study-days:${userId}`) || '[]')));
    } catch { setStudyDays(new Set()); }
    void loadReviewProgress(userId, [...localLearned], Boolean(previewWords)).then(progress => {
      const merged = new Set([...localLearned, ...progress.rows.map(row => row.wordId)]);
      setLearnedIds(merged);
      localStorage.setItem(`dictionary-learned:${userId}`, JSON.stringify([...merged]));
    });
  }, [previewDailyReview, previewWords, userId]);
  useEffect(() => {
    if (reviewOpen) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [reviewOpen]);

  const recordStudyActivity = () => {
    const today = localDayKey(new Date());
    if (studyDays.has(today)) return;
    const next = new Set(studyDays);
    next.add(today);
    const recentDays = [...next].sort().slice(-400);
    setStudyDays(new Set(recentDays));
    localStorage.setItem(`dictionary-study-days:${userId}`, JSON.stringify(recentDays));
  };

  const toggleLearned = (id: string) => {
    recordStudyActivity();
    const next = new Set(learnedIds); if (next.has(id)) next.delete(id); else next.add(id);
    setLearnedIds(next); localStorage.setItem(`dictionary-learned:${userId}`, JSON.stringify([...next]));
    void setDictionaryWordLearned(userId, id, next.has(id), Boolean(previewWords));
  };
  const toggleFavorite = (id: string) => {
    const next = new Set(favoriteIds); if (next.has(id)) next.delete(id); else next.add(id);
    setFavoriteIds(next); localStorage.setItem(`dictionary-favorites:${userId}`, JSON.stringify([...next]));
  };

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    words.forEach(word => { const name = word.category?.trim() || t(lang, 'dict_no_category'); counts.set(name, (counts.get(name) || 0) + 1); });
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [words, lang]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return words.filter(word => {
      const isLearned = learnedIds.has(word.id);
      const matchesCategory = !category
        || (category === FAVORITES_CATEGORY ? favoriteIds.has(word.id) : (word.category?.trim() || t(lang, 'dict_no_category')) === category);
      return matchesCategory
        && (status === 'all' || (status === 'learned' ? isLearned : !isLearned))
        && (!needle || `${word.word} ${word.translation} ${word.category}`.toLocaleLowerCase().includes(needle));
    });
  }, [words, learnedIds, favoriteIds, category, status, search, lang]);

  const learnedCount = words.filter(word => learnedIds.has(word.id)).length;
  const studyingCount = words.length - learnedCount;
  const progress = words.length ? Math.round((learnedCount / words.length) * 100) : 0;
  const streak = dictionaryStreak(studyDays);
  const weekDayKeys = currentWeekDayKeys();
  const startReview = () => { setReviewOpen(true); };

  if (loading) return <div className="glass rounded-[2rem] p-12 text-center text-purple-400">…</div>;

  if (reviewOpen) return <DailyReview userId={userId} lang={lang} words={words} learnedIds={learnedIds} preview={Boolean(previewWords)} onClose={() => setReviewOpen(false)} />;

  return <div className="space-y-5" data-testid="dictionary-redesign">
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="relative flex min-h-[210px] items-center overflow-visible rounded-[2rem] px-4 pl-[200px]">
        <img src={ASSET.book} alt="" aria-hidden="true" className="absolute bottom-[-2px] left-[-14px] h-[205px] w-[205px] max-w-none object-contain drop-shadow-[0_18px_22px_rgba(92,45,190,0.24)]" />
        <div className="relative z-10"><h1 className="whitespace-nowrap bg-gradient-to-r from-purple-700 via-violet-600 to-fuchsia-500 bg-clip-text font-display text-[2.2rem] font-black leading-tight text-transparent drop-shadow-[0_3px_12px_rgba(147,51,234,0.14)]">{ui.title}</h1><p className="mt-3 max-w-[270px] font-display text-sm font-semibold leading-6 text-slate-500">{ui.subtitle}</p></div>
      </div>
      <div className="relative rounded-[1.6rem] border border-purple-100 bg-white/65 shadow-[0_12px_35px_rgba(90,50,130,0.08)] dark:border-purple-500/20 dark:bg-white/5 xl:-ml-1 xl:w-[calc(100%+0.25rem)]">
        <div className="flex items-center gap-3 border-b border-purple-100 p-4 dark:border-purple-500/20"><label className="relative flex-1"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-purple-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={ui.search} className="h-12 w-full rounded-xl border border-purple-100 bg-white/75 pl-12 pr-4 font-body font-700 text-purple-700 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100/70 dark:bg-white/5 dark:text-purple-100" /></label><button type="button" aria-label={lang === 'en' ? 'Filters' : lang === 'ua' ? 'Фільтри' : 'Фильтры'} aria-expanded={filtersOpen} aria-controls="dictionary-filter-panel" onClick={() => setFiltersOpen(open => !open)} className={`flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${filtersOpen || status !== 'all' || category ? 'border-purple-500 bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white' : 'border-purple-100 bg-white/80 text-purple-600'}`}><SlidersHorizontal className="h-5 w-5" /></button></div>
        {filtersOpen && <motion.div id="dictionary-filter-panel" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="absolute right-4 top-[76px] z-30 w-[min(29rem,calc(100%-2rem))] rounded-[1.4rem] border border-fuchsia-100 bg-gradient-to-br from-white via-white to-purple-50/95 p-4 shadow-[0_22px_55px_rgba(83,45,135,0.24)] backdrop-blur-xl dark:border-purple-500/30 dark:from-[#2d1b40] dark:via-[#251735] dark:to-[#20142f]">
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-display text-base font-black text-purple-700 dark:text-purple-100"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white shadow-md"><SlidersHorizontal className="h-4 w-4" /></span>{lang === 'en' ? 'Filters' : lang === 'ua' ? 'Фільтри' : 'Фильтры'}</h3><button type="button" onClick={() => { setStatus('all'); setCategory(''); }} className="rounded-full bg-pink-50 px-3 py-1.5 font-body text-xs font-800 text-pink-500 transition hover:bg-purple-50 hover:text-purple-700 dark:bg-white/5">{lang === 'en' ? 'Clear' : lang === 'ua' ? 'Очистити' : 'Сбросить'}</button></div>
          <p className="mb-2 mt-4 font-body text-[11px] font-800 uppercase tracking-wide text-slate-400">{lang === 'en' ? 'Learning status' : lang === 'ua' ? 'Статус вивчення' : 'Статус изучения'}</p>
          <div className="grid grid-cols-3 gap-2">{(['all', 'studying', 'learned'] as Status[]).map(item => <button key={item} type="button" onClick={() => setStatus(item)} className={`rounded-xl px-2 py-2 font-body text-xs font-800 transition ${status === item ? 'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow-md' : 'bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-white/5 dark:text-purple-100'}`}>{item === 'all' ? (lang === 'en' ? 'All' : lang === 'ua' ? 'Усі' : 'Все') : item === 'studying' ? ui.studying : ui.learned}</button>)}</div>
          <div className="mt-4"><span className="mb-2 block font-body text-[11px] font-800 uppercase tracking-wide text-slate-400">{ui.categories}</span><div className="grid grid-cols-2 gap-2"><button type="button" aria-pressed={!category} onClick={() => setCategory('')} className={`flex min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2.5 font-display text-xs font-bold ring-1 transition ${!category ? 'bg-purple-600 text-white ring-purple-600 shadow-md' : 'bg-purple-50 text-purple-700 ring-purple-100 hover:bg-purple-100 dark:bg-white/5 dark:text-purple-100'}`}><span className="truncate">{lang === 'en' ? 'All categories' : lang === 'ua' ? 'Усі категорії' : 'Все категории'}</span><span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-purple-700">{words.length}</span></button><button type="button" aria-pressed={category === FAVORITES_CATEGORY} onClick={() => setCategory(FAVORITES_CATEGORY)} className={`flex min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2.5 font-display text-xs font-bold ring-1 transition ${category === FAVORITES_CATEGORY ? 'bg-pink-500 text-white ring-pink-500 shadow-md' : 'bg-pink-50 text-pink-600 ring-pink-100 hover:bg-pink-100 dark:bg-white/5 dark:text-pink-100'}`}><span className="flex min-w-0 items-center gap-1.5"><img src={ASSET.favoriteHeart} alt="" aria-hidden="true" className="h-5 w-5 shrink-0 object-contain" /><span className="truncate">{ui.favorites}</span></span><span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-pink-600">{favoriteIds.size}</span></button>{categories.map(([name, count]) => <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)} className={`flex min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2.5 font-display text-xs font-bold transition ${category === name ? '' : 'ring-1'} ${filterCategoryStyle(name, t(lang, 'dict_no_category'), category === name)}`}><span className="truncate">{name}</span><span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-slate-600">{count}</span></button>)}</div></div>
        </motion.div>}
        <div className="flex divide-x divide-purple-100 dark:divide-purple-500/20"><Stat image={ASSET.all} value={words.length} label={ui.allWords} accent="text-purple-700" /><Stat image={ASSET.studying} value={studyingCount} label={ui.studying} accent="text-orange-500" /><Stat image={ASSET.learned} value={learnedCount} label={ui.learned} accent="text-green-500" /></div>
      </div>
      <div className="relative min-h-[210px] overflow-hidden rounded-[1.6rem] border border-purple-100 bg-white/65 p-5 shadow-[0_12px_35px_rgba(90,50,130,0.08)] dark:border-purple-500/20 dark:bg-white/5"><h2 className="relative z-10 translate-x-2 font-display font-black text-purple-700">{ui.progress}</h2><div className="relative z-10 mt-9 flex w-[38%] translate-x-2 items-center gap-2"><div className="h-3 min-w-8 flex-1 overflow-hidden rounded-full bg-purple-100"><div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-400" style={{ width: `${progress}%` }} /></div><span className="font-display text-2xl font-black text-purple-700">{progress}%</span></div><p className="relative z-10 mt-6 max-w-[40%] translate-x-2 font-display text-sm font-semibold text-slate-500">{learnedCount} {lang === 'en' ? 'of' : lang === 'ua' ? 'з' : 'из'} {words.length} {ui.learnedOf}</p><img src={ASSET.progress} alt="" aria-hidden="true" className="absolute bottom-[-9px] right-0 h-[225px] w-[225px] max-w-none object-contain" /></div>
    </section>

    <section className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)_260px]">
      <aside className="min-h-[600px] overflow-hidden rounded-[2rem] border border-purple-200 bg-gradient-to-b from-purple-500/85 via-purple-200/70 to-blue-100/70 shadow-[0_18px_40px_rgba(97,55,155,0.14)]">
        <h2 className="px-6 py-5 font-display text-xl font-black text-white">{ui.categories}</h2><nav className="space-y-2 px-3"><button type="button" aria-pressed={!category} onClick={() => setCategory('')} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 font-display font-bold transition duration-200 ease-out ${!category ? 'bg-white text-purple-700 shadow-lg' : 'text-slate-600 hover:-translate-y-0.5 hover:bg-white/40 hover:text-purple-700 hover:shadow-md'}`}><img src={ASSET.all} alt="" className="h-8 w-8 object-contain" /><span className="flex-1 text-left">{ui.allWords}</span><span className="rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-700">{words.length}</span></button><button type="button" aria-pressed={category === FAVORITES_CATEGORY} onClick={() => setCategory(FAVORITES_CATEGORY)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 font-display font-bold transition duration-200 ease-out ${category === FAVORITES_CATEGORY ? 'bg-white text-pink-600 shadow-lg' : 'text-slate-600 hover:-translate-y-0.5 hover:bg-white/40 hover:text-purple-700 hover:shadow-md'}`}><img src={ASSET.favoriteHeart} alt="" aria-hidden="true" className="h-9 w-9 shrink-0 object-contain drop-shadow-[0_4px_7px_rgba(236,72,153,0.2)]" /><span className="flex-1 text-left">{ui.favorites}</span><span className="rounded-full bg-pink-100 px-2 py-1 text-xs text-pink-600">{favoriteIds.size}</span></button>{categories.map(([name, count], index) => <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 font-display text-sm font-bold transition duration-200 ease-out ${sidebarCategoryStyle(name, t(lang, 'dict_no_category'), category === name)}`}><span className="text-2xl">{CATEGORY_ICONS[index % CATEGORY_ICONS.length]}</span><span className="min-w-0 flex-1 truncate text-left">{name}</span><span className="rounded-full bg-white/70 px-2 py-1 text-xs text-slate-600">{count}</span></button>)}</nav>
      </aside>

      <main className="min-w-0"><div className="mb-3 flex flex-col gap-3 rounded-[1.5rem] border border-purple-100 bg-white/65 p-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="flex items-center gap-3 font-display text-lg font-black text-purple-700">{layout === 'grid' ? <Grid2X2 className="h-5 w-5" /> : <List className="h-5 w-5" />}{layout === 'grid' ? ui.cards : ui.list}</h2><div className="flex items-center gap-3"><div className="flex rounded-xl bg-white/70 p-1">{(['all', 'studying', 'learned'] as Status[]).map(item => <button key={item} type="button" onClick={() => setStatus(item)} className={`rounded-lg px-5 py-2 font-body text-sm font-800 ${status === item ? 'bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-md' : 'text-slate-500'}`}>{item === 'all' ? (lang === 'en' ? 'All' : lang === 'ua' ? 'Усі' : 'Все') : item === 'studying' ? ui.studying : ui.learned}</button>)}</div><div className="flex rounded-xl bg-white/70 p-1"><button type="button" aria-label={lang === 'en' ? 'Card view' : lang === 'ua' ? 'Картки' : 'Карточки'} aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')} className={`rounded-lg p-2 transition ${layout === 'grid' ? 'bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-md' : 'text-purple-500 hover:bg-purple-50'}`}><Grid2X2 className="h-5 w-5" /></button><button type="button" aria-label={lang === 'en' ? 'List view' : lang === 'ua' ? 'Список' : 'Список'} aria-pressed={layout === 'list'} onClick={() => setLayout('list')} className={`rounded-lg p-2 transition ${layout === 'list' ? 'bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-md' : 'text-purple-500 hover:bg-purple-50'}`}><List className="h-5 w-5" /></button></div></div></div>
        {words.length === 0 ? <div className="glass flex min-h-[520px] flex-col items-center justify-center rounded-[2rem] text-center"><motion.img src={ASSET.book} alt="" animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }} className="h-44 w-44 object-contain" /><p className="mt-4 font-body font-700 text-purple-400">{ui.empty}</p></div> : filtered.length === 0 ? <div className="glass flex min-h-[520px] items-center justify-center rounded-[2rem] font-display text-lg font-black text-purple-400">{ui.noResults}</div> : layout === 'grid' ? <div className="grid grid-cols-1 gap-5 min-[520px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filtered.map(word => <WordCard key={word.id} word={word} lang={lang} learned={learnedIds.has(word.id)} favorite={favoriteIds.has(word.id)} onLearned={() => toggleLearned(word.id)} onFavorite={() => toggleFavorite(word.id)} onStudyActivity={recordStudyActivity} />)}</div> : <div className="grid grid-cols-1 gap-3">{filtered.map(word => <WordListItem key={word.id} word={word} lang={lang} learned={learnedIds.has(word.id)} onLearned={() => toggleLearned(word.id)} onStudyActivity={recordStudyActivity} />)}</div>}
      </main>

      <aside className="space-y-4"><div className="relative aspect-[0.787] overflow-hidden rounded-[1.6rem] shadow-[0_18px_38px_rgba(116,56,195,0.28)]"><img src={ASSET.daily} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" /><h2 className="absolute left-5 top-6 z-10 max-w-[125px] text-left font-display text-xl font-black leading-tight text-white">{ui.daily}</h2><div className="absolute inset-x-5 bottom-5 z-10 text-center text-white"><p className="font-body text-sm font-700 leading-relaxed text-white/95">{ui.dailyText}</p><button type="button" onClick={startReview} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 to-fuchsia-500 px-3 py-3 font-display text-sm font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl"><img src={ASSET.reviewLightning} alt="" aria-hidden="true" className="h-7 w-7 shrink-0 object-contain drop-shadow-[0_0_7px_rgba(216,180,254,0.8)]" /><span className="-translate-x-1">{ui.start}</span></button></div></div><div className="relative overflow-hidden rounded-[1.6rem] border border-purple-100 bg-white/70 p-5 shadow-[0_12px_30px_rgba(92,55,135,0.1)]"><h2 className="font-display text-lg font-black text-slate-600">{ui.streak}</h2><div className="mt-3 flex items-end gap-3"><img src={ASSET.fire} alt="" className="h-14 w-14 translate-y-2 object-contain" /><span className="font-display text-4xl font-black text-purple-700">{streak}</span><span className="pb-1 font-body text-xs font-700 text-slate-500">{ui.daysStraight}</span></div><div className="mt-4 grid grid-cols-7 gap-1">{WEEKDAY_LABELS[lang].map((day, index) => { const active = studyDays.has(weekDayKeys[index]); return <div key={weekDayKeys[index]} className="text-center"><span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs ${active ? 'bg-purple-600 text-white' : 'border border-purple-200 bg-purple-50 text-purple-200'}`}>{active ? '✓' : ''}</span><span className="mt-1 block font-body text-[10px] font-700 text-slate-500">{day}</span></div>; })}</div></div><div className="relative h-[120px] overflow-visible"><img src={ASSET.owl} alt="" aria-hidden="true" className="absolute bottom-10 right-[-8px] w-[260px] max-w-none object-contain object-right-bottom drop-shadow-[0_10px_16px_rgba(101,61,170,0.14)]" /></div></aside>
    </section>
  </div>;
}
