// Единый реестр шаблонов уведомлений Vetoschool (Telegram + Email).
// Никаких текстов сообщений вне этого файла.

export type NotifyLang = 'ru' | 'ua' | 'en';
export type NotifyChannel = 'telegram' | 'email';
export type NotifyRole = 'parent' | 'student' | 'teacher' | 'admin';

export const APP_TIMEZONE = 'Europe/Prague';

export type NotificationEvent =
  | 'telegram_connected'
  | 'trial_request_created'
  | 'trial_request_confirmed'
  | 'trial_reminder_24h'
  | 'trial_reminder_1h'
  | 'trial_reminder_10m'
  | 'trial_request_rescheduled'
  | 'trial_request_cancelled'
  | 'trial_request_no_show'
  | 'trial_request_completed'
  | 'trial_recommendation_ready'
  | 'trial_request_converted'
  | 'lesson_scheduled'
  | 'lesson_reminder_24h'
  | 'lesson_reminder_1h'
  | 'lesson_reminder_10m'
  | 'lesson_rescheduled'
  | 'lesson_cancelled'
  | 'lesson_completed'
  | 'lesson_no_show'
  | 'homework_assigned'
  | 'homework_submitted'
  | 'homework_updated'
  | 'homework_cancelled'
  | 'lesson_result_published'
  | 'grade_published'
  | 'grade_updated'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'subscription_cancelled'
  | 'subscription_ended'
  | 'lessons_low_balance'
  | 'weekly_progress_summary';

export type NotifyVars = Record<string, string | number | null | undefined>;

export interface RenderedMessage {
  /** Готовый текст Telegram-сообщения (HTML parse_mode). */
  text: string;
  /** Тема письма (для email-канала). */
  subject: string;
  /** Заголовок письма/сообщения без эмодзи-строки. */
  title: string;
  /** Строки основного блока — удобны для email-карточки. */
  lines: string[];
  /** Кнопки действия, соответствующие событию. */
  buttons: { label: string; url: string }[];
}

/* ---------------------------------------------------------------- utils */

export function pickLang(value?: string | null): NotifyLang {
  const normalized = (value || '').toLowerCase();
  if (normalized.startsWith('ua') || normalized.startsWith('uk')) return 'ua';
  if (normalized.startsWith('en')) return 'en';
  return 'ru';
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Безопасная подстановка {var} — значения всегда экранируются. */
export function fill(template: string, vars: NotifyVars): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name];
    return value === undefined || value === null || value === '' ? '' : escapeHtml(value);
  });
}

const LOCALES: Record<NotifyLang, string> = { ru: 'ru-RU', ua: 'uk-UA', en: 'en-GB' };

function zoned(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** «5 августа 2026» / «5 серпня 2026» / «5 August 2026» */
export function formatDate(value?: string | Date | null, lang: NotifyLang = 'ru', timeZone = APP_TIMEZONE) {
  if (!value) return '';
  const date = zoned(value, timeZone);
  if (!date) return String(value);
  // «5 августа 2026», без технического «г.»
  return new Intl.DateTimeFormat(LOCALES[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone })
    .format(date)
    .replace(/\s*(г\.|р\.)$/u, '')
    .trim();
}

/** «14:00» */
export function formatTime(value?: string | Date | null, lang: NotifyLang = 'ru', timeZone = APP_TIMEZONE) {
  if (!value) return '';
  const date = zoned(value, timeZone);
  if (!date) return String(value);
  return new Intl.DateTimeFormat(LOCALES[lang], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(date);
}

function dayKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(date);
}

const RELATIVE: Record<NotifyLang, { today: string; tomorrow: string; at: string; on: string }> = {
  ru: { today: 'Сегодня', tomorrow: 'Завтра', at: 'в', on: '' },
  ua: { today: 'Сьогодні', tomorrow: 'Завтра', at: 'о', on: '' },
  en: { today: 'Today', tomorrow: 'Tomorrow', at: 'at', on: 'on' },
};

/** Грамматически корректно: «Сегодня, 5 августа, в 15:57» / «Завтра, 6 августа, в 14:00». */
export function formatWhen(
  value?: string | Date | null,
  lang: NotifyLang = 'ru',
  now: Date = new Date(),
  timeZone = APP_TIMEZONE,
) {
  if (!value) return '';
  const date = zoned(value, timeZone);
  if (!date) return String(value);
  const words = RELATIVE[lang];
  const time = formatTime(date, lang, timeZone);
  const dayLabel = new Intl.DateTimeFormat(LOCALES[lang], { day: 'numeric', month: 'long', timeZone }).format(date);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60_000);
  if (dayKey(date, timeZone) === dayKey(now, timeZone)) return `${words.today}, ${dayLabel}, ${words.at} ${time}`;
  if (dayKey(date, timeZone) === dayKey(tomorrow, timeZone)) return `${words.tomorrow}, ${dayLabel}, ${words.at} ${time}`;
  const full = formatDate(date, lang, timeZone);
  return lang === 'en' ? `${words.on} ${full} ${words.at} ${time}` : `${full}, ${words.at} ${time}`;
}

/* --------------------------------------------------------- button labels */

export type ButtonKey =
  | 'open_request' | 'confirm_lesson' | 'join_lesson' | 'add_to_calendar' | 'reschedule_lesson'
  | 'open_schedule' | 'open_homework' | 'check_homework' | 'open_result' | 'fill_recommendation'
  | 'continue_learning' | 'choose_plan' | 'manage_subscription' | 'update_payment' | 'open_student'
  | 'contact_school' | 'open_lesson' | 'notification_settings' | 'open_progress' | 'open_plan'
  | 'offer_reschedule' | 'view_recommendation' | 'open_info';

export const BUTTON_LABELS: Record<ButtonKey, Record<NotifyLang, string>> = {
  open_request: { ru: 'Открыть заявку', ua: 'Відкрити заявку', en: 'Open request' },
  confirm_lesson: { ru: 'Подтвердить урок', ua: 'Підтвердити урок', en: 'Confirm lesson' },
  join_lesson: { ru: 'Присоединиться к уроку', ua: 'Приєднатися до уроку', en: 'Join the lesson' },
  add_to_calendar: { ru: 'Добавить в календарь', ua: 'Додати в календар', en: 'Add to calendar' },
  reschedule_lesson: { ru: 'Перенести урок', ua: 'Перенести урок', en: 'Reschedule lesson' },
  open_schedule: { ru: 'Открыть расписание', ua: 'Відкрити розклад', en: 'Open schedule' },
  open_homework: { ru: 'Открыть задание', ua: 'Відкрити завдання', en: 'Open homework' },
  check_homework: { ru: 'Проверить задание', ua: 'Перевірити завдання', en: 'Review homework' },
  open_result: { ru: 'Посмотреть результат', ua: 'Переглянути результат', en: 'View result' },
  fill_recommendation: { ru: 'Заполнить результат', ua: 'Заповнити результат', en: 'Fill in the result' },
  continue_learning: { ru: 'Продолжить обучение', ua: 'Продовжити навчання', en: 'Continue learning' },
  choose_plan: { ru: 'Выбрать тариф', ua: 'Обрати тариф', en: 'Choose a plan' },
  manage_subscription: { ru: 'Управление подпиской', ua: 'Керування підпискою', en: 'Manage subscription' },
  update_payment: { ru: 'Обновить способ оплаты', ua: 'Оновити спосіб оплати', en: 'Update payment method' },
  open_student: { ru: 'Открыть ученика', ua: 'Відкрити учня', en: 'Open student' },
  contact_school: { ru: 'Связаться со школой', ua: "Зв'язатися зі школою", en: 'Contact the school' },
  open_lesson: { ru: 'Открыть урок', ua: 'Відкрити урок', en: 'Open lesson' },
  notification_settings: { ru: '⚙️ Настройки уведомлений', ua: '⚙️ Налаштування сповіщень', en: '⚙️ Notification settings' },
  open_progress: { ru: 'Посмотреть прогресс', ua: 'Переглянути прогрес', en: 'View progress' },
  open_plan: { ru: 'Открыть тариф', ua: 'Відкрити тариф', en: 'Open plan' },
  offer_reschedule: { ru: 'Предложить перенос', ua: 'Запропонувати перенесення', en: 'Offer a new time' },
  view_recommendation: { ru: 'Посмотреть рекомендацию', ua: 'Переглянути рекомендацію', en: 'View recommendation' },
  open_info: { ru: 'Открыть информацию', ua: 'Відкрити інформацію', en: 'Open details' },
};

