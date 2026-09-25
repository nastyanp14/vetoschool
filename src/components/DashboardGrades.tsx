import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { ContentItem, ContentType } from '../lib/content';
import { t, type Lang } from '../lib/i18n';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

const RATING_STAR_SRC = '/dashboard/rating-user-star.png?v=20260815';

export function DashboardGradeStars({ rating, large = false }: { rating: number; large?: boolean }) {
  const filledStars = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <div className={`flex justify-center ${large ? 'gap-1.5' : '-space-x-1'}`} aria-label={`${filledStars} / 5`}>
      {[1, 2, 3, 4, 5].map(star => (
        <img
          key={star}
          src={RATING_STAR_SRC}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={`${large ? 'h-11 w-11 max-sm:h-8 max-sm:w-8' : 'h-7 w-7'} shrink-0 object-contain drop-shadow-[0_3px_5px_rgba(217,119,6,0.2)] ${star <= filledStars ? '' : 'opacity-20 grayscale-[0.35]'}`}
        />
      ))}
    </div>
  );
}

type GradeCategory = Extract<ContentType, 'homework' | 'practice' | 'checkpoint' | 'grammar' | 'listening'>;
type JournalTab = 'planned' | 'submitted';
type GradeFilter = 'all' | 'waiting' | 'review' | 'graded' | 'revision';

type GradeCategoryConfig = {
  id: GradeCategory;
  label: string;
  title: string;
  tabIcon: string;
  titleIcon: string;
  itemIcon: string;
  empty: string;
};

type DashboardGradesProps = {
  lang: Lang;
  ratingAverage: number;
  totalEarned: number;
  itemsByType: Record<GradeCategory, ContentItem[]>;
  onOpenItem: (item: ContentItem) => void;
};

const copyByLang = {
  ru: {
    progress: 'Мой прогресс',
    average: 'Средний балл',
    earned: 'Получено звёзд',
    planned: 'Запланированные',
    submitted: 'Сданные',
    all: 'Все задания',
    waitingFilter: 'Ожидают сдачи',
    reviewFilter: 'Ждут проверки',
    gradedFilter: 'Проверены',
    revisionFilter: 'На доработке',
    due: 'Сдать до:',
    submittedOn: 'Сдано:',
    checkedOn: 'Проверено:',
    waiting: 'Ожидает сдачи',
    overdue: 'Срок сдачи прошёл',
    review: 'Ждёт проверки',
    graded: 'Оценено',
    checked: 'Проверено без оценки',
    revision: 'Нужна доработка',
    noPlanned: 'Нет запланированных работ',
    noSubmitted: 'Сданных работ пока нет',
    grammarDiary: 'Дневник по грамматике',
    listeningDiary: 'Дневник аудирования',
  },
  en: {
    progress: 'My progress',
    average: 'Average score',
    earned: 'Stars earned',
    planned: 'Planned',
    submitted: 'Submitted',
    all: 'All assignments',
    waitingFilter: 'Awaiting submission',
    reviewFilter: 'Awaiting review',
    gradedFilter: 'Reviewed',
    revisionFilter: 'Needs revision',
    due: 'Due:',
    submittedOn: 'Submitted:',
    checkedOn: 'Checked:',
    waiting: 'Awaiting submission',
    overdue: 'Past due',
    review: 'Awaiting review',
    graded: 'Graded',
    checked: 'Checked without a grade',
    revision: 'Needs revision',
    noPlanned: 'No planned assignments',
    noSubmitted: 'No submitted assignments yet',
    grammarDiary: 'Grammar journal',
    listeningDiary: 'Listening journal',
  },
  ua: {
    progress: 'Мій прогрес',
    average: 'Середній бал',
    earned: 'Отримано зірок',
    planned: 'Заплановані',
    submitted: 'Здані',
    all: 'Усі завдання',
    waitingFilter: 'Очікують здачі',
    reviewFilter: 'Чекають перевірки',
    gradedFilter: 'Перевірені',
    revisionFilter: 'На доопрацюванні',
    due: 'Здати до:',
    submittedOn: 'Здано:',
    checkedOn: 'Перевірено:',
    waiting: 'Очікує здачі',
    overdue: 'Термін здачі минув',
    review: 'Чекає перевірки',
    graded: 'Оцінено',
    checked: 'Перевірено без оцінки',
    revision: 'Потрібне доопрацювання',
    noPlanned: 'Немає запланованих робіт',
    noSubmitted: 'Зданих робіт поки немає',
    grammarDiary: 'Щоденник із граматики',
    listeningDiary: 'Щоденник аудіювання',
  },
} as const;

