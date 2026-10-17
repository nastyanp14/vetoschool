import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Home, Lock, PawPrint, PlayCircle, RefreshCw, Sun, Users, Utensils } from 'lucide-react';
import { Workbook, Unit, Lesson, listAvailableWorkbooks, listUnitsForWorkbooks, listLessonsForUnits, getLessonProgress } from '../lib/workbooks';
import { canReward } from '../lib/mechanics';
import InteractiveLessonRoom from './InteractiveLessonRoom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Lang, t } from '../lib/i18n';
import './InteractiveLessonMap.css';

const copyByLang = {
  en: {
    eyebrow: 'INTERACTIVE', title: 'Interactive units', subtitle: 'Learn English step by step. Take lessons, complete tasks and earn stars!',
    tip: 'Small lessons — big results!', tipText: 'Work through your lessons in order and discover new topics.',
    loading: 'Loading interactive…', error: 'Could not load your lessons.', retry: 'Try again', units: 'Choose a unit',
    lesson: 'Lesson', lessons: 'lessons', progress: 'Unit progress', completed: 'lessons completed', of: 'of',
    continue: 'Continue', start: 'Start', repeat: 'Repeat', locked: 'Locked', done: 'Completed',
    description: 'Learn new words, practise and take the next step in English.',
    rewardTitle: 'Complete your unit and celebrate your progress!', rewardText: 'Complete tasks and collect stars for your work.',
    rewards: 'View rewards', earned: 'Stars earned', rewardInfo: 'Stars earned from completed lessons in this unit.',
    rewardDialogTitle: 'Unit rewards', unitLabel: 'Unit', allCompleted: 'All lessons completed!', greatJob: 'Great job!',
    empty: 'New lessons are coming soon.', emptyUnits: 'Your units are being prepared.', scroll: 'More units',
  },
  ru: {
    eyebrow: 'ИНТЕРАКТИВ', title: 'Интерактивные юниты', subtitle: 'Изучай английский шаг за шагом. Проходи уроки, выполняй задания и получай звёздочки!',
    tip: 'Небольшие уроки — большие результаты!', tipText: 'Проходи уроки последовательно и открывай новые темы.',
    loading: 'Загрузка интерактива…', error: 'Не удалось загрузить уроки.', retry: 'Попробовать снова', units: 'Выбрать юнит',
    lesson: 'Урок', lessons: 'уроков', progress: 'Прогресс юнита', completed: 'уроков завершено', of: 'из',
    continue: 'Продолжить', start: 'Начать', repeat: 'Повторить', locked: 'Заблокировано', done: 'Завершено',
    description: 'Учи новые слова, практикуйся и делай следующий шаг в английском.',
    rewardTitle: 'Заверши юнит и порадуйся своему прогрессу!', rewardText: 'Выполняй задания и собирай звёздочки за свою работу.',
    rewards: 'Смотреть награды', earned: 'Заработано звёзд', rewardInfo: 'Звёзды за пройденные уроки этого юнита',
    rewardDialogTitle: 'Награды за юнит', unitLabel: 'Юнит', allCompleted: 'Все уроки завершены!', greatJob: 'Отличная работа!',
    empty: 'Новые уроки скоро появятся.', emptyUnits: 'Твои юниты готовятся.', scroll: 'Другие юниты',
  },
  ua: {
    eyebrow: 'ІНТЕРАКТИВ', title: 'Інтерактивні юніти', subtitle: 'Вивчай англійську крок за кроком. Проходь уроки, виконуй завдання та отримуй зірочки!',
    tip: 'Невеликі уроки — великі результати!', tipText: 'Проходь уроки послідовно та відкривай нові теми.',
    loading: 'Завантаження інтерактиву…', error: 'Не вдалося завантажити уроки.', retry: 'Спробувати знову', units: 'Обрати юніт',
    lesson: 'Урок', lessons: 'уроків', progress: 'Прогрес юніта', completed: 'уроків завершено', of: 'з',
    continue: 'Продовжити', start: 'Почати', repeat: 'Повторити', locked: 'Заблоковано', done: 'Завершено',
    description: 'Вивчай нові слова, практикуйся та роби наступний крок в англійській.',
    rewardTitle: 'Заверши юніт і відсвяткуй свій прогрес!', rewardText: 'Виконуй завдання та збирай зірочки за свою роботу.',
    rewards: 'Переглянути нагороди', earned: 'Зароблено зірок', rewardInfo: 'Зірки за пройдені уроки цього юніта.',
    rewardDialogTitle: 'Нагороди за юніт', unitLabel: 'Юніт', allCompleted: 'Усі уроки завершено!', greatJob: 'Чудова робота!',
    empty: 'Нові уроки незабаром з’являться.', emptyUnits: 'Твої юніти готуються.', scroll: 'Інші юніти',
  },
};
const GIFT = '/dashboard/interactive/reward-gift.png';
const TROPHY = '/dashboard/interactive/reward-trophy.png';
const REWARD_SCENE = '/dashboard/interactive/reward-owl-reference.png';
const HOME_STICKER = '/dashboard/interactive/unit-home.png';
const RATING_STAR = '/dashboard/rating-user-star.png?v=20260815';
const unitIcons = [Home, Users, Sun, Utensils, Home, PawPrint];
const lessonArt: Record<Lesson['type'], string> = {
  theory: '/dashboard/lessons-header-books.png', class_task: '/dashboard/interactive-tablet.png',
  homework: '/dashboard/homework-notebook.png', practice: '/dashboard/practice-gamepad.png',
  grammar: '/dashboard/grammar-header-book.png', listening: '/dashboard/listening-headphones.png',
  checkpoint: '/dashboard/checkpoint-flag-full.png',
};
export type InteractiveProgress = Record<string, { completed_at: string; stars_awarded: number }>;
type AssignedInteractiveContent = { id: string; interactiveLessonId?: string | null };
const percentage = (done: number, total: number) => total ? Math.round(done / total * 100) : 0;

