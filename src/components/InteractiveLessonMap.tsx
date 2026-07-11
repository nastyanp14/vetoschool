import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Flame,
  Lock,
  PlayCircle,
  Sparkles,
  Star,
} from 'lucide-react';
import {
  Workbook, Unit, Lesson,
  listAvailableWorkbooks, listUnits, listLessons, getLessonProgress,
} from '../lib/workbooks';
import { canReward } from '../lib/mechanics';
import InteractiveLessonRoom from './InteractiveLessonRoom';
import { Lang, t } from '../lib/i18n';

const UNIT_THEMES = [
  {
    title: 'Colors & Toys',
    description: 'Изучаем цвета, игрушки и простые слова.',
    accent: '#ec6aa8',
    soft: '#fff1f7',
    wash: 'linear-gradient(135deg, rgba(255,241,247,0.95), rgba(245,240,255,0.92))',
  },
  {
    title: 'Feelings & Letters',
    description: 'Эмоции, буквы F-J и добрые истории.',
    accent: '#a56df2',
    soft: '#f5efff',
    wash: 'linear-gradient(135deg, rgba(246,240,255,0.95), rgba(255,245,250,0.92))',
  },
  {
    title: 'Animals World',
    description: 'Домашние, фермерские и дикие животные.',
    accent: '#5cbf9d',
    soft: '#effdf8',
    wash: 'linear-gradient(135deg, rgba(239,253,248,0.95), rgba(241,248,255,0.92))',
  },
];

const mapCopy = {
  ru: {
    loading: 'Загрузка интерактива...',
    workbookHeroTitle: 'Interactive Workbook',
    workbookHeroSubtitle: 'Учись, играй и проходи уроки в своём темпе.',
    continue: 'Продолжить обучение',
    myWorkbook: 'Мои воркбуки',
    workbook: 'Воркбук',
    unit: 'Unit',
    lessons: 'уроков',
    completed: 'Пройдено',
    progress: 'Прогресс',
    earnedStars: 'звёзд заработано',
    rewards: 'Награды',
    streak: 'Отличная работа',
    streakSub: 'Продолжай в том же духе.',
    continueLesson: 'Продолжить',
    repeat: 'Повторить',
    locked: 'Откроется позже',
    completedStatus: 'Завершено',
    inProgressStatus: 'В процессе',
    lockedStatus: 'Закрыто',
    lesson: 'Lesson',
    theory: 'Theory',
    games: 'Games',
    home: 'Home',
    practice: 'Practice',
    emptyTitle: 'Этот юнит готовится',
    emptySubtitle: 'Новые интерактивные уроки скоро появятся здесь.',
  },
  en: {
    loading: 'Loading interactive...',
    workbookHeroTitle: 'Interactive Workbook',
    workbookHeroSubtitle: 'Learn, play and move through lessons at your own pace.',
    continue: 'Continue learning',
    myWorkbook: 'My workbooks',
    workbook: 'Workbook',
    unit: 'Unit',
    lessons: 'lessons',
    completed: 'Completed',
    progress: 'Progress',
    earnedStars: 'stars earned',
    rewards: 'Rewards',
    streak: 'Great work',
    streakSub: 'Keep growing today.',
    continueLesson: 'Continue',
    repeat: 'Repeat',
    locked: 'Unlocks later',
    completedStatus: 'Completed',
    inProgressStatus: 'In progress',
    lockedStatus: 'Locked',
    lesson: 'Lesson',
    theory: 'Theory',
    games: 'Games',
    home: 'Home',
    practice: 'Practice',
    emptyTitle: 'This unit is preparing',
    emptySubtitle: 'New interactive lessons will appear here soon.',
  },
  ua: {
    loading: 'Завантаження інтерактиву...',
    workbookHeroTitle: 'Interactive Workbook',
    workbookHeroSubtitle: 'Навчайся, грай і проходь уроки у своєму темпі.',
    continue: 'Продовжити навчання',
    myWorkbook: 'Мої воркбуки',
    workbook: 'Воркбук',
    unit: 'Unit',
    lessons: 'уроків',
    completed: 'Пройдено',
    progress: 'Прогрес',
    earnedStars: 'зірок зароблено',
    rewards: 'Нагороди',
    streak: 'Чудова робота',
    streakSub: 'Продовжуй у тому ж дусі.',
    continueLesson: 'Продовжити',
    repeat: 'Повторити',
    locked: 'Відкриється пізніше',
    completedStatus: 'Завершено',
    inProgressStatus: 'У процесі',
    lockedStatus: 'Закрито',
    lesson: 'Lesson',
    theory: 'Theory',
    games: 'Games',
    home: 'Home',
    practice: 'Practice',
    emptyTitle: 'Цей юніт готується',
    emptySubtitle: 'Нові інтерактивні уроки скоро зʼявляться тут.',
  },
};