function isSubmitted(item: ContentItem) {
  return Boolean(
    item.submittedAt
    || item.checkedAt
    || (item.starRating && item.starRating > 0)
    || ['submitted', 'reviewed', 'revision_requested'].includes(item.homeworkStatus || ''),
  );
}

function statusKind(item: ContentItem): Exclude<GradeFilter, 'all'> | 'checked' | 'overdue' {
  if (item.homeworkStatus === 'revision_requested' || item.studentResult === 'Revision Requested') return 'revision';
  if ((item.starRating && item.starRating > 0) || item.homeworkStatus === 'reviewed') return 'graded';
  if (item.checkedAt) return 'checked';
  if (item.submittedAt || item.homeworkStatus === 'submitted') return 'review';
  if (item.homeworkStatus === 'late') return 'overdue';
  if (item.dueDate) {
    const due = new Date(item.dueDate);
    if (!Number.isNaN(due.getTime()) && due.getTime() < Date.now()) return 'overdue';
  }
  return 'waiting';
}

function dateValue(item: ContentItem) {
  return item.checkedAt || item.submittedAt || item.dueDate || item.scheduledDate || '';
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

function moduleLabel(moduleId: string) {
  const numbered = moduleId.match(/^module-(\d+)$/i);
  if (numbered) return `Unit ${numbered[1]}`;
  if (/^(admin-|lesson-block:|grammar-|listening-|checkpoint-|preview)/i.test(moduleId)) return '';
  return moduleId.replace(/[-_]+/g, ' ').trim();
}

export default function DashboardGrades({ lang, ratingAverage, totalEarned, itemsByType, onOpenItem }: DashboardGradesProps) {
  const copy = copyByLang[lang];
  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';
  const [activeCategory, setActiveCategory] = useState<GradeCategory>('homework');
  const [journalTab, setJournalTab] = useState<JournalTab>('planned');
  const [filter, setFilter] = useState<GradeFilter>('all');

  const categories: GradeCategoryConfig[] = [
    {
      id: 'homework', label: t(lang, 'dash_homework'), title: t(lang, 'dash_diary').replace(/^📝\s*/u, ''),
      tabIcon: '/dashboard/grades-homework-pencil.png', titleIcon: '/dashboard/grades-homework-pencil.png', itemIcon: '/dashboard/grades-homework-books.png', empty: t(lang, 'dash_hw_empty_title'),
    },
    {
      id: 'practice', label: t(lang, 'dash_practice'), title: t(lang, 'dash_practice_diary').replace(/^🎮\s*/u, ''),
      tabIcon: '/dashboard/grades-practice-gamepad.png', titleIcon: '/dashboard/grades-practice-gamepad.png', itemIcon: '/dashboard/grades-practice-target.png', empty: t(lang, 'dash_practice_empty_title'),
    },
    {
      id: 'checkpoint', label: 'Unit Checkpoint', title: t(lang, 'dash_checkpoint_results').replace(/^🏁\s*/u, ''),
      tabIcon: '/dashboard/grades-checkpoint-flag.png', titleIcon: '/dashboard/grades-checkpoint-flag.png', itemIcon: '/dashboard/grades-checkpoint-flag.png', empty: t(lang, 'dash_checkpoint'),
    },
    {
      id: 'grammar', label: t(lang, 'dash_grammar'), title: copy.grammarDiary,
      tabIcon: '/dashboard/grammar-book.png', titleIcon: '/dashboard/grammar-header-book.png', itemIcon: '/dashboard/grammar-task.png', empty: t(lang, 'dash_grammar_empty'),
    },
    {
      id: 'listening', label: t(lang, 'dash_listening'), title: copy.listeningDiary,
      tabIcon: '/dashboard/listening-headphones.png', titleIcon: '/dashboard/listening-headphones.png', itemIcon: '/dashboard/listening-note.png', empty: t(lang, 'dash_listening_empty'),
    },
  ];
  const activeConfig = categories.find(category => category.id === activeCategory) || categories[0];
  const categoryItems = itemsByType[activeCategory];
  const plannedCount = categoryItems.filter(item => !isSubmitted(item)).length;
  const submittedCount = categoryItems.length - plannedCount;

  const visibleItems = useMemo(() => categoryItems
    .filter(item => journalTab === 'submitted' ? isSubmitted(item) : !isSubmitted(item))
    .filter(item => {
      if (filter === 'all') return true;
      const kind = statusKind(item);
      if (filter === 'graded') return kind === 'graded' || kind === 'checked';
      if (filter === 'waiting') return kind === 'waiting' || kind === 'overdue';
      return kind === filter;
    })
    .sort((a, b) => {
      const aDate = dateValue(a);
      const bDate = dateValue(b);
      if (!aDate) return 1;
      if (!bDate) return -1;
      return journalTab === 'submitted' ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
    }), [categoryItems, filter, journalTab]);

  const openCategory = (category: GradeCategory) => {
    setActiveCategory(category);
    setJournalTab('planned');
    setFilter('all');
  };

  const filters: { id: GradeFilter; label: string }[] = [
    { id: 'all', label: copy.all },
    { id: 'waiting', label: copy.waitingFilter },
    { id: 'review', label: copy.reviewFilter },
    { id: 'graded', label: copy.gradedFilter },
    { id: 'revision', label: copy.revisionFilter },
  ];
  const activeFilterLabel = filters.find(option => option.id === filter)?.label || copy.all;

  const statusPresentation = (item: ContentItem) => {
    const kind = statusKind(item);
    if (kind === 'revision') return { label: copy.revision, className: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300' };
    if (kind === 'graded') return { label: copy.graded, className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' };
    if (kind === 'checked') return { label: copy.checked, className: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300' };
    if (kind === 'review') return { label: copy.review, className: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300' };
    if (kind === 'overdue') return { label: copy.overdue, className: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300' };
    return { label: copy.waiting, className: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300' };
  };

  return (
    <div className="space-y-4" data-testid="dashboard-grades">
      <section className="relative min-h-[190px] overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#f69bd1_0%,#c3a8f6_48%,#79c7f6_100%)] px-5 py-5 text-white shadow-[0_18px_48px_rgba(107,76,180,0.16)] sm:min-h-[210px] sm:px-8">
        <img src="/dashboard/grades-hero-owl-left.png" alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute bottom-[-8px] left-[-4px] w-36 select-none object-contain drop-shadow-[0_12px_22px_rgba(82,43,153,0.22)] sm:left-4 sm:w-52 md:w-60" />
        <div className="relative z-10 ml-auto flex max-w-[46rem] flex-col items-center">
          <h2 className="font-display text-3xl font-black drop-shadow-sm sm:text-4xl">{copy.progress}</h2>
          <div className="mt-5 grid w-full max-w-[36rem] grid-cols-2 gap-3">
            <div className="flex min-h-[92px] items-center justify-center gap-2 rounded-3xl border border-white/65 bg-white/65 px-2 text-purple-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_22px_rgba(91,63,160,0.12)] backdrop-blur-sm sm:gap-3 sm:px-3">
              <img src={RATING_STAR_SRC} alt="" aria-hidden="true" className="h-9 w-9 shrink-0 object-contain drop-shadow-[0_5px_8px_rgba(217,119,6,0.22)] sm:h-14 sm:w-14" />
              <div className="min-w-0 text-left"><div className="whitespace-nowrap font-display text-xl font-black sm:text-3xl">{ratingAverage > 0 ? ratingAverage : '—'}{ratingAverage > 0 && ' / 5'}</div><div className="font-body text-[10px] font-700 leading-tight text-purple-400 sm:text-sm">{copy.average}</div></div>
            </div>
            <div className="flex min-h-[92px] items-center justify-center gap-2 rounded-3xl border border-white/65 bg-white/65 px-2 text-purple-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_22px_rgba(91,63,160,0.12)] backdrop-blur-sm sm:gap-3 sm:px-3">
              <div className="relative h-12 w-14 shrink-0 sm:h-14 sm:w-[4.5rem]"><img src={RATING_STAR_SRC} alt="" aria-hidden="true" className="absolute left-0 top-3 h-8 w-8 -rotate-12 object-contain sm:h-10 sm:w-10" /><img src={RATING_STAR_SRC} alt="" aria-hidden="true" className="absolute right-0 top-0 h-9 w-9 rotate-12 object-contain sm:h-11 sm:w-11" /><img src={RATING_STAR_SRC} alt="" aria-hidden="true" className="absolute bottom-0 left-1/2 h-8 w-8 -translate-x-1/2 object-contain sm:h-10 sm:w-10" /></div>
              <div className="min-w-0 text-left"><div className="font-display text-2xl font-black sm:text-3xl">{totalEarned}</div><div className="font-body text-[10px] font-700 leading-tight text-purple-400 sm:text-sm">{copy.earned}</div></div>
            </div>
          </div>
        </div>
      </section>

      <nav className="flex gap-2 overflow-x-auto pb-2" aria-label={copy.progress} style={{ scrollbarWidth: 'none' }}>
        {categories.map(category => (
          <motion.button key={category.id} type="button" onClick={() => openCategory(category.id)} aria-pressed={activeCategory === category.id} whileTap={{ scale: 0.97 }} className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 font-body text-sm font-600 transition-all duration-300 ${activeCategory === category.id ? 'student-accent-gradient text-white shadow-lg shadow-purple-200' : 'glass text-purple-600 hover:bg-pink-50 dark:hover:bg-purple-950/60'}`}>
            <span className="relative h-6 w-6 flex-shrink-0"><img src={category.tabIcon} alt="" aria-hidden="true" draggable={false} className={`absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-sm ${['practice', 'listening'].includes(category.id) ? 'h-8 w-8' : 'h-7 w-7'}`} /></span>
            <span>{category.label}</span>
          </motion.button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
      <motion.section key={activeCategory} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="glass rounded-3xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex min-w-0 items-center gap-2 font-display text-xl font-black text-purple-700 sm:text-2xl">
            <img src={activeConfig.titleIcon} alt="" aria-hidden="true" draggable={false} className="h-12 w-14 shrink-0 object-contain drop-shadow-sm" />
            <span>{activeConfig.title}</span>
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="group inline-flex min-w-[11rem] items-center justify-between gap-4 rounded-2xl border border-purple-100 bg-white/80 px-4 py-2.5 font-body text-sm font-700 text-purple-600 shadow-[0_6px_18px_rgba(100,68,160,0.08)] outline-none transition hover:border-purple-200 hover:bg-white hover:shadow-[0_9px_24px_rgba(100,68,160,0.13)] data-[state=open]:border-purple-200 data-[state=open]:bg-white dark:border-purple-800/50 dark:bg-[#281443] dark:text-purple-100">
                <span>{activeFilterLabel}</span><ChevronDown className="h-4 w-4 text-purple-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-2xl border border-white/80 bg-white/95 p-2 font-body text-purple-600 shadow-[0_18px_48px_rgba(88,51,145,0.2)] backdrop-blur-xl dark:border-purple-800/60 dark:bg-[#281443]/95 dark:text-purple-100">
              {filters.map(option => <DropdownMenuItem key={option.id} onSelect={() => setFilter(option.id)} className={`cursor-pointer rounded-xl px-3 py-2.5 font-700 outline-none transition-colors focus:bg-purple-50 focus:text-purple-700 dark:focus:bg-purple-900/60 dark:focus:text-purple-50 ${filter === option.id ? 'bg-gradient-to-r from-pink-50 to-violet-50 text-purple-700 dark:from-purple-900/70 dark:to-violet-900/50 dark:text-purple-50' : ''}`}>{option.label}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 flex max-w-[26rem] rounded-full bg-purple-50/90 p-1 dark:bg-purple-950/40" role="tablist">
          {([{ id: 'planned', label: copy.planned, count: plannedCount }, { id: 'submitted', label: copy.submitted, count: submittedCount }] as const).map(tab => (
            <button key={tab.id} type="button" role="tab" aria-selected={journalTab === tab.id} onClick={() => { setJournalTab(tab.id); setFilter('all'); }} className={`flex-1 rounded-full px-3 py-2 font-body text-sm font-700 transition ${journalTab === tab.id ? 'student-accent-gradient text-white shadow-sm' : 'text-purple-500 hover:bg-white/70 dark:hover:bg-purple-900/50'}`}>{tab.label} ({tab.count})</button>
          ))}
        </div>

        <AnimatePresence mode="wait">
        <motion.div key={`${activeCategory}:${journalTab}:${filter}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }} className="mt-4 space-y-2">
          {categoryItems.length === 0 ? <p className="py-10 text-center font-body text-sm text-purple-400">{activeConfig.empty}</p> : visibleItems.length === 0 ? <p className="py-10 text-center font-body text-sm text-purple-400">{journalTab === 'planned' ? copy.noPlanned : copy.noSubmitted}</p> : visibleItems.map((item, index) => {
            const status = statusPresentation(item);
            const meta = moduleLabel(item.moduleId);
            const primaryDate = item.checkedAt || item.submittedAt || item.dueDate || item.scheduledDate;
            const dateLabel = item.checkedAt ? copy.checkedOn : item.submittedAt ? copy.submittedOn : copy.due;
            return (
              <button key={item.id} type="button" onClick={() => onOpenItem(item)} className="group grid w-full grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-white/65 p-3 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_9px_24px_rgba(100,68,160,0.1)] dark:bg-[#281443]/80 dark:hover:bg-[#341b55] sm:grid-cols-[3.5rem_minmax(0,1.25fr)_minmax(10rem,.8fr)_auto_auto] sm:px-4 sm:py-3.5">
                <img src={activeConfig.itemIcon} alt="" aria-hidden="true" draggable={false} className="h-12 w-12 object-contain drop-shadow-sm sm:h-14 sm:w-14" />
                <span className="min-w-0"><span className="block truncate font-body text-sm font-800 text-purple-700 sm:text-base">{item.title}</span><span className="block truncate font-body text-xs text-purple-300">{meta || `${activeConfig.label} ${index + 1}`}</span></span>
                <span className="col-span-2 col-start-2 flex min-w-0 items-center gap-2 border-t border-purple-50 pt-2 font-body text-xs text-purple-400 dark:border-purple-900/50 sm:col-span-1 sm:col-start-auto sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"><img src="/dashboard/checkpoint-calendar-blank.png" alt="" aria-hidden="true" draggable={false} className="h-8 w-8 shrink-0 object-contain drop-shadow-sm" /><span className="min-w-0"><span className="block text-[11px] text-purple-300">{dateLabel}</span><span className="block truncate font-700 text-purple-500">{formatDate(primaryDate, locale) || '—'}</span></span></span>
                <span className={`col-span-2 col-start-2 inline-flex w-fit items-center rounded-full px-3 py-2 font-body text-xs font-800 sm:col-span-1 sm:col-start-auto ${status.className}`}>{status.label}</span>
                <span className="col-start-3 row-start-1 flex items-center gap-1 sm:col-start-auto sm:row-start-auto">{item.starRating && item.starRating > 0 ? <span className="hidden lg:block"><DashboardGradeStars rating={item.starRating} /></span> : null}{item.starRating && item.starRating > 0 ? <span className="whitespace-nowrap font-display text-sm font-black text-purple-700">{item.starRating} / 5</span> : null}</span>
              </button>
            );
          })}
        </motion.div>
        </AnimatePresence>
      </motion.section>
      </AnimatePresence>
    </div>
  );
}