export function buttonLabel(key: ButtonKey, lang: NotifyLang) {
  return BUTTON_LABELS[key]?.[lang] || BUTTON_LABELS[key]?.ru || key;
}

/* ------------------------------------------------------------- templates */

interface TemplateDef {
  /** Заголовок с эмодзи. */
  title: Record<NotifyLang, string>;
  /** Тема письма; по умолчанию — заголовок без эмодзи. */
  subject?: Record<NotifyLang, string>;
  /** Строки тела: поддерживают {vars}; пустая строка = визуальный разрыв блока. */
  body: Record<NotifyLang, string[]>;
  /** Кнопки: url берётся из vars по имени поля. */
  buttons: { key: ButtonKey; urlVar: string }[];
  /** Критические уведомления нельзя отключить в настройках. */
  critical?: boolean;
  /** Настройка родителя, управляющая событием. */
  preference?: 'lessons' | 'homework' | 'grades' | 'schedule' | 'billing' | 'trials' | 'weekly';
}

type Registry = Partial<Record<NotificationEvent, Partial<Record<NotifyRole, TemplateDef>>>>;

const L = (ru: string, ua: string, en: string): Record<NotifyLang, string> => ({ ru, ua, en });
const B = (ru: string[], ua: string[], en: string[]): Record<NotifyLang, string[]> => ({ ru, ua, en });