type Copy = typeof mapCopy.ru;

function percent(done: number, total: number) {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

function themeFor(index: number) {
  return UNIT_THEMES[index % UNIT_THEMES.length];
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-full bg-white/75 shadow-xl shadow-purple-100/70 ring-1 ring-pink-100/80 backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-pink-100/80 hover:ring-pink-200 dark:bg-white/5 dark:ring-purple-400/25 dark:shadow-none dark:hover:bg-white/10 dark:hover:ring-sky-300/45 dark:hover:shadow-lg dark:hover:shadow-sky-500/10"
      style={{ width: 128, height: 128 }}
    >
      <svg className="-rotate-90" viewBox="0 0 100 100" style={{ width: 112, height: 112 }}>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgba(168, 85, 247, 0.12)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="url(#interactiveRing)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="interactiveRing" x1="0" x2="100" y1="0" y2="100">
            <stop offset="0%" stopColor="#ec6aa8" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-3xl font-black text-purple-700 dark:text-purple-100">{value}%</div>
        <div className="font-display text-xs font-bold text-purple-400 dark:text-purple-300">{label}</div>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  value,
  label,
  detail,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  detail?: string;
}) {
  return (
    <div className="rounded-3xl border border-pink-100/80 bg-white/70 p-4 shadow-lg shadow-purple-100/40 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-pink-200 hover:shadow-2xl hover:shadow-pink-100/70 dark:border-purple-400/20 dark:bg-white/5 dark:shadow-none dark:hover:border-sky-300/45 dark:hover:bg-white/10 dark:hover:shadow-lg dark:hover:shadow-sky-500/10">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-purple-500 shadow-sm dark:bg-purple-500/15 dark:text-pink-200">
          {icon}
        </div>
        <div>
          <div className="font-display text-2xl font-black text-purple-700 dark:text-purple-100">{value}</div>
          <div className="font-display text-xs font-bold text-purple-500 dark:text-purple-300">{label}</div>
        </div>
      </div>
      {detail && <div className="mt-3 font-display text-xs font-bold text-purple-400 dark:text-purple-300">{detail}</div>}
    </div>
  );
}

