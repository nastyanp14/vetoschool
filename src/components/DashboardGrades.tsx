import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { ContentItem, ContentType } from '../lib/content';
import { t, type Lang } from '../lib/i18n';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

const RATING_STAR_SRC = '/dashboard/rating-user-star.png?v=20260815';

export function DashboardGradeStars({ rating, large = false }: { rating: number; large?: boolean }) {
  const filledStars = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className={`flex justify-center ${large ? 'gap-1.5' : '-space-x-1'}`} aria-label={`${filledStars} / 5`}>
      {[1, 2, 3, 4, 5].map(star => <img key={star} src={RATING_STAR_SRC} alt="" aria-hidden="true" draggable={false} className={`${large ? 'h-11 w-11 max-sm:h-8 max-sm:w-8' : 'h-7 w-7'} shrink-0 object-contain drop-shadow-[0_3px_5px_rgba(217,119,6,0.2)] ${star <= filledStars ? '' : 'opacity-20 grayscale-[0.35]'}`} />)}
    </div>
  );
}

type GradeCategory = Extract<ContentType, 'homework' | 'practice' | 'checkpoint' | 'grammar' | 'listening'>;
type CategoryFilter = GradeCategory | 'all';
type GradesView = 'overview' | 'all' | 'planned' | 'submitted';
type GradeFilter = 'all' | 'waiting' | 'review' | 'graded' | 'revision';
type GradeCategoryConfig = { id: GradeCategory; label: string; tabIcon: string; itemIcon: string };

type DashboardGradesProps = {
  lang: Lang;
  ratingAverage: number;
  totalEarned: number;
  itemsByType: Record<GradeCategory, ContentItem[]>;
  onOpenItem: (item: ContentItem) => void;
};

const CATEGORY_IDS: GradeCategory[] = ['homework', 'practice', 'checkpoint', 'grammar', 'listening'];

const copyByLang = {
  ru: {
    overview: 'Общие оценки', average: 'Средний балл', earned: 'Получено звёзд', byCategory: 'Оценки по категориям', grades: 'оценок', noGrades: 'Пока нет оценок',
    planned: 'Запланированные', submitted: 'Сданные', all: 'Все задания', allCategories: 'Все категории', allStatuses: 'Все статусы',
    waitingFilter: 'Ожидают сдачи', reviewFilter: 'Ждут проверки', gradedFilter: 'Проверены', revisionFilter: 'На доработке',
    due: 'Сдать до:', submittedOn: 'Сдано:', checkedOn: 'Проверено:', waiting: 'Ожидает сдачи', overdue: 'Срок сдачи прошёл', review: 'Ждёт проверки', graded: 'Оценено', checked: 'Проверено без оценки', revision: 'Нужна доработка',
    noItems: 'Заданий пока нет', noPlanned: 'Нет запланированных работ', noSubmitted: 'Сданных работ пока нет', noFiltered: 'Нет заданий с таким статусом',
  },
  en: {
    overview: 'Overall grades', average: 'Average score', earned: 'Stars earned', byCategory: 'Grades by category', grades: 'grades', noGrades: 'No grades yet',
    planned: 'Planned', submitted: 'Submitted', all: 'All assignments', allCategories: 'All categories', allStatuses: 'All statuses',
    waitingFilter: 'Awaiting submission', reviewFilter: 'Awaiting review', gradedFilter: 'Reviewed', revisionFilter: 'Needs revision',
    due: 'Due:', submittedOn: 'Submitted:', checkedOn: 'Checked:', waiting: 'Awaiting submission', overdue: 'Past due', review: 'Awaiting review', graded: 'Graded', checked: 'Checked without a grade', revision: 'Needs revision',
    noItems: 'No assignments yet', noPlanned: 'No planned assignments', noSubmitted: 'No submitted assignments yet', noFiltered: 'No assignments with this status',
  },
  ua: {
    overview: 'Загальні оцінки', average: 'Середній бал', earned: 'Отримано зірок', byCategory: 'Оцінки за категоріями', grades: 'оцінок', noGrades: 'Оцінок поки немає',
    planned: 'Заплановані', submitted: 'Здані', all: 'Усі завдання', allCategories: 'Усі категорії', allStatuses: 'Усі статуси',
    waitingFilter: 'Очікують здачі', reviewFilter: 'Чекають перевірки', gradedFilter: 'Перевірені', revisionFilter: 'На доопрацюванні',
    due: 'Здати до:', submittedOn: 'Здано:', checkedOn: 'Перевірено:', waiting: 'Очікує здачі', overdue: 'Термін здачі минув', review: 'Чекає перевірки', graded: 'Оцінено', checked: 'Перевірено без оцінки', revision: 'Потрібне доопрацювання',
    noItems: 'Завдань поки немає', noPlanned: 'Немає запланованих робіт', noSubmitted: 'Зданих робіт поки немає', noFiltered: 'Немає завдань із таким статусом',
  },
} as const;

