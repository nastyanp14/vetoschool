import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Grid2X2,
  Headphones,
  Lock,
  MessageCircle,
  PlayCircle,
  RefreshCw,
  Sparkles,
  Star,
} from 'lucide-react';
import {
  Workbook, Unit, Lesson,
  listAvailableWorkbooks, listUnitsForWorkbooks, listLessonsForUnits, getLessonProgress,
} from '../lib/workbooks';
import { canReward } from '../lib/mechanics';
import InteractiveLessonRoom from './InteractiveLessonRoom';
import { Lang, t } from '../lib/i18n';

const mapCopy = {
  ru: {
    loading: 'Загрузка интерактива...',
    workbookHeroTitle: 'Interactive Workbook',
    workbookHeroSubtitle: 'Учись, играй и проходи уроки в своём темпе.',
    continue: 'Продолжить обучение',
    myWorkbook: 'Мои воркбуки',
    lessons: 'уроков',
    of: 'из',
    completed: 'Пройдено',
    progress: 'Прогресс',
    earnedStars: 'звёзд заработано',
    rewards: 'Смотреть награды',
    streak: 'Отличная работа',
    streakSub: 'Продолжай в том же духе.',
    continueLesson: 'Продолжить',
    repeat: 'Повторить',
    locked: 'Откроется позже',
    completedStatus: 'Завершено',
    inProgressStatus: 'В процессе',
    lockedStatus: 'Закрыто',
    lesson: 'Lesson',
    lessonTitlePrefix: 'Урок',
    trialTitle: 'Пробник',
    trialSubtitle: 'English Start',
    unit: 'UNIT',
    unitProgress: 'Прогресс юнита',
    completedLessons: 'уроков завершено',
    latestLessons: 'Последние уроки',
    allLessons: 'Смотреть все уроки',
    upcomingTitle: 'Ближайшие занятия',
    today: 'Сегодня',
    may: 'Мая',
    scheduleTime: '17:00 - 17:45',
    speechPractice: 'Практика речи',
    onlineLesson: 'Онлайн-занятие',
    scheduleLink: 'Смотреть расписание',
    filterAll: 'Все уроки',
    filterOrder: 'По порядку',
  },
  en: {
    loading: 'Loading interactive...',
    workbookHeroTitle: 'Interactive Workbook',
    workbookHeroSubtitle: 'Learn, play and move through lessons at your own pace.',
    continue: 'Continue learning',
    myWorkbook: 'My workbooks',
    lessons: 'lessons',
    of: 'of',
    completed: 'Completed',
    progress: 'Progress',
    earnedStars: 'stars earned',
    rewards: 'View rewards',
    streak: 'Great work',
    streakSub: 'Keep growing today.',
    continueLesson: 'Continue',
    repeat: 'Repeat',
    locked: 'Unlocks later',
    completedStatus: 'Completed',
    inProgressStatus: 'In progress',
    lockedStatus: 'Locked',
    lesson: 'Lesson',
    lessonTitlePrefix: 'Lesson',
    trialTitle: 'Trial',
    trialSubtitle: 'English Start',
    unit: 'UNIT',
    unitProgress: 'Unit progress',
    completedLessons: 'lessons completed',
    latestLessons: 'Recent lessons',
    allLessons: 'View all lessons',
    upcomingTitle: 'Upcoming lessons',
    today: 'Today',
    may: 'May',
    scheduleTime: '17:00 - 17:45',
    speechPractice: 'Speech practice',
    onlineLesson: 'Online lesson',
    scheduleLink: 'View schedule',
    filterAll: 'All lessons',
    filterOrder: 'In order',
  },
  ua: {
    loading: 'Завантаження інтерактиву...',
    workbookHeroTitle: 'Interactive Workbook',
    workbookHeroSubtitle: 'Навчайся, грай і проходь уроки у своєму темпі.',
    continue: 'Продовжити навчання',
    myWorkbook: 'Мої воркбуки',
    lessons: 'уроків',
    of: 'з',
    completed: 'Пройдено',
    progress: 'Прогрес',
    earnedStars: 'зірок зароблено',
    rewards: 'Переглянути нагороди',
    streak: 'Чудова робота',
    streakSub: 'Продовжуй у тому ж дусі.',
    continueLesson: 'Продовжити',
    repeat: 'Повторити',
    locked: 'Відкриється пізніше',
    completedStatus: 'Завершено',
    inProgressStatus: 'У процесі',
    lockedStatus: 'Закрито',
    lesson: 'Lesson',
    lessonTitlePrefix: 'Урок',
    trialTitle: 'Пробник',
    trialSubtitle: 'English Start',
    unit: 'UNIT',
    unitProgress: 'Прогрес юніта',
    completedLessons: 'уроків завершено',
    latestLessons: 'Останні уроки',
    allLessons: 'Переглянути всі уроки',
    upcomingTitle: 'Найближчі заняття',
    today: 'Сьогодні',
    may: 'Травня',
    scheduleTime: '17:00 - 17:45',
    speechPractice: 'Практика мовлення',
    onlineLesson: 'Онлайн-заняття',
    scheduleLink: 'Переглянути розклад',
    filterAll: 'Усі уроки',
    filterOrder: 'За порядком',
  },
};