function StatusPill({ state, copy }: { state: 'done' | 'active' | 'locked'; copy: Copy }) {
  const config = {
    done: {
      label: copy.completedStatus,
      icon: <CheckCircle2 className="h-4 w-4" />,
      className: 'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-200 dark:ring-emerald-900',
    },
    active: {
      label: copy.inProgressStatus,
      icon: <Sparkles className="h-4 w-4" />,
      className: 'bg-purple-50 text-purple-600 ring-purple-100 dark:bg-purple-950/70 dark:text-purple-200 dark:ring-purple-900',
    },
    locked: {
      label: copy.lockedStatus,
      icon: <Lock className="h-4 w-4" />,
      className: 'bg-slate-50 text-slate-400 ring-slate-100 dark:bg-slate-900 dark:text-slate-500 dark:ring-slate-800',
    },
  }[state];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
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

  return (
    <motion.button
      type="button"
      whileHover={unlocked ? { y: -3 } : undefined}
      whileTap={unlocked ? { scale: 0.985 } : undefined}
      onClick={() => unlocked && onOpen()}
      className={`relative min-h-48 w-full rounded-3xl border p-4 text-left transition duration-300 hover:-translate-y-1 hover:border-pink-200 hover:shadow-2xl hover:shadow-pink-100/70 dark:hover:border-sky-300/45 dark:hover:bg-white/10 dark:hover:shadow-lg dark:hover:shadow-sky-500/10 sm:w-56 ${
        done
          ? 'border-emerald-100 bg-white shadow-lg shadow-emerald-100/40 dark:border-purple-400/25 dark:bg-white/5'
          : unlocked
            ? 'border-pink-100 bg-white shadow-xl shadow-purple-100/45 dark:border-purple-400/25 dark:bg-white/5'
            : 'cursor-not-allowed border-slate-100 bg-white/70 opacity-60 dark:border-purple-400/15 dark:bg-white/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-purple-400">
            {copy.lesson} {lesson.lesson_number || index + 1}
          </div>
          <h5 className="mt-1 font-display text-xl font-black leading-tight text-purple-800 dark:text-purple-100">
            {lesson.title}
          </h5>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
          done ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-400/10' : unlocked ? 'bg-pink-50 text-pink-500 dark:bg-pink-400/10' : 'bg-slate-50 text-slate-400 dark:bg-white/5'
        }`}>
          {done ? <CheckCircle2 className="h-5 w-5" /> : unlocked ? <BookOpen className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between font-display text-xs font-black">
          <span className={done ? 'text-purple-700 dark:text-purple-100' : unlocked ? 'text-pink-500 dark:text-pink-200' : 'text-purple-300 dark:text-purple-400'}>{progressValue}%</span>
          <span className={done ? 'text-purple-700 dark:text-purple-100' : unlocked ? 'text-pink-500 dark:text-pink-200' : 'text-purple-300 dark:text-purple-400'}>{statusLabel}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-purple-50 dark:bg-white/10">
          <div
            className={done ? 'h-full rounded-full bg-emerald-400' : 'h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-500'}
            style={{ width: `${progressValue}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 font-display text-xs font-black ${
          done
            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-200'
            : unlocked
              ? 'bg-gradient-to-r from-pink-400 to-purple-500 text-white shadow-lg shadow-pink-200/50'
              : 'bg-slate-100 text-slate-400 dark:bg-white/10 dark:text-purple-300'
        }`}>
          {done ? <CheckCircle2 className="h-4 w-4" /> : unlocked ? <PlayCircle className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          {action}
        </span>
        {stars > 0 && (
          <span className="inline-flex items-center gap-1 rounded-2xl bg-yellow-50 px-2.5 py-1.5 font-display text-xs font-black text-yellow-600 dark:bg-yellow-950 dark:text-yellow-200">
            <Star className="h-3.5 w-3.5 fill-current" />
            {stars}
          </span>
        )}
      </div>
    </motion.button>
  );
}

export default function InteractiveLessonMap({ userId, hasAccess, lang = 'ru', onStarsChanged }: {
  userId: string; hasAccess: boolean; lang?: Lang; onStarsChanged?: () => void;
}) {
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [units, setUnits] = useState<Record<string, Unit[]>>({});
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [progress, setProgress] = useState<Record<string, { completed_at: string; stars_awarded: number }>>({});
  const [active, setActive] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [openUnits, setOpenUnits] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    setLoading(true);
    const wbs = await listAvailableWorkbooks(userId);
    setWorkbooks(wbs);
    const u: Record<string, Unit[]> = {};
    const l: Record<string, Lesson[]> = {};
    for (const w of wbs) {
      u[w.id] = await listUnits(w.id);
      for (const un of u[w.id]) l[un.id] = await listLessons(un.id);
    }
    setUnits(u);
    setLessons(l);
    setProgress(await getLessonProgress(userId));
    setOpenUnits(prev => {
      const next = { ...prev };
      Object.values(u).flat().forEach((unit, index) => {
        if (next[unit.id] === undefined) next[unit.id] = index === 0;
      });
      return next;
    });
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [userId]);

  const copy = mapCopy[lang] || mapCopy.ru;

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
        <BookOpen className="mx-auto mb-4 h-12 w-12 text-purple-300" />
        <h3 className="mb-2 font-display text-2xl font-black text-purple-700 dark:text-purple-100">{t(lang, 'map_empty_title')}</h3>
        <p className="text-purple-400 dark:text-purple-200">{t(lang, 'map_empty_desc')}</p>
      </div>
    );
  }

  return (
    <div
      className="space-y-7"
      style={{ fontFamily: 'Nunito, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {workbooks.map(wb => {
        const wbUnits = units[wb.id] || [];
        const wbLessons = wbUnits.flatMap(un => lessons[un.id] || []);
        const doneCount = wbLessons.filter(l => progress[l.id]).length;
        const workbookPercent = percent(doneCount, wbLessons.length);
        const totalStars = wbLessons.reduce((sum, lesson) => sum + (progress[lesson.id]?.stars_awarded || 0), 0);
        const firstPlayable = wbUnits.flatMap(un => {
          const list = lessons[un.id] || [];
          return list.filter((lesson, index) => {
            const previous = list[index - 1];
            return hasAccess && !progress[lesson.id] && (index === 0 || (previous && progress[previous.id]));
          });
        })[0] || wbLessons.find(lesson => progress[lesson.id]) || wbLessons[0] || null;

        return (
          <section key={wb.id} className="space-y-5">
            <div className="overflow-hidden rounded-3xl border border-pink-100/80 bg-gradient-to-br from-pink-50 via-purple-50 to-sky-50 p-6 shadow-2xl shadow-purple-100/60 transition duration-300 hover:-translate-y-1 hover:border-pink-200 hover:shadow-[0_22px_70px_rgba(200,150,220,0.25)] dark:border-purple-400/20 dark:from-[#170823] dark:via-[#200b31] dark:to-[#0e1730] dark:shadow-none dark:hover:border-sky-300/45 dark:hover:shadow-[0_18px_55px_rgba(125,211,252,0.12)]">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
                <div className="min-w-0 flex-1">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pink-100 bg-white/75 px-4 py-2 font-display text-xs font-black uppercase tracking-wide text-pink-500 shadow-sm dark:border-purple-400/20 dark:bg-white/5 dark:text-pink-200">
                    <BookOpen className="h-4 w-4" />
                    {copy.workbook}
                  </div>
                  <h2 className="font-display text-4xl font-black leading-tight text-purple-800 sm:text-5xl dark:text-purple-100">
                    {copy.workbookHeroTitle}
                  </h2>
                  <p className="mt-3 max-w-2xl font-display text-base font-bold leading-relaxed text-purple-500 dark:text-purple-200">
                    {copy.workbookHeroSubtitle}
                  </p>
                  <button
                    type="button"
                    disabled={!firstPlayable}
                    onClick={() => firstPlayable && setActive(firstPlayable)}
                    className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-500 px-5 py-3 font-display text-sm font-black text-white shadow-xl shadow-pink-200/60 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PlayCircle className="h-5 w-5" />
                    {copy.continue}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row xl:items-center">
                  <ProgressRing value={workbookPercent} label={copy.completed} />
                  <div className="grid min-w-64 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <StatTile
                      icon={<Star className="h-6 w-6 fill-yellow-300 text-yellow-400" />}
                      value={totalStars}
                      label={copy.earnedStars}
                      detail={copy.rewards}
                    />
                    <StatTile
                      icon={<Flame className="h-6 w-6 text-pink-500" />}
                      value={copy.streak}
                      label={copy.streakSub}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-purple-100 bg-white/85 p-5 shadow-2xl shadow-purple-100/45 backdrop-blur transition duration-300 hover:border-pink-200 hover:shadow-[0_22px_70px_rgba(200,150,220,0.22)] dark:border-purple-400/20 dark:bg-white/5 dark:shadow-none dark:hover:border-sky-300/45 dark:hover:bg-white/10 dark:hover:shadow-[0_18px_55px_rgba(125,211,252,0.10)]">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50 text-pink-500 shadow-sm dark:bg-purple-500/15 dark:text-pink-200">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-display text-xs font-black uppercase tracking-wide text-pink-400 dark:text-pink-300">{copy.myWorkbook}</div>
                    <h3 className="font-display text-3xl font-black leading-tight text-purple-800 dark:text-purple-100 sm:text-4xl">{wb.title || copy.workbook}</h3>
                  </div>
                </div>
                <div className="rounded-full bg-purple-50 px-4 py-2 font-display text-xs font-black text-purple-500 dark:bg-purple-500/15 dark:text-purple-100">
                  {doneCount}/{wbLessons.length} {copy.completed.toLowerCase()}
                </div>
              </div>

              <div className="space-y-4">
                {wbUnits.map((un, unitIndex) => {
                  const theme = themeFor(unitIndex);
                  const list = lessons[un.id] || [];
                  const unitDone = list.filter(l => progress[l.id]).length;
                  const unitPercent = percent(unitDone, list.length);
                  const unitCompleted = list.length > 0 && unitDone === list.length;
                  const unitLocked = !hasAccess;
                  const unitActive = !unitCompleted && !unitLocked && list.length > 0;
                  const isOpen = openUnits[un.id] ?? unitIndex === 0;
                  const unitTitle = un.title || theme.title;
                  const statusState = unitCompleted ? 'done' : unitLocked ? 'locked' : 'active';

                  return (
                    <motion.article
                      key={un.id}
                      className="overflow-hidden rounded-3xl border border-pink-100 bg-white shadow-lg shadow-purple-100/30 transition duration-300 hover:-translate-y-1 hover:border-pink-200 hover:shadow-2xl hover:shadow-pink-100/60 dark:border-purple-400/20 dark:bg-white/5 dark:shadow-none dark:hover:border-sky-300/45 dark:hover:bg-white/10 dark:hover:shadow-lg dark:hover:shadow-sky-500/10"
                    >
                      <div className="flex flex-col md:flex-row">
                        <aside
                          className="relative overflow-hidden border-b border-pink-100 bg-gradient-to-br from-pink-50/80 via-purple-50/70 to-white p-5 md:w-64 md:border-b-0 md:border-r dark:border-purple-400/15 dark:from-purple-500/10 dark:via-white/5 dark:to-sky-500/5"
                        >
                          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/85 font-display text-3xl font-black shadow-sm ring-1 ring-pink-100 dark:bg-purple-500/15 dark:ring-purple-400/20" style={{ color: theme.accent }}>
                            {unitIndex + 1}
                          </div>
                          <div className="mt-4 font-display text-xs font-black uppercase tracking-wide text-purple-400">{copy.unit} {unitIndex + 1}</div>
                          <h4 className="mt-1 font-display text-2xl font-black text-purple-800 dark:text-purple-100">{unitTitle}</h4>
                        </aside>

                        <div className="min-w-0 flex-1 p-5">
                          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-52 flex-1">
                              <div className="h-2.5 overflow-hidden rounded-full bg-purple-50 dark:bg-white/10">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${unitPercent}%` }}
                                  transition={{ duration: 0.35, ease: 'easeOut' }}
                                  className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-500"
                                />
                              </div>
                              <div className="mt-2 font-display text-xs font-bold text-pink-500 dark:text-pink-300">
                                {copy.progress}: {unitDone} из {list.length} {copy.lessons}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <StatusPill state={statusState} copy={copy} />
                              <button
                                type="button"
                                onClick={() => setOpenUnits(prev => ({ ...prev, [un.id]: !isOpen }))}
                                className="rounded-2xl border border-purple-100 bg-white p-3 text-purple-500 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 hover:text-pink-500 dark:border-purple-400/20 dark:bg-white/5 dark:text-purple-200 dark:hover:border-sky-300/45"
                                aria-label={isOpen ? 'Collapse unit' : 'Open unit'}
                              >
                                <ChevronDown className={`h-5 w-5 transition ${isOpen ? 'rotate-180' : ''}`} />
                              </button>
                            </div>
                          </div>

                          {isOpen && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
                              {list.length === 0 ? (
                                <div className="rounded-3xl border border-dashed border-purple-200 bg-purple-50/50 p-6 dark:border-purple-400/25 dark:bg-white/5">
                                  <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-purple-400 shadow-sm dark:bg-purple-500/15">
                                      <CircleDot className="h-6 w-6" />
                                    </div>
                                    <div>
                                      <h5 className="font-display text-lg font-black text-purple-700 dark:text-purple-100">{copy.emptyTitle}</h5>
                                      <p className="mt-1 text-sm font-semibold text-purple-400 dark:text-purple-200">{copy.emptySubtitle}</p>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="grid gap-3"
                                  style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 224px))', justifyContent: 'start' }}
                                >
                                  {list.map((lesson, lessonIndex) => {
                                    const previous = list[lessonIndex - 1];
                                    const done = !!progress[lesson.id];
                                    const unlocked = hasAccess && (lessonIndex === 0 || (previous && progress[previous.id]));
                                    const progressValue = done ? 100 : 0;

                                    return (
                                      <LessonCard
                                        key={lesson.id}
                                        lesson={lesson}
                                        index={lessonIndex}
                                        copy={copy}
                                        done={done}
                                        unlocked={!!unlocked}
                                        progressValue={progressValue}
                                        onOpen={() => setActive(lesson)}
                                      />
                                    );
                                  })}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>

                        <div className="hidden w-28 items-center justify-center border-l border-pink-100 p-5 xl:flex dark:border-purple-400/15">
                          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                            unitCompleted ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950' : unitActive ? 'bg-purple-50 text-purple-500 dark:bg-purple-950' : 'bg-slate-50 text-slate-400 dark:bg-slate-800'
                          }`}>
                            {unitCompleted ? <Award className="h-7 w-7" /> : unitLocked ? <Lock className="h-6 w-6" /> : <CircleDot className="h-7 w-7" />}
                          </div>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
      {active && (
        <InteractiveLessonRoom
          lesson={active} userId={userId}
          onExit={() => { setActive(null); refresh(); onStarsChanged?.(); }}
          onCompleted={() => { onStarsChanged?.(); }}
        />
      )}
    </div>
  );
}
