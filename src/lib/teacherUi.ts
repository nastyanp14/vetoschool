import { Lang } from './i18n';
import { GradeCategory, LessonStatus, TeacherLesson, TeacherRecord, TeacherStatus } from './teachers';

type NameLike = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  name?: string | null;
};

export const missingValue: Record<Lang, string> = {
  ru: 'Не указано',
  ua: 'Не вказано',
  en: 'Not specified',
};

const teacherFallback: Record<Lang, string> = {
  ru: 'Учитель',
  ua: 'Учитель',
  en: 'Teacher',
};

export function teacherDisplayName(teacher?: NameLike | null, lang: Lang = 'ru') {
  const full = [teacher?.firstName, teacher?.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (teacher?.name?.trim()) return teacher.name.trim();
  if (teacher?.email?.trim()) return teacher.email.trim();
  return teacherFallback[lang];
}

export function initialsFor(value?: string | null) {
  const cleaned = (value || '').trim();
  if (!cleaned) return 'T';
  const pieces = cleaned.includes('@') ? [cleaned.split('@')[0]] : cleaned.split(/\s+/);
  return pieces.slice(0, 2).map(piece => piece[0]?.toUpperCase()).join('') || 'T';
}

export function teacherStatusLabel(status: TeacherStatus | string | null | undefined, lang: Lang) {
  const map: Record<Lang, Record<string, string>> = {
    ru: { active: 'Активен', inactive: 'Неактивен', vacation: 'В отпуске', blocked: 'Заблокирован' },
    ua: { active: 'Активний', inactive: 'Неактивний', vacation: 'У відпустці', blocked: 'Заблокований' },
    en: { active: 'Active', inactive: 'Inactive', vacation: 'On vacation', blocked: 'Blocked' },
  };
  return map[lang][status || ''] || missingValue[lang];
}

export function studentStatusLabel(status: string | null | undefined, lang: Lang) {
  const map: Record<Lang, Record<string, string>> = {
    ru: { active: 'Активен', pending: 'Ожидает активации', paused: 'На паузе', inactive: 'Неактивен', trial: 'Пробный', completed: 'Завершил' },
    ua: { active: 'Активний', pending: 'Очікує активації', paused: 'На паузі', inactive: 'Неактивний', trial: 'Пробний', completed: 'Завершив' },
    en: { active: 'Active', pending: 'Pending activation', paused: 'Paused', inactive: 'Inactive', trial: 'Trial', completed: 'Completed' },
  };
  return map[lang][status || ''] || missingValue[lang];
}

export function lessonStatusLabel(status: LessonStatus | string | null | undefined, lang: Lang) {
  const map: Record<Lang, Record<string, string>> = {
    ru: {
      scheduled: 'Запланирован',
      completed: 'Проведён',
      cancelled: 'Отменён',
      rescheduled: 'Перенесён',
      student_absent: 'Ученик отсутствовал',
      teacher_absent: 'Учитель отсутствовал',
    },
    ua: {
      scheduled: 'Запланований',
      completed: 'Проведений',
      cancelled: 'Скасований',
      rescheduled: 'Перенесений',
      student_absent: 'Учень був відсутній',
      teacher_absent: 'Учитель був відсутній',
    },
    en: {
      scheduled: 'Scheduled',
      completed: 'Completed',
      cancelled: 'Cancelled',
      rescheduled: 'Rescheduled',
      student_absent: 'Student absent',
      teacher_absent: 'Teacher absent',
    },
  };
  return map[lang][status || ''] || missingValue[lang];
}

export function gradeCategoryLabel(category: GradeCategory | string | null | undefined, lang: Lang) {
  const map: Record<Lang, Record<string, string>> = {
    ru: { Participation: 'Участие', Speaking: 'Говорение', Grammar: 'Грамматика', Listening: 'Аудирование', Homework: 'Домашняя работа' },
    ua: { Participation: 'Участь', Speaking: 'Мовлення', Grammar: 'Граматика', Listening: 'Аудіювання', Homework: 'Домашня робота' },
    en: { Participation: 'Participation', Speaking: 'Speaking', Grammar: 'Grammar', Listening: 'Listening', Homework: 'Homework' },
  };
  return map[lang][category || ''] || missingValue[lang];
}

export function formatTeacherDate(value: string | null | undefined, lang: Lang, withTime = true) {
  if (!value) return missingValue[lang];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale = lang === 'ua' ? 'uk-UA' : lang === 'en' ? 'en-GB' : 'ru-RU';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function formatLessonMoment(lesson: TeacherLesson | null | undefined, lang: Lang) {
  if (!lesson) return missingValue[lang];
  if (lesson.date) {
    const value = lesson.time ? `${lesson.date}T${lesson.time}` : lesson.date;
    return formatTeacherDate(value, lang, Boolean(lesson.time));
  }
  return [lesson.day, lesson.time].filter(Boolean).join(', ') || missingValue[lang];
}

export function teacherAvatarAlt(teacher: TeacherRecord | null | undefined, lang: Lang) {
  return teacherDisplayName(teacher, lang);
}
