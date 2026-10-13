import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  Lock,
  Play,
  RotateCcw,
  Star,
} from 'lucide-react';
import {
  type Lesson,
  type Unit,
  type Workbook,
  getLessonProgress,
  listAvailableWorkbooks,
  listLessonsForUnits,
  listUnitsForWorkbooks,
} from '../lib/workbooks';
import { canReward } from '../lib/mechanics';
import {
  isActiveScheduleSlot,
  scheduleSlotTimeValue,
  type ScheduleSlot,
} from '../lib/schedule';
import InteractiveLessonRoom from './InteractiveLessonRoom';
import { type Lang, t } from '../lib/i18n';

const mapCopy = {
  ru: {
    loading: 'Загрузка интерактива...',
    title: 'Интерактивная тетрадь',
    subtitle: 'Учись, играй и открывай новое!',
    yourProgress: 'Твой прогресс',
    lessonsCompleted: 'уроков завершено',
    of: 'из',
    nextLesson: 'Следующее занятие',
    noNextLesson: 'Ближайших занятий пока нет',
    noNextLessonHint: 'Новое занятие появится здесь после добавления в расписание.',
    onlineLesson: 'Онлайн-занятие',
    schedule: 'К расписанию',
    unitsTitle: 'Твои юниты',
    unit: 'UNIT',
    lesson: 'УРОК',
    lessons: 'урока',
    completed: 'Завершено',
    selectUnit: 'Выбрать юнит',
    lessonsTitle: 'Уроки юнита',
    notStarted: 'Не начато',
    inProgress: 'В процессе',
    locked: 'Откроется позже',
    start: 'Начать',
    continue: 'Продолжить',
    repeat: 'Повторить',
    reward: 'зв.',
  },
  en: {
    loading: 'Loading interactive...',
    title: 'Interactive workbook',
    subtitle: 'Learn, play and discover something new!',
    yourProgress: 'Your progress',
    lessonsCompleted: 'lessons completed',
    of: 'of',
    nextLesson: 'Next lesson',
    noNextLesson: 'No upcoming lessons yet',
    noNextLessonHint: 'A new lesson will appear here once it is added to your schedule.',
    onlineLesson: 'Online lesson',
    schedule: 'View schedule',
    unitsTitle: 'Your units',
    unit: 'UNIT',
    lesson: 'LESSON',
    lessons: 'lessons',
    completed: 'Completed',
    selectUnit: 'Select unit',
    lessonsTitle: 'Unit lessons',
    notStarted: 'Not started',
    inProgress: 'In progress',
    locked: 'Unlocks later',
    start: 'Start',
    continue: 'Continue',
    repeat: 'Repeat',
    reward: 'stars',
  },
  ua: {
    loading: 'Завантаження інтерактиву...',
    title: 'Інтерактивний зошит',
    subtitle: 'Навчайся, грай та відкривай нове!',
    yourProgress: 'Твій прогрес',
    lessonsCompleted: 'уроків завершено',
    of: 'із',
    nextLesson: 'Наступне заняття',
    noNextLesson: 'Найближчих занять поки немає',
    noNextLessonHint: 'Нове заняття зʼявиться тут після додавання до розкладу.',
    onlineLesson: 'Онлайн-заняття',
    schedule: 'До розкладу',
    unitsTitle: 'Твої юніти',
    unit: 'UNIT',
    lesson: 'УРОК',
    lessons: 'уроки',
    completed: 'Завершено',
    selectUnit: 'Обрати юніт',
    lessonsTitle: 'Уроки юніта',
    notStarted: 'Не розпочато',
    inProgress: 'У процесі',
    locked: 'Відкриється пізніше',
    start: 'Розпочати',
    continue: 'Продовжити',
    repeat: 'Повторити',
    reward: 'зір.',
  },
};

type Copy = typeof mapCopy.ru;
type AssignedInteractiveContent = {
  id: string;
  interactiveLessonId?: string | null;
  interactiveCompletedAt?: string | null;
  interactiveScorePercent?: number | null;
};