type Copy = typeof mapCopy.ru;
type AssignedInteractiveContent = {
  id: string;
  interactiveLessonId?: string | null;
};

const CARD_ART = {
  trial: '/dashboard/interactive/trial-card.png?v=20260827b',
  workbook: '/dashboard/interactive/workbook-card.jpg',
  upcoming: '/dashboard/interactive/upcoming-card.png?v=20260827b',
  greatWork: '/dashboard/interactive/great-work-card.png?v=20260827b',
};

const STAR_SRC = '/dashboard/rating-user-star.png?v=20260815';

function percent(done: number, total: number) {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

function lessonNumber(lesson: Lesson, index: number) {
  return lesson.lesson_number || index + 5;
}

function lessonDisplayTitle(copy: Copy, lesson: Lesson, index: number) {
  const displayNumber = index === 3 ? 4 : lessonNumber(lesson, index);
  return `${copy.lessonTitlePrefix} ${displayNumber}`;
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex h-[218px] w-[218px] shrink-0 items-center justify-center rounded-full bg-white/55 shadow-[0_0_0_10px_rgba(255,255,255,0.22),0_16px_38px_rgba(124,58,237,0.24),inset_0_0_24px_rgba(255,255,255,0.9)] backdrop-blur-sm">
      <svg className="-rotate-90" viewBox="0 0 200 200" width="210" height="210" aria-hidden="true">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(125,92,238,0.20)" strokeWidth="14" />
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="url(#interactiveRing)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="drop-shadow-[0_0_7px_rgba(168,85,247,0.72)]"
        />
        <defs>
          <linearGradient id="interactiveRing" x1="100" x2="100" y1="10" y2="190" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f06fca" />
            <stop offset="52%" stopColor="#b15ee8" />
            <stop offset="100%" stopColor="#7659ef" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-[48px] font-black leading-none text-purple-800">{value}%</div>
        <div className="mt-2 font-display text-base font-bold text-purple-600">{label}</div>
      </div>
    </div>
  );
}