export const NOTIFICATION_TEMPLATES: Registry = {
  telegram_connected: {
    parent: {
      title: L('✅ Telegram подключён', '✅ Telegram підключено', '✅ Telegram connected'),
      body: B(
        ['Теперь вы будете получать уведомления Vetoschool об уроках, расписании, домашних заданиях, оценках и тарифе.', '', 'Ученик: <b>{student_name}</b>', '', '✅ Напоминания об уроках\n✅ Домашние задания\n✅ Оценки\n✅ Переносы и отмены\n💳 Оплата и тариф\n🎓 Пробные уроки'],
        ['Тепер ви отримуватимете сповіщення Vetoschool про уроки, розклад, домашні завдання, оцінки та тариф.', '', 'Учень: <b>{student_name}</b>', '', '✅ Нагадування про уроки\n✅ Домашні завдання\n✅ Оцінки\n✅ Перенесення та скасування\n💳 Оплата та тариф\n🎓 Пробні уроки'],
        ['You will now receive Vetoschool updates about lessons, schedule, homework, grades and billing.', '', 'Student: <b>{student_name}</b>', '', '✅ Lesson reminders\n✅ Homework\n✅ Grades\n✅ Reschedules and cancellations\n💳 Payments and plan\n🎓 Trial lessons'],
      ),
      buttons: [{ key: 'notification_settings', urlVar: 'settings_url' }],
      critical: true,
    },
  },

  trial_request_created: {
    admin: {
      title: L('🆕 Новая заявка на пробный урок', '🆕 Нова заявка на пробний урок', '🆕 New trial lesson request'),
      body: B(
        ['👦 Ученик: {child_name}', '🎂 Возраст: {child_age}', '🏫 Класс: {school_grade}', '📊 Предварительный уровень: {recommended_level}', '🌍 Язык общения: {communication_language}', '', '📅 Желаемая дата: {preferred_date}', '🕒 Желаемое время: {preferred_time}', '', '👤 Родитель: {parent_name}', '📧 Email: {parent_email}', '📱 Телефон: {parent_phone}'],
        ['👦 Учень: {child_name}', '🎂 Вік: {child_age}', '🏫 Клас: {school_grade}', '📊 Попередній рівень: {recommended_level}', '🌍 Мова спілкування: {communication_language}', '', '📅 Бажана дата: {preferred_date}', '🕒 Бажаний час: {preferred_time}', '', '👤 Батьки: {parent_name}', '📧 Email: {parent_email}', '📱 Телефон: {parent_phone}'],
        ['👦 Student: {child_name}', '🎂 Age: {child_age}', '🏫 Grade: {school_grade}', '📊 Preliminary level: {recommended_level}', '🌍 Language: {communication_language}', '', '📅 Preferred date: {preferred_date}', '🕒 Preferred time: {preferred_time}', '', '👤 Parent: {parent_name}', '📧 Email: {parent_email}', '📱 Phone: {parent_phone}'],
      ),
      buttons: [{ key: 'open_request', urlVar: 'request_url' }],
      preference: 'trials',
    },
    parent: {
      title: L('Мы получили вашу заявку 🎉', 'Ми отримали вашу заявку 🎉', 'We received your request 🎉'),
      subject: L('Мы получили вашу заявку на пробный урок Vetoschool', 'Ми отримали вашу заявку на пробний урок Vetoschool', 'We received your Vetoschool trial lesson request'),
      body: B(
        ['Здравствуйте, {parent_name}!', 'Спасибо за запись {child_name} на бесплатный пробный урок. Мы получили заявку и проверяем выбранные дату и время.', '', 'Ученик: {child_name}\nПредварительный уровень: {recommended_level}\nДата: {preferred_date}\nВремя: {preferred_time}', '', 'В течение 24 часов администратор подтвердит занятие и пришлёт подробности.'],
        ['Вітаємо, {parent_name}!', 'Дякуємо за запис {child_name} на безкоштовний пробний урок. Ми отримали заявку та перевіряємо обрані дату й час.', '', 'Учень: {child_name}\nПопередній рівень: {recommended_level}\nДата: {preferred_date}\nЧас: {preferred_time}', '', 'Протягом 24 годин адміністратор підтвердить заняття та надішле деталі.'],
        ['Hello {parent_name}!', 'Thank you for booking a free trial lesson for {child_name}. We have received your request and are checking the selected date and time.', '', 'Student: {child_name}\nPreliminary level: {recommended_level}\nDate: {preferred_date}\nTime: {preferred_time}', '', 'An administrator will confirm the lesson within 24 hours and send you the details.'],
      ),
      buttons: [{ key: 'open_request', urlVar: 'request_url' }],
      preference: 'trials',
    },
  },

  trial_request_confirmed: {
    parent: {
      title: L('✅ Пробный урок подтверждён', '✅ Пробний урок підтверджено', '✅ Trial lesson confirmed'),
      subject: L('Пробный урок {child_name} подтверждён', 'Пробний урок {child_name} підтверджено', 'Trial lesson for {child_name} is confirmed'),
      body: B(
        ['👦 Ученик: {child_name}', '📅 Дата: {lesson_date}', '🕒 Время: {lesson_time}', '👩‍🏫 Преподаватель: {teacher_name}', '🌍 Язык занятия: {lesson_language}', '', 'Ссылка на урок уже готова.'],
        ['👦 Учень: {child_name}', '📅 Дата: {lesson_date}', '🕒 Час: {lesson_time}', '👩‍🏫 Викладач: {teacher_name}', '🌍 Мова заняття: {lesson_language}', '', 'Посилання на урок уже готове.'],
        ['👦 Student: {child_name}', '📅 Date: {lesson_date}', '🕒 Time: {lesson_time}', '👩‍🏫 Teacher: {teacher_name}', '🌍 Lesson language: {lesson_language}', '', 'The lesson link is ready.'],
      ),
      buttons: [{ key: 'join_lesson', urlVar: 'lesson_url' }, { key: 'open_request', urlVar: 'request_url' }],
      critical: true,
    },
    teacher: {
      title: L('📚 Вам назначен пробный урок', '📚 Вам призначено пробний урок', '📚 A trial lesson is assigned to you'),
      body: B(
        ['👦 Ученик: {child_name}', '🎂 Возраст: {child_age}', '📊 Предварительный уровень: {recommended_level}', '📅 Дата: {lesson_date}', '🕒 Время: {lesson_time}'],
        ['👦 Учень: {child_name}', '🎂 Вік: {child_age}', '📊 Попередній рівень: {recommended_level}', '📅 Дата: {lesson_date}', '🕒 Час: {lesson_time}'],
        ['👦 Student: {child_name}', '🎂 Age: {child_age}', '📊 Preliminary level: {recommended_level}', '📅 Date: {lesson_date}', '🕒 Time: {lesson_time}'],
      ),
      buttons: [{ key: 'open_student', urlVar: 'student_url' }, { key: 'open_lesson', urlVar: 'lesson_url' }],
      critical: true,
    },
    admin: {
      title: L('✅ Пробный урок подтверждён', '✅ Пробний урок підтверджено', '✅ Trial lesson confirmed'),
      body: B(
        ['Ученик: {child_name}', 'Преподаватель: {teacher_name}', 'Дата и время: {lesson_date}, {lesson_time}', '', 'Уведомления родителю и преподавателю отправлены.'],
        ['Учень: {child_name}', 'Викладач: {teacher_name}', 'Дата і час: {lesson_date}, {lesson_time}', '', 'Сповіщення батькам і викладачу надіслані.'],
        ['Student: {child_name}', 'Teacher: {teacher_name}', 'Date and time: {lesson_date}, {lesson_time}', '', 'Parent and teacher have been notified.'],
      ),
      buttons: [{ key: 'open_request', urlVar: 'request_url' }],
      preference: 'trials',
    },
  },

  trial_reminder_24h: {
    parent: {
      title: L('⏰ Напоминание о пробном уроке', '⏰ Нагадування про пробний урок', '⏰ Trial lesson reminder'),
      body: B(
        ['Завтра у {child_name} пробный урок английского.', '', '📅 {lesson_date}', '🕒 {lesson_time}', '👩‍🏫 {teacher_name}'],
        ['Завтра у {child_name} пробний урок англійської.', '', '📅 {lesson_date}', '🕒 {lesson_time}', '👩‍🏫 {teacher_name}'],
        ['{child_name} has a trial English lesson tomorrow.', '', '📅 {lesson_date}', '🕒 {lesson_time}', '👩‍🏫 {teacher_name}'],
      ),
      buttons: [{ key: 'open_info', urlVar: 'request_url' }],
      preference: 'lessons',
    },
  },
  trial_reminder_1h: {
    parent: {
      title: L('🚀 До пробного урока остался 1 час', '🚀 До пробного уроку залишилась 1 година', '🚀 The trial lesson starts in 1 hour'),
      body: B(
        ['Ученик: {child_name}', 'Начало: {lesson_time}'],
        ['Учень: {child_name}', 'Початок: {lesson_time}'],
        ['Student: {child_name}', 'Starts at: {lesson_time}'],
      ),
      buttons: [{ key: 'join_lesson', urlVar: 'lesson_url' }],
      preference: 'lessons',
    },
  },
  trial_reminder_10m: {
    parent: {
      title: L('🔔 Урок начнётся через 10 минут', '🔔 Урок почнеться за 10 хвилин', '🔔 The lesson starts in 10 minutes'),
      body: B(
        ['Подключитесь заранее, чтобы проверить звук и интернет.'],
        ["Підключіться заздалегідь, щоб перевірити звук та інтернет."],
        ['Join a bit early to check your sound and connection.'],
      ),
      buttons: [{ key: 'join_lesson', urlVar: 'lesson_url' }],
      preference: 'lessons',
    },
  },

  trial_request_rescheduled: {
    parent: {
      title: L('🔄 Пробный урок перенесён', '🔄 Пробний урок перенесено', '🔄 Trial lesson rescheduled'),
      subject: L('Новое время пробного урока {child_name}', 'Новий час пробного уроку {child_name}', 'New time for {child_name}’s trial lesson'),
      body: B(
        ['👦 {child_name}', '', 'Было:\n{old_date} • {old_time}', '', 'Стало:\n{new_date} • {new_time}', '', 'Преподаватель: {teacher_name}'],
        ['👦 {child_name}', '', 'Було:\n{old_date} • {old_time}', '', 'Стало:\n{new_date} • {new_time}', '', 'Викладач: {teacher_name}'],
        ['👦 {child_name}', '', 'Was:\n{old_date} • {old_time}', '', 'Now:\n{new_date} • {new_time}', '', 'Teacher: {teacher_name}'],
      ),
      buttons: [{ key: 'open_info', urlVar: 'request_url' }, { key: 'join_lesson', urlVar: 'lesson_url' }],
      critical: true,
    },
    teacher: {
      title: L('🔄 Пробный урок перенесён', '🔄 Пробний урок перенесено', '🔄 Trial lesson rescheduled'),
      body: B(
        ['Ученик: {child_name}', 'Было: {old_date} • {old_time}', 'Стало: {new_date} • {new_time}'],
        ['Учень: {child_name}', 'Було: {old_date} • {old_time}', 'Стало: {new_date} • {new_time}'],
        ['Student: {child_name}', 'Was: {old_date} • {old_time}', 'Now: {new_date} • {new_time}'],
      ),
      buttons: [{ key: 'open_lesson', urlVar: 'lesson_url' }],
      critical: true,
    },
    admin: {
      title: L('🔄 Пробный урок перенесён', '🔄 Пробний урок перенесено', '🔄 Trial lesson rescheduled'),
      body: B(
        ['Ученик: {child_name}', 'Было: {old_date} • {old_time}', 'Стало: {new_date} • {new_time}'],
        ['Учень: {child_name}', 'Було: {old_date} • {old_time}', 'Стало: {new_date} • {new_time}'],
        ['Student: {child_name}', 'Was: {old_date} • {old_time}', 'Now: {new_date} • {new_time}'],
      ),
      buttons: [{ key: 'open_request', urlVar: 'request_url' }],
      preference: 'trials',
    },
  },

  trial_request_cancelled: {
    parent: {
      title: L('❌ Пробный урок отменён', '❌ Пробний урок скасовано', '❌ Trial lesson cancelled'),
      subject: L('Пробный урок {child_name} отменён', 'Пробний урок {child_name} скасовано', '{child_name}’s trial lesson was cancelled'),
      body: B(
        ['Ученик: {child_name}', 'Дата: {lesson_date}', 'Время: {lesson_time}', '', 'Причина:\n{cancellation_reason}', '', 'Если вы хотите выбрать другое время, заявку можно восстановить.'],
        ['Учень: {child_name}', 'Дата: {lesson_date}', 'Час: {lesson_time}', '', 'Причина:\n{cancellation_reason}', '', 'Якщо ви хочете обрати інший час, заявку можна відновити.'],
        ['Student: {child_name}', 'Date: {lesson_date}', 'Time: {lesson_time}', '', 'Reason:\n{cancellation_reason}', '', 'You can pick another time whenever it suits you.'],
      ),
      buttons: [{ key: 'reschedule_lesson', urlVar: 'reschedule_url' }],
      critical: true,
    },
    teacher: {
      title: L('❌ Пробный урок отменён', '❌ Пробний урок скасовано', '❌ Trial lesson cancelled'),
      body: B(
        ['Ученик: {child_name}', 'Дата: {lesson_date} • {lesson_time}', 'Причина: {cancellation_reason}'],
        ['Учень: {child_name}', 'Дата: {lesson_date} • {lesson_time}', 'Причина: {cancellation_reason}'],
        ['Student: {child_name}', 'Date: {lesson_date} • {lesson_time}', 'Reason: {cancellation_reason}'],
      ),
      buttons: [{ key: 'open_lesson', urlVar: 'lesson_url' }],
      critical: true,
    },
    admin: {
      title: L('❌ Заявка на пробный урок отменена', '❌ Заявку на пробний урок скасовано', '❌ Trial request cancelled'),
      body: B(
        ['Ученик: {child_name}', 'Причина: {cancellation_reason}'],
        ['Учень: {child_name}', 'Причина: {cancellation_reason}'],
        ['Student: {child_name}', 'Reason: {cancellation_reason}'],
      ),
      buttons: [{ key: 'open_request', urlVar: 'request_url' }],
      preference: 'trials',
    },
  },

  trial_request_no_show: {
    parent: {
      title: L('Мы не дождались вас на уроке', 'Ми не дочекались вас на уроці', 'We missed you at the lesson'),
      subject: L('Перенесём пробный урок {child_name}?', 'Перенесемо пробний урок {child_name}?', 'Shall we reschedule {child_name}’s trial lesson?'),
      body: B(
        ['Здравствуйте, {parent_name}!', 'Сегодня был запланирован пробный урок для {child_name}, но подключение не состоялось.', '', 'Ничего страшного — вы можете выбрать новое удобное время.'],
        ['Вітаємо, {parent_name}!', 'Сьогодні був запланований пробний урок для {child_name}, але підключення не відбулося.', '', 'Нічого страшного — ви можете обрати новий зручний час.'],
        ['Hello {parent_name}!', 'A trial lesson for {child_name} was scheduled today, but we did not manage to connect.', '', 'No worries — you can pick a new time that works for you.'],
      ),
      buttons: [{ key: 'reschedule_lesson', urlVar: 'reschedule_url' }],
      preference: 'trials',
    },
    teacher: {
      title: L('⚠️ Ученик не пришёл на пробный урок', '⚠️ Учень не прийшов на пробний урок', '⚠️ Student did not show up'),
      body: B(
        ['👦 {child_name}', '📅 {lesson_date}', '🕒 {lesson_time}'],
        ['👦 {child_name}', '📅 {lesson_date}', '🕒 {lesson_time}'],
        ['👦 {child_name}', '📅 {lesson_date}', '🕒 {lesson_time}'],
      ),
      buttons: [{ key: 'offer_reschedule', urlVar: 'reschedule_url' }, { key: 'open_request', urlVar: 'request_url' }],
      preference: 'trials',
    },
    admin: {
      title: L('⚠️ Ученик не пришёл на пробный урок', '⚠️ Учень не прийшов на пробний урок', '⚠️ Student did not show up'),
      body: B(
        ['👦 {child_name}', '📅 {lesson_date}', '🕒 {lesson_time}'],
        ['👦 {child_name}', '📅 {lesson_date}', '🕒 {lesson_time}'],
        ['👦 {child_name}', '📅 {lesson_date}', '🕒 {lesson_time}'],
      ),
      buttons: [{ key: 'offer_reschedule', urlVar: 'reschedule_url' }, { key: 'open_request', urlVar: 'request_url' }],
      preference: 'trials',
    },
  },

  trial_request_completed: {
    parent: {
      title: L('🎓 Спасибо за пробный урок!', '🎓 Дякуємо за пробний урок!', '🎓 Thank you for the trial lesson!'),
      subject: L('Пробный урок {child_name} прошёл — что дальше?', 'Пробний урок {child_name} відбувся — що далі?', '{child_name}’s trial lesson is done — what’s next?'),
      body: B(
        ['Здравствуйте, {parent_name}!', 'Спасибо, что были с нами: пробный урок для {child_name} состоялся 🎉', '', '📊 Уровень: {final_level}', '👥 Рекомендуемый формат: {recommended_format}', '📦 Рекомендуемый тариф: {recommended_plan}', '', 'Комментарий преподавателя:\n{teacher_comment}', '', 'Чтобы продолжить обучение, выберите подходящий тариф — мы подберём расписание под вас.'],
        ['Вітаємо, {parent_name}!', 'Дякуємо, що були з нами: пробний урок для {child_name} відбувся 🎉', '', '📊 Рівень: {final_level}', '👥 Рекомендований формат: {recommended_format}', '📦 Рекомендований тариф: {recommended_plan}', '', 'Коментар викладача:\n{teacher_comment}', '', 'Щоб продовжити навчання, оберіть відповідний тариф — ми підберемо розклад під вас.'],
        ['Hello {parent_name}!', 'Thank you for joining us — {child_name}’s trial lesson is complete 🎉', '', '📊 Level: {final_level}', '👥 Recommended format: {recommended_format}', '📦 Recommended plan: {recommended_plan}', '', 'Teacher comment:\n{teacher_comment}', '', 'To continue learning, pick the plan that fits — we will build the schedule around you.'],
      ),
      buttons: [{ key: 'choose_plan', urlVar: 'pricing_url' }],
      preference: 'trials',
    },

    teacher: {
      title: L('🎓 Пробный урок проведён', '🎓 Пробний урок проведено', '🎓 Trial lesson completed'),
      body: B(
        ['Ученик: {child_name}', '', 'Теперь заполните:\n• итоговый уровень\n• комментарий\n• сильные стороны\n• что нужно улучшить\n• рекомендуемый формат\n• рекомендуемую группу\n• рекомендуемый тариф'],
        ['Учень: {child_name}', '', 'Тепер заповніть:\n• підсумковий рівень\n• коментар\n• сильні сторони\n• що варто покращити\n• рекомендований формат\n• рекомендовану групу\n• рекомендований тариф'],
        ['Student: {child_name}', '', 'Please fill in:\n• final level\n• comment\n• strengths\n• areas to improve\n• recommended format\n• recommended group\n• recommended plan'],
      ),
      buttons: [{ key: 'fill_recommendation', urlVar: 'result_url' }],
      preference: 'trials',
    },
    admin: {
      title: L('🎓 Пробный урок завершён', '🎓 Пробний урок завершено', '🎓 Trial lesson finished'),
      body: B(
        ['Ученик: {child_name}', 'Преподаватель: {teacher_name}', '', 'Ожидается рекомендация преподавателя.'],
        ['Учень: {child_name}', 'Викладач: {teacher_name}', '', 'Очікується рекомендація викладача.'],
        ['Student: {child_name}', 'Teacher: {teacher_name}', '', 'Waiting for the teacher’s recommendation.'],
      ),
      buttons: [{ key: 'open_result', urlVar: 'result_url' }],
      preference: 'trials',
    },
  },

  trial_recommendation_ready: {
    parent: {
      title: L('🌟 Рекомендация преподавателя готова', '🌟 Рекомендація викладача готова', '🌟 Teacher recommendation is ready'),
      subject: L('Рекомендация преподавателя для {child_name}', 'Рекомендація викладача для {child_name}', 'Teacher recommendation for {child_name}'),
      body: B(
        ['{child_name} отлично справился с пробным уроком!', '', '📊 Уровень: {final_level}', '👥 Рекомендуемый формат: {recommended_format}', '🎓 Рекомендуемая группа: {recommended_group}', '📦 Рекомендуемый тариф: {recommended_plan}', '', 'Комментарий преподавателя:\n{teacher_comment}'],
        ['{child_name} чудово впорався з пробним уроком!', '', '📊 Рівень: {final_level}', '👥 Рекомендований формат: {recommended_format}', '🎓 Рекомендована група: {recommended_group}', '📦 Рекомендований тариф: {recommended_plan}', '', 'Коментар викладача:\n{teacher_comment}'],
        ['{child_name} did a great job in the trial lesson!', '', '📊 Level: {final_level}', '👥 Recommended format: {recommended_format}', '🎓 Recommended group: {recommended_group}', '📦 Recommended plan: {recommended_plan}', '', 'Teacher comment:\n{teacher_comment}'],
      ),
      buttons: [{ key: 'view_recommendation', urlVar: 'recommendation_url' }, { key: 'continue_learning', urlVar: 'pricing_url' }],
      preference: 'trials',
    },
  },

  trial_request_converted: {
    admin: {
      title: L('🎉 Заявка успешно конвертирована', '🎉 Заявку успішно конвертовано', '🎉 Trial request converted'),
      body: B(
        ['👦 Ученик: {child_name}', '📊 Уровень: {final_level}', '👥 Группа: {assigned_group}', '📦 Тариф: {purchased_plan}', '💳 Оплата: {payment_status}', '', '✅ Профиль активирован'],
        ['👦 Учень: {child_name}', '📊 Рівень: {final_level}', '👥 Група: {assigned_group}', '📦 Тариф: {purchased_plan}', '💳 Оплата: {payment_status}', '', '✅ Профіль активовано'],
        ['👦 Student: {child_name}', '📊 Level: {final_level}', '👥 Group: {assigned_group}', '📦 Plan: {purchased_plan}', '💳 Payment: {payment_status}', '', '✅ Profile activated'],
      ),
      buttons: [{ key: 'open_student', urlVar: 'student_url' }],
      preference: 'trials',
    },
    teacher: {
      title: L('🎉 Новый ученик зачислен', '🎉 Нового учня зараховано', '🎉 New student enrolled'),
      body: B(
        ['Ученик: {child_name}', 'Группа: {assigned_group}', 'Первый урок: {first_lesson_date}'],
        ['Учень: {child_name}', 'Група: {assigned_group}', 'Перший урок: {first_lesson_date}'],
        ['Student: {child_name}', 'Group: {assigned_group}', 'First lesson: {first_lesson_date}'],
      ),
      buttons: [{ key: 'open_student', urlVar: 'student_url' }],
      preference: 'trials',
    },
    parent: {
      title: L('Обучение начинается 🎉', 'Навчання починається 🎉', 'Your learning starts 🎉'),
      subject: L('Добро пожаловать в Vetoschool!', 'Ласкаво просимо до Vetoschool!', 'Welcome to Vetoschool!'),
      body: B(
        ['Здравствуйте, {parent_name}!', 'Рады видеть {child_name} в Vetoschool.', '', 'Тариф: {purchased_plan}\nГруппа: {assigned_group}\nПреподаватель: {teacher_name}\nУроков в тарифе: {lessons_total}\nСледующий урок: {first_lesson_date}', '', 'Подключите Telegram-бота, чтобы получать напоминания и оценки.'],
        ['Вітаємо, {parent_name}!', 'Раді бачити {child_name} у Vetoschool.', '', 'Тариф: {purchased_plan}\nГрупа: {assigned_group}\nВикладач: {teacher_name}\nУроків у тарифі: {lessons_total}\nНаступний урок: {first_lesson_date}', '', 'Підключіть Telegram-бота, щоб отримувати нагадування та оцінки.'],
        ['Hello {parent_name}!', 'We are happy to welcome {child_name} to Vetoschool.', '', 'Plan: {purchased_plan}\nGroup: {assigned_group}\nTeacher: {teacher_name}\nLessons included: {lessons_total}\nNext lesson: {first_lesson_date}', '', 'Connect the Telegram bot to get reminders and grades.'],
      ),
      buttons: [{ key: 'continue_learning', urlVar: 'dashboard_url' }],
      critical: true,
    },
  },

  lesson_scheduled: {
    parent: {
      title: L('📚 Новый урок добавлен в расписание', '📚 Новий урок додано до розкладу', '📚 New lesson added to the schedule'),
      body: B(
        ['Ученик: {student_name}', 'Дата: {lesson_date}', 'Время: {lesson_time}', 'Преподаватель: {teacher_name}', 'Тема: {lesson_topic}'],
        ['Учень: {student_name}', 'Дата: {lesson_date}', 'Час: {lesson_time}', 'Викладач: {teacher_name}', 'Тема: {lesson_topic}'],
        ['Student: {student_name}', 'Date: {lesson_date}', 'Time: {lesson_time}', 'Teacher: {teacher_name}', 'Topic: {lesson_topic}'],
      ),
      buttons: [{ key: 'open_schedule', urlVar: 'schedule_url' }],
      preference: 'schedule',
    },
    teacher: {
      title: L('📅 Новый урок в расписании', '📅 Новий урок у розкладі', '📅 New lesson in your schedule'),
      body: B(
        ['Ученик или группа: {student_or_group}', 'Дата: {lesson_date}', 'Время: {lesson_time}', 'Тема: {lesson_topic}'],
        ['Учень або група: {student_or_group}', 'Дата: {lesson_date}', 'Час: {lesson_time}', 'Тема: {lesson_topic}'],
        ['Student or group: {student_or_group}', 'Date: {lesson_date}', 'Time: {lesson_time}', 'Topic: {lesson_topic}'],
      ),
      buttons: [{ key: 'open_lesson', urlVar: 'lesson_url' }],
      preference: 'schedule',
    },
  },

  lesson_reminder_24h: {
    parent: {
      title: L('⏰ Завтра урок английского', '⏰ Завтра урок англійської', '⏰ English lesson tomorrow'),
      body: B(
        ['Ученик: {student_name}', '📅 {lesson_when}', '👩‍🏫 {teacher_name}', '📖 Тема: {lesson_topic}'],
        ['Учень: {student_name}', '📅 {lesson_when}', '👩‍🏫 {teacher_name}', '📖 Тема: {lesson_topic}'],
        ['Student: {student_name}', '📅 {lesson_when}', '👩‍🏫 {teacher_name}', '📖 Topic: {lesson_topic}'],
      ),
      buttons: [{ key: 'open_schedule', urlVar: 'schedule_url' }],
      preference: 'lessons',
    },
  },
  lesson_reminder_1h: {
    parent: {
      title: L('⏰ Через 1 час у {student_name} урок английского', '⏰ За 1 годину у {student_name} урок англійської', '⏰ {student_name} has an English lesson in 1 hour'),
      body: B(
        ['📅 {lesson_when}', '👩‍🏫 {teacher_name}', '📖 Тема: {lesson_topic}'],
        ['📅 {lesson_when}', '👩‍🏫 {teacher_name}', '📖 Тема: {lesson_topic}'],
        ['📅 {lesson_when}', '👩‍🏫 {teacher_name}', '📖 Topic: {lesson_topic}'],
      ),
      buttons: [{ key: 'join_lesson', urlVar: 'lesson_url' }, { key: 'open_schedule', urlVar: 'schedule_url' }],
      preference: 'lessons',
    },
  },
  lesson_reminder_10m: {
    parent: {
      title: L('🔔 Урок начнётся через 10 минут', '🔔 Урок почнеться за 10 хвилин', '🔔 The lesson starts in 10 minutes'),
      body: B(
        ['Ученик: {student_name}', 'Подключитесь заранее, чтобы проверить звук и интернет.'],
        ['Учень: {student_name}', "Підключіться заздалегідь, щоб перевірити звук та інтернет."],
        ['Student: {student_name}', 'Join a bit early to check your sound and connection.'],
      ),
      buttons: [{ key: 'join_lesson', urlVar: 'lesson_url' }],
      preference: 'lessons',
    },
  },

  lesson_rescheduled: {
    parent: {
      title: L('🔄 Урок перенесён', '🔄 Урок перенесено', '🔄 Lesson rescheduled'),
      subject: L('Новое время урока {student_name}', 'Новий час уроку {student_name}', 'New time for {student_name}’s lesson'),
      body: B(
        ['Ученик: {student_name}', '', 'Было:\n{old_date} • {old_time}', '', 'Стало:\n{new_date} • {new_time}', '', 'Преподаватель: {teacher_name}'],
        ['Учень: {student_name}', '', 'Було:\n{old_date} • {old_time}', '', 'Стало:\n{new_date} • {new_time}', '', 'Викладач: {teacher_name}'],
        ['Student: {student_name}', '', 'Was:\n{old_date} • {old_time}', '', 'Now:\n{new_date} • {new_time}', '', 'Teacher: {teacher_name}'],
      ),
      buttons: [{ key: 'open_schedule', urlVar: 'schedule_url' }],
      critical: true,
    },
  },

  lesson_cancelled: {
    parent: {
      title: L('❌ Урок отменён', '❌ Урок скасовано', '❌ Lesson cancelled'),
      subject: L('Урок {student_name} отменён', 'Урок {student_name} скасовано', '{student_name}’s lesson was cancelled'),
      body: B(
        ['Ученик: {student_name}', 'Дата: {lesson_date}', 'Время: {lesson_time}', '', 'Причина:\n{cancellation_reason}', '', 'Если урок будет перенесён, мы пришлём новое уведомление.'],
        ['Учень: {student_name}', 'Дата: {lesson_date}', 'Час: {lesson_time}', '', 'Причина:\n{cancellation_reason}', '', 'Якщо урок буде перенесено, ми надішлемо нове сповіщення.'],
        ['Student: {student_name}', 'Date: {lesson_date}', 'Time: {lesson_time}', '', 'Reason:\n{cancellation_reason}', '', 'If the lesson is rescheduled, we will send a new notification.'],
      ),
      buttons: [{ key: 'open_schedule', urlVar: 'schedule_url' }],
      critical: true,
    },
  },

  lesson_completed: {
    parent: {
      title: L('✅ Урок завершён', '✅ Урок завершено', '✅ Lesson completed'),
      body: B(
        ['Ученик: {student_name}', 'Тема: {lesson_topic}', 'Преподаватель: {teacher_name}', '', 'На уроке:\n{lesson_summary}', '', 'Домашнее задание:\n{homework_summary}'],
        ['Учень: {student_name}', 'Тема: {lesson_topic}', 'Викладач: {teacher_name}', '', 'На уроці:\n{lesson_summary}', '', 'Домашнє завдання:\n{homework_summary}'],
        ['Student: {student_name}', 'Topic: {lesson_topic}', 'Teacher: {teacher_name}', '', 'In the lesson:\n{lesson_summary}', '', 'Homework:\n{homework_summary}'],
      ),
      buttons: [{ key: 'open_lesson', urlVar: 'lesson_url' }],
      preference: 'lessons',
    },
  },

  lesson_no_show: {
    parent: {
      title: L('⚠️ Пропущен урок', '⚠️ Пропущено урок', '⚠️ Missed lesson'),
      body: B(
        ['Сегодня {student_name} не подключился к занятию.', '', 'Дата: {lesson_date}', 'Время: {lesson_time}', '', 'Свяжитесь с администратором, если нужна помощь.'],
        ["Сьогодні {student_name} не підключився до заняття.", '', 'Дата: {lesson_date}', 'Час: {lesson_time}', '', "Зв'яжіться з адміністратором, якщо потрібна допомога."],
        ['{student_name} did not join today’s lesson.', '', 'Date: {lesson_date}', 'Time: {lesson_time}', '', 'Contact the administrator if you need help.'],
      ),
      buttons: [{ key: 'contact_school', urlVar: 'contact_url' }],
      critical: true,
    },
    teacher: {
      title: L('⚠️ Ученик не пришёл на урок', '⚠️ Учень не прийшов на урок', '⚠️ Student missed the lesson'),
      body: B(
        ['Ученик: {student_name}', 'Дата: {lesson_date} • {lesson_time}'],
        ['Учень: {student_name}', 'Дата: {lesson_date} • {lesson_time}'],
        ['Student: {student_name}', 'Date: {lesson_date} • {lesson_time}'],
      ),
      buttons: [{ key: 'open_lesson', urlVar: 'lesson_url' }],
      preference: 'lessons',
    },
    admin: {
      title: L('⚠️ Ученик не пришёл на урок', '⚠️ Учень не прийшов на урок', '⚠️ Student missed the lesson'),
      body: B(
        ['Ученик: {student_name}', 'Дата: {lesson_date} • {lesson_time}', 'Преподаватель: {teacher_name}'],
        ['Учень: {student_name}', 'Дата: {lesson_date} • {lesson_time}', 'Викладач: {teacher_name}'],
        ['Student: {student_name}', 'Date: {lesson_date} • {lesson_time}', 'Teacher: {teacher_name}'],
      ),
      buttons: [{ key: 'open_student', urlVar: 'student_url' }],
      preference: 'lessons',
    },
  },

  homework_assigned: {
    parent: {
      title: L('📝 Новое домашнее задание', '📝 Нове домашнє завдання', '📝 New homework'),
      body: B(
        ['Ученик: {student_name}', 'Задание: {homework_title}', 'Урок: {lesson_title}', 'Срок выполнения: {due_date}'],
        ['Учень: {student_name}', 'Завдання: {homework_title}', 'Урок: {lesson_title}', 'Термін виконання: {due_date}'],
        ['Student: {student_name}', 'Task: {homework_title}', 'Lesson: {lesson_title}', 'Due: {due_date}'],
      ),
      buttons: [{ key: 'open_homework', urlVar: 'homework_url' }],
      preference: 'homework',
    },
  },

  homework_submitted: {
    teacher: {
      title: L('📩 Ученик отправил домашнее задание', '📩 Учень надіслав домашнє завдання', '📩 Homework submitted'),
      body: B(
        ['Ученик: {student_name}', 'Задание: {homework_title}', 'Дата отправки: {submitted_at}'],
        ['Учень: {student_name}', 'Завдання: {homework_title}', 'Дата надсилання: {submitted_at}'],
        ['Student: {student_name}', 'Task: {homework_title}', 'Submitted: {submitted_at}'],
      ),
      buttons: [{ key: 'check_homework', urlVar: 'homework_url' }],
      preference: 'homework',
    },
    parent: {
      title: L('✅ Домашнее задание отправлено', '✅ Домашнє завдання надіслано', '✅ Homework submitted'),
      body: B(
        ['Задание:\n{homework_title}', '', 'Теперь преподаватель проверит работу.'],
        ['Завдання:\n{homework_title}', '', 'Тепер викладач перевірить роботу.'],
        ['Task:\n{homework_title}', '', 'The teacher will review it soon.'],
      ),
      buttons: [{ key: 'open_homework', urlVar: 'homework_url' }],
      preference: 'homework',
    },
  },

  homework_updated: {
    parent: {
      title: L('✏️ Домашнее задание обновлено', '✏️ Домашнє завдання оновлено', '✏️ Homework updated'),
      body: B(
        ['Ученик: {student_name}', 'Задание: {homework_title}', 'Срок выполнения: {due_date}'],
        ['Учень: {student_name}', 'Завдання: {homework_title}', 'Термін виконання: {due_date}'],
        ['Student: {student_name}', 'Task: {homework_title}', 'Due: {due_date}'],
      ),
      buttons: [{ key: 'open_homework', urlVar: 'homework_url' }],
      preference: 'homework',
    },
  },

  homework_cancelled: {
    parent: {
      title: L('❌ Домашнее задание отменено', '❌ Домашнє завдання скасовано', '❌ Homework cancelled'),
      body: B(
        ['Ученик: {student_name}', 'Задание: {homework_title}'],
        ['Учень: {student_name}', 'Завдання: {homework_title}'],
        ['Student: {student_name}', 'Task: {homework_title}'],
      ),
      buttons: [{ key: 'open_schedule', urlVar: 'schedule_url' }],
      preference: 'homework',
    },
  },

  lesson_result_published: {
    parent: {
      title: L('📘 Опубликован результат урока', '📘 Опубліковано результат уроку', '📘 Lesson result published'),
      body: B(
        ['Ученик: {student_name}', 'Урок: {lesson_title}', '', 'Комментарий преподавателя:\n{teacher_comment}'],
        ['Учень: {student_name}', 'Урок: {lesson_title}', '', 'Коментар викладача:\n{teacher_comment}'],
        ['Student: {student_name}', 'Lesson: {lesson_title}', '', 'Teacher comment:\n{teacher_comment}'],
      ),
      buttons: [{ key: 'open_result', urlVar: 'result_url' }],
      preference: 'lessons',
    },
  },



  grade_published: {
    parent: {
      title: L('⭐ Новый результат', '⭐ Новий результат', '⭐ New result'),
      body: B(
        ['Ученик: {student_name}', 'Задание: {content_title}', 'Оценка: {score}/{max_score}', '', '{score_note}', '', 'Комментарий преподавателя:\n{teacher_comment}'],
        ['Учень: {student_name}', 'Завдання: {content_title}', 'Оцінка: {score}/{max_score}', '', '{score_note}', '', 'Коментар викладача:\n{teacher_comment}'],
        ['Student: {student_name}', 'Task: {content_title}', 'Score: {score}/{max_score}', '', '{score_note}', '', 'Teacher comment:\n{teacher_comment}'],
      ),
      buttons: [{ key: 'open_result', urlVar: 'result_url' }],
      preference: 'grades',
    },
  },
  grade_updated: {
    parent: {
      title: L('✏️ Оценка обновлена', '✏️ Оцінку оновлено', '✏️ Grade updated'),
      body: B(
        ['Ученик: {student_name}', 'Задание: {content_title}', 'Новая оценка: {score}/{max_score}', '', 'Комментарий преподавателя:\n{teacher_comment}'],
        ['Учень: {student_name}', 'Завдання: {content_title}', 'Нова оцінка: {score}/{max_score}', '', 'Коментар викладача:\n{teacher_comment}'],
        ['Student: {student_name}', 'Task: {content_title}', 'New score: {score}/{max_score}', '', 'Teacher comment:\n{teacher_comment}'],
      ),
      buttons: [{ key: 'open_result', urlVar: 'result_url' }],
      preference: 'grades',
    },
  },

  payment_succeeded: {
    parent: {
      title: L('✅ Оплата прошла успешно', '✅ Оплата пройшла успішно', '✅ Payment successful'),
      subject: L('Оплата Vetoschool подтверждена', 'Оплату Vetoschool підтверджено', 'Your Vetoschool payment is confirmed'),
      body: B(
        ['Ученик: {student_name}', 'Тариф: {plan_name}', 'Сумма: {amount} {currency}', 'Начислено уроков: {lessons_added}', 'Следующая оплата: {next_payment_date}', '', 'Номер платежа: {invoice_number}'],
        ['Учень: {student_name}', 'Тариф: {plan_name}', 'Сума: {amount} {currency}', 'Нараховано уроків: {lessons_added}', 'Наступна оплата: {next_payment_date}', '', 'Номер платежу: {invoice_number}'],
        ['Student: {student_name}', 'Plan: {plan_name}', 'Amount: {amount} {currency}', 'Lessons added: {lessons_added}', 'Next payment: {next_payment_date}', '', 'Invoice number: {invoice_number}'],
      ),
      buttons: [{ key: 'open_plan', urlVar: 'billing_url' }],
      preference: 'billing',
    },
  },

  payment_failed: {
    parent: {
      title: L('⚠️ Не удалось провести оплату', '⚠️ Не вдалося провести оплату', '⚠️ Payment failed'),
      subject: L('Не удалось продлить подписку Vetoschool', 'Не вдалося продовжити підписку Vetoschool', 'We could not renew your Vetoschool subscription'),
      body: B(
        ['Тариф: {plan_name}', 'Сумма: {amount} {currency}', '', 'Проверьте способ оплаты, чтобы обучение продолжилось без перерыва.'],
        ['Тариф: {plan_name}', 'Сума: {amount} {currency}', '', 'Перевірте спосіб оплати, щоб навчання тривало без перерви.'],
        ['Plan: {plan_name}', 'Amount: {amount} {currency}', '', 'Please update your payment method so learning continues without interruption.'],
      ),
      buttons: [{ key: 'update_payment', urlVar: 'billing_url' }],
      critical: true,
    },
  },

  subscription_cancelled: {
    parent: {
      title: L('ℹ️ Подписка будет отменена', 'ℹ️ Підписку буде скасовано', 'ℹ️ Subscription will be cancelled'),
      body: B(
        ['Тариф: {plan_name}', '', 'Доступ сохранится до:\n{access_until}', '', 'До этой даты ученик сможет пользоваться кабинетом и оставшимися уроками.'],
        ['Тариф: {plan_name}', '', 'Доступ збережеться до:\n{access_until}', '', 'До цієї дати учень зможе користуватися кабінетом і рештою уроків.'],
        ['Plan: {plan_name}', '', 'Access remains until:\n{access_until}', '', 'Until then the student keeps the dashboard and remaining lessons.'],
      ),
      buttons: [{ key: 'manage_subscription', urlVar: 'billing_url' }],
      critical: true,
    },
  },
  subscription_ended: {
    parent: {
      title: L('ℹ️ Подписка завершена', 'ℹ️ Підписку завершено', 'ℹ️ Subscription ended'),
      body: B(
        ['Тариф: {plan_name}', '', 'Подписка завершена. Вы можете возобновить обучение в любой момент.'],
        ['Тариф: {plan_name}', '', 'Підписку завершено. Ви можете відновити навчання будь-коли.'],
        ['Plan: {plan_name}', '', 'The subscription has ended. You can resume learning any time.'],
      ),
      buttons: [{ key: 'continue_learning', urlVar: 'pricing_url' }],
      critical: true,
    },
  },

  lessons_low_balance: {
    parent: {
      title: L('🔔 Осталось мало уроков', '🔔 Залишилось мало уроків', '🔔 Few lessons left'),
      body: B(
        ['У ученика {student_name} осталось:\n{lessons_remaining}', '', 'Следующая оплата:\n{next_payment_date}'],
        ['У учня {student_name} залишилось:\n{lessons_remaining}', '', 'Наступна оплата:\n{next_payment_date}'],
        ['{student_name} has {lessons_remaining} lessons left.', '', 'Next payment:\n{next_payment_date}'],
      ),
      buttons: [{ key: 'open_plan', urlVar: 'billing_url' }],
      preference: 'billing',
    },
  },

  weekly_progress_summary: {
    parent: {
      title: L('📊 Итоги недели', '📊 Підсумки тижня', '📊 Weekly summary'),
      subject: L('Итоги недели {student_name}', 'Підсумки тижня {student_name}', 'Weekly summary for {student_name}'),
      body: B(
        ['Ученик: {student_name}', '', '✅ Проведено уроков: {lessons_completed}', '📝 Выполнено заданий: {homework_completed}', '⭐ Средняя оценка: {average_score}', '🔥 Серия обучения: {learning_streak}', '📈 Прогресс: {progress_summary}', '', 'Комментарий преподавателя:\n{teacher_weekly_comment}'],
        ['Учень: {student_name}', '', '✅ Проведено уроків: {lessons_completed}', '📝 Виконано завдань: {homework_completed}', '⭐ Середня оцінка: {average_score}', '🔥 Серія навчання: {learning_streak}', '📈 Прогрес: {progress_summary}', '', 'Коментар викладача:\n{teacher_weekly_comment}'],
        ['Student: {student_name}', '', '✅ Lessons completed: {lessons_completed}', '📝 Homework done: {homework_completed}', '⭐ Average score: {average_score}', '🔥 Learning streak: {learning_streak}', '📈 Progress: {progress_summary}', '', 'Teacher comment:\n{teacher_weekly_comment}'],
      ),
      buttons: [{ key: 'open_progress', urlVar: 'progress_url' }],
      preference: 'weekly',
    },
  },
};