export function InteractiveHeader({ lang }: { lang: Lang }) {
  const copy = copyByLang[lang];
  return <section className="interactive-units interactive-hero" aria-labelledby="interactive-heading">
    <div className="interactive-hero-copy">
      <h1 id="interactive-heading" className="font-display font-black">{copy.title}</h1>
      <p className="interactive-intro font-body">{copy.subtitle}</p>
    </div>
    <img className="interactive-hero-owl dark:hidden" src="/dashboard/interactive/hero-owl-banner.png" alt="" draggable={false} />
    <img className="interactive-hero-owl hidden dark:block" src="/dashboard/interactive/hero-owl-banner-dark.png" alt="" draggable={false} />
  </section>;
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return <div className="interactive-progress" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    <span style={{ width: `${value}%` }} />
  </div>;
}

export function InteractiveUnits({ units, lessons, progress, hasAccess, lang, onOpen, selectedUnitId, onSelectUnit }: {
  units: Unit[]; lessons: Record<string, Lesson[]>; progress: InteractiveProgress;
  hasAccess: boolean; lang: Lang; onOpen: (lesson: Lesson) => void;
  selectedUnitId?: string | null; onSelectUnit?: (id: string) => void;
}) {
  const copy = copyByLang[lang];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const unit = units.find(item => item.id === (selectedUnitId ?? selectedId)) || units[0];
  if (!unit) return <div className="interactive-units interactive-empty">{copy.emptyUnits}</div>;
  const unitLessons = lessons[unit.id] || [];
  const completed = unitLessons.filter(lesson => progress[lesson.id]).length;
  const percent = percentage(completed, unitLessons.length);
  const earned = unitLessons.reduce(
    (sum, lesson) => canReward(lesson.type)
      ? sum + Math.max(0, Number(progress[lesson.id]?.stars_awarded) || 0)
      : sum,
    0,
  );
  const unlocked = (lesson: Lesson, index: number) => hasAccess && (!!progress[lesson.id] || index === 0 || !!progress[unitLessons[index - 1]?.id]);
  const nextLesson = unitLessons.find((lesson, index) => !progress[lesson.id] && unlocked(lesson, index))
    || unitLessons.find((lesson, index) => unlocked(lesson, index));
  const completionLabel = `${completed} ${copy.of} ${unitLessons.length} ${copy.completed}`;

  return <div className="interactive-units interactive-unit-content">
    <div className="interactive-unit-nav">
      <div className="interactive-unit-strip" ref={strip} role="group" aria-label={copy.units}>
        {units.map((item, index) => {
          const list = lessons[item.id] || [];
          const done = list.filter(lesson => progress[lesson.id]).length;
          const Icon = unitIcons[index % unitIcons.length];
          return <button key={item.id} type="button" aria-pressed={unit.id === item.id}
            className={`interactive-unit-chip interactive-tone-${index % 6}`} onClick={() => { setSelectedId(item.id); onSelectUnit?.(item.id); }}>
            <span className="interactive-unit-icon">
              {index === 0 ? <img src={HOME_STICKER} alt="" aria-hidden="true" /> : <Icon aria-hidden="true" />}
            </span>
            <span className="interactive-unit-chip-copy"><strong>Unit {item.unit_number || index + 1}</strong><span>{item.title}</span>
              <span className="interactive-chip-progress"><ProgressBar value={percentage(done, list.length)} label={`${item.title}: ${copy.progress}`} /><small>{done}/{list.length}</small></span>
            </span>
          </button>;
        })}
      </div>
      {units.length > 1 && <button className="interactive-scroll-next" type="button" aria-label={copy.scroll} onClick={() => {
        const element = strip.current;
        if (element) element.scrollTo({ left: element.scrollLeft + element.clientWidth >= element.scrollWidth - 5 ? 0 : element.scrollLeft + element.clientWidth * .7, behavior: 'smooth' });
      }}><ChevronRight /></button>}
    </div>

    <div className="interactive-learning-grid">
      <article className="interactive-unit-summary">
        <p className="interactive-eyebrow">UNIT {unit.unit_number || units.indexOf(unit) + 1}</p>
        <h2>{unit.title}</h2>
        <p className="interactive-unit-description">{copy.description}</p>
        <div className="interactive-summary-progress"><span>{copy.progress}</span><strong>{completed} {copy.of} {unitLessons.length} {copy.lessons}</strong>
          <div className="interactive-summary-meter"><ProgressBar value={percent} label={copy.progress} /><b>{percent}%</b></div>
        </div>
        <button className="interactive-primary interactive-continue" disabled={!nextLesson} onClick={() => nextLesson && onOpen(nextLesson)}>
          <PlayCircle />{percent === 100 ? copy.repeat : copy.continue}<ChevronRight />
        </button>
      </article>

      <div className="interactive-lesson-grid">
        {unitLessons.map((lesson, index) => {
          const done = !!progress[lesson.id];
          const available = unlocked(lesson, index);
          const stars = Math.max(0, Math.min(5, progress[lesson.id]?.stars_awarded || 0));
          return <article key={lesson.id} className={`interactive-lesson-card ${done ? 'is-complete' : available ? 'is-ready' : 'is-locked'}`}>
            <span className="interactive-lesson-state" aria-label={done ? copy.done : available ? copy.start : copy.locked}>
              {done ? <Check /> : available ? <ChevronRight /> : <Lock />}
            </span>
            <p className="interactive-lesson-number">{copy.lesson} {lesson.lesson_number || index + 1}</p>
            <h3>{lesson.title || `${copy.lesson} ${index + 1}`}</h3>
            <img className="interactive-lesson-art" src={lessonArt[lesson.type] || lessonArt.theory} alt="" draggable={false} />
            <div className="interactive-lesson-footer">
              {canReward(lesson.type) ? <div className="interactive-stars" aria-label={`${copy.earned}: ${stars} / 5`}>
                {[0, 1, 2, 3, 4].map(star => <img key={star} src={RATING_STAR} alt="" aria-hidden="true" className={star < stars ? 'is-earned' : ''} />)}
              </div> : <span className="interactive-lesson-status">{done ? copy.done : ''}</span>}
              <button disabled={!available} onClick={() => onOpen(lesson)} className="interactive-lesson-action">
                {done && <RefreshCw />}{done ? copy.repeat : available ? copy.start : copy.locked}
              </button>
            </div>
          </article>;
        })}
        {!unitLessons.length && <div className="interactive-empty">{copy.empty}</div>}
      </div>
    </div>

    <section className="interactive-reward-banner">
      <img className="interactive-trophy" src={TROPHY} alt="" />
      <div className="interactive-reward-copy"><h2>{copy.rewardTitle}</h2><p>{copy.rewardText}</p></div>
      <div className="interactive-reward-progress">
        <img src={GIFT} alt="" /><div><p>{completionLabel}</p><ProgressBar value={percent} label={copy.progress} /></div>
        <button className="interactive-primary" onClick={() => setRewardsOpen(true)}>{copy.rewards}<ArrowRight /></button>
      </div>
    </section>
    <Dialog open={rewardsOpen} onOpenChange={setRewardsOpen}>
      <DialogContent
        className="interactive-units interactive-rewards-dialog"
        overlayClassName="interactive-rewards-overlay"
      >
        <div className="interactive-rewards-scroll">
          <DialogHeader className="interactive-rewards-heading">
            <DialogTitle>{copy.rewardDialogTitle}</DialogTitle>
            <DialogDescription>{copy.rewardInfo}</DialogDescription>
          </DialogHeader>
          <div className="interactive-rewards-art" aria-hidden="true">
            <img className="interactive-rewards-scene interactive-rewards-scene-light" src={REWARD_SCENE} alt="" draggable={false} />
            <img className="interactive-rewards-scene interactive-rewards-scene-dark" src="/dashboard/interactive/reward-owl-night.png" alt="" draggable={false} />
          </div>
          <div className="interactive-rewards-score">
            <img src={RATING_STAR} alt="" aria-hidden="true" />
            <strong>{earned}</strong>
            <span>{copy.earned}</span>
            <span className="sr-only">{earned} ★</span>
          </div>
          <p className="interactive-rewards-unit"><span className="interactive-rewards-unit-label">{copy.unitLabel}:</span>{' '}<strong>{unit.title}</strong></p>
          <div className="interactive-rewards-meter">
            <ProgressBar value={percent} label={copy.progress} />
            <b>{completed}/{unitLessons.length}</b>
          </div>
          <p className="interactive-rewards-complete"><span><Check /></span>{copy.allCompleted}</p>
          <button type="button" className="interactive-primary interactive-rewards-done" onClick={() => setRewardsOpen(false)}>
            {copy.greatJob}<ArrowRight />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

export default function InteractiveLessonMap({ userId, hasAccess, lang = 'ru', assignedContent = [], onStarsChanged, onContentChanged }: {
  userId: string; hasAccess: boolean; lang?: Lang; assignedContent?: AssignedInteractiveContent[]; onStarsChanged?: () => void; onContentChanged?: () => void;
}) {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [progress, setProgress] = useState<InteractiveProgress>({});
  const [active, setActive] = useState<{ lesson: Lesson; contentItem: AssignedInteractiveContent | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const copy = copyByLang[lang];
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [wbs, nextProgress] = await Promise.all([listAvailableWorkbooks(userId), getLessonProgress(userId)]);
      const unitRows = await listUnitsForWorkbooks(wbs.map(workbook => workbook.id));
      const lessonRows = await listLessonsForUnits(unitRows.map(unit => unit.id));
      setWorkbooks(wbs);
      setUnits(wbs.flatMap(workbook => unitRows.filter(unit => unit.workbook_id === workbook.id)));
      setLessons(Object.fromEntries(unitRows.map(unit => [unit.id, lessonRows.filter(lesson => lesson.unit_id === unit.id)])));
      setProgress(nextProgress);
    } catch { setError(true); } finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (loading) return (
    <div className="interactive-units interactive-loading-card" role="status" aria-live="polite" aria-label={copy.loading}>
      <div className="interactive-loading-visual" aria-hidden="true">
        <img className="interactive-loading-owl" src="/owl/loading-owl-clock.png" alt="" />
      </div>
      <div className="interactive-loading-copy">
        <span className="interactive-loading-eyebrow">{copy.eyebrow}</span>
        <p>{copy.loading}</p>
        <div className="interactive-loading-progress" aria-hidden="true"><span /></div>
      </div>
    </div>
  );
  if (error) return <div className="interactive-units interactive-empty" role="alert"><p>{copy.error}</p><button className="interactive-primary" onClick={() => void refresh()}>{copy.retry}</button></div>;
  if (!workbooks.length) return <div className="interactive-units interactive-empty"><img src="/dashboard/interactive-tablet.png" alt="" width="90" /><h2>{t(lang, 'map_empty_title')}</h2><p>{t(lang, 'map_empty_desc')}</p></div>;
  return <>
    <InteractiveUnits selectedUnitId={selectedUnitId} onSelectUnit={setSelectedUnitId} units={units} lessons={lessons} progress={progress} hasAccess={hasAccess} lang={lang} onOpen={lesson => {
      setActive({ lesson, contentItem: assignedContent.find(item => item.interactiveLessonId === lesson.id) || null });
    }} />
    {active && <InteractiveLessonRoom lesson={active.lesson} userId={userId} contentItemId={active.contentItem?.id || null} lang={lang}
      onExit={() => { setActive(null); void refresh(); onStarsChanged?.(); onContentChanged?.(); }}
      onCompleted={() => { onStarsChanged?.(); onContentChanged?.(); }} />}
  </>;
}