function ArtCard({
  src,
  alt,
  children,
  className = '',
  button = false,
  disabled = false,
  onClick,
  imageClassName = '',
}: {
  src: string;
  alt: string;
  children?: ReactNode;
  className?: string;
  button?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  imageClassName?: string;
}) {
  const content = (
    <>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={`interactive-art-image select-none ${imageClassName}`}
      />
      {children}
    </>
  );
  const sharedClass = `relative w-full overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_16px_44px_rgba(167,139,250,0.16)] ring-1 ring-pink-100/75 transition duration-300 dark:border-purple-300/20 dark:bg-white/[0.08] dark:ring-purple-300/15 ${className}`;

  if (button) {
    return (
      <motion.button
        type="button"
        whileHover={!disabled ? { y: -3 } : undefined}
        whileTap={!disabled ? { scale: 0.99 } : undefined}
        onClick={onClick}
        disabled={disabled}
        className={`${sharedClass} text-left ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <motion.div whileHover={{ y: -3 }} className={sharedClass}>
      {content}
    </motion.div>
  );
}

function StarsCard({ copy }: { copy: Copy }) {
  return (
    <div className="relative h-[130px] overflow-hidden rounded-[22px] border border-white/85 bg-gradient-to-br from-white via-pink-50/80 to-purple-50 px-5 py-3 shadow-[0_12px_32px_rgba(167,139,250,0.14)] ring-1 ring-pink-100/70 xl:h-full">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-yellow-100/70 blur-2xl" />
      <div className="relative flex h-[72px] items-center gap-3">
        <img src={STAR_SRC} alt="" draggable={false} className="h-[66px] w-[72px] shrink-0 select-none object-contain drop-shadow-[0_8px_10px_rgba(245,158,11,0.26)]" />
        <div className="flex min-w-0 items-center gap-3">
          <div className="font-display text-[46px] font-black leading-none text-purple-800">7</div>
          <div className="max-w-[90px] font-display text-[13px] font-black leading-tight text-purple-800">{copy.earnedStars}</div>
        </div>
      </div>
      <button className="relative flex h-8 w-full items-center justify-center gap-2 rounded-xl border border-pink-100 bg-white/78 font-display text-xs font-black text-purple-700 shadow-sm transition hover:-translate-y-0.5 hover:text-pink-500">
        {copy.rewards}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function RecentLessonsCard({
  copy,
  lessons,
  progress,
}: {
  copy: Copy;
  lessons: Lesson[];
  progress: Record<string, { completed_at: string; stars_awarded: number }>;
}) {
  const lessonPalette = [
    'bg-pink-50 text-pink-500',
    'bg-emerald-50 text-emerald-500',
    'bg-sky-50 text-sky-500',
  ];

  return (
    <div className="relative flex h-[210px] flex-col overflow-hidden rounded-[22px] border border-white/85 bg-white/90 px-5 pb-3 pt-4 shadow-[0_12px_32px_rgba(167,139,250,0.13)] ring-1 ring-pink-100/70 backdrop-blur xl:h-full">
      <h3 className="font-display text-base font-black leading-tight text-purple-800">{copy.latestLessons}</h3>
      <div className="mt-2 flex-1 divide-y divide-purple-100/70">
        {lessons.slice(0, 3).map((lesson, index) => {
          const done = !!progress[lesson.id];
          const number = lessonNumber(lesson, index);
          return (
            <div key={lesson.id} className="flex h-[40px] items-center gap-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${lessonPalette[index % lessonPalette.length]}`}>
                <BookOpen className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm font-black leading-tight text-purple-800">
                  {copy.lessonTitlePrefix} {number}
                </div>
                <div className="truncate font-display text-[11px] font-bold leading-tight text-purple-400">
                  English Start
                </div>
              </div>
              <span className="font-display text-xs font-black text-emerald-500">{done ? '100%' : '0%'}</span>
              <CheckCircle2 className={`h-4 w-4 shrink-0 ${done ? 'text-emerald-500' : 'text-purple-200'}`} />
            </div>
          );
        })}
      </div>
      <button className="mt-1 flex items-center gap-2 font-display text-xs font-black text-purple-700 transition hover:text-pink-500">
        {copy.allLessons}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function UpcomingCard({ copy }: { copy: Copy }) {
  return (
    <div className="relative flex h-[210px] flex-col overflow-hidden rounded-[22px] border border-white/85 bg-white shadow-[0_12px_32px_rgba(167,139,250,0.13)] ring-1 ring-pink-100/70 xl:h-full">
      <img
        src={CARD_ART.upcoming}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-cover"
      />
      <div className="relative -translate-y-0.5 px-5 pt-2">
        <h3 className="flex items-center gap-2 font-display text-base font-black leading-tight text-purple-800">
          <CalendarDays className="h-4 w-4 text-violet-500" />
          {copy.upcomingTitle}
        </h3>
      </div>
      <div className="absolute left-[7.8%] top-[20%] z-10 flex h-[43%] w-[21%] flex-col text-center xl:top-[17.5%] xl:h-[46.5%]">
        <div className="flex h-[29%] translate-y-[12px] items-center justify-center font-display text-[clamp(7px,0.7vw,11px)] font-black uppercase leading-none text-white xl:translate-y-[14px]">
          {copy.today}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="font-display text-[clamp(24px,2.1vw,34px)] font-black leading-none text-purple-800">17</div>
          <div className="mt-1 font-display text-[clamp(8px,0.8vw,12px)] font-black uppercase leading-none text-purple-600">{copy.may}</div>
        </div>
      </div>
      <div className="relative flex flex-1 items-center gap-3 px-5 pb-11 pt-2">
        <div className="w-[68px] shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1 -translate-y-2">
          <div className="font-display text-xs font-bold text-purple-400">{copy.scheduleTime}</div>
          <div className="mt-1 truncate font-display text-lg font-black leading-tight text-purple-800">{copy.speechPractice}</div>
          <div className="mt-1 font-display text-xs font-bold text-purple-400">{copy.onlineLesson}</div>
        </div>
      </div>
      <button className="absolute inset-x-4 bottom-3 flex h-9 items-center justify-center gap-2 rounded-xl bg-purple-50/76 font-display text-xs font-black text-purple-700 shadow-inner transition hover:text-pink-500">
        {copy.scheduleLink}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function LessonCard({
  lesson,
  index,
  copy,
  done,
  unlocked,
  progressValue,
  onOpen,
}: {
  lesson: Lesson;
  index: number;
  copy: Copy;
  done: boolean;
  unlocked: boolean;
  progressValue: number;
  onOpen: () => void;
}) {
  const action = done ? copy.repeat : unlocked ? copy.continueLesson : copy.locked;
  const statusLabel = done ? copy.completedStatus : unlocked ? copy.inProgressStatus : copy.lockedStatus;
  const stars = canReward(lesson.type) ? lesson.stars_reward : 0;
  const number = lessonNumber(lesson, index);
  const lessonIcons = [Star, MessageCircle, Headphones, BookOpen];
  const lessonIconPalette = [
    'bg-pink-50 text-pink-400',
    'bg-emerald-50 text-emerald-500',
    'bg-violet-50 text-violet-500',
    'bg-fuchsia-50 text-fuchsia-500',
  ];
  const Icon = lessonIcons[index % lessonIcons.length];

  return (
    <motion.button
      type="button"
      whileHover={unlocked ? { y: -3 } : undefined}
      whileTap={unlocked ? { scale: 0.985 } : undefined}
      onClick={() => unlocked && onOpen()}
      className={`relative flex h-full min-h-0 w-full flex-col rounded-[20px] border p-3 text-left transition duration-300 ${
        done
          ? 'border-emerald-100 bg-white shadow-[0_12px_26px_rgba(16,185,129,0.10)]'
          : unlocked
            ? 'border-violet-200 bg-white shadow-[0_16px_32px_rgba(139,92,246,0.16)]'
            : 'cursor-not-allowed border-slate-100 bg-white/76 opacity-70'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[16px] ${lessonIconPalette[index % lessonIconPalette.length]}`}>
          <Icon className={`h-8 w-8 ${Icon === Star ? 'fill-current' : ''}`} />
        </span>
        <div className="min-w-0 pt-1">
          <div className="font-display text-xs font-black uppercase leading-tight text-emerald-600">
            {copy.lesson} {number}
          </div>
          <h5 className="mt-1 truncate font-display text-[20px] font-black leading-tight text-purple-800">
            {lessonDisplayTitle(copy, lesson, index)}
          </h5>
        </div>
      </div>

      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between font-display text-xs font-black">
          <span className={done ? 'text-emerald-600' : 'text-purple-700'}>{progressValue}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-purple-100/70">
          <div
            className={done ? 'h-full rounded-full bg-emerald-400' : 'h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-500'}
            style={{ width: `${progressValue}%` }}
          />
        </div>
      </div>

      <div className="mt-auto flex items-end justify-between gap-1 pt-2">
        <span className={`inline-flex items-center gap-1 rounded-xl px-1.5 py-1.5 font-display text-[10px] font-black ${
          done
            ? 'bg-emerald-50 text-emerald-600'
            : unlocked
              ? 'bg-purple-50 text-purple-600'
              : 'bg-slate-100 text-slate-400'
        }`}>
          {done ? <CheckCircle2 className="h-3 w-3" /> : unlocked ? <PlayCircle className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {statusLabel}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-xl px-1.5 py-1.5 font-display text-[10px] font-black ${
          done ? 'bg-emerald-50 text-emerald-600' : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-purple-200/60'
        }`}>
          {done ? <RefreshCw className="h-3 w-3" /> : <PlayCircle className="h-3 w-3" />}
          {action}
        </span>
        {stars > 0 && done && (
          <span className="absolute bottom-12 right-3 hidden items-center gap-1 rounded-xl bg-yellow-50 px-2 py-1 font-display text-[11px] font-black text-yellow-600 xl:inline-flex">
            <Star className="h-3.5 w-3.5 fill-current" />
            {stars}
          </span>
        )}
      </div>
    </motion.button>
  );
}

export default function InteractiveLessonMap({ userId, hasAccess, lang = 'ru', assignedContent = [], onStarsChanged, onContentChanged }: {
  userId: string; hasAccess: boolean; lang?: Lang; assignedContent?: AssignedInteractiveContent[]; onStarsChanged?: () => void; onContentChanged?: () => void;
}) {
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [units, setUnits] = useState<Record<string, Unit[]>>({});
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [progress, setProgress] = useState<Record<string, { completed_at: string; stars_awarded: number }>>({});
  const [active, setActive] = useState<{ lesson: Lesson; contentItem: AssignedInteractiveContent | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [wbs, nextProgress] = await Promise.all([
      listAvailableWorkbooks(userId),
      getLessonProgress(userId),
    ]);
    setWorkbooks(wbs);
    const unitRows = await listUnitsForWorkbooks(wbs.map(workbook => workbook.id));
    const lessonRows = await listLessonsForUnits(unitRows.map(unit => unit.id));
    const u = Object.fromEntries(wbs.map(workbook => [workbook.id, unitRows.filter(unit => unit.workbook_id === workbook.id)]));
    const l = Object.fromEntries(unitRows.map(unit => [unit.id, lessonRows.filter(lesson => lesson.unit_id === unit.id)]));
    setUnits(u);
    setLessons(l);
    setProgress(nextProgress);
    setLoading(false);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const copy = mapCopy[lang] || mapCopy.ru;
  const contentByLessonId = new Map(assignedContent
    .filter(item => item.interactiveLessonId)
    .map(item => [item.interactiveLessonId as string, item]));
  const openLesson = (lesson: Lesson) => {
    setActive({ lesson, contentItem: contentByLessonId.get(lesson.id) || null });
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="inline-flex items-center gap-3 rounded-3xl border border-purple-100 bg-white px-5 py-3 font-bold text-purple-500 shadow-sm dark:border-purple-900 dark:bg-slate-900 dark:text-purple-100">
        <Sparkles className="h-5 w-5 text-pink-400" />
        {copy.loading}
      </div>
    </div>
  );

  if (workbooks.length === 0) {
    return (
      <div className="rounded-3xl border border-purple-100 bg-white/80 p-12 text-center shadow-xl shadow-purple-100/50 dark:border-purple-900 dark:bg-slate-900">
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="mx-auto mb-4 flex h-[60px] w-[90px] items-center justify-center"
        >
          <img
            src="/dashboard/interactive-tablet.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="h-[60px] w-auto scale-125 select-none object-contain"
          />
        </motion.div>
        <h3 className="mb-2 font-display text-2xl font-bold text-purple-700">{t(lang, 'map_empty_title')}</h3>
        <p className="font-body text-purple-400">{t(lang, 'map_empty_desc')}</p>
      </div>
    );
  }

  const allUnits = workbooks.flatMap(wb => units[wb.id] || []);
  const allLessons = allUnits.flatMap(un => lessons[un.id] || []);
  const doneCount = allLessons.filter(lesson => progress[lesson.id]).length;
  const workbookPercent = percent(doneCount, allLessons.length);
  const firstPlayable = allUnits.flatMap(un => {
    const list = lessons[un.id] || [];
    return list.filter((lesson, index) => {
      const previous = list[index - 1];
      return hasAccess && !progress[lesson.id] && (index === 0 || (previous && progress[previous.id]));
    });
  })[0] || allLessons.find(lesson => progress[lesson.id]) || allLessons[0] || null;
  const firstUnit = allUnits[0] || null;
  const firstUnitLessons = firstUnit ? lessons[firstUnit.id] || [] : [];
  const firstUnitDone = firstUnitLessons.filter(lesson => progress[lesson.id]).length;
  const firstUnitPercent = percent(firstUnitDone, firstUnitLessons.length);
  const featuredLessons = allLessons.slice(0, 4);

  return (
    <div
      className="interactive-dashboard-shell"
      style={{ fontFamily: 'Nunito, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      <section className="interactive-dashboard-grid">
        <div className="interactive-dashboard-top">
          <ArtCard
            src={CARD_ART.workbook}
            alt=""
            button
            disabled={!firstPlayable}
            onClick={() => firstPlayable && openLesson(firstPlayable)}
            className="interactive-workbook-card"
            imageClassName="-translate-x-4 scale-[1.06]"
          >
            <div className="absolute inset-y-0 left-0 z-10 flex w-[52%] flex-col justify-start px-9 pt-8">
              <span className="mb-4 inline-flex w-fit rounded-full bg-white/82 px-3 py-1.5 font-display text-[11px] font-black uppercase text-purple-500 shadow-sm backdrop-blur">
                {copy.progress}: {doneCount} {copy.of} {allLessons.length}
              </span>
              <h2 className="font-display text-[50px] font-black leading-[0.96] text-purple-800 drop-shadow-[0_2px_0_rgba(255,255,255,0.75)]">
                {copy.workbookHeroTitle}
              </h2>
              <p className="mt-4 max-w-[330px] font-display text-base font-bold leading-snug text-purple-600">
                {copy.workbookHeroSubtitle}
              </p>
              <span className="mt-5 inline-flex h-12 w-fit items-center gap-3 rounded-[18px] bg-gradient-to-r from-pink-500 to-purple-600 px-5 font-display text-sm font-black text-white shadow-[0_14px_26px_rgba(168,85,247,0.26)]">
                <PlayCircle className="h-6 w-6" />
                {copy.continue}
                <ChevronRight className="h-5 w-5" />
              </span>
            </div>
            <div className="absolute right-[5.5%] top-1/2 z-10 -translate-y-1/2">
              <ProgressRing value={workbookPercent} label={copy.completed} />
            </div>
          </ArtCard>

          <div className="interactive-dashboard-center">
            <StarsCard copy={copy} />
            <RecentLessonsCard copy={copy} lessons={featuredLessons} progress={progress} />
          </div>

          <div className="interactive-dashboard-right">
            <ArtCard
              src={CARD_ART.greatWork}
              alt=""
              className="interactive-great-work-card bg-[#eef1ff]"
              imageClassName="scale-[1.03]"
            >
              <div className="absolute inset-y-0 right-0 z-10 flex w-[55%] -translate-x-5 -translate-y-2.5 flex-col items-start justify-center px-3">
                <h3 className="whitespace-nowrap font-display text-lg font-black leading-tight text-white">{copy.streak}!</h3>
                <p className="mt-1 whitespace-nowrap font-display text-xs font-bold text-white">{copy.streakSub}</p>
              </div>
            </ArtCard>
            <UpcomingCard copy={copy} />
          </div>
        </div>

        <div className="interactive-dashboard-bottom">
          <ArtCard
            src={CARD_ART.trial}
            alt=""
            className="interactive-trial-card bg-[#f7eaff]"
            imageClassName="scale-[1.03]"
          >
            <div className="absolute inset-y-0 left-0 z-10 flex w-[58%] flex-col justify-center px-7">
              <span className="mb-3 font-display text-xs font-black uppercase text-purple-400">{copy.myWorkbook}</span>
              <h3 className="font-display text-[31px] font-black leading-none text-purple-800">{copy.trialTitle}</h3>
              <p className="mt-6 font-display text-xs font-black uppercase text-purple-500">{copy.unit} 1</p>
              <p className="font-display text-base font-black leading-tight text-purple-800">{copy.trialSubtitle}</p>
              <div className="mt-4 flex items-center justify-between font-display text-xs font-black text-purple-700">
                <span>{copy.unitProgress}</span>
                <span>{firstUnitPercent}%</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/85 shadow-inner">
                <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-500" style={{ width: `${firstUnitPercent}%` }} />
              </div>
              <p className="mt-3 font-display text-xs font-black text-purple-700">
                {firstUnitDone} {copy.of} {firstUnitLessons.length} {copy.completedLessons}
              </p>
            </div>
          </ArtCard>

          <div className="interactive-lessons-panel relative flex flex-col overflow-hidden rounded-[24px] border border-white/85 bg-white/92 px-4 pb-2 pt-2 shadow-[0_16px_44px_rgba(167,139,250,0.14)] ring-1 ring-pink-100/75 backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-5">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <span className="shrink-0 font-display text-sm font-black text-purple-800">
                  {copy.progress}: {doneCount} {copy.of} {allLessons.length} {copy.lessons}
                </span>
                <div className="h-2.5 min-w-[180px] flex-1 overflow-hidden rounded-full bg-purple-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-600" style={{ width: `${workbookPercent}%` }} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button className="inline-flex h-10 items-center gap-2 rounded-2xl border border-purple-100 bg-white px-4 font-display text-sm font-black text-purple-700 shadow-sm">
                  {copy.filterAll}
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button className="inline-flex h-10 items-center gap-2 rounded-2xl border border-purple-100 bg-white px-4 font-display text-sm font-black text-purple-700 shadow-sm">
                  {copy.filterOrder}
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button className="flex h-10 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700 shadow-sm" aria-label="Grid view">
                  <Grid2X2 className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {featuredLessons.map((lesson, lessonIndex) => {
                const previous = allLessons[allLessons.indexOf(lesson) - 1];
                const done = !!progress[lesson.id];
                const unlocked = hasAccess && (lessonIndex === 0 || (previous && progress[previous.id]));
                return (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    index={lessonIndex}
                    copy={copy}
                    done={done}
                    unlocked={!!unlocked}
                    progressValue={done ? 100 : 0}
                    onOpen={() => openLesson(lesson)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {active && (
        <InteractiveLessonRoom
          lesson={active.lesson}
          userId={userId}
          contentItemId={active.contentItem?.id || null}
          lang={lang}
          onExit={() => { setActive(null); refresh(); onStarsChanged?.(); onContentChanged?.(); }}
          onCompleted={() => { onStarsChanged?.(); onContentChanged?.(); }}
        />
      )}
    </div>
  );
}