type InteractiveLessonMapProps = {
  userId: string;
  hasAccess: boolean;
  lang?: Lang;
  assignedContent?: AssignedInteractiveContent[];
  schedule?: ScheduleSlot[];
  onOpenSchedule?: () => void;
  onStarsChanged?: () => void;
  onContentChanged?: () => void;
};

function percent(done: number, total: number) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function localeFor(lang: Lang) {
  if (lang === 'ua') return 'uk-UA';
  if (lang === 'en') return 'en-GB';
  return 'ru-RU';
}

function formatScheduleDate(slot: ScheduleSlot, lang: Lang) {
  if (!slot.date) return slot.day;
  const date = new Date(`${slot.date}T12:00:00`);
  if (Number.isNaN(date.getTime())) return slot.day || slot.date;
  return new Intl.DateTimeFormat(localeFor(lang), { day: 'numeric', month: 'long' }).format(date);
}

function formatTimeRange(slot: ScheduleSlot) {
  const start = slot.time || '';
  const [hours, minutes] = start.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return start;
  const endMinutes = hours * 60 + minutes + (slot.durationMinutes || 45);
  return `${start}–${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
}

function unitLabel(copy: Copy, unit: Unit) {
  return `${copy.unit} ${unit.unit_number || unit.order || 1}`;
}

function LessonCard({ lesson, index, copy, done, inProgress, unlocked, onOpen }: {
  lesson: Lesson;
  index: number;
  copy: Copy;
  done: boolean;
  inProgress: boolean;
  unlocked: boolean;
  onOpen: () => void;
}) {
  const lessonNumber = lesson.lesson_number || index + 1;
  const reward = canReward(lesson.type) ? lesson.stars_reward : 0;
  const statusLabel = done ? copy.completed : inProgress ? copy.inProgress : unlocked ? copy.notStarted : copy.locked;
  const actionLabel = done ? copy.repeat : inProgress ? copy.continue : unlocked ? copy.start : copy.locked;
  const ActionIcon = done ? RotateCcw : unlocked ? Play : Lock;

  return (
    <motion.article
      whileHover={unlocked ? { y: -3 } : undefined}
      transition={{ duration: 0.18 }}
      className={`interactive-lesson-card${done ? ' is-complete' : ''}${unlocked ? '' : ' is-locked'}`}
    >
      <div className="interactive-lesson-card__topline">
        <span className="interactive-lesson-card__number">{copy.lesson} {lessonNumber}</span>
        {done && reward > 0 && (
          <span className="interactive-lesson-card__reward" aria-label={`${reward} ${copy.reward}`}>
            <Star aria-hidden="true" /> {reward}
          </span>
        )}
      </div>
      <div className="interactive-lesson-card__icon" aria-hidden="true">
        {done ? <CheckCircle2 /> : unlocked ? <BookOpen /> : <Lock />}
      </div>
      <h4>{lesson.title || `${copy.lessonsTitle} ${lessonNumber}`}</h4>
      <span className={`interactive-lesson-status${done ? ' is-complete' : ''}${unlocked ? '' : ' is-locked'}`}>
        {done && <Check aria-hidden="true" />}
        {statusLabel}
      </span>
      <button type="button" onClick={onOpen} disabled={!unlocked}>
        <span>{actionLabel}</span>
        <ActionIcon aria-hidden="true" />
      </button>
    </motion.article>
  );
}

export default function InteractiveLessonMap({
  userId,
  hasAccess,
  lang = 'ru',
  assignedContent = [],
  schedule = [],
  onOpenSchedule,
  onStarsChanged,
  onContentChanged,
}: InteractiveLessonMapProps) {
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [units, setUnits] = useState<Record<string, Unit[]>>({});
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [progress, setProgress] = useState<Record<string, { completed_at: string; stars_awarded: number }>>({});
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [active, setActive] = useState<{ lesson: Lesson; contentItem: AssignedInteractiveContent | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [nextWorkbooks, nextProgress] = await Promise.all([
      listAvailableWorkbooks(userId),
      getLessonProgress(userId),
    ]);
    const unitRows = await listUnitsForWorkbooks(nextWorkbooks.map(workbook => workbook.id));
    const lessonRows = await listLessonsForUnits(unitRows.map(unit => unit.id));
    const nextUnits = Object.fromEntries(nextWorkbooks.map(workbook => [
      workbook.id,
      unitRows.filter(unit => unit.workbook_id === workbook.id),
    ]));
    const nextLessons = Object.fromEntries(unitRows.map(unit => [
      unit.id,
      lessonRows.filter(lesson => lesson.unit_id === unit.id),
    ]));

    setWorkbooks(nextWorkbooks);
    setUnits(nextUnits);
    setLessons(nextLessons);
    setProgress(nextProgress);
    setActiveUnitId(current => unitRows.some(unit => unit.id === current) ? current : unitRows[0]?.id || null);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const copy = mapCopy[lang] || mapCopy.ru;
  const allUnits = useMemo(() => workbooks.flatMap(workbook => units[workbook.id] || []), [units, workbooks]);
  const allLessons = useMemo(() => allUnits.flatMap(unit => lessons[unit.id] || []), [allUnits, lessons]);
  const selectedUnit = allUnits.find(unit => unit.id === activeUnitId) || allUnits[0] || null;
  const selectedLessons = selectedUnit ? lessons[selectedUnit.id] || [] : [];
  const doneCount = allLessons.filter(lesson => !!progress[lesson.id]).length;
  const overallPercent = percent(doneCount, allLessons.length);
  const nextScheduleSlot = useMemo(() => [...schedule]
    .filter(isActiveScheduleSlot)
    .filter(slot => !slot.date || scheduleSlotTimeValue(slot) >= Date.now())
    .sort((a, b) => scheduleSlotTimeValue(a) - scheduleSlotTimeValue(b))[0] || null, [schedule]);
  const contentByLessonId = useMemo(() => new Map(assignedContent
    .filter(item => item.interactiveLessonId)
    .map(item => [item.interactiveLessonId as string, item])), [assignedContent]);

  const openLesson = (lesson: Lesson) => {
    setActive({ lesson, contentItem: contentByLessonId.get(lesson.id) || null });
  };

  if (loading) {
    return (
      <div className="interactive-loading" role="status">
        <Loader2 aria-hidden="true" />
        {copy.loading}
      </div>
    );
  }

  if (workbooks.length === 0) {
    return (
      <div className="interactive-empty-state">
        <img src="/dashboard/interactive-tablet.png" alt="" aria-hidden="true" />
        <h3>{t(lang, 'map_empty_title')}</h3>
        <p>{t(lang, 'map_empty_desc')}</p>
      </div>
    );
  }

  return (
    <div className="interactive-dashboard-shell" data-testid="interactive-dashboard">
      <section className="interactive-welcome" aria-labelledby="interactive-welcome-title">
        <div className="interactive-welcome__content">
          <span className="interactive-welcome__eyebrow">VETOSCHOOL</span>
          <h2 id="interactive-welcome-title">{copy.title}</h2>
          <p>{copy.subtitle}</p>
          <div className="interactive-overall-progress">
            <div className="interactive-overall-progress__label">
              <span>{copy.yourProgress}</span>
              <strong>{doneCount} {copy.of} {allLessons.length} {copy.lessonsCompleted}</strong>
            </div>
            <div className="interactive-progress-track" role="progressbar" aria-label={copy.yourProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={overallPercent}>
              <span style={{ width: `${overallPercent}%` }} />
            </div>
          </div>
        </div>
        <img className="interactive-welcome__owl" src="/owl/hero-owl-headphones.png" alt="" aria-hidden="true" />
      </section>

      <section className="interactive-next-lesson" aria-labelledby="interactive-next-lesson-title">
        <span className="interactive-next-lesson__icon" aria-hidden="true"><CalendarDays /></span>
        <div className="interactive-next-lesson__content">
          <h3 id="interactive-next-lesson-title">{copy.nextLesson}</h3>
          {nextScheduleSlot ? (
            <>
              <p className="interactive-next-lesson__time"><Clock3 aria-hidden="true" />{formatScheduleDate(nextScheduleSlot, lang)} · {formatTimeRange(nextScheduleSlot)}</p>
              <p className="interactive-next-lesson__topic">{nextScheduleSlot.topic || copy.onlineLesson}</p>
            </>
          ) : (
            <>
              <p className="interactive-next-lesson__topic">{copy.noNextLesson}</p>
              <p className="interactive-next-lesson__empty">{copy.noNextLessonHint}</p>
            </>
          )}
        </div>
        <button type="button" onClick={onOpenSchedule} disabled={!onOpenSchedule}>{copy.schedule}<ArrowRight aria-hidden="true" /></button>
      </section>

      <section className="interactive-units" aria-labelledby="interactive-units-title">
        <div className="interactive-section-heading">
          <div><span>{copy.selectUnit}</span><h3 id="interactive-units-title">{copy.unitsTitle}</h3></div>
        </div>
        <div className="interactive-unit-grid">
          {allUnits.map(unit => {
            const unitLessons = lessons[unit.id] || [];
            const completed = unitLessons.filter(lesson => !!progress[lesson.id]).length;
            const unitPercent = percent(completed, unitLessons.length);
            const isSelected = unit.id === selectedUnit?.id;
            return (
              <button key={unit.id} type="button" aria-pressed={isSelected} className={`interactive-unit-card${isSelected ? ' is-active' : ''}`} onClick={() => setActiveUnitId(unit.id)}>
                <span className="interactive-unit-card__label">{unitLabel(copy, unit)}</span>
                <strong>{unit.title}</strong>
                <span className="interactive-unit-card__meta">{unitLessons.length} {copy.lessons} · {completed === unitLessons.length && unitLessons.length > 0 ? copy.completed : `${completed}/${unitLessons.length}`}</span>
                <span className="interactive-unit-card__progress" aria-hidden="true"><i style={{ width: `${unitPercent}%` }} /></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="interactive-lessons" aria-labelledby="interactive-lessons-title">
        <div className="interactive-section-heading interactive-section-heading--lessons">
          <div><span>{selectedUnit ? unitLabel(copy, selectedUnit) : copy.unit}</span><h3 id="interactive-lessons-title">{selectedUnit?.title || copy.lessonsTitle}</h3></div>
          {selectedUnit && <p>{selectedLessons.filter(lesson => !!progress[lesson.id]).length} / {selectedLessons.length} {copy.lessonsCompleted}</p>}
        </div>
        <div className="interactive-lesson-grid">
          {selectedLessons.map((lesson, index) => {
            const previous = selectedLessons[index - 1];
            const contentItem = contentByLessonId.get(lesson.id);
            const done = !!progress[lesson.id] || !!contentItem?.interactiveCompletedAt;
            const inProgress = !done && Number(contentItem?.interactiveScorePercent || 0) > 0;
            const unlocked = hasAccess && (index === 0 || !!(previous && progress[previous.id]));
            return <LessonCard key={lesson.id} lesson={lesson} index={index} copy={copy} done={done} inProgress={inProgress} unlocked={unlocked} onOpen={() => openLesson(lesson)} />;
          })}
        </div>
      </section>

      {active && (
        <InteractiveLessonRoom
          lesson={active.lesson}
          userId={userId}
          contentItemId={active.contentItem?.id || null}
          lang={lang}
          onExit={() => { setActive(null); void refresh(); onStarsChanged?.(); onContentChanged?.(); }}
          onCompleted={() => { onStarsChanged?.(); onContentChanged?.(); }}
        />
      )}
    </div>
  );
}