/* --------------------------------------------------------------- render */

const SCORE_NOTE: Record<'high' | 'mid' | 'low', Record<NotifyLang, string>> = {
  high: L('🏆 Отличная работа!', '🏆 Чудова робота!', '🏆 Excellent work!'),
  mid: L('👏 Хороший результат!', '👏 Гарний результат!', '👏 Good result!'),
  low: L('💪 Продолжаем тренироваться!', '💪 Продовжуємо тренуватися!', '💪 Let’s keep practising!'),
};

export function scoreNote(score: number, maxScore: number, lang: NotifyLang) {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  const bucket = ratio >= 0.8 ? 'high' : ratio >= 0.5 ? 'mid' : 'low';
  return SCORE_NOTE[bucket][lang];
}

export function getTemplate(event: NotificationEvent, role: NotifyRole) {
  return NOTIFICATION_TEMPLATES[event]?.[role] || null;
}

export function isCritical(event: NotificationEvent, role: NotifyRole = 'parent') {
  return !!getTemplate(event, role)?.critical;
}

export function preferenceFor(event: NotificationEvent, role: NotifyRole = 'parent') {
  return getTemplate(event, role)?.preference || null;
}

/** Рендер сообщения: заголовок + блоки + контекстные кнопки. */
export function renderNotification(
  event: NotificationEvent,
  role: NotifyRole,
  lang: NotifyLang,
  vars: NotifyVars = {},
): RenderedMessage | null {
  const template = getTemplate(event, role);
  if (!template) return null;

  const title = fill(template.title[lang] || template.title.ru, vars);
  const subjectRaw = template.subject?.[lang] || template.subject?.ru || template.title[lang] || template.title.ru;
  const subject = fill(subjectRaw, vars).replace(/^[^\p{L}\p{N}]+/u, '').trim();

  const lines = (template.body[lang] || template.body.ru)
    .map(line => fill(line, vars))
    // строки, где все переменные пустые, выпадают: не показываем «Причина:» без причины
    .filter((line, index, all) => {
      const raw = (template.body[lang] || template.body.ru)[index];
      if (!raw.includes('{')) return true;
      const stripped = line.replace(/[^\p{L}\p{N}]/gu, '');
      const labelOnly = raw.replace(/\{\w+\}/g, '').replace(/[^\p{L}\p{N}]/gu, '');
      return stripped !== labelOnly;
    })
    .filter((line, index, all) => !(line === '' && (index === 0 || all[index - 1] === '')));

  const buttons = template.buttons
    .map(entry => ({ label: buttonLabel(entry.key, lang), url: String(vars[entry.urlVar] ?? '') }))
    .filter(entry => /^https?:\/\//i.test(entry.url));

  const text = [`<b>${title}</b>`, '', ...lines].join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return { text, subject, title, lines, buttons };
}

/** Идемпотентность: event_type + entity_id + recipient_id + channel + event_version. */
export function idempotencyKey(input: {
  eventType: string;
  entityId: string;
  recipientId: string;
  channel: NotifyChannel;
  eventVersion?: number | string;
}) {
  return [input.eventType, input.entityId, input.recipientId, input.channel, String(input.eventVersion ?? 1)].join('|');
}