function isSubmitted(item: ContentItem) {
  return Boolean(item.submittedAt || item.checkedAt || (item.starRating && item.starRating > 0) || ['submitted', 'reviewed', 'revision_requested'].includes(item.homeworkStatus || ''));
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

function dateValue(item: ContentItem) { return item.checkedAt || item.submittedAt || item.dueDate || item.scheduledDate || ''; }

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

function moduleLabel(moduleId: string) {
  const numbered = moduleId.match(/^module-(\d+)$/i);
  if (numbered) return `Unit ${numbered[1]}`;
  if (/^(admin-|lesson-block:|grammar-|listening-|checkpoint-|preview)/i.test(moduleId)) return '';
  return moduleId.replace(/[-_]+/g, ' ').trim();
}

function averageFor(items: ContentItem[]) {
  const ratings = items.flatMap(item => item.starRating && item.starRating > 0 ? [item.starRating] : []);
  return ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10 : null;
}

export default function DashboardGrades({ lang, ratingAverage, totalEarned, itemsByType, onOpenItem }: DashboardGradesProps) {
  const copy = copyByLang[lang];
  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';
  const [view, setView] = useState<GradesView>('overview');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [filter, setFilter] = useState<GradeFilter>('all');

  const categories: GradeCategoryConfig[] = [
    { id: 'homework', label: t(lang, 'dash_homework'), tabIcon: '/dashboard/grades-homework-pencil.png', itemIcon: '/dashboard/grades-homework-books.png' },
    { id: 'practice', label: t(lang, 'dash_practice'), tabIcon: '/dashboard/grades-practice-gamepad.png', itemIcon: '/dashboard/grades-practice-target.png' },
    { id: 'checkpoint', label: 'Unit Checkpoint', tabIcon: '/dashboard/grades-checkpoint-flag.png', itemIcon: '/dashboard/grades-checkpoint-flag.png' },
    { id: 'grammar', label: t(lang, 'dash_grammar'), tabIcon: '/dashboard/grammar-book.png', itemIcon: '/dashboard/grammar-task.png' },
    { id: 'listening', label: t(lang, 'dash_listening'), tabIcon: '/dashboard/listening-headphones.png', itemIcon: '/dashboard/listening-note.png' },
  ];

  const allItems = useMemo(() => CATEGORY_IDS.flatMap(category => itemsByType[category]), [itemsByType]);
  const plannedCount = allItems.filter(item => !isSubmitted(item)).length;
  const submittedCount = allItems.length - plannedCount;
  const categoryItems = activeCategory === 'all' ? allItems : itemsByType[activeCategory];
  const activeConfig = activeCategory === 'all' ? null : categories.find(category => category.id === activeCategory) || null;

  const visibleItems = useMemo(() => categoryItems
    .filter(item => view === 'submitted' ? isSubmitted(item) : view === 'planned' ? !isSubmitted(item) : true)
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
      return view === 'planned' ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
    }), [categoryItems, filter, view]);

  const filters: { id: GradeFilter; label: string }[] = [
    { id: 'all', label: copy.allStatuses },
    { id: 'waiting', label: copy.waitingFilter },
    { id: 'review', label: copy.reviewFilter },
    { id: 'graded', label: copy.gradedFilter },
    { id: 'revision', label: copy.revisionFilter },
  ];
  const activeFilterLabel = filters.find(option => option.id === filter)?.label || copy.allStatuses;
  const viewTabs: { id: GradesView; label: string; count?: number }[] = [
    { id: 'overview', label: copy.overview },
    { id: 'all', label: copy.all, count: allItems.length },
    { id: 'planned', label: copy.planned, count: plannedCount },
    { id: 'submitted', label: copy.submitted, count: submittedCount },
  ];

  const statusPresentation = (item: ContentItem) => {
    const kind = statusKind(item);
    if (kind === 'revision') return { label: copy.revision, className: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300' };
    if (kind === 'graded') return { label: copy.graded, className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' };
    if (kind === 'checked') return { label: copy.checked, className: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300' };
    if (kind === 'review') return { label: copy.review, className: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300' };
    if (kind === 'overdue') return { label: copy.overdue, className: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300' };
    return { label: copy.waiting, className: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300' };
  };

  const openCategory = (category: GradeCategory) => { setActiveCategory(category); setView('all'); setFilter('all'); };
  const emptyText = filter !== 'all' ? copy.noFiltered : view === 'planned' ? copy.noPlanned : view === 'submitted' ? copy.noSubmitted : copy.noItems;

  return (
    <div className="space-y-4" data-testid="dashboard-grades">
      <nav className="flex gap-2 overflow-x-auto pb-2" aria-label={copy.overview} style={{ scrollbarWidth: 'none' }} role="tablist">
        {viewTabs.map(tab => (
          <button key={tab.id} type="button" role="tab" aria-selected={view === tab.id} onClick={() => { setView(tab.id); setActiveCategory('all'); setFilter('all'); }} className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl px-5 py-3 font-body text-sm font-700 transition-all ${view === tab.id ? 'student-accent-gradient text-white shadow-lg shadow-purple-200/70' : 'glass text-purple-600 hover:bg-pink-50 dark:hover:bg-purple-950/60'}`}>
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && <span className={`rounded-full px-2 py-0.5 text-xs ${view === tab.id ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-400 dark:bg-purple-950/60'}`}>{tab.count}</span>}
          </button>
        ))}
      </nav>

      {view === 'overview' ? (
          <motion.section key="overview" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.24 }} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex min-h-[104px] items-center gap-4 rounded-3xl border border-pink-100/80 bg-white/70 px-5 py-4 shadow-[0_12px_32px_rgba(100,68,160,0.08)] backdrop-blur-xl dark:border-purple-800/50 dark:bg-[#281443]/80">
                <img src={RATING_STAR_SRC} alt="" aria-hidden="true" className="h-16 w-16 shrink-0 object-contain drop-shadow-[0_5px_8px_rgba(217,119,6,0.22)]" />
                <div><div className="font-display text-3xl font-black text-purple-700 dark:text-purple-100">{ratingAverage > 0 ? `${ratingAverage} / 5` : '—'}</div><div className="font-body text-sm font-700 text-purple-400">{copy.average}</div></div>
              </div>
              <div className="flex min-h-[104px] items-center gap-4 rounded-3xl border border-blue-100/80 bg-white/70 px-5 py-4 shadow-[0_12px_32px_rgba(100,68,160,0.08)] backdrop-blur-xl dark:border-purple-800/50 dark:bg-[#281443]/80">
                <div className="relative h-16 w-[4.75rem] shrink-0"><img src={RATING_STAR_SRC} alt="" aria-hidden="true" className="absolute left-0 top-4 h-10 w-10 -rotate-12 object-contain" /><img src={RATING_STAR_SRC} alt="" aria-hidden="true" className="absolute right-0 top-0 h-12 w-12 rotate-12 object-contain" /><img src={RATING_STAR_SRC} alt="" aria-hidden="true" className="absolute bottom-0 left-1/2 h-10 w-10 -translate-x-1/2 object-contain" /></div>
                <div><div className="font-display text-3xl font-black text-purple-700 dark:text-purple-100">{totalEarned}</div><div className="font-body text-sm font-700 text-purple-400">{copy.earned}</div></div>
              </div>
            </div>

            <div>
              <h2 className="mb-3 font-display text-xl font-black text-purple-700 dark:text-purple-100 sm:text-2xl">{copy.byCategory}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {categories.map(category => {
                  const items = itemsByType[category.id];
                  const gradedCount = items.filter(item => item.starRating && item.starRating > 0).length;
                  const average = averageFor(items);
                  return (
                    <button key={category.id} type="button" onClick={() => openCategory(category.id)} aria-label={`${category.label}: ${average ? `${average} / 5` : copy.noGrades}`} className="group flex min-h-[140px] flex-col items-start rounded-3xl border border-white/90 bg-white/65 p-4 text-left shadow-[0_10px_28px_rgba(100,68,160,0.07)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_14px_32px_rgba(100,68,160,0.12)] dark:border-purple-800/50 dark:bg-[#281443]/80 dark:hover:bg-[#341b55]">
                      <span className="flex w-full items-center justify-between gap-2"><img src={category.tabIcon} alt="" aria-hidden="true" draggable={false} className="h-11 w-11 object-contain drop-shadow-sm" /><ChevronDown className="h-4 w-4 -rotate-90 text-purple-300 transition-transform group-hover:translate-x-0.5" /></span>
                      <span className="mt-2 font-body text-sm font-800 text-purple-600 dark:text-purple-200">{category.label}</span>
                      <span className="mt-auto font-display text-2xl font-black text-purple-700 dark:text-purple-100">{average ? `${average} / 5` : '—'}</span>
                      <span className="font-body text-xs text-purple-300">{gradedCount ? `${gradedCount} ${copy.grades}` : copy.noGrades}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.section>
        ) : (
          <motion.section key="assignments" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.24 }} className="space-y-4">
            <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={copy.byCategory} style={{ scrollbarWidth: 'none' }}>
              <button type="button" onClick={() => setActiveCategory('all')} aria-pressed={activeCategory === 'all'} className={`flex flex-shrink-0 items-center whitespace-nowrap rounded-2xl px-4 py-2.5 font-body text-sm font-700 transition-all ${activeCategory === 'all' ? 'student-accent-gradient text-white shadow-md' : 'glass text-purple-600 hover:bg-pink-50 dark:hover:bg-purple-950/60'}`}>{copy.allCategories}</button>
              {categories.map(category => (
                <button key={category.id} type="button" onClick={() => setActiveCategory(category.id)} aria-pressed={activeCategory === category.id} className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 font-body text-sm font-600 transition-all ${activeCategory === category.id ? 'student-accent-gradient text-white shadow-md' : 'glass text-purple-600 hover:bg-pink-50 dark:hover:bg-purple-950/60'}`}>
                  <img src={category.tabIcon} alt="" aria-hidden="true" draggable={false} className="h-7 w-7 object-contain drop-shadow-sm" /><span>{category.label}</span>
                </button>
              ))}
            </nav>

            <div className="glass rounded-3xl p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex min-w-0 items-center gap-3 font-display text-xl font-black text-purple-700 dark:text-purple-100 sm:text-2xl">
                  {activeConfig && <img src={activeConfig.tabIcon} alt="" aria-hidden="true" draggable={false} className="h-11 w-11 shrink-0 object-contain drop-shadow-sm" />}
                  <span>{viewTabs.find(tab => tab.id === view)?.label}{activeConfig ? ` · ${activeConfig.label}` : ''}</span>
                </h3>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><button type="button" className="group inline-flex min-w-[11rem] items-center justify-between gap-4 rounded-2xl border border-purple-100 bg-white/80 px-4 py-2.5 font-body text-sm font-700 text-purple-600 shadow-[0_6px_18px_rgba(100,68,160,0.08)] outline-none transition hover:border-purple-200 hover:bg-white dark:border-purple-800/50 dark:bg-[#281443] dark:text-purple-100"><span>{activeFilterLabel}</span><ChevronDown className="h-4 w-4 text-purple-400 transition-transform duration-200 group-data-[state=open]:rotate-180" /></button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-2xl border border-white/80 bg-white/95 p-2 font-body text-purple-600 shadow-[0_18px_48px_rgba(88,51,145,0.2)] backdrop-blur-xl dark:border-purple-800/60 dark:bg-[#281443]/95 dark:text-purple-100">
                    {filters.map(option => <DropdownMenuItem key={option.id} onSelect={() => setFilter(option.id)} className={`cursor-pointer rounded-xl px-3 py-2.5 font-700 outline-none transition-colors focus:bg-purple-50 focus:text-purple-700 dark:focus:bg-purple-900/60 dark:focus:text-purple-50 ${filter === option.id ? 'bg-gradient-to-r from-pink-50 to-violet-50 text-purple-700 dark:from-purple-900/70 dark:to-violet-900/50 dark:text-purple-50' : ''}`}>{option.label}</DropdownMenuItem>)}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <motion.div key={`${view}:${activeCategory}:${filter}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mt-4 space-y-2">
                  {visibleItems.length === 0 ? <p className="py-10 text-center font-body text-sm text-purple-400">{emptyText}</p> : visibleItems.map((item, index) => {
                    const category = categories.find(option => option.id === item.type) || categories[0];
                    const status = statusPresentation(item);
                    const meta = moduleLabel(item.moduleId);
                    const primaryDate = item.checkedAt || item.submittedAt || item.dueDate || item.scheduledDate;
                    const dateLabel = item.checkedAt ? copy.checkedOn : item.submittedAt ? copy.submittedOn : copy.due;
                    return (
                      <button key={item.id} type="button" onClick={() => onOpenItem(item)} className="group grid w-full grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-white/65 p-3 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_9px_24px_rgba(100,68,160,0.1)] dark:bg-[#281443]/80 dark:hover:bg-[#341b55] sm:grid-cols-[3.5rem_minmax(0,1.25fr)_minmax(10rem,.8fr)_auto_auto] sm:px-4 sm:py-3.5">
                        <img src={category.itemIcon} alt="" aria-hidden="true" draggable={false} className="h-12 w-12 object-contain drop-shadow-sm sm:h-14 sm:w-14" />
                        <span className="min-w-0"><span className="block truncate font-body text-sm font-800 text-purple-700 dark:text-purple-100 sm:text-base">{item.title}</span><span className="block truncate font-body text-xs text-purple-300">{meta || `${category.label} ${index + 1}`}</span></span>
                        <span className="col-span-2 col-start-2 flex min-w-0 items-center gap-2 border-t border-purple-50 pt-2 font-body text-xs text-purple-400 dark:border-purple-900/50 sm:col-span-1 sm:col-start-auto sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"><img src="/dashboard/checkpoint-calendar-blank.png" alt="" aria-hidden="true" draggable={false} className="h-8 w-8 shrink-0 object-contain drop-shadow-sm" /><span className="min-w-0"><span className="block text-[11px] text-purple-300">{dateLabel}</span><span className="block truncate font-700 text-purple-500">{formatDate(primaryDate, locale) || '—'}</span></span></span>
                        <span className={`col-span-2 col-start-2 inline-flex w-fit items-center rounded-full px-3 py-2 font-body text-xs font-800 sm:col-span-1 sm:col-start-auto ${status.className}`}>{status.label}</span>
                        <span className="col-start-3 row-start-1 flex items-center gap-1 sm:col-start-auto sm:row-start-auto">{item.starRating && item.starRating > 0 ? <span className="hidden lg:block"><DashboardGradeStars rating={item.starRating} /></span> : null}{item.starRating && item.starRating > 0 ? <span className="whitespace-nowrap font-display text-sm font-black text-purple-700 dark:text-purple-100">{item.starRating} / 5</span> : null}</span>
                      </button>
                    );
                  })}
              </motion.div>
            </div>
          </motion.section>
        )}
    </div>
  );
}
