import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  ExternalLink,
  GraduationCap,
  Lightbulb,
  Lock,
  MonitorPlay,
  PlayCircle,
  RefreshCw,
  Search,
  Send,
  Star,
  Unlock,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { TeacherAvatar } from '@/components/teacher/TeacherAvatar';
import { TeacherAvatarUploader } from '@/components/teacher/TeacherAvatarUploader';
import InteractiveLessonRoom from '@/components/InteractiveLessonRoom';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUser, logout } from '@/lib/auth';
import { Lang } from '@/lib/i18n';
import {
  addTeacherNote,
  AttendanceStatus,
  completeTeacherLesson,
  createLessonChangeRequest,
  deleteTeacherNote,
  loadTeacherWorkspace,
  loadTeacherNotificationStates,
  saveHomeworkComment,
  saveTeacherNotificationState,
  TeacherHomework,
  TeacherLesson,
  TeacherLessonAttendance,
  TeacherLessonResult,
  LessonStructureSection,
  TeacherNote,
  TeacherRecord,
  TeacherStudent,
  TeacherWorkspace,
  updateTeacherContentAccess,
  updateTeacherNotePinned,
  updateOwnTeacherProfile,
  updateTeacherLesson,
} from '@/lib/teachers';
import {
  LiveEvent,
  LiveSession,
  listLiveEvents,
  listLiveSessions,
  sendTeacherHint,
  subscribeLiveSessionEvents,
  subscribeLiveSessions,
} from '@/lib/live';
import { formatLessonMoment, formatTeacherDate, missingValue, teacherDisplayName } from '@/lib/teacherUi';
import { resolveFileUrl } from '@/lib/content';
import { getLessonById } from '@/lib/workbooks';
import type { Lesson as WorkbookLesson } from '@/lib/workbooks';

type TeacherRouteMode = 'root' | 'group' | 'student';
type TeacherSection = 'dashboard' | 'schedule' | 'groups' | 'students' | 'live' | 'lessons' | 'homework' | 'notes' | 'notifications' | 'profile';
type LessonWorkspaceTab = string;
type NoteType = 'Private' | 'Visible to Admin' | 'Important' | 'Follow-up';

interface LocalNote {
  id: string;
  target: 'Student' | 'Group' | 'Lesson' | 'Admin' | 'Teacher';
  targetId: string;
  type: NoteType;
  text: string;
  attachmentLabel: string;
  pinned?: boolean;
  createdAt: string;
}

interface TeacherNotification {
  id: string;
  type: string;
  text: string;
  date: string;
  read: boolean;
  relatedSection: TeacherSection;
  lessonId?: string;
  homeworkId?: string;
  studentId?: string;
  groupId?: string;
  lessonKind?: string;
  studentName?: string;
  groupName?: string;
  groupCategory?: string;
  topic?: string;
}

interface LessonCompletionDraft {
  summary: string;
  teacherComment: string;
  homeworkBrief: string;
  carryOverToNextLesson: string;
  adminNote: string;
  grades: Record<string, number>;
}

const navItems: Array<{ id: TeacherSection; emoji: string }> = [
  { id: 'dashboard', emoji: '🏠' },
  { id: 'schedule', emoji: '🗓️' },
  { id: 'groups', emoji: '👥' },
  { id: 'students', emoji: '👩‍🎓' },
  { id: 'live', emoji: '📡' },
  { id: 'lessons', emoji: '📖' },
  { id: 'homework', emoji: '📚' },
  { id: 'notes', emoji: '✏️' },
  { id: 'notifications', emoji: '🔔' },
  { id: 'profile', emoji: '👤' },
];

const copyByLang = {
  ru: {
    lang: 'ru' as Lang,
    dashboard: 'Главная',
    schedule: 'Расписание',
    groups: 'Мои группы',
    students: 'Ученики',
    live: 'Live-уроки',
    lessons: 'Уроки',
    homework: 'Проверка работ',
    notes: 'Заметки',
    notifications: 'Уведомления',
    profile: 'Профиль',
    logout: 'Выйти',
    today: 'Сегодня',
    openLesson: 'Открыть урок',
    startLesson: 'Начать урок',
    finishLesson: 'Завершить урок',
    requestChange: 'Запросить изменение',
    lessonsToday: 'Уроки сегодня',
    upcomingLessons: 'Ближайшие уроки',
    homeworkReview: 'Работы на проверке',
    activeStudents: 'Активные ученики',
    noLessons: 'Нет назначенных уроков',
    noLessonsText: 'Когда администратор создаст урок в расписании, он появится здесь. Материалы без расписания находятся в проверке работ.',
    noGroups: 'Нет назначенных групп',
    noGroupsText: 'Администратор пока не назначил вам группы.',
    noHomework: 'Нет работ для проверки',
    noHomeworkText: 'Домашние задания, практики, грамматика, аудирование и unit checkpoint появятся здесь.',
    noNotifications: 'Нет уведомлений',
    save: 'Сохранить',
    saved: 'Сохранено',
    failed: 'Не удалось сохранить изменения',
    attendanceRequired: 'Нужно отметить посещаемость.',
    finishLessonConfirm: 'Завершить урок и сохранить результат?',
    homeworkDueRequired: 'Для проверки у домашнего задания должна быть дата сдачи.',
    emptyNoteError: 'Пустые заметки нельзя сохранять.',
    requestPrepared: 'Запрос подготовлен для администратора',
    requestSent: 'Запрос отправлен администратору',
    teacherWorkspaceLoadFailed: 'Кабинет учителя не загрузился.',
    teacherWorkspaceMissing: 'Профиль учителя ещё не привязан',
    teacherWorkspaceMissingText: 'Попросите администратора привязать ваш аккаунт к профилю учителя.',
    localNoteWarning: 'Заметка сохранена локально. В базу данных сохранить не удалось.',
    scheduleChangeRequest: 'Запрос на изменение расписания',
    teacherWorkspace: 'Рабочее пространство учителя Vetoschool',
    teacherDashboardTitle: 'Панель учителя',
    teacherWorkspaceLine: 'уроки, группы и домашние задания в одном рабочем пространстве',
    groupsCount: 'Группы',
    studentsCount: 'Ученики',
    thisWeek: 'На неделе',
    nextLesson: 'Следующий урок',
    viewSchedule: 'К расписанию',
    openHomework: 'Открыть работы',
    importantNotifications: 'Важные уведомления',
    scheduleDescription: 'Расписание назначает администратор. Учитель может просматривать уроки, открывать их и запрашивать изменения.',
    day: 'День',
    week: 'Неделя',
    calendar: 'Календарь',
    scheduledLessons: 'Запланированные уроки',
    plannedLessons: 'Актуальные уроки',
    conductedLessons: 'Проведённые уроки',
    noConductedLessons: 'Проведённых уроков пока нет.',
    selectedDate: 'Выбранная дата',
    individualLesson: 'Индивидуальный урок',
    individualLessons: 'Индивидуальные',
    groupLesson: 'Групповой урок',
    trialLesson: 'Пробный урок',
    packageLabel: 'Тариф',
    studentsInGroup: 'Ученики группы',
    lessonsOnDate: 'уроков',
    previous: 'Назад',
    next: 'Вперёд',
    groupsDescription: 'Здесь видны только группы, назначенные администратором.',
    groupNotFound: 'Группа не найдена',
    groupNotFoundText: 'Эта группа не назначена вам.',
    openGroupProfile: 'Открыть профиль группы',
    groupSchedule: 'Расписание группы',
    lessonsDescription: 'Назначенные уроки учителя: статус, тема, ученик, курс и время в одном месте.',
    searchLessons: 'Поиск уроков',
    searchStudents: 'Поиск ученика',
    noStudentMatches: 'Ученики не найдены',
    myStudents: 'Ученики',
    studentSearchDescription: 'Быстрый список всех учеников из ваших групп и индивидуальных уроков.',
    allAssignedStudents: 'Все ученики',
    quickProfile: 'Быстрый профиль',
    openAnalytics: 'Открыть аналитику',
    liveLessons: 'Live-уроки',
    liveLessonsDescription: 'Здесь видно, что ребёнок делает в интерактивном уроке прямо сейчас.',
    activeSessions: 'Активные сессии',
    activityLog: 'Журнал действий',
    noLiveSessions: 'Пока никто не проходит интерактивный урок.',
    noLiveEvents: 'Событий пока нет.',
    childHint: 'Подсказка ребёнку',
    childHintPlaceholder: 'Например: попробуй соединить первую карточку с правильным словом',
    sendHint: 'Отправить',
    refresh: 'Обновить',
    liveNeedsDb: 'Live-режим ждёт доступ к таблицам Supabase.',
    materialAccess: 'Доступ к блокам',
    materialAccessDescription: 'Открывайте только нужные блоки на уроке: практика, грамматика, аудирование, домашнее задание и чекпоинты.',
    opened: 'Открыто',
    locked: 'Закрыто',
    openAccess: 'Открыть',
    closeAccess: 'Закрыть',
    close: 'Закрыть',
    openAssignedMaterial: 'Открыть назначенный материал',
    assignedContentPreview: 'Предпросмотр назначенного контента',
    assignedContentText: 'Здесь отображаются только материалы, назначенные администратором. Учитель проводит урок, отмечает посещаемость и фиксирует результат, но не меняет структуру курса.',
    presentation: 'Презентация',
    worksheet: 'Рабочий лист',
    interactiveTask: 'Интерактивное задание',
    interactiveTasks: 'Интерактивные задания',
    homeworkBrief: 'Инструкция к домашнему заданию',
    openContent: 'Открыть',
    theoryContent: 'Теория',
    lessonTaskContent: 'Задание урока',
    practiceContent: 'Практика',
    homeworkContent: 'Домашнее задание',
    grammarContent: 'Грамматика',
    listeningContent: 'Аудирование',
    lessonStructure: 'Структура урока',
    whatCovered: 'Что прошли',
    moveNextLesson: 'Перейти к следующему уроку',
    completeLessonTitle: 'Итог урока',
    completeLessonDescription: 'Сохраните посещаемость, краткий итог и данные для администратора.',
    teacherComment: 'Комментарий учителя',
    carryOver: 'Что перенести на следующий урок',
    readOnlyCompleted: 'Урок завершён. Данные доступны только для просмотра.',
    noAssignedSections: 'Администратор ещё не назначил структуру для этого урока.',
    assignedTasks: 'Назначенные задания',
    noTasksInSection: 'В этом разделе нет отдельных интерактивных заданий.',
    homeworkNote: 'Комментарий к домашнему заданию',
    homeworkInstructionPlaceholder: 'Короткая инструкция к домашнему заданию',
    shortComment: 'Короткий комментарий',
    homeworkDescription: 'Проверяйте домашние задания, практики, грамматику, аудирование и unit checkpoint в одном месте.',
    allGroups: 'Все группы',
    notesDescription: 'Личные рабочие заметки. Без родительского чата и общей ленты школы.',
    attachmentPlaceholder: 'Изображение, документ или ссылка',
    internalNotePlaceholder: 'Внутренняя заметка',
    saveNote: 'Сохранить заметку',
    noNotes: 'Заметок пока нет.',
    pinNote: 'Закрепить заметку',
    deleteNote: 'Удалить',
    deleteNoteConfirm: 'Удалить заметку?',
    pinned: 'Закреплена',
    pinnedNotes: 'Закреплённые',
    recentNotes: 'Последние заметки',
    noteType: 'Тип заметки',
    teacherLanguages: 'Языки преподавания',
    languageUkrainian: 'Украинский',
    languageRussian: 'Русский',
    languageEnglish: 'Английский',
    notificationsDescription: 'Системные уведомления от администраторов и по назначенным данным школы.',
    systemUpdatesEmpty: 'Системные обновления появятся здесь.',
    notificationFeed: 'Лента событий',
    rescheduledTo: 'Перенесено на',
    notificationStudent: 'Ученик',
    notificationGroup: 'Группа',
    notificationCourse: 'Направление',
    read: 'Прочитано',
    markRead: 'Отметить прочитанным',
    open: 'Открыть',
    profileDescription: 'Профиль учителя и настройки интерфейса.',
    personalInformation: 'Личная информация',
    firstName: 'Имя',
    lastName: 'Фамилия',
    phone: 'Телефон',
    email: 'Email',
    languages: 'Языки',
    specialization: 'Специализация',
    shortDescription: 'Краткое описание',
    security: 'Безопасность',
    newPassword: 'Новый пароль',
    changePassword: 'Изменить пароль',
    newEmail: 'Новый email',
    changeEmail: 'Изменить email',
    interface: 'Интерфейс',
    theme: 'Тема',
    language: 'Язык',
    attendance: 'Посещаемость',
    course: 'Курс',
    unit: 'Юнит',
    lesson: 'Урок',
    materials: 'Материалы',
    duration: 'Длительность',
    topic: 'Тема',
    format: 'Формат',
    minutesShort: 'мин',
    online: 'Онлайн',
    classroom: 'Класс',
    assignedLessons: 'Назначенные уроки',
    level: 'Уровень',
    student: 'Ученик',
    groupLabel: 'Группа',
    studentAnalytics: 'Аналитика ученика',
    analyticsDescription: 'Данные только для просмотра: посещаемость, уроки, домашние задания и динамика.',
    completedLessonsMetric: 'Завершённые уроки',
    completedHomeworkMetric: 'Выполненные ДЗ',
    averageHomeworkRating: 'Средняя оценка ДЗ',
    averageLessonRating: 'Средняя оценка уроков',
    lastLessonDate: 'Последний урок',
    nextLessonDate: 'Следующий урок',
    lessonHistory: 'История уроков',
    homeworkHistory: 'История домашних заданий',
    homeworkCompletionChart: 'Выполнение ДЗ',
    lessonActivity: 'Активность уроков',
    noHistory: 'Истории пока нет',
    nextLessonTable: 'Следующий урок',
    openWork: 'Открыть работу',
    studentSubmission: 'Работа ученика',
    noStudentSubmission: 'Работа ученика не прикреплена',
    openStudentSubmission: 'Открыть работу ученика',
    attachments: 'Вложения',
    shortFeedback: 'Короткий отзыв',
    result: 'Результат',
    stars: 'Звёзды',
    markDone: 'Готово',
    returnRevision: 'Вернуть на доработку',
    administrator: 'Администратор',
    myself: 'Я',
    scheduleLabel: 'Расписание',
    studentsLabel: 'Ученики',
    currentUnit: 'Текущий юнит',
    currentLesson: 'Текущий урок',
    nextLessonLabel: 'Следующий урок',
    upcoming: 'Ближайшие',
    lessonCancelled: 'Урок отменён',
    lessonRescheduled: 'Урок перенесён',
    homeworkReceived: 'Домашнее задание получено',
    assignedGroup: 'Назначена группа',
    courseFallback: 'Курс',
    materialsList: 'Презентация, рабочий лист, задание, домашняя работа',
    groupTabs: { Overview: 'Обзор', Students: 'Ученики', Schedule: 'Расписание', Notes: 'Заметки' },
    lessonTabs: { Theory: 'Теория', 'Lesson Tasks': 'Задания урока', Practice: 'Практика', Homework: 'Домашнее задание', Grammar: 'Грамматика', Listening: 'Аудирование', 'Unit Checkpoint': 'Unit Checkpoint' },
    noteTypes: { Private: 'Личная', 'Visible to Admin': 'Для администратора', Important: 'Важная', 'Follow-up': 'Нужно вернуться' },
    noteTargets: { Student: 'Ученик', Group: 'Группа', Lesson: 'Урок', Admin: 'Администратор', Teacher: 'Учитель' },
    attendanceOptions: { present: 'Присутствует', absent_unexcused: 'Отсутствует', late: 'Опоздал(а)', technical_issue: 'Техническая проблема' },
    statusLabels: { Upcoming: 'Запланирован', Ready: 'Готов', 'In Progress': 'Идёт урок', Completed: 'Завершён', Cancelled: 'Отменён', Rescheduled: 'Перенесён', Late: 'Просрочено', Reviewed: 'Проверено', 'Revision Requested': 'Доработка', 'Needs Review': 'Нужно проверить', 'Not Submitted': 'Не сдано', Active: 'Активна', 'By Group': 'По группе' },
  },
  ua: {
    lang: 'ua' as Lang,
    dashboard: 'Головна',
    schedule: 'Розклад',
    groups: 'Мої групи',
    students: 'Учні',
    live: 'Live-уроки',
    lessons: 'Уроки',
    homework: 'Перевірка робіт',
    notes: 'Нотатки',
    notifications: 'Сповіщення',
    profile: 'Профіль',
    logout: 'Вийти',
    today: 'Сьогодні',
    openLesson: 'Відкрити урок',
    startLesson: 'Почати урок',
    finishLesson: 'Завершити урок',
    requestChange: 'Запросити зміну',
    lessonsToday: 'Уроки сьогодні',
    upcomingLessons: 'Найближчі уроки',
    homeworkReview: 'Роботи на перевірці',
    activeStudents: 'Активні учні',
    noLessons: 'Немає призначених уроків',
    noLessonsText: 'Коли адміністратор створить урок у розкладі, він зʼявиться тут. Матеріали без розкладу знаходяться у перевірці робіт.',
    noGroups: 'Немає призначених груп',
    noGroupsText: 'Адміністратор поки не призначив вам групи.',
    noHomework: 'Немає робіт для перевірки',
    noHomeworkText: 'Домашні завдання, практики, граматика, аудіювання та unit checkpoint зʼявляться тут.',
    noNotifications: 'Немає сповіщень',
    save: 'Зберегти',
    saved: 'Збережено',
    failed: 'Не вдалося зберегти зміни',
    attendanceRequired: 'Потрібно відмітити відвідуваність.',
    finishLessonConfirm: 'Завершити урок і зберегти результат?',
    homeworkDueRequired: 'Для перевірки домашнє завдання повинно мати дату здачі.',
    emptyNoteError: 'Порожні нотатки не можна зберігати.',
    requestPrepared: 'Запит підготовлено для адміністратора',
    requestSent: 'Запит надіслано адміністратору',
    teacherWorkspaceLoadFailed: 'Кабінет учителя не завантажився.',
    teacherWorkspaceMissing: 'Профіль учителя ще не привʼязаний',
    teacherWorkspaceMissingText: 'Попросіть адміністратора привʼязати ваш акаунт до профілю вчителя.',
    localNoteWarning: 'Нотатку збережено локально. У базу даних зберегти не вдалося.',
    scheduleChangeRequest: 'Запит на зміну розкладу',
    teacherWorkspace: 'Робочий простір учителя Vetoschool',
    teacherDashboardTitle: 'Панель учителя',
    teacherWorkspaceLine: 'уроки, групи й домашні завдання в одному робочому просторі',
    groupsCount: 'Групи',
    studentsCount: 'Учні',
    thisWeek: 'За тиждень',
    nextLesson: 'Наступний урок',
    viewSchedule: 'До розкладу',
    openHomework: 'Відкрити роботи',
    importantNotifications: 'Важливі сповіщення',
    scheduleDescription: 'Розклад призначає адміністратор. Учитель може переглядати уроки, відкривати їх і запитувати зміни.',
    day: 'День',
    week: 'Тиждень',
    calendar: 'Календар',
    scheduledLessons: 'Заплановані уроки',
    plannedLessons: 'Актуальні уроки',
    conductedLessons: 'Проведені уроки',
    noConductedLessons: 'Проведених уроків поки немає.',
    selectedDate: 'Обрана дата',
    individualLesson: 'Індивідуальний урок',
    individualLessons: 'Індивідуальні',
    groupLesson: 'Груповий урок',
    trialLesson: 'Пробний урок',
    packageLabel: 'Тариф',
    studentsInGroup: 'Учні групи',
    lessonsOnDate: 'уроків',
    previous: 'Назад',
    next: 'Вперед',
    groupsDescription: 'Тут видно лише групи, призначені адміністратором.',
    groupNotFound: 'Групу не знайдено',
    groupNotFoundText: 'Цю групу не призначено вам.',
    openGroupProfile: 'Відкрити профіль групи',
    groupSchedule: 'Розклад групи',
    lessonsDescription: 'Призначені уроки вчителя: статус, тема, учень, курс і час в одному місці.',
    searchLessons: 'Пошук уроків',
    searchStudents: 'Пошук учня',
    noStudentMatches: 'Учнів не знайдено',
    myStudents: 'Учні',
    studentSearchDescription: 'Швидкий список усіх учнів із ваших груп та індивідуальних уроків.',
    allAssignedStudents: 'Усі учні',
    quickProfile: 'Швидкий профіль',
    openAnalytics: 'Відкрити аналітику',
    liveLessons: 'Live-уроки',
    liveLessonsDescription: 'Тут видно, що дитина робить в інтерактивному уроці просто зараз.',
    activeSessions: 'Активні сесії',
    activityLog: 'Журнал дій',
    noLiveSessions: 'Поки ніхто не проходить інтерактивний урок.',
    noLiveEvents: 'Подій поки немає.',
    childHint: 'Підказка дитині',
    childHintPlaceholder: 'Наприклад: спробуй зʼєднати першу картку з правильним словом',
    sendHint: 'Надіслати',
    refresh: 'Оновити',
    liveNeedsDb: 'Live-режим очікує доступ до таблиць Supabase.',
    materialAccess: 'Доступ до блоків',
    materialAccessDescription: 'Відкривайте тільки потрібні блоки на уроці: практика, граматика, аудіювання, домашнє завдання й чекпоінти.',
    opened: 'Відкрито',
    locked: 'Закрито',
    openAccess: 'Відкрити',
    closeAccess: 'Закрити',
    close: 'Закрити',
    openAssignedMaterial: 'Відкрити призначений матеріал',
    assignedContentPreview: 'Перегляд призначеного контенту',
    assignedContentText: 'Тут відображаються лише матеріали, призначені адміністратором. Учитель проводить урок, відмічає відвідуваність і фіксує результат, але не змінює структуру курсу.',
    presentation: 'Презентація',
    worksheet: 'Робочий аркуш',
    interactiveTask: 'Інтерактивне завдання',
    interactiveTasks: 'Інтерактивні завдання',
    homeworkBrief: 'Інструкція до домашнього завдання',
    openContent: 'Відкрити',
    theoryContent: 'Теорія',
    lessonTaskContent: 'Завдання уроку',
    practiceContent: 'Практика',
    homeworkContent: 'Домашнє завдання',
    grammarContent: 'Граматика',
    listeningContent: 'Аудіювання',
    lessonStructure: 'Структура уроку',
    whatCovered: 'Що пройшли',
    moveNextLesson: 'Перейти до наступного уроку',
    completeLessonTitle: 'Підсумок уроку',
    completeLessonDescription: 'Збережіть відвідуваність, короткий підсумок і дані для адміністратора.',
    teacherComment: 'Коментар учителя',
    carryOver: 'Що перенести на наступний урок',
    readOnlyCompleted: 'Урок завершено. Дані доступні лише для перегляду.',
    noAssignedSections: 'Адміністратор ще не призначив структуру для цього уроку.',
    assignedTasks: 'Призначені завдання',
    noTasksInSection: 'У цьому розділі немає окремих інтерактивних завдань.',
    homeworkNote: 'Коментар до домашнього завдання',
    homeworkInstructionPlaceholder: 'Коротка інструкція до домашнього завдання',
    shortComment: 'Короткий коментар',
    homeworkDescription: 'Перевіряйте домашні завдання, практики, граматику, аудіювання та unit checkpoint в одному місці.',
    allGroups: 'Усі групи',
    notesDescription: 'Особисті робочі нотатки. Без батьківського чату й загальної стрічки школи.',
    attachmentPlaceholder: 'Зображення, документ або посилання',
    internalNotePlaceholder: 'Внутрішня нотатка',
    saveNote: 'Зберегти нотатку',
    noNotes: 'Нотаток поки немає.',
    pinNote: 'Закріпити нотатку',
    deleteNote: 'Видалити',
    deleteNoteConfirm: 'Видалити нотатку?',
    pinned: 'Закріплена',
    pinnedNotes: 'Закріплені',
    recentNotes: 'Останні нотатки',
    noteType: 'Тип нотатки',
    teacherLanguages: 'Мови викладання',
    languageUkrainian: 'Українська',
    languageRussian: 'Російська',
    languageEnglish: 'Англійська',
    notificationsDescription: 'Системні сповіщення від адміністраторів і щодо призначених даних школи.',
    systemUpdatesEmpty: 'Системні оновлення зʼявляться тут.',
    notificationFeed: 'Стрічка подій',
    rescheduledTo: 'Перенесено на',
    notificationStudent: 'Учень',
    notificationGroup: 'Група',
    notificationCourse: 'Напрям',
    read: 'Прочитано',
    markRead: 'Позначити прочитаним',
    open: 'Відкрити',
    profileDescription: 'Профіль учителя й налаштування інтерфейсу.',
    personalInformation: 'Особиста інформація',
    firstName: 'Імʼя',
    lastName: 'Прізвище',
    phone: 'Телефон',
    email: 'Email',
    languages: 'Мови',
    specialization: 'Спеціалізація',
    shortDescription: 'Короткий опис',
    security: 'Безпека',
    newPassword: 'Новий пароль',
    changePassword: 'Змінити пароль',
    newEmail: 'Новий email',
    changeEmail: 'Змінити email',
    interface: 'Інтерфейс',
    theme: 'Тема',
    language: 'Мова',
    attendance: 'Відвідуваність',
    course: 'Курс',
    unit: 'Юніт',
    lesson: 'Урок',
    materials: 'Матеріали',
    duration: 'Тривалість',
    topic: 'Тема',
    format: 'Формат',
    minutesShort: 'хв',
    online: 'Онлайн',
    classroom: 'Клас',
    assignedLessons: 'Призначені уроки',
    level: 'Рівень',
    student: 'Учень',
    groupLabel: 'Група',
    studentAnalytics: 'Аналітика учня',
    analyticsDescription: 'Дані лише для перегляду: відвідуваність, уроки, домашні завдання й динаміка.',
    completedLessonsMetric: 'Завершені уроки',
    completedHomeworkMetric: 'Виконані ДЗ',
    averageHomeworkRating: 'Середня оцінка ДЗ',
    averageLessonRating: 'Середня оцінка уроків',
    lastLessonDate: 'Останній урок',
    nextLessonDate: 'Наступний урок',
    lessonHistory: 'Історія уроків',
    homeworkHistory: 'Історія домашніх завдань',
    homeworkCompletionChart: 'Виконання ДЗ',
    lessonActivity: 'Активність уроків',
    noHistory: 'Історії поки немає',
    nextLessonTable: 'Наступний урок',
    openWork: 'Відкрити роботу',
    studentSubmission: 'Робота учня',
    noStudentSubmission: 'Робота учня не прикріплена',
    openStudentSubmission: 'Відкрити роботу учня',
    attachments: 'Вкладення',
    shortFeedback: 'Короткий відгук',
    result: 'Результат',
    stars: 'Зірки',
    markDone: 'Готово',
    returnRevision: 'Повернути на доопрацювання',
    administrator: 'Адміністратор',
    myself: 'Я',
    scheduleLabel: 'Розклад',
    studentsLabel: 'Учні',
    currentUnit: 'Поточний юніт',
    currentLesson: 'Поточний урок',
    nextLessonLabel: 'Наступний урок',
    upcoming: 'Найближчі',
    lessonCancelled: 'Урок скасовано',
    lessonRescheduled: 'Урок перенесено',
    homeworkReceived: 'Домашнє завдання отримано',
    assignedGroup: 'Призначено групу',
    courseFallback: 'Курс',
    materialsList: 'Презентація, робочий аркуш, завдання, домашня робота',
    groupTabs: { Overview: 'Огляд', Students: 'Учні', Schedule: 'Розклад', Notes: 'Нотатки' },
    lessonTabs: { Theory: 'Теорія', 'Lesson Tasks': 'Завдання уроку', Practice: 'Практика', Homework: 'Домашнє завдання', Grammar: 'Граматика', Listening: 'Аудіювання', 'Unit Checkpoint': 'Unit Checkpoint' },
    noteTypes: { Private: 'Особиста', 'Visible to Admin': 'Для адміністратора', Important: 'Важлива', 'Follow-up': 'Повернутися пізніше' },
    noteTargets: { Student: 'Учень', Group: 'Група', Lesson: 'Урок', Admin: 'Адміністратор', Teacher: 'Учитель' },
    attendanceOptions: { present: 'Присутній(я)', absent_unexcused: 'Відсутній(я)', late: 'Запізнився/лась', technical_issue: 'Технічна проблема' },
    statusLabels: { Upcoming: 'Заплановано', Ready: 'Готовий', 'In Progress': 'Урок триває', Completed: 'Завершено', Cancelled: 'Скасовано', Rescheduled: 'Перенесено', Late: 'Прострочено', Reviewed: 'Перевірено', 'Revision Requested': 'Доопрацювання', 'Needs Review': 'Потрібно перевірити', 'Not Submitted': 'Не здано', Active: 'Активна', 'By Group': 'За групою' },
  },
  en: {
    lang: 'en' as Lang,
    dashboard: 'Dashboard',
    schedule: 'Schedule',
    groups: 'My Groups',
    students: 'Students',
    live: 'Live lessons',
    lessons: 'Lessons',
    homework: 'Work Review',
    notes: 'Teacher Notes',
    notifications: 'Notifications',
    profile: 'Profile',
    logout: 'Logout',
    today: 'Today',
    openLesson: 'Open Lesson',
    startLesson: 'Start Lesson',
    finishLesson: 'Finish Lesson',
    requestChange: 'Request change',
    lessonsToday: 'Lessons Today',
    upcomingLessons: 'Upcoming Lessons',
    homeworkReview: 'Work to Review',
    activeStudents: 'Active Students',
    noLessons: 'No assigned lessons',
    noLessonsText: 'Scheduled lessons created by an administrator will appear here. Materials without schedule stay in Work Review.',
    noGroups: 'No assigned groups',
    noGroupsText: 'An administrator has not assigned groups to you yet.',
    noHomework: 'No work to review',
    noHomeworkText: 'Homework, practice, grammar, listening and unit checkpoint submissions will appear here.',
    noNotifications: 'No notifications',
    save: 'Save',
    saved: 'Saved',
    failed: 'Could not save changes',
    attendanceRequired: 'Attendance is required.',
    finishLessonConfirm: 'Finish lesson and save the short result?',
    homeworkDueRequired: 'Homework needs a due date before review.',
    emptyNoteError: 'Empty notes are not allowed.',
    requestPrepared: 'Request prepared for admin',
    requestSent: 'Request sent to admin',
    teacherWorkspaceLoadFailed: 'Teacher workspace did not load.',
    teacherWorkspaceMissing: 'Teacher profile is not linked yet',
    teacherWorkspaceMissingText: 'Ask an administrator to link your account to a teacher record.',
    localNoteWarning: 'Note saved locally. Database note could not be saved.',
    scheduleChangeRequest: 'Schedule change request',
    teacherWorkspace: 'Vetoschool teacher workspace',
    teacherDashboardTitle: 'Teacher Panel',
    teacherWorkspaceLine: 'lessons, groups and homework in one workspace',
    groupsCount: 'Groups',
    studentsCount: 'Students',
    thisWeek: 'This week',
    nextLesson: 'Next lesson',
    viewSchedule: 'View schedule',
    openHomework: 'Open work',
    importantNotifications: 'Important notifications',
    scheduleDescription: 'Schedule is assigned by administrators. Teachers can view, open lessons and request changes.',
    day: 'Day',
    week: 'Week',
    calendar: 'Calendar',
    scheduledLessons: 'Scheduled lessons',
    plannedLessons: 'Current lessons',
    conductedLessons: 'Completed lessons',
    noConductedLessons: 'No completed lessons yet.',
    selectedDate: 'Selected date',
    individualLesson: 'Individual lesson',
    individualLessons: 'Individual',
    groupLesson: 'Group lesson',
    trialLesson: 'Trial lesson',
    packageLabel: 'Tariff',
    studentsInGroup: 'Group students',
    lessonsOnDate: 'lessons',
    previous: 'Previous',
    next: 'Next',
    groupsDescription: 'Only groups assigned by the administrator are visible here.',
    groupNotFound: 'Group not found',
    groupNotFoundText: 'This group is not assigned to you.',
    openGroupProfile: 'Open group profile',
    groupSchedule: 'Group schedule',
    lessonsDescription: 'Assigned teacher lessons: status, topic, student, course and time in one place.',
    searchLessons: 'Search lessons',
    searchStudents: 'Search student',
    noStudentMatches: 'No students found',
    myStudents: 'Students',
    studentSearchDescription: 'Fast list of all students from your groups and individual lessons.',
    allAssignedStudents: 'All students',
    quickProfile: 'Quick profile',
    openAnalytics: 'Open analytics',
    liveLessons: 'Live lessons',
    liveLessonsDescription: 'See what a child is doing in an interactive lesson right now.',
    activeSessions: 'Active sessions',
    activityLog: 'Activity log',
    noLiveSessions: 'No one is taking an interactive lesson yet.',
    noLiveEvents: 'No events yet.',
    childHint: 'Hint for the child',
    childHintPlaceholder: 'For example: try matching the first card with the correct word',
    sendHint: 'Send',
    refresh: 'Refresh',
    liveNeedsDb: 'Live mode is waiting for Supabase table access.',
    materialAccess: 'Block access',
    materialAccessDescription: 'Open only the needed lesson blocks: practice, grammar, listening, homework, and checkpoints.',
    opened: 'Opened',
    locked: 'Locked',
    openAccess: 'Open',
    closeAccess: 'Close',
    close: 'Close',
    openAssignedMaterial: 'Open assigned material',
    assignedContentPreview: 'Assigned content preview',
    assignedContentText: 'This workspace shows only materials assigned by the administrator. The teacher can conduct the lesson, mark attendance and record a short result, but cannot edit course structure.',
    presentation: 'Presentation',
    worksheet: 'Worksheet',
    interactiveTask: 'Interactive task',
    interactiveTasks: 'Interactive tasks',
    homeworkBrief: 'Homework brief',
    openContent: 'Open',
    theoryContent: 'Theory',
    lessonTaskContent: 'Lesson task',
    practiceContent: 'Practice',
    homeworkContent: 'Homework',
    grammarContent: 'Grammar',
    listeningContent: 'Listening',
    lessonStructure: 'Lesson structure',
    whatCovered: 'What was covered',
    moveNextLesson: 'Move to next lesson',
    completeLessonTitle: 'Lesson result',
    completeLessonDescription: 'Save attendance, a short result, and admin handoff details.',
    teacherComment: 'Teacher comment',
    carryOver: 'Move to next lesson',
    readOnlyCompleted: 'This lesson is completed. Data is read-only.',
    noAssignedSections: 'The administrator has not assigned a structure for this lesson yet.',
    assignedTasks: 'Assigned tasks',
    noTasksInSection: 'There are no separate interactive tasks in this section.',
    homeworkNote: 'Homework note',
    homeworkInstructionPlaceholder: 'Short homework instruction from assigned lesson',
    shortComment: 'Short comment',
    homeworkDescription: 'Review homework, practice, grammar, listening and unit checkpoint submissions in one place.',
    allGroups: 'All groups',
    notesDescription: 'Simple internal notes. No parent chat, no school-wide activity log.',
    attachmentPlaceholder: 'Image, document or link',
    internalNotePlaceholder: 'Internal note',
    saveNote: 'Save note',
    noNotes: 'No notes yet.',
    pinNote: 'Pin note',
    deleteNote: 'Delete',
    deleteNoteConfirm: 'Delete note?',
    pinned: 'Pinned',
    pinnedNotes: 'Pinned',
    recentNotes: 'Recent notes',
    noteType: 'Note type',
    teacherLanguages: 'Teaching languages',
    languageUkrainian: 'Ukrainian',
    languageRussian: 'Russian',
    languageEnglish: 'English',
    notificationsDescription: 'System notifications from administrators and assigned school data.',
    systemUpdatesEmpty: 'System updates will appear here.',
    notificationFeed: 'Event feed',
    rescheduledTo: 'Rescheduled to',
    notificationStudent: 'Student',
    notificationGroup: 'Group',
    notificationCourse: 'Track',
    read: 'Read',
    markRead: 'Mark read',
    open: 'Open',
    profileDescription: 'Minimal teacher profile and interface settings.',
    personalInformation: 'Personal information',
    firstName: 'First name',
    lastName: 'Last name',
    phone: 'Phone',
    email: 'Email',
    languages: 'Languages',
    specialization: 'Specialization',
    shortDescription: 'Short description',
    security: 'Security',
    newPassword: 'New password',
    changePassword: 'Change password',
    newEmail: 'New email',
    changeEmail: 'Change email',
    interface: 'Interface',
    theme: 'Theme',
    language: 'Language',
    attendance: 'Attendance',
    course: 'Course',
    unit: 'Unit',
    lesson: 'Lesson',
    materials: 'Materials',
    duration: 'Duration',
    topic: 'Topic',
    format: 'Format',
    minutesShort: 'min',
    online: 'Online',
    classroom: 'Classroom',
    assignedLessons: 'Assigned lessons',
    level: 'Level',
    student: 'Student',
    groupLabel: 'Group',
    studentAnalytics: 'Student analytics',
    analyticsDescription: 'View-only teacher data: attendance, lessons, homework, and progress over time.',
    completedLessonsMetric: 'Completed lessons',
    completedHomeworkMetric: 'Completed homework',
    averageHomeworkRating: 'Average homework rating',
    averageLessonRating: 'Average lesson rating',
    lastLessonDate: 'Last lesson',
    nextLessonDate: 'Next lesson',
    lessonHistory: 'Lesson history',
    homeworkHistory: 'Homework history',
    homeworkCompletionChart: 'Homework completion',
    lessonActivity: 'Lesson activity',
    noHistory: 'No history yet',
    nextLessonTable: 'Next lesson',
    openWork: 'Open work',
    studentSubmission: 'Student work',
    noStudentSubmission: 'Student work is not attached',
    openStudentSubmission: 'Open student work',
    attachments: 'Attachments',
    shortFeedback: 'Short feedback',
    result: 'Result',
    stars: 'Stars',
    markDone: 'Mark done',
    returnRevision: 'Return for revision',
    administrator: 'Administrator',
    myself: 'Myself',
    scheduleLabel: 'Schedule',
    studentsLabel: 'Students',
    currentUnit: 'Current unit',
    currentLesson: 'Current lesson',
    nextLessonLabel: 'Next lesson',
    upcoming: 'Upcoming',
    lessonCancelled: 'Lesson cancelled',
    lessonRescheduled: 'Lesson rescheduled',
    homeworkReceived: 'Homework received',
    assignedGroup: 'Assigned group',
    courseFallback: 'Course',
    materialsList: 'Presentation, worksheet, task, homework',
    groupTabs: { Overview: 'Overview', Students: 'Students', Schedule: 'Schedule', Notes: 'Notes' },
    lessonTabs: { Theory: 'Theory', 'Lesson Tasks': 'Lesson Tasks', Practice: 'Practice', Homework: 'Homework', Grammar: 'Grammar', Listening: 'Listening', 'Unit Checkpoint': 'Unit Checkpoint' },
    noteTypes: { Private: 'Private', 'Visible to Admin': 'For Admin', Important: 'Important', 'Follow-up': 'Follow-up' },
    noteTargets: { Student: 'Student', Group: 'Group', Lesson: 'Lesson', Admin: 'Admin', Teacher: 'Teacher' },
    attendanceOptions: { present: 'Present', absent_unexcused: 'Absent', late: 'Late', technical_issue: 'Technical Issue' },
    statusLabels: { Upcoming: 'Upcoming', Ready: 'Ready', 'In Progress': 'In Progress', Completed: 'Completed', Cancelled: 'Cancelled', Rescheduled: 'Rescheduled', Late: 'Late', Reviewed: 'Reviewed', 'Revision Requested': 'Revision Requested', 'Needs Review': 'Needs Review', 'Not Submitted': 'Not Submitted', Active: 'Active', 'By Group': 'By Group' },
  },
};

type TeacherCopy = (typeof copyByLang)['ru'];
type GroupProfileTab = 'Overview' | 'Students' | 'Schedule' | 'Notes';
type HomeworkFilter = 'Needs Review' | 'Reviewed' | 'Revision Requested' | 'Not Submitted' | 'Late';

function cardClass(extra = '') {
  return `rounded-[26px] border border-white/80 bg-white/75 shadow-[0_14px_40px_rgba(126,87,194,0.07)] backdrop-blur-xl dark-panel-soft ${extra}`;
}

function compactButton(tone: 'purple' | 'pink' | 'blue' | 'green' | 'yellow' | 'red' = 'purple') {
  const tones = {
    purple: 'border-purple-100 bg-white/80 text-purple-700 hover:border-purple-200 hover:bg-purple-50/80',
    pink: 'border-pink-100 bg-white/80 text-pink-600 hover:border-pink-200 hover:bg-pink-50/80',
    blue: 'border-blue-100 bg-white/80 text-blue-600 hover:border-blue-200 hover:bg-blue-50/80',
    green: 'border-emerald-100 bg-white/80 text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50/80',
    yellow: 'border-amber-100 bg-white/80 text-amber-600 hover:border-amber-200 hover:bg-amber-50/80',
    red: 'border-red-100 bg-white/80 text-red-600 hover:border-red-200 hover:bg-red-50/80',
  };
  return `inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 font-body text-xs font-900 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`;
}

function dateValue(lesson: TeacherLesson) {
  return new Date(`${lesson.date || new Date().toISOString().slice(0, 10)}T${lesson.time || '00:00'}`).getTime();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const startedLessonStorageKey = (lessonId: string) => `vetoschool:teacher-started-at:${lessonId}`;

function saveLocalLessonStart(lessonId: string, startedAt: string) {
  try {
    window.localStorage.setItem(startedLessonStorageKey(lessonId), startedAt);
  } catch {
    // Timer still works in memory when storage is unavailable.
  }
}

function readLocalLessonStart(lessonId: string) {
  try {
    return window.localStorage.getItem(startedLessonStorageKey(lessonId));
  } catch {
    return null;
  }
}

function clearLocalLessonStart(lessonId: string) {
  try {
    window.localStorage.removeItem(startedLessonStorageKey(lessonId));
  } catch {
    // No-op.
  }
}

function withLocalLessonStarts(data: TeacherWorkspace): TeacherWorkspace {
  return {
    ...data,
    lessons: data.lessons.map(lesson => {
      if (lesson.status === 'completed' || lesson.isConducted || lesson.completedAt) return lesson;
      const localStartedAt = readLocalLessonStart(lesson.id);
      if (!localStartedAt) return lesson;
      return { ...lesson, status: 'in_progress', startedAt: lesson.startedAt || localStartedAt };
    }),
  };
}

function lessonStatus(lesson: TeacherLesson) {
  if (lesson.startedAt && lesson.status !== 'completed' && !lesson.isConducted) return 'In Progress';
  if (lesson.status === 'in_progress') return 'In Progress';
  if (lesson.status === 'completed') return 'Completed';
  if (lesson.status === 'cancelled') return 'Cancelled';
  if (lesson.status === 'rescheduled') return 'Rescheduled';
  const diff = dateValue(lesson) - Date.now();
  if (diff <= 15 * 60 * 1000 && diff > -70 * 60 * 1000) return 'Ready';
  return 'Upcoming';
}

function copyMissing(copy: TeacherCopy) {
  return missingValue[copy.lang];
}

function statusLabel(status: string, copy: TeacherCopy) {
  return (copy.statusLabels as Record<string, string>)[status] || status;
}

function groupTabLabel(tab: GroupProfileTab, copy: TeacherCopy) {
  return copy.groupTabs[tab];
}

function noteTypeLabel(type: NoteType, copy: TeacherCopy) {
  return copy.noteTypes[type];
}

function notificationTypeLabel(type: string, copy: TeacherCopy) {
  const map: Record<string, string> = {
    'Lesson cancelled': copy.lessonCancelled,
    'Lesson rescheduled': copy.lessonRescheduled,
    'Homework received': copy.homeworkReceived,
    'Assigned group': copy.assignedGroup,
    'Schedule change request': copy.scheduleChangeRequest,
  };
  return map[type] || type;
}

function statusBadge(status: string, copy: TeacherCopy) {
  const tones: Record<string, string> = {
    Upcoming: 'bg-blue-100 text-blue-700',
    Ready: 'bg-pink-100 text-pink-700',
    'In Progress': 'bg-purple-100 text-purple-700',
    Completed: 'bg-green-100 text-green-700',
    Cancelled: 'bg-red-100 text-red-600',
    Rescheduled: 'bg-yellow-100 text-yellow-700',
    Late: 'bg-yellow-100 text-yellow-700',
    Reviewed: 'bg-green-100 text-green-700',
    'Needs Review': 'bg-pink-100 text-pink-700',
    'Not Submitted': 'bg-purple-100 text-purple-700',
    Active: 'bg-green-100 text-green-700',
  };
  return <span className={`rounded-full px-3 py-1 font-body text-xs font-900 ${tones[status] || 'bg-purple-100 text-purple-700'}`}>{statusLabel(status, copy)}</span>;
}

function groupForLesson(workspace: TeacherWorkspace, lesson: TeacherLesson) {
  return workspace.groups.find(group => group.id === lesson.groupId);
}

function studentsForLesson(workspace: TeacherWorkspace, lesson: TeacherLesson) {
  const group = groupForLesson(workspace, lesson);
  if (group) return workspace.students.filter(student => group.studentIds.includes(student.id));
  return workspace.students.filter(student => student.id === lesson.studentId);
}

function lessonTarget(workspace: TeacherWorkspace, lesson: TeacherLesson) {
  const group = groupForLesson(workspace, lesson);
  if (group) return group.name;
  return workspace.students.find(student => student.id === lesson.studentId)?.name || missingValue.en;
}

function homeworkState(item: TeacherHomework): HomeworkFilter {
  if (item.reviewStatus === 'revision_requested') return 'Revision Requested';
  if (item.reviewStatus === 'reviewed') return 'Reviewed';
  if (item.interactiveCompletedAt || item.studentResult === 'Interactive completed' || item.interactiveScorePercent != null) return 'Reviewed';
  if (item.reviewStatus === 'submitted') return 'Needs Review';
  if (item.checkedAt) return 'Reviewed';
  if (item.submittedAt) return 'Needs Review';
  if (item.dueDate && item.dueDate < todayIso()) return 'Late';
  return 'Not Submitted';
}

function courseForStudent(workspace: TeacherWorkspace, studentId: string) {
  const student = workspace.students.find(item => item.id === studentId);
  return student?.course || workspace.groups.find(group => group.studentIds.includes(studentId))?.course || missingValue.en;
}

function groupForStudent(workspace: TeacherWorkspace, studentId: string) {
  return workspace.groups.find(group => group.studentIds.includes(studentId));
}

function langLocale(lang: Lang) {
  return lang === 'ua' ? 'uk-UA' : lang === 'ru' ? 'ru-RU' : 'en-US';
}

function dateFromIso(value: string) {
  return new Date(`${value}T00:00:00`);
}

function isoFromDate(value: Date) {
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

function calendarDays(baseIso: string) {
  const base = dateFromIso(baseIso);
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return {
      iso: isoFromDate(day),
      number: day.getDate(),
      inMonth: day.getMonth() === base.getMonth(),
    };
  });
}

function lessonTypeLabel(lesson: TeacherLesson, copy: TeacherCopy) {
  if (lesson.type === 'group') return copy.groupLesson;
  if (lesson.type === 'trial') return copy.trialLesson;
  return copy.individualLesson;
}

function lessonCourse(workspace: TeacherWorkspace, lesson: TeacherLesson) {
  const group = groupForLesson(workspace, lesson);
  return group?.course || courseForStudent(workspace, lesson.studentId);
}

function lessonUnit(workspace: TeacherWorkspace, lesson: TeacherLesson, copy: TeacherCopy) {
  const group = groupForLesson(workspace, lesson);
  return group?.currentUnit || lesson.lessonNumber || copyMissing(copy);
}

function lessonTopic(lesson: TeacherLesson, copy: TeacherCopy) {
  return lesson.topic || lesson.title || copyMissing(copy);
}

function lessonNumberValue(workspace: TeacherWorkspace, lesson: TeacherLesson, copy: TeacherCopy) {
  const group = groupForLesson(workspace, lesson);
  return lesson.lessonNumber || group?.currentLesson || copyMissing(copy);
}

function lessonDateLabel(lesson: TeacherLesson, copy: TeacherCopy) {
  const date = lesson.date ? dateFromIso(lesson.date) : new Date();
  const weekday = date.toLocaleDateString(langLocale(copy.lang), { weekday: 'long' });
  return `${formatTeacherDate(lesson.date, copy.lang, false)} · ${weekday} · ${lesson.time}`;
}

function studentPlan(student: TeacherStudent, copy: TeacherCopy) {
  return student.level || student.course || copyMissing(copy);
}

const conductedLessonGroups = ['Mini Kids', 'Kids A1', 'Kids Beginners', 'Junior Beginners', 'Junior A1 10–12'];

function conductedLessonGroupLabel(workspace: TeacherWorkspace, lesson: TeacherLesson, copy: TeacherCopy) {
  const group = groupForLesson(workspace, lesson);
  if (!group || lesson.type === 'individual') return copy.individualLessons;
  const source = `${group.name} ${group.course || ''} ${group.level || ''}`.toLowerCase();
  return conductedLessonGroups.find(label => source.includes(label.toLowerCase())) || group.name || group.course || copy.groupLesson;
}

function isActionableLesson(lesson: TeacherLesson) {
  return !['completed', 'cancelled', 'rescheduled'].includes(lesson.status) && dateValue(lesson) >= Date.now();
}

function groupedConductedLessons(workspace: TeacherWorkspace, copy: TeacherCopy) {
  const completed = workspace.lessons
    .filter(lesson => lesson.status === 'completed' || lesson.isConducted)
    .sort((a, b) => dateValue(b) - dateValue(a));
  const order = [...conductedLessonGroups, copy.individualLessons];
  const groups = completed.reduce<Record<string, TeacherLesson[]>>((acc, lesson) => {
    const label = conductedLessonGroupLabel(workspace, lesson, copy);
    acc[label] = acc[label] || [];
    acc[label].push(lesson);
    return acc;
  }, {});
  return Object.entries(groups).sort(([a], [b]) => {
    const aIndex = order.indexOf(a);
    const bIndex = order.indexOf(b);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex) || a.localeCompare(b);
  });
}

export default function TeacherDashboard({
  lang,
  setLang,
  mode = 'root',
}: {
  lang: Lang;
  setLang?: (lang: Lang) => void;
  mode?: TeacherRouteMode;
}) {
  const copy = copyByLang[lang] || copyByLang.ru;
  const navigate = useNavigate();
  const params = useParams();
  const user = getCurrentUser();
  const [workspace, setWorkspace] = useState<TeacherWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [active, setActive] = useState<TeacherSection>('dashboard');
  const [toast, setToast] = useState('');
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, AttendanceStatus>>({});
  const [lessonTab, setLessonTab] = useState<LessonWorkspaceTab>('Theory');
  const [localNotes, setLocalNotes] = useState<LocalNote[]>([]);
  const [notifications, setNotifications] = useState<TeacherNotification[]>([]);
  const visibleStudentKey = useMemo(
    () => workspace?.students.map(student => student.id).sort().join(',') || '',
    [workspace?.students],
  );

  const refresh = useCallback(async () => {
    setLoadError('');
    const data = withLocalLessonStarts(await loadTeacherWorkspace(user?.id));
    setWorkspace(data);
    setLocalNotes(data.notes.map(teacherNoteToLocal));
    const generatedNotifications = makeNotifications(data);
    if (!data.teacher) {
      setNotifications(generatedNotifications);
      return;
    }
    const persistedStates = await loadTeacherNotificationStates(data.teacher.id);
    setNotifications(generatedNotifications.map(notification => ({
      ...notification,
      read: persistedStates[notification.id]?.read ?? notification.read,
    })));
  }, [user?.id]);

  useEffect(() => {
    refresh()
      .catch(error => {
        setLoadError(error instanceof Error ? error.message : copy.teacherWorkspaceLoadFailed);
        setWorkspace(null);
      })
      .finally(() => setLoading(false));
  }, [copy.teacherWorkspaceLoadFailed, refresh]);

  useEffect(() => {
    if (!visibleStudentKey) return;
    const visibleStudentIds = new Set(visibleStudentKey.split(',').filter(Boolean));
    let refreshTimer = 0;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void refresh(), 350);
    };
    const channel = supabase
      .channel(`teacher-workspace-${workspace?.teacher?.id || 'active'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_items' }, payload => {
        const row = (payload.new || payload.old) as { user_id?: string } | null;
        if (row?.user_id && visibleStudentIds.has(row.user_id)) scheduleRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_live_sessions' }, payload => {
        const row = (payload.new || payload.old) as { student_id?: string; status?: string } | null;
        if (row?.student_id && visibleStudentIds.has(row.student_id) && row.status === 'completed') scheduleRefresh();
      })
      .subscribe();
    const interval = window.setInterval(() => void refresh(), 20000);
    return () => {
      window.clearTimeout(refreshTimer);
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [refresh, visibleStudentKey, workspace?.teacher?.id]);

  useEffect(() => {
    if (mode === 'group') setActive('groups');
    if (mode === 'student') setActive('groups');
  }, [mode, params.groupId, params.studentId]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const visibleGroup = useMemo(() => workspace?.groups.find(group => group.id === params.groupId) || null, [params.groupId, workspace]);
  const visibleStudent = useMemo(() => workspace?.students.find(student => student.id === params.studentId) || null, [params.studentId, workspace]);
  const selectedLesson = useMemo(() => workspace?.lessons.find(lesson => lesson.id === openLessonId) || null, [openLessonId, workspace]);

  const updateLocalLesson = (lessonId: string, patch: Partial<TeacherLesson>) => {
    setWorkspace(prev => prev ? { ...prev, lessons: prev.lessons.map(lesson => lesson.id === lessonId ? { ...lesson, ...patch } : lesson) } : prev);
  };

  const openLesson = (lesson: TeacherLesson) => {
    const students = workspace ? studentsForLesson(workspace, lesson) : [];
    setOpenLessonId(lesson.id);
    setLessonTab(lesson.structure[0]?.id || 'assigned');
    setAttendanceDraft(Object.fromEntries(students.map(student => {
      const existing = workspace?.attendance.find(row => row.lessonId === lesson.id && row.studentId === student.id);
      return [student.id, existing?.status || 'present'];
    })));
  };

  const requestScheduleChange = async (lesson: TeacherLesson) => {
    if (!workspace?.teacher) return;
    try {
      await createLessonChangeRequest({
        lessonId: lesson.id,
        teacherId: workspace.teacher.id,
        requestType: 'reschedule',
        desiredDate: lesson.date,
        desiredTime: lesson.time,
        reason: copy.scheduleChangeRequest,
        comment: lesson.topic || lesson.title,
      });
      showToast(`${copy.requestSent}: ${lesson.topic || lesson.title}`);
      setNotifications(prev => [{
        id: `schedule-request-${lesson.id}`,
        type: 'Schedule change request',
        text: `${copy.requestSent}: ${lesson.topic || lesson.title}`,
        date: new Date().toISOString(),
        read: false,
        relatedSection: 'schedule',
        lessonId: lesson.id,
        studentId: lesson.studentId,
        groupId: lesson.groupId || undefined,
      }, ...prev.filter(item => item.id !== `schedule-request-${lesson.id}`)]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : copy.failed);
    }
  };

  const startLesson = async (lesson: TeacherLesson) => {
    const startedAt = lesson.startedAt || new Date().toISOString();
    saveLocalLessonStart(lesson.id, startedAt);
    updateLocalLesson(lesson.id, { status: 'in_progress', startedAt, completedAt: null });
    openLesson({ ...lesson, status: 'in_progress', startedAt, completedAt: null });
    try {
      await updateTeacherLesson(lesson.id, { status: 'in_progress' });
    } catch (error) {
      console.warn('Could not persist lesson start immediately; it will be saved with the lesson result.', error);
    }
  };

  const finishLesson = async (draft: LessonCompletionDraft) => {
    if (!workspace?.teacher || !selectedLesson) return false;
    if (!Object.keys(attendanceDraft).length) {
      showToast(copy.attendanceRequired);
      return false;
    }
    try {
      const result = await completeTeacherLesson({
        lessonId: selectedLesson.id,
        teacherId: workspace.teacher.id,
        groupId: selectedLesson.groupId,
        attendance: Object.entries(attendanceDraft).map(([studentId, status]) => ({ studentId, status })),
        summary: draft.summary,
        teacherComment: draft.teacherComment,
        homeworkBrief: draft.homeworkBrief,
        carryOverToNextLesson: draft.carryOverToNextLesson,
        adminNote: draft.adminNote,
        startedAt: selectedLesson.startedAt,
        grades: Object.entries(draft.grades).map(([studentId, score]) => ({ studentId, score, category: 'Participation' })),
      });
      clearLocalLessonStart(selectedLesson.id);
      setWorkspace(prev => prev ? {
        ...prev,
        lessons: prev.lessons.map(lesson => lesson.id === selectedLesson.id ? {
          ...lesson,
          status: 'completed',
          isConducted: true,
          startedAt: selectedLesson.startedAt,
          completedAt: new Date().toISOString(),
          comment: draft.teacherComment || null,
          homeworkBrief: draft.homeworkBrief || null,
          carryOverToNextLesson: draft.carryOverToNextLesson || null,
          result,
        } : lesson),
        attendance: mergeAttendance(prev.attendance, selectedLesson.id, workspace.teacher!.id, attendanceDraft, ''),
        stats: { ...prev.stats, completedLessons: prev.stats.completedLessons + (selectedLesson.status === 'completed' ? 0 : 1), upcomingLessons: Math.max(0, prev.stats.upcomingLessons - 1) },
      } : prev);
      showToast(copy.saved);
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : copy.failed);
      return false;
    }
  };

  const saveHomeworkReview = async (homework: TeacherHomework, patch: { teacherComment?: string; resultPercent?: number | null; starRating?: number | null; status?: 'reviewed' | 'revision_requested' }) => {
    try {
      await saveHomeworkComment(homework.id, {
        teacherId: workspace?.teacher?.id,
        teacherComment: patch.teacherComment ?? homework.teacherComment ?? '',
        resultPercent: patch.resultPercent ?? homework.resultPercent,
        starRating: patch.starRating ?? homework.starRating,
        status: patch.status || 'reviewed',
      });
      setWorkspace(prev => prev ? {
        ...prev,
        homeworks: prev.homeworks.map(item => item.id === homework.id ? {
          ...item,
          teacherComment: patch.teacherComment ?? item.teacherComment,
          resultPercent: patch.resultPercent ?? item.resultPercent,
          starRating: patch.starRating ?? item.starRating,
          checkedAt: new Date().toISOString(),
          reviewStatus: patch.status || 'reviewed',
          reviewedByTeacherId: workspace?.teacher?.id || item.reviewedByTeacherId,
          reviewComment: patch.teacherComment ?? item.reviewComment,
          studentResult: patch.status === 'revision_requested' ? 'Revision Requested' : item.studentResult,
        } : item),
      } : prev);
      showToast(copy.saved);
    } catch (error) {
      showToast(error instanceof Error ? error.message : copy.failed);
    }
  };

  const toggleContentAccess = async (item: TeacherHomework) => {
    const nextUnlocked = !item.unlocked;
    setWorkspace(prev => prev ? {
      ...prev,
      homeworks: prev.homeworks.map(homework => homework.id === item.id ? { ...homework, unlocked: nextUnlocked } : homework),
    } : prev);
    try {
      await updateTeacherContentAccess(item.id, nextUnlocked);
      showToast(nextUnlocked ? copy.opened : copy.locked);
    } catch (error) {
      setWorkspace(prev => prev ? {
        ...prev,
        homeworks: prev.homeworks.map(homework => homework.id === item.id ? { ...homework, unlocked: item.unlocked } : homework),
      } : prev);
      showToast(error instanceof Error ? error.message : copy.failed);
    }
  };

  const saveNote = async (note: Omit<LocalNote, 'id' | 'createdAt'>) => {
    if (!note.text.trim()) {
      showToast(copy.emptyNoteError);
      return false;
    }
    const fallbackNote = { ...note, id: `note-${Date.now()}`, createdAt: new Date().toISOString() };
    if (workspace?.teacher) {
      try {
        const savedNote = await addTeacherNote({
          teacherId: workspace.teacher.id,
          target: note.target,
          targetId: note.targetId,
          authorId: workspace.teacher.teacherUserId || user?.id || workspace.teacher.id,
          text: note.text,
          noteType: note.type,
          attachmentLabel: note.attachmentLabel,
          pinned: note.pinned,
        });
        setLocalNotes(prev => [teacherNoteToLocal(savedNote), ...prev]);
      } catch {
        setLocalNotes(prev => [fallbackNote, ...prev]);
        showToast(copy.localNoteWarning);
        return true;
      }
    } else {
      setLocalNotes(prev => [fallbackNote, ...prev]);
    }
    showToast(copy.saved);
    return true;
  };

  const toggleNotePin = async (id: string) => {
    const note = localNotes.find(item => item.id === id);
    if (!note) return;
    const nextPinned = !note.pinned;
    setLocalNotes(prev => prev.map(item => item.id === id ? { ...item, pinned: nextPinned } : item));
    if (id.startsWith('note-')) return;
    try {
      await updateTeacherNotePinned(id, nextPinned);
    } catch {
      setLocalNotes(prev => prev.map(item => item.id === id ? { ...item, pinned: note.pinned } : item));
      showToast(copy.localNoteWarning);
    }
  };

  const removeNote = async (id: string) => {
    const note = localNotes.find(item => item.id === id);
    setLocalNotes(prev => prev.filter(item => item.id !== id));
    if (!note || id.startsWith('note-')) return;
    try {
      await deleteTeacherNote(id);
    } catch {
      setLocalNotes(prev => [note, ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      showToast(copy.localNoteWarning);
    }
  };

  const navigateSection = (section: TeacherSection) => {
    setActive(section);
    navigate('/teacher');
  };

  const markNotificationRead = async (notification: TeacherNotification, opened = false) => {
    setNotifications(prev => prev.map(item => item.id === notification.id ? { ...item, read: true } : item));
    if (!workspace?.teacher) return;
    try {
      await saveTeacherNotificationState({
        teacherId: workspace.teacher.id,
        eventKey: notification.id,
        type: notification.type,
        title: notification.topic || notification.text,
        body: notification.text,
        date: notification.date,
        relatedSection: notification.relatedSection,
        lessonId: notification.lessonId || null,
        homeworkId: notification.homeworkId || null,
        studentId: notification.studentId || null,
        groupId: notification.groupId || null,
        opened,
      });
    } catch (error) {
      console.warn('teacher notification state was not persisted', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (loading) return <TeacherLoading />;
  if (!workspace?.teacher) {
    return (
      <div className="page-bg-admin min-h-screen p-4">
        <div className="mx-auto max-w-2xl pt-16">
          <CompactEmpty icon={GraduationCap} title={loadError ? copy.teacherWorkspaceLoadFailed : copy.teacherWorkspaceMissing} description={loadError || copy.teacherWorkspaceMissingText} />
        </div>
      </div>
    );
  }

  const content = (() => {
    if (mode === 'group' && visibleGroup) return <GroupProfile groupId={visibleGroup.id} workspace={workspace} localNotes={localNotes} onOpenLesson={openLesson} onSaveNote={saveNote} copy={copy} />;
    if (mode === 'student' && visibleStudent) return <StudentProfile student={visibleStudent} workspace={workspace} copy={copy} onOpenLesson={openLesson} />;
    if (active === 'dashboard') return <DashboardPage workspace={workspace} notifications={notifications} copy={copy} onOpenLesson={openLesson} onNavigate={navigateSection} />;
    if (active === 'schedule') return <SchedulePage workspace={workspace} copy={copy} onOpenLesson={openLesson} onStartLesson={startLesson} onRequestChange={requestScheduleChange} />;
    if (active === 'groups') return <GroupsPage workspace={workspace} copy={copy} onOpenGroup={id => navigate(`/teacher/groups/${id}`)} />;
    if (active === 'students') return <StudentSearchDashboard workspace={workspace} copy={copy} onOpenStudent={id => navigate(`/teacher/students/${id}`)} onToggleContentAccess={toggleContentAccess} />;
    if (active === 'live') return <TeacherLiveLessons workspace={workspace} copy={copy} />;
    if (active === 'lessons') return <LessonsPage workspace={workspace} copy={copy} onOpenLesson={openLesson} onStartLesson={startLesson} />;
    if (active === 'homework') return <HomeworkPage workspace={workspace} copy={copy} onSaveReview={saveHomeworkReview} />;
    if (active === 'notes') return <NotesPage workspace={workspace} localNotes={localNotes} copy={copy} onSaveNote={saveNote} onTogglePin={toggleNotePin} onDeleteNote={removeNote} />;
    if (active === 'notifications') return <NotificationsPage notifications={notifications} copy={copy} onRead={markNotificationRead} onOpen={notification => { void markNotificationRead(notification, true); navigateSection(notification.relatedSection); }} />;
    if (active === 'profile') return <ProfilePage workspace={workspace} lang={lang} copy={copy} onRefresh={refresh} showToast={showToast} />;
    return null;
  })();

  return (
    <div className="page-bg-admin min-h-screen">
      {toast && <div className="fixed left-1/2 top-4 z-[70] -translate-x-1/2 rounded-full border border-purple-100 bg-white/95 px-5 py-3 font-body text-sm font-900 text-purple-700 shadow-xl backdrop-blur">{toast}</div>}
      <TeacherTopNav
        teacher={workspace.teacher}
        lang={lang}
        copy={copy}
        notifications={notifications}
        onLangChange={next => { localStorage.setItem('vetoschool_lang', next); setLang?.(next); }}
        onNotificationsOpen={() => navigateSection('notifications')}
        onLogout={handleLogout}
      />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-5">
        <TeacherHero workspace={workspace} copy={copy} />
        <TeacherAdminStats workspace={workspace} copy={copy} />
        <TeacherSectionTabs active={active} copy={copy} onNavigate={navigateSection} />
        <AnimatePresence mode="wait">
          <motion.div key={`${mode}-${active}-${params.groupId || ''}-${params.studentId || ''}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            {content}
          </motion.div>
        </AnimatePresence>
      </main>
      {selectedLesson && workspace && (
        <LessonWorkspace
          workspace={workspace}
          lesson={selectedLesson}
          tab={lessonTab}
          setTab={setLessonTab}
          attendanceDraft={attendanceDraft}
          setAttendanceDraft={setAttendanceDraft}
          onClose={() => setOpenLessonId(null)}
          onFinish={finishLesson}
          copy={copy}
        />
      )}
    </div>
  );
}

function mergeAttendance(existing: TeacherLessonAttendance[], lessonId: string, teacherId: string, attendance: Record<string, AttendanceStatus>, note: string) {
  const rows = [...existing];
  Object.entries(attendance).forEach(([studentId, status]) => {
    const index = rows.findIndex(item => item.lessonId === lessonId && item.studentId === studentId);
    const row: TeacherLessonAttendance = {
      id: index >= 0 ? rows[index].id : `local-${lessonId}-${studentId}`,
      lessonId,
      teacherId,
      studentId,
      status,
      note: note || null,
      createdAt: index >= 0 ? rows[index].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (index >= 0) rows[index] = row;
    else rows.push(row);
  });
  return rows;
}

function teacherNoteToLocal(note: TeacherNote): LocalNote {
  return {
    id: note.id,
    target: note.targetType,
    targetId: note.targetId || note.studentId || note.teacherId,
    type: note.noteType,
    text: note.text,
    attachmentLabel: note.attachmentLabel,
    pinned: note.pinned,
    createdAt: note.createdAt,
  };
}

function makeNotifications(workspace: TeacherWorkspace): TeacherNotification[] {
  const scheduleIssues = workspace.lessons
    .filter(lesson => lesson.status === 'cancelled' || lesson.status === 'rescheduled')
    .slice(0, 3)
    .map(lesson => {
      const group = groupForLesson(workspace, lesson);
      const students = studentsForLesson(workspace, lesson);
      return {
        id: `lesson-${lesson.id}`,
        type: lesson.status === 'cancelled' ? 'Lesson cancelled' : 'Lesson rescheduled',
        text: lesson.topic || lesson.title,
        date: lesson.date || new Date().toISOString(),
        read: false,
        relatedSection: 'schedule' as TeacherSection,
        lessonId: lesson.id,
        studentId: students[0]?.id,
        groupId: group?.id || lesson.groupId,
        lessonKind: lesson.type,
        studentName: group ? students.map(student => student.name).join(', ') : students[0]?.name,
        groupName: group?.name,
        groupCategory: group ? conductedLessonGroupLabel(workspace, lesson, copyByLang.ru) : undefined,
        topic: lesson.topic || lesson.title,
      };
    });
  const homework = workspace.homeworks
    .filter(item => homeworkState(item) === 'Needs Review')
    .slice(0, 4)
    .map(item => ({
      id: `homework-${item.id}`,
      type: 'Homework received',
      text: item.title,
      date: item.submittedAt || item.dueDate || new Date().toISOString(),
      read: false,
      relatedSection: 'homework' as TeacherSection,
      homeworkId: item.id,
      studentId: item.studentId,
    }));
  const groups = workspace.groups.slice(0, 1).map(group => ({
    id: `group-${group.id}`,
    type: 'Assigned group',
    text: [group.name, group.course].filter(Boolean).join(' · '),
    date: group.createdAt,
    read: true,
    relatedSection: 'groups' as TeacherSection,
    groupId: group.id,
  }));
  return [...scheduleIssues, ...homework, ...groups];
}

function TeacherLoading() {
  return (
    <div className="page-bg-admin min-h-screen p-5">
      <div className="mx-auto max-w-[1440px] space-y-4">
        <div className="h-16 animate-pulse rounded-3xl bg-white/70 shadow-sm" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-3xl bg-white/65 shadow-sm" />)}
        </div>
        <div className="h-80 animate-pulse rounded-3xl bg-white/65 shadow-sm" />
      </div>
    </div>
  );
}

function TeacherTopNav({ teacher, lang, copy, notifications, onLangChange, onNotificationsOpen, onLogout }: { teacher: TeacherRecord; lang: Lang; copy: TeacherCopy; notifications: TeacherNotification[]; onLangChange: (lang: Lang) => void; onNotificationsOpen: () => void; onLogout: () => void }) {
  const name = teacherDisplayName(teacher, lang);
  return (
    <header className="border-b border-purple-100/50 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📖</span>
          <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text font-display text-xl font-black text-transparent">Vetoschool</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <div className="flex gap-1 rounded-full bg-white/60 px-1 py-1">
            {(['ru', 'en', 'ua'] as Lang[]).map(item => (
              <button key={item} type="button" onClick={() => onLangChange(item)} className={`rounded-full px-2.5 py-1 font-body text-xs font-700 uppercase transition-all ${lang === item ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow' : 'text-purple-500 hover:text-purple-700'}`}>
                {item.toUpperCase()}
              </button>
            ))}
          </div>
          <motion.button
            type="button"
            onClick={onNotificationsOpen}
            initial="idle"
            whileHover="ring"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-pink-100 bg-white/85 text-purple-500 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 hover:bg-pink-50 hover:text-pink-500"
          >
            <motion.span
              className="inline-flex origin-top"
              variants={{
                idle: { rotate: 0 },
                ring: {
                  rotate: [0, -18, 16, -12, 9, -5, 0],
                  transition: { duration: 0.62, repeat: Infinity, repeatDelay: 0.16 },
                },
              }}
            >
              <Bell className="h-4 w-4" />
            </motion.span>
            {notifications.some(item => !item.read) && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-pink-400" />}
          </motion.button>
          <div className="hidden items-center gap-2 rounded-full bg-purple-100 px-3 py-1.5 sm:flex">
            <TeacherAvatar src={teacher.avatarUrl} name={name} size="sm" />
            <span className="font-body text-sm font-600 text-purple-700">{copy.noteTargets.Teacher}</span>
          </div>
          <button type="button" onClick={onLogout} className="font-body text-xs text-purple-400 transition hover:text-pink-500">
            {copy.logout}
          </button>
        </div>
      </div>
    </header>
  );
}

function TeacherHero({ workspace, copy }: { workspace: TeacherWorkspace; copy: TeacherCopy }) {
  const teacher = workspace.teacher!;
  const name = teacherDisplayName(teacher, copy.lang);
  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl p-5 text-white md:p-6"
      style={{ background: 'linear-gradient(135deg,#A87EFF 0%,#FF8DC7 100%)' }}>
      <div className="absolute inset-0 opacity-10">
        {[...Array(12)].map((_, i) => <div key={i} className="absolute text-xl" style={{ left: `${(i * 8.5) % 100}%`, top: `${(i * 9.1) % 100}%` }}>✨</div>)}
      </div>
      <div className="relative z-10">
        <h1 className="font-display text-2xl font-black md:text-3xl">👩‍🏫 {copy.teacherDashboardTitle}</h1>
        <p className="mt-2 font-display text-lg font-black text-white/92 md:text-xl">{name}</p>
      </div>
    </motion.section>
  );
}

function TeacherAdminStats({ workspace, copy }: { workspace: TeacherWorkspace; copy: typeof copyByLang.ru }) {
  const activeStudents = workspace.students.filter(student => ['active', 'trial'].includes(student.statusLabel)).length;
  const stats = [
    { label: copy.lessonsToday, value: workspace.stats.todayLessons, emoji: '🗓️', color: 'from-purple-100 to-violet-100', border: 'border-purple-200' },
    { label: copy.upcomingLessons, value: workspace.stats.upcomingLessons, emoji: '🕓', color: 'from-blue-100 to-cyan-100', border: 'border-blue-200' },
    { label: copy.homeworkReview, value: workspace.stats.homeworkToReview, emoji: '✅', color: 'from-pink-100 to-rose-100', border: 'border-pink-200' },
    { label: copy.activeStudents, value: activeStudents, emoji: '👩‍🎓', color: 'from-green-100 to-teal-100', border: 'border-green-200' },
  ];
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((item, index) => {
        return (
          <motion.div key={item.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.1 }}
            className={`card-hover rounded-3xl border bg-gradient-to-br ${item.color} ${item.border} p-4 text-center md:p-5`}>
            <div className="mb-2 text-3xl leading-none">{item.emoji}</div>
            <div className="font-display text-3xl font-black text-purple-700">{item.value}</div>
            <div className="mt-1 font-body text-xs text-purple-500">{item.label}</div>
          </motion.div>
        );
      })}
    </section>
  );
}

function TeacherSectionTabs({ active, copy, onNavigate }: { active: TeacherSection; copy: typeof copyByLang.ru; onNavigate: (section: TeacherSection) => void }) {
  return (
    <nav className="mb-2 flex flex-wrap gap-3">
      {navItems.map(item => {
        return (
          <button key={item.id} type="button" onClick={() => onNavigate(item.id)} className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 font-body text-sm font-600 transition-all ${active === item.id ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-lg' : 'glass text-purple-600 hover:bg-pink-50'}`}>
            <span className="text-base leading-none">{item.emoji}</span>
            {copy[item.id]}
          </button>
        );
      })}
    </nav>
  );
}

function DashboardPage({ workspace, notifications, copy, onOpenLesson, onNavigate }: { workspace: TeacherWorkspace; notifications: TeacherNotification[]; copy: typeof copyByLang.ru; onOpenLesson: (lesson: TeacherLesson) => void; onNavigate: (section: TeacherSection) => void }) {
  const nextLesson = workspace.stats.nextLesson || workspace.lessons.filter(isActionableLesson).sort((a, b) => dateValue(a) - dateValue(b))[0];
  const upcoming = workspace.lessons.filter(isActionableLesson).sort((a, b) => dateValue(a) - dateValue(b)).slice(0, 5);
  const review = workspace.homeworks.filter(item => homeworkState(item) === 'Needs Review').slice(0, 5);
  return (
    <div className="space-y-5">
      {nextLesson ? (
        <section className="glass rounded-3xl p-5 md:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="mb-2 font-body text-xs font-900 uppercase text-pink-400">{copy.nextLesson}</div>
              <h1 className="font-display text-2xl font-black text-purple-700 md:text-3xl">{lessonTarget(workspace, nextLesson)}</h1>
              <p className="mt-1 font-body text-sm text-purple-500">{formatLessonMoment(nextLesson, copy.lang)} · {nextLesson.topic || nextLesson.title}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {statusBadge(lessonStatus(nextLesson), copy)}
                <span className="rounded-full bg-blue-100 px-3 py-1 font-body text-xs font-900 text-blue-700">{nextLesson.onlineUrl ? copy.online : nextLesson.room || copy.classroom}</span>
              </div>
            </div>
            <button type="button" onClick={() => onOpenLesson(nextLesson)} className="btn-magic px-5 py-3 text-sm text-white"><PlayCircle className="mr-2 inline h-4 w-4" />{copy.openLesson}</button>
          </div>
        </section>
      ) : <CompactEmpty icon={CalendarDays} emoji="🗓️" title={copy.noLessons} description={copy.noLessonsText} />}
      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title={copy.upcomingLessons} action={<DashboardActionButton emoji="🗓️" label={copy.viewSchedule} onClick={() => onNavigate('schedule')} />}>
          <div className="space-y-2">
            {upcoming.length ? upcoming.map(lesson => <LessonRow key={lesson.id} workspace={workspace} lesson={lesson} copy={copy} onOpen={() => onOpenLesson(lesson)} />) : <SmallMessage text={copy.noLessonsText} />}
          </div>
        </Panel>
        <Panel title={copy.homeworkReview} action={<DashboardActionButton emoji="📚" label={copy.openHomework} onClick={() => onNavigate('homework')} />}>
          <div className="space-y-2">
            {review.length ? review.map(item => <HomeworkMiniRow key={item.id} workspace={workspace} homework={item} copy={copy} />) : <SmallMessage text={copy.noHomeworkText} />}
          </div>
        </Panel>
      </section>
      <Panel title={copy.importantNotifications}>
        <div className="space-y-2">
          {notifications.slice(0, 4).length ? notifications.slice(0, 4).map(item => <NotificationMini key={item.id} notification={item} copy={copy} />) : <SmallMessage text={copy.noNotifications} />}
        </div>
      </Panel>
    </div>
  );
}

function StudentSearchDashboard({ workspace, copy, onOpenStudent, onToggleContentAccess }: { workspace: TeacherWorkspace; copy: TeacherCopy; onOpenStudent: (studentId: string) => void; onToggleContentAccess: (item: TeacherHomework) => void }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(workspace.students[0]?.id || '');
  const normalized = query.trim().toLowerCase();
  const students = useMemo(() => {
    const sorted = workspace.students.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!normalized) return sorted;
    return sorted.filter(student => student.name.toLowerCase().includes(normalized));
  }, [normalized, workspace.students]);
  const selected = workspace.students.find(student => student.id === selectedId) || students[0] || workspace.students[0] || null;
  const grouped = workspace.groups.map(group => ({
    group,
    students: workspace.students.filter(student => group.studentIds.includes(student.id)),
  })).filter(item => item.students.length);
  const individual = workspace.students.filter(student => !workspace.groups.some(group => group.studentIds.includes(student.id)));

  useEffect(() => {
    if (selectedId && workspace.students.some(student => student.id === selectedId)) return;
    setSelectedId(workspace.students[0]?.id || '');
  }, [selectedId, workspace.students]);

  return (
    <section className={cardClass('overflow-hidden p-0')}>
      <div className="border-b border-purple-100/70 bg-gradient-to-r from-white/90 via-pink-50/70 to-blue-50/70 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-1 font-body text-xs font-900 uppercase text-pink-400">{copy.quickProfile}</div>
            <h2 className="font-display text-3xl font-black text-purple-700">{copy.myStudents}</h2>
            <p className="mt-1 font-body text-sm text-purple-400">{copy.studentSearchDescription}</p>
          </div>
          <div className="relative w-full lg:w-[420px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-purple-300" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={copy.searchStudents}
              className="h-12 w-full rounded-full border border-purple-100 bg-white/90 pl-12 pr-4 font-body text-sm font-800 text-purple-700 outline-none transition placeholder:text-purple-300 focus:border-pink-200 focus:bg-white focus:shadow-[0_0_0_5px_rgba(244,114,182,0.08)]"
            />
          </div>
        </div>
      </div>
      <div className="grid gap-4 p-5 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-purple-100 bg-white/65 p-3">
            <div className="mb-2 px-2 font-body text-xs font-900 uppercase text-purple-300">{copy.allAssignedStudents}</div>
            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {students.length ? students.map(student => (
                <StudentPickerButton key={student.id} student={student} active={selected?.id === student.id} copy={copy} onClick={() => setSelectedId(student.id)} />
              )) : <SmallMessage text={copy.noStudentMatches} />}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {grouped.slice(0, 3).map(item => (
              <div key={item.group.id} className="rounded-3xl border border-pink-100 bg-pink-50/45 p-3">
                <div className="mb-2 font-body text-xs font-900 text-pink-500">{item.group.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  {item.students.map(student => <button key={student.id} type="button" onClick={() => setSelectedId(student.id)} className="rounded-full bg-white/80 px-2.5 py-1 font-body text-xs font-900 text-purple-600 transition hover:bg-white hover:text-pink-500">{student.name}</button>)}
                </div>
              </div>
            ))}
            {individual.length > 0 && (
              <div className="rounded-3xl border border-blue-100 bg-blue-50/45 p-3">
                <div className="mb-2 font-body text-xs font-900 text-blue-500">{copy.individualLessons}</div>
                <div className="flex flex-wrap gap-1.5">
                  {individual.map(student => <button key={student.id} type="button" onClick={() => setSelectedId(student.id)} className="rounded-full bg-white/80 px-2.5 py-1 font-body text-xs font-900 text-purple-600 transition hover:bg-white hover:text-blue-500">{student.name}</button>)}
                </div>
              </div>
            )}
          </div>
        </div>
        {selected ? (
          <div className="space-y-4">
            <QuickStudentProfile student={selected} workspace={workspace} copy={copy} onOpenAnalytics={() => onOpenStudent(selected.id)} />
            <MaterialAccessPanel student={selected} workspace={workspace} copy={copy} onToggle={onToggleContentAccess} />
          </div>
        ) : <CompactEmpty icon={Users} title={copy.noStudentMatches} description={copy.studentSearchDescription} />}
      </div>
    </section>
  );
}

function StudentPickerButton({ student, active, copy, onClick }: { student: TeacherStudent; active: boolean; copy: TeacherCopy; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2, x: 2, transition: { duration: 0.1 } }}
      whileTap={{ scale: 0.98, transition: { duration: 0.05 } }}
      className={`flex w-full items-center justify-between gap-3 rounded-3xl border p-3 text-left transition-colors ${active ? 'border-pink-200 bg-gradient-to-r from-pink-50 to-purple-50 shadow-sm' : 'border-purple-100 bg-white/80 hover:border-pink-100 hover:bg-pink-50/50'}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <TeacherAvatar name={student.name} size="sm" />
        <span className="min-w-0">
          <span className="block truncate font-body text-sm font-900 text-purple-700">{student.name}</span>
          <span className="block truncate font-body text-xs text-purple-300">{student.groupNames.join(', ') || student.course || copy.individualLessons}</span>
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 font-body text-[11px] font-900 text-emerald-600">{student.attendance}%</span>
    </motion.button>
  );
}

function QuickStudentProfile({ student, workspace, copy, onOpenAnalytics }: { student: TeacherStudent; workspace: TeacherWorkspace; copy: TeacherCopy; onOpenAnalytics: () => void }) {
  const group = groupForStudent(workspace, student.id);
  const lastHomework = workspace.homeworks.filter(item => item.studentId === student.id).sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''))[0];
  return (
    <motion.article whileHover={{ y: -4, transition: { duration: 0.12 } }} className="overflow-hidden rounded-[28px] border border-white/80 bg-white/80 shadow-[0_18px_45px_rgba(126,87,194,0.10)]">
      <div className="bg-gradient-to-r from-white via-pink-50/70 to-purple-50/70 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <TeacherAvatar name={student.name} size="xl" />
            <div className="min-w-0">
              <div className="font-body text-xs font-900 uppercase text-pink-400">{copy.quickProfile}</div>
              <h3 className="truncate font-display text-3xl font-black text-purple-700">{student.name}</h3>
              <p className="font-body text-sm text-purple-400">{student.age || copyMissing(copy)} · {group?.name || copy.individualLessons}</p>
            </div>
          </div>
          <button type="button" onClick={onOpenAnalytics} className="btn-magic px-5 py-3 text-sm text-white">
            <BarChart3 className="mr-2 inline h-4 w-4" />{copy.openAnalytics}
          </button>
        </div>
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
        <InfoPill label={copy.currentUnit} value={group?.currentUnit || copyMissing(copy)} />
        <InfoPill label={copy.currentLesson} value={group?.currentLesson || copyMissing(copy)} />
        <InfoPill label={copy.homework} value={lastHomework?.title || copyMissing(copy)} />
        <InfoPill label={copy.nextLessonDate} value={formatLessonMoment(student.nextLesson, copy.lang)} />
      </div>
    </motion.article>
  );
}

function MaterialAccessPanel({ student, workspace, copy, onToggle }: { student: TeacherStudent; workspace: TeacherWorkspace; copy: TeacherCopy; onToggle: (item: TeacherHomework) => void }) {
  const items = workspace.homeworks.filter(item => item.studentId === student.id);
  const typeMeta: Record<string, { label: string; emoji: string; tone: string }> = {
    homework: { label: copy.homeworkContent, emoji: '📚', tone: 'border-purple-100 bg-purple-50/50 text-purple-700' },
    practice: { label: copy.practiceContent, emoji: '🎮', tone: 'border-blue-100 bg-blue-50/50 text-blue-700' },
    grammar: { label: copy.lang === 'en' ? 'Grammar' : copy.lang === 'ua' ? 'Граматика' : 'Грамматика', emoji: '📝', tone: 'border-yellow-100 bg-yellow-50/60 text-yellow-700' },
    listening: { label: copy.lang === 'en' ? 'Listening' : copy.lang === 'ua' ? 'Аудіювання' : 'Аудирование', emoji: '🎧', tone: 'border-emerald-100 bg-emerald-50/60 text-emerald-700' },
    checkpoint: { label: 'Unit Checkpoint', emoji: '🏁', tone: 'border-orange-100 bg-orange-50/60 text-orange-700' },
  };
  const groups = Object.entries(typeMeta)
    .map(([type, meta]) => ({ type, meta, items: items.filter(item => item.type === type) }))
    .filter(group => group.items.length);
  return (
    <section className={cardClass('p-5')}>
      <div className="mb-4 flex flex-col gap-1">
        <h3 className="font-display text-2xl font-black text-purple-700">{copy.materialAccess}</h3>
        <p className="font-body text-sm text-purple-400">{copy.materialAccessDescription}</p>
      </div>
      {groups.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {groups.map(group => (
            <div key={group.type} className={`rounded-3xl border p-3 ${group.meta.tone}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-display text-lg font-black"><span className="mr-1">{group.meta.emoji}</span>{group.meta.label}</div>
                <div className="font-body text-xs font-900">{group.items.filter(item => item.unlocked).length}/{group.items.length}</div>
              </div>
              <div className="space-y-2">
                {group.items.map(item => (
                  <motion.div key={item.id} whileHover={{ y: -2, transition: { duration: 0.1 } }} className="flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/80 p-3">
                    <div className="min-w-0">
                      <div className="truncate font-body text-sm font-900 text-purple-700">{item.title}</div>
                      <div className="mt-1 flex items-center gap-1.5 font-body text-xs font-900">
                        {item.unlocked ? <Unlock className="h-3.5 w-3.5 text-emerald-500" /> : <Lock className="h-3.5 w-3.5 text-purple-300" />}
                        <span className={item.unlocked ? 'text-emerald-600' : 'text-purple-300'}>{item.unlocked ? copy.opened : copy.locked}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => onToggle(item)} className={compactButton(item.unlocked ? 'red' : 'green')}>
                      {item.unlocked ? copy.closeAccess : copy.openAccess}
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : <SmallMessage text={copy.noHomeworkText} />}
    </section>
  );
}

function formatLiveEvent(event: LiveEvent, lang: Lang) {
  const dict = {
    ru: {
      lesson_opened: 'открыл урок',
      task_opened: 'перешёл к заданию',
      choice_selected: 'выбрал вариант',
      answer_correct: 'ответил правильно',
      answer_wrong: 'ошибся',
      undo: 'отменил действие',
      lesson_completed: 'завершил урок',
      teacher_hint: 'учитель отправил подсказку',
    },
    ua: {
      lesson_opened: 'відкрив урок',
      task_opened: 'перейшов до завдання',
      choice_selected: 'обрав варіант',
      answer_correct: 'відповів правильно',
      answer_wrong: 'помилився',
      undo: 'скасував дію',
      lesson_completed: 'завершив урок',
      teacher_hint: 'учитель надіслав підказку',
    },
    en: {
      lesson_opened: 'opened the lesson',
      task_opened: 'opened a task',
      choice_selected: 'selected an option',
      answer_correct: 'answered correctly',
      answer_wrong: 'made a mistake',
      undo: 'undid an action',
      lesson_completed: 'completed the lesson',
      teacher_hint: 'teacher sent a hint',
    },
  }[lang];
  return dict[event.event_type as keyof typeof dict] || event.event_type;
}

function livePayloadSummary(event: LiveEvent) {
  const payload = event.payload_json || {};
  if (event.event_type === 'answer_wrong' && payload.expected !== undefined) return `expected ${payload.expected}`;
  if (event.event_type === 'choice_selected' && payload.index !== undefined) return `${payload.side || 'item'} #${payload.index + 1}`;
  if (event.event_type === 'task_opened' && payload.mechanic) return String(payload.mechanic);
  if (event.event_type === 'teacher_hint' && payload.message) return String(payload.message);
  if (event.event_type === 'lesson_completed' && payload.stars !== undefined) return `+${payload.stars} stars`;
  return '';
}

function TeacherLiveLessons({ workspace, copy }: { workspace: TeacherWorkspace; copy: TeacherCopy }) {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [sending, setSending] = useState(false);
  const studentIds = useMemo(() => new Set(workspace.students.map(student => student.id)), [workspace.students]);
  const activeSessions = useMemo(
    () => sessions.filter(session => session.status === 'active' && studentIds.has(session.student_id)),
    [sessions, studentIds],
  );
  const activeSession = activeSessions.find(session => session.id === activeSessionId) || activeSessions[0] || null;
  const activeSessionEventId = activeSession?.id || null;

  const loadSessions = useCallback(async () => {
    try {
      setError('');
      const list = await listLiveSessions();
      setSessions(list);
      const first = list.find(session => session.status === 'active' && studentIds.has(session.student_id));
      if (!first) setActiveSessionId(null);
      else if (!activeSessionId || !list.some(session => session.id === activeSessionId && session.status === 'active')) setActiveSessionId(first.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(message ? `${copy.liveNeedsDb} (${message})` : copy.liveNeedsDb);
    } finally {
      setLoading(false);
    }
  }, [activeSessionId, copy.liveNeedsDb, studentIds]);

  const loadEvents = useCallback(async (sessionId: string) => {
    try {
      setEvents(await listLiveEvents(sessionId));
    } catch {
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
    const interval = window.setInterval(() => void loadSessions(), 3000);
    const unsubscribe = subscribeLiveSessions(() => void loadSessions());
    return () => { window.clearInterval(interval); unsubscribe(); };
  }, [loadSessions]);

  useEffect(() => {
    if (!activeSessionEventId) {
      setEvents([]);
      return;
    }
    void loadEvents(activeSessionEventId);
    const interval = window.setInterval(() => void loadEvents(activeSessionEventId), 2500);
    const unsubscribe = subscribeLiveSessionEvents(activeSessionEventId, event => {
      setEvents(prev => [event, ...prev.filter(item => item.id !== event.id)].slice(0, 80));
    });
    return () => { window.clearInterval(interval); unsubscribe(); };
  }, [activeSessionEventId, loadEvents]);

  const sendHint = async () => {
    if (!activeSession || !hint.trim()) return;
    setSending(true);
    try {
      await sendTeacherHint(activeSession, hint.trim());
      setHint('');
      await loadEvents(activeSession.id);
    } finally {
      setSending(false);
    }
  };

  const nameFor = (session: LiveSession) => {
    const student = workspace.students.find(item => item.id === session.student_id);
    return session.student_name || student?.name || copy.student;
  };

  return (
    <section className={cardClass('overflow-hidden p-0')}>
      <div className="relative border-b border-purple-100/70 bg-gradient-to-r from-white via-pink-50 to-sky-50 p-5">
        <div className="mb-3 inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-1.5 font-body text-xs font-900 uppercase text-pink-500 shadow-sm">
          <Wifi className="h-4 w-4" /> Realtime
        </div>
        <h2 className="font-display text-3xl font-black text-purple-700">{copy.liveLessons}</h2>
        <p className="mt-1 max-w-2xl font-body text-sm text-purple-400">{copy.liveLessonsDescription}</p>
        <motion.div whileHover={{ y: -3, transition: { duration: 0.12 } }} className="absolute right-5 top-5 hidden rounded-3xl bg-white/75 px-5 py-3 shadow-sm backdrop-blur sm:block">
          <div className="font-display text-3xl font-black text-purple-700">{activeSessions.length}</div>
          <div className="font-body text-xs font-900 uppercase text-purple-300">{copy.activeSessions}</div>
        </motion.div>
      </div>
      {error ? (
        <div className="m-5 rounded-3xl border border-yellow-200 bg-yellow-50 p-4 font-body text-sm font-700 text-yellow-800">
          <div className="mb-3">{error}</div>
          <button type="button" onClick={() => void loadSessions()} className={compactButton('yellow')}><RefreshCw className="h-4 w-4" />{copy.refresh}</button>
        </div>
      ) : (
        <div className="grid gap-4 p-5 lg:grid-cols-[330px_1fr]">
          <div className="rounded-3xl border border-purple-100 bg-white/65 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-display text-xl font-black text-purple-700">{copy.activeSessions}</h3>
              <button type="button" onClick={() => void loadSessions()} className="rounded-2xl bg-purple-100 p-2 text-purple-500 transition hover:bg-purple-200" title={copy.refresh}>
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {loading ? (
              <SmallMessage text="..." />
            ) : activeSessions.length ? (
              <div className="space-y-2">
                {activeSessions.map(session => {
                  const active = activeSession?.id === session.id;
                  return (
                    <motion.button
                      key={session.id}
                      type="button"
                      onClick={() => setActiveSessionId(session.id)}
                      whileHover={{ x: 3, y: -2, transition: { duration: 0.1 } }}
                      className={`w-full rounded-3xl border p-3 text-left transition-colors ${active ? 'border-pink-200 bg-gradient-to-br from-pink-50 to-purple-50 shadow-sm' : 'border-purple-100 bg-white/80 hover:border-pink-100 hover:bg-pink-50/60'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-body text-sm font-900 text-purple-700">{nameFor(session)}</div>
                        <span className="rounded-full bg-green-100 px-2.5 py-1 font-body text-[11px] font-900 text-green-600">{session.status}</span>
                      </div>
                      <div className="mt-1 truncate font-body text-xs text-purple-400">{session.lesson_title || session.lesson_id}</div>
                      <div className="mt-2 font-body text-[11px] text-purple-300">{new Date(session.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                    </motion.button>
                  );
                })}
              </div>
            ) : <SmallMessage text={copy.noLiveSessions} />}
          </div>
          <div className="space-y-4">
            <div className="rounded-3xl border border-purple-100 bg-white/65 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                <h3 className="font-display text-xl font-black text-purple-700">{copy.childHint}</h3>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={hint}
                  onChange={event => setHint(event.target.value)}
                  disabled={!activeSession}
                  placeholder={copy.childHintPlaceholder}
                  className="min-h-11 flex-1 rounded-2xl border-2 border-pink-100 bg-white/85 px-4 py-2 font-body text-sm text-purple-700 outline-none transition placeholder:text-purple-300 focus:border-pink-200"
                />
                <button type="button" onClick={() => void sendHint()} disabled={!activeSession || !hint.trim() || sending} className="btn-magic px-5 py-2.5 text-sm text-white disabled:opacity-50">
                  <Send className="mr-2 inline h-4 w-4" />{copy.sendHint}
                </button>
              </div>
            </div>
            <div className="rounded-3xl border border-purple-100 bg-white/65 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Activity className="h-5 w-5 text-pink-400" />
                <h3 className="font-display text-xl font-black text-purple-700">{copy.activityLog}</h3>
              </div>
              {events.length ? (
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {events.map(event => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ x: 3, transition: { duration: 0.1 } }}
                      className={`rounded-2xl border p-3 ${event.actor_role === 'teacher' ? 'border-yellow-200 bg-yellow-50' : event.event_type === 'answer_wrong' ? 'border-rose-200 bg-rose-50' : event.event_type === 'answer_correct' ? 'border-emerald-200 bg-emerald-50' : 'border-purple-100 bg-white/80'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2">
                          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
                          <div className="min-w-0">
                            <div className="font-body text-sm font-900 text-purple-700">{formatLiveEvent(event, copy.lang)}</div>
                            {livePayloadSummary(event) && <div className="truncate font-body text-xs text-purple-400">{livePayloadSummary(event)}</div>}
                          </div>
                        </div>
                        <div className="shrink-0 font-body text-[11px] text-purple-300">{new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : <SmallMessage text={copy.noLiveEvents} />}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function DashboardActionButton({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2, scale: 1.02, transition: { duration: 0.1 } }}
      whileTap={{ scale: 0.96, transition: { duration: 0.05 } }}
      className="group relative overflow-hidden rounded-full border border-pink-100 bg-white/85 px-4 py-2 font-body text-xs font-900 text-purple-700 shadow-sm transition-colors hover:border-pink-200"
    >
      <span className="absolute inset-0 bg-gradient-to-r from-pink-100/70 via-purple-100/60 to-blue-100/60 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      <span className="relative z-10 inline-flex items-center gap-2">
        <span className="transition-transform duration-150 group-hover:-rotate-6 group-hover:scale-110">{emoji}</span>
        {label}
      </span>
    </motion.button>
  );
}

function SchedulePage({ workspace, copy, onOpenLesson, onStartLesson, onRequestChange }: { workspace: TeacherWorkspace; copy: typeof copyByLang.ru; onOpenLesson: (lesson: TeacherLesson) => void; onStartLesson: (lesson: TeacherLesson) => void; onRequestChange: (lesson: TeacherLesson) => void }) {
  const [tab, setTab] = useState<'planned' | 'conducted'>('planned');
  const [activeControl, setActiveControl] = useState<'planned' | 'conducted' | 'today'>('planned');
  const [date, setDate] = useState(todayIso());
  const lessons = workspace.lessons
    .filter(lesson => (lesson.date || date) === date && lesson.status !== 'completed' && lesson.status !== 'cancelled' && !lesson.isConducted)
    .sort((a, b) => dateValue(a) - dateValue(b));
  const conductedGroups = groupedConductedLessons(workspace, copy);
  const selectedMonth = dateFromIso(date).toLocaleDateString(langLocale(copy.lang), { month: 'long', year: 'numeric' });
  const selectCalendarDate = (nextDate: string) => {
    setDate(nextDate);
    setTab('planned');
    setActiveControl('planned');
  };
  const controls = [
    { id: 'planned' as const, label: copy.plannedLessons, action: () => { setTab('planned'); setActiveControl('planned'); } },
    { id: 'conducted' as const, label: copy.conductedLessons, action: () => { setTab('conducted'); setActiveControl('conducted'); } },
    { id: 'today' as const, label: copy.today, action: () => { setDate(todayIso()); setTab('planned'); setActiveControl('today'); } },
  ];
  return (
    <div className="space-y-5">
      <PageTitle title={copy.schedule} description={copy.scheduleDescription} />
      <section className="grid items-start gap-5 xl:grid-cols-[380px_1fr]">
        <ScheduleCalendar workspace={workspace} selectedDate={date} copy={copy} onSelectDate={selectCalendarDate} />
        <div className={cardClass('p-5')}>
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="font-body text-xs font-900 uppercase text-purple-300">{copy.selectedDate}</div>
              <h2 className="font-display text-2xl font-black text-purple-700">{formatTeacherDate(date, copy.lang, false)}</h2>
              <p className="font-body text-sm capitalize text-purple-400">{selectedMonth} · {lessons.length} {copy.lessonsOnDate}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 rounded-full border border-white/80 bg-white/70 p-1.5 shadow-sm">
              {controls.map(control => {
                const active = activeControl === control.id;
                return (
                  <motion.button
                    key={control.id}
                    type="button"
                    onClick={control.action}
                    whileTap={{ scale: 0.96 }}
                    className={`relative overflow-hidden rounded-full px-4 py-2.5 font-body text-sm font-900 transition hover:-translate-y-0.5 ${active ? 'text-white' : control.id === 'conducted' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-purple-600 hover:bg-pink-50'}`}
                  >
                    {active && (
                      <motion.span
                        layoutId="teacher-schedule-active-control"
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 shadow-[0_12px_28px_rgba(236,72,153,0.22)]"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{control.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-xl font-black text-purple-700">{tab === 'planned' ? copy.scheduledLessons : copy.conductedLessons}</h3>
            <span className="rounded-full bg-purple-100 px-3 py-1 font-body text-xs font-900 capitalize text-purple-600">{selectedMonth}</span>
          </div>
          {tab === 'planned' ? (
            <div className="space-y-3">
              {lessons.length ? lessons.map(lesson => <ScheduleCard key={lesson.id} workspace={workspace} lesson={lesson} copy={copy} onOpen={() => onOpenLesson(lesson)} onStart={() => onStartLesson(lesson)} onRequestChange={() => onRequestChange(lesson)} />) : <CompactEmpty icon={CalendarDays} emoji="🗓️" title={copy.noLessons} description={copy.noLessonsText} />}
            </div>
          ) : (
            <div className="space-y-4">
              {conductedGroups.length ? conductedGroups.map(([label, items]) => (
                <section key={label} className="rounded-3xl border border-purple-100 bg-white/55 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-display text-lg font-black text-purple-700">{label}</h4>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 font-body text-xs font-900 text-emerald-700">{items.length}</span>
                  </div>
                  <div className="space-y-3">
                    {items.map(lesson => <ScheduleCard key={lesson.id} workspace={workspace} lesson={lesson} copy={copy} onOpen={() => onOpenLesson(lesson)} onStart={() => onStartLesson(lesson)} onRequestChange={() => onRequestChange(lesson)} />)}
                  </div>
                </section>
              )) : <SmallMessage text={copy.noConductedLessons} />}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ScheduleCalendar({ workspace, selectedDate, copy, onSelectDate }: { workspace: TeacherWorkspace; selectedDate: string; copy: TeacherCopy; onSelectDate: (date: string) => void }) {
  const monthDate = dateFromIso(selectedDate);
  const days = calendarDays(selectedDate);
  const monthTitle = monthDate.toLocaleDateString(langLocale(copy.lang), { month: 'long', year: 'numeric' });
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(2026, 6, 20 + index);
    return day.toLocaleDateString(langLocale(copy.lang), { weekday: 'short' });
  });
  const lessonCounts = workspace.lessons.reduce<Record<string, { total: number; completed: number; rescheduled: number }>>((acc, lesson) => {
    if (!lesson.date) return acc;
    acc[lesson.date] = acc[lesson.date] || { total: 0, completed: 0, rescheduled: 0 };
    acc[lesson.date].total += 1;
    if (lesson.status === 'completed' || lesson.isConducted) acc[lesson.date].completed += 1;
    if (lesson.status === 'rescheduled') acc[lesson.date].rescheduled += 1;
    return acc;
  }, {});
  const shiftMonth = (direction: -1 | 1) => {
    const next = dateFromIso(selectedDate);
    next.setMonth(next.getMonth() + direction);
    onSelectDate(isoFromDate(next));
  };
  return (
    <div className={cardClass('self-start p-5')}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="font-body text-xs font-900 uppercase text-purple-300">{copy.calendar}</div>
          <h2 className="font-display text-2xl font-black capitalize text-purple-700">{monthTitle}</h2>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => shiftMonth(-1)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-100 bg-white/80 text-purple-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-purple-50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => shiftMonth(1)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-100 bg-white/80 text-purple-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-purple-50">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map(day => <div key={day} className="pb-2 text-center font-body text-[11px] font-900 uppercase text-purple-300">{day}</div>)}
        {days.map(day => {
          const isSelected = day.iso === selectedDate;
          const isToday = day.iso === todayIso();
          const stats = lessonCounts[day.iso];
          const count = stats?.total || 0;
          const hasCompleted = Boolean(stats?.completed);
          const hasRescheduled = Boolean(stats?.rescheduled);
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onSelectDate(day.iso)}
              className={`relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-2xl border font-body text-sm font-900 transition-all ${
                isSelected
                  ? 'border-pink-200 bg-gradient-to-br from-pink-400 to-purple-400 text-white shadow-lg shadow-pink-200/60'
                  : day.inMonth
                    ? 'border-purple-100 bg-white/70 text-purple-700 hover:-translate-y-0.5 hover:border-pink-200 hover:bg-pink-50'
                    : 'border-transparent bg-white/25 text-purple-200 hover:bg-white/55'
              } ${isToday && !isSelected ? 'ring-2 ring-pink-200' : ''}`}
            >
              <span className={hasCompleted ? 'decoration-2 underline-offset-[-3px]' : ''}>{day.number}</span>
              {hasCompleted && <span className={`absolute left-2 right-2 top-1/2 h-0.5 -rotate-12 rounded-full ${isSelected ? 'bg-white/90' : 'bg-emerald-300/80'}`} />}
              {count > 0 && (
                <span className="mt-1 flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : hasCompleted ? 'bg-emerald-400' : hasRescheduled ? 'bg-amber-400' : 'bg-pink-400'}`} />
                  {count > 1 && <span className={`text-[9px] leading-none ${isSelected ? 'text-white' : 'text-purple-400'}`}>{count}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GroupsPage({ workspace, copy, onOpenGroup }: { workspace: TeacherWorkspace; copy: typeof copyByLang.ru; onOpenGroup: (id: string) => void }) {
  return (
    <div className="space-y-5">
      <PageTitle title={copy.groups} description={copy.groupsDescription} />
      {workspace.groups.length ? (
        <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {workspace.groups.map(group => {
            const nextLesson = workspace.lessons.filter(lesson => lesson.groupId === group.id && isActionableLesson(lesson)).sort((a, b) => dateValue(a) - dateValue(b))[0];
            return (
              <article key={group.id} className={cardClass('p-5')}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl font-black text-purple-700">{group.name}</h3>
                    <p className="font-body text-sm text-purple-400">{group.course || copyMissing(copy)} · {group.level || copyMissing(copy)}</p>
                  </div>
                  {statusBadge(group.status || 'Active', copy)}
                </div>
                <div className="grid gap-2 font-body text-sm text-purple-500">
                  <InfoLine label={copy.scheduleLabel} value={`${group.weeklyFrequency || 1} / ${copy.week.toLowerCase()}`} />
                  <InfoLine label={copy.studentsLabel} value={`${group.studentIds.length}/${group.maxSeats || '∞'}`} />
                  <InfoLine label={copy.currentUnit} value={group.currentUnit || copyMissing(copy)} />
                  <InfoLine label={copy.currentLesson} value={group.currentLesson || copyMissing(copy)} />
                  <InfoLine label={copy.nextLessonLabel} value={nextLesson ? formatLessonMoment(nextLesson, copy.lang) : copyMissing(copy)} />
                </div>
                <button type="button" onClick={() => onOpenGroup(group.id)} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 px-4 py-3 font-body text-sm font-900 text-white shadow-lg transition hover:-translate-y-0.5">
                  {copy.openGroupProfile}
                </button>
              </article>
            );
          })}
        </section>
      ) : <CompactEmpty icon={Users} title={copy.noGroups} description={copy.noGroupsText} />}
    </div>
  );
}

function GroupProfile({ groupId, workspace, localNotes, onOpenLesson, onSaveNote, copy }: { groupId: string; workspace: TeacherWorkspace; localNotes: LocalNote[]; onOpenLesson: (lesson: TeacherLesson) => void; onSaveNote: (note: Omit<LocalNote, 'id' | 'createdAt'>) => Promise<boolean>; copy: TeacherCopy }) {
  const group = workspace.groups.find(item => item.id === groupId);
  const [tab, setTab] = useState<GroupProfileTab>('Overview');
  if (!group) return <CompactEmpty icon={Users} title={copy.groupNotFound} description={copy.groupNotFoundText} />;
  const students = workspace.students.filter(student => group.studentIds.includes(student.id));
  const lessons = workspace.lessons.filter(lesson => lesson.groupId === group.id || group.studentIds.includes(lesson.studentId)).sort((a, b) => dateValue(a) - dateValue(b));
  return (
    <div className="space-y-5">
      <section className={cardClass('p-5')}>
        <h1 className="font-display text-3xl font-black text-purple-700">{group.name}</h1>
        <p className="mt-1 font-body text-sm text-purple-400">{group.course || copyMissing(copy)} · {group.level || copyMissing(copy)}</p>
      </section>
      <Tabs tabs={['Overview', 'Students', 'Schedule', 'Notes'] as GroupProfileTab[]} active={tab} setActive={value => setTab(value as GroupProfileTab)} getLabel={item => groupTabLabel(item as GroupProfileTab, copy)} />
      {tab === 'Overview' && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Users} label={copy.studentsLabel} value={students.length} />
          <MetricCard icon={CalendarDays} label={copy.upcoming} value={lessons.filter(lesson => lesson.status === 'scheduled').length} />
          <MetricCard icon={BookOpen} label={copy.unit} value={group.currentUnit || copyMissing(copy)} />
          <MetricCard icon={MonitorPlay} label={copy.lesson} value={group.currentLesson || copyMissing(copy)} />
        </section>
      )}
      {tab === 'Students' && <StudentsList students={students} workspace={workspace} copy={copy} />}
      {tab === 'Schedule' && <Panel title={copy.groupSchedule}><div className="space-y-2">{lessons.map(lesson => <LessonRow key={lesson.id} workspace={workspace} lesson={lesson} copy={copy} onOpen={() => onOpenLesson(lesson)} />)}</div></Panel>}
      {tab === 'Notes' && <NotesComposer target="Group" targetId={group.id} localNotes={localNotes.filter(note => note.target === 'Group' && note.targetId === group.id)} onSaveNote={onSaveNote} copy={copy} />}
    </div>
  );
}

function LessonsPage({ workspace, copy, onOpenLesson, onStartLesson }: { workspace: TeacherWorkspace; copy: typeof copyByLang.ru; onOpenLesson: (lesson: TeacherLesson) => void; onStartLesson: (lesson: TeacherLesson) => void }) {
  const [query, setQuery] = useState('');
  const lessons = workspace.lessons
    .filter(lesson => `${lesson.topic} ${lesson.title} ${lessonTarget(workspace, lesson)}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => dateValue(a) - dateValue(b));
  return (
    <div className="space-y-5">
      <PageTitle title={copy.lessons} description={copy.lessonsDescription} />
      <FilterSearch value={query} onChange={setQuery} placeholder={copy.searchLessons} />
      <section className="grid gap-4 xl:grid-cols-2">
        {lessons.length ? lessons.map(lesson => <LessonCard key={lesson.id} workspace={workspace} lesson={lesson} copy={copy} onOpen={() => onOpenLesson(lesson)} onStart={() => onStartLesson(lesson)} />) : <CompactEmpty icon={BookOpen} title={copy.noLessons} description={copy.noLessonsText} />}
      </section>
    </div>
  );
}

function LessonWorkspace({ workspace, lesson, tab, setTab, attendanceDraft, setAttendanceDraft, onClose, onFinish, copy }: { workspace: TeacherWorkspace; lesson: TeacherLesson; tab: LessonWorkspaceTab; setTab: (tab: LessonWorkspaceTab) => void; attendanceDraft: Record<string, AttendanceStatus>; setAttendanceDraft: (value: Record<string, AttendanceStatus>) => void; onClose: () => void; onFinish: (draft: LessonCompletionDraft) => Promise<boolean>; copy: TeacherCopy }) {
  const students = useMemo(() => studentsForLesson(workspace, lesson), [lesson, workspace]);
  const group = groupForLesson(workspace, lesson);
  const status = lessonStatus(lesson);
  const completed = status === 'Completed';
  const readOnly = completed;
  const canFinish = !completed && status !== 'Cancelled';
  const [nowMs, setNowMs] = useState(Date.now());
  const [resultOpen, setResultOpen] = useState(false);
  const [activeMaterialLesson, setActiveMaterialLesson] = useState<WorkbookLesson | null>(null);
  const [draft, setDraft] = useState<LessonCompletionDraft>(() => ({
    summary: lesson.result?.summary || '',
    teacherComment: lesson.result?.teacherComment || lesson.comment || '',
    homeworkBrief: lesson.result?.homeworkBrief || lesson.homeworkBrief || '',
    carryOverToNextLesson: lesson.result?.carryOverToNextLesson || lesson.carryOverToNextLesson || '',
    adminNote: lesson.result?.adminNote || '',
    grades: Object.fromEntries(students.map(student => {
      const existing = workspace.grades.find(grade => grade.lessonId === lesson.id && grade.studentId === student.id && grade.category === 'Participation');
      return [student.id, existing?.score || 5];
    })),
  }));
  useEffect(() => {
    setDraft({
      summary: lesson.result?.summary || '',
      teacherComment: lesson.result?.teacherComment || lesson.comment || '',
      homeworkBrief: lesson.result?.homeworkBrief || lesson.homeworkBrief || '',
      carryOverToNextLesson: lesson.result?.carryOverToNextLesson || lesson.carryOverToNextLesson || '',
      adminNote: lesson.result?.adminNote || '',
      grades: Object.fromEntries(students.map(student => {
        const existing = workspace.grades.find(grade => grade.lessonId === lesson.id && grade.studentId === student.id && grade.category === 'Participation');
        return [student.id, existing?.score || 5];
      })),
    });
  }, [lesson.id, lesson.result, lesson.comment, lesson.homeworkBrief, lesson.carryOverToNextLesson, students, workspace.grades]);

  const sections = useMemo(() => lessonWorkspaceSections(lesson, copy), [copy, lesson]);
  const selectedSection = sections.find(section => section.id === tab) || sections[0] || null;
  useEffect(() => {
    if (sections.length && !sections.some(section => section.id === tab)) setTab(sections[0].id);
  }, [sections, setTab, tab]);
  useEffect(() => {
    if (completed || !lesson.startedAt) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [completed, lesson.startedAt]);
  const startedAtMs = lesson.startedAt ? new Date(lesson.startedAt).getTime() : null;
  const completedAtMs = lesson.completedAt ? new Date(lesson.completedAt).getTime() : null;
  const elapsedSeconds = startedAtMs ? Math.max(0, Math.round(((completedAtMs || nowMs) - startedAtMs) / 1000)) : 0;
  const submitResult = async () => {
    const saved = await onFinish(draft);
    if (saved) setResultOpen(false);
  };
  const openAssignedMaterial = async (section: LessonStructureSection | null) => {
    if (!section) return;
    if (section.materialUrl) {
      window.open(section.materialUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!section.sourceLessonId) return;
    const sourceLesson = await getLessonById(section.sourceLessonId);
    setActiveMaterialLesson(sourceLesson || {
      id: section.sourceLessonId,
      unit_id: '',
      title: section.materialTitle || section.label || sectionDisplayLabel(section, copy),
      lesson_number: Number(section.order || 1),
      order: Number(section.order || 0),
      type: (section.kind === 'class_task' ? 'practice' : section.kind === 'checkpoint' ? 'checkpoint' : section.kind) as WorkbookLesson['type'],
      stars_reward: 0,
    });
  };
  const resultDialog = (
    <AnimatePresence>
      {resultOpen && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-purple-950/20 px-4 py-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/80 bg-white p-5 shadow-2xl"
          >
            <LessonResultForm draft={draft} setDraft={setDraft} readOnly={completed} copy={copy} result={lesson.result} students={students} elapsedSeconds={elapsedSeconds} />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setResultOpen(false)} className={compactButton('purple')}>{copy.close}</button>
              {!completed && <button type="button" onClick={submitResult} className="btn-magic px-5 py-2.5 text-sm text-white">{copy.save}</button>}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-purple-950/25 p-3 backdrop-blur-sm">
      <motion.section initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }} className="mx-auto max-w-[1500px] overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-2xl">
        <header className="sticky top-0 z-10 border-b border-purple-100 bg-white/92 p-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="font-display text-2xl font-black text-purple-700">{lessonTarget(workspace, lesson)}</h1>
              <p className="font-body text-sm capitalize text-purple-400">{lessonTopic(lesson, copy)} · {lessonDateLabel(lesson, copy)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-purple-100 px-3 py-1 font-body text-xs font-900 text-purple-700">{lessonCourse(workspace, lesson)}</span>
                <span className="rounded-full bg-pink-50 px-3 py-1 font-body text-xs font-900 text-pink-600">{copy.unit}: {lessonUnit(workspace, lesson, copy)}</span>
                <span className="rounded-full bg-blue-50 px-3 py-1 font-body text-xs font-900 text-blue-600">{copy.lesson}: {lessonNumberValue(workspace, lesson, copy)}</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-body text-xs font-900 text-emerald-600">{copy.duration}: {lesson.startedAt ? formatElapsedLessonTime(elapsedSeconds) : `${lesson.durationMinutes || 50} ${copy.minutesShort}`}</span>
                {group && <span className="rounded-full bg-emerald-50 px-3 py-1 font-body text-xs font-900 text-emerald-600">{group.name}</span>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(status, copy)}
              {canFinish ? (
                <button type="button" onClick={() => setResultOpen(true)} className="btn-magic px-4 py-2.5 text-sm text-white"><CheckCircle2 className="mr-1 inline h-4 w-4" />{copy.finishLesson}</button>
              ) : null}
              <motion.button type="button" onClick={onClose} whileHover={{ y: -2, scale: 1.02, transition: { duration: 0.12 } }} whileTap={{ scale: 0.96, transition: { duration: 0.06 } }} className="group relative overflow-hidden rounded-full border border-purple-100 bg-white px-4 py-2.5 font-body text-sm font-900 text-purple-700 shadow-sm transition-colors hover:border-pink-200">
                <span className="absolute inset-0 bg-gradient-to-r from-pink-50 via-white to-purple-50 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                <span className="relative z-10 inline-flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-purple-50 text-purple-600 transition-all duration-150 group-hover:bg-pink-100 group-hover:text-pink-600 group-hover:rotate-90">
                    <X className="h-4 w-4" />
                  </span>
                  {copy.close}
                </span>
              </motion.button>
            </div>
          </div>
        </header>
        <div className="grid items-start gap-4 p-4 xl:grid-cols-[220px_1fr_320px]">
          <aside className="space-y-2">
            {sections.length ? sections.map(section => (
              <motion.button key={section.id} type="button" onClick={() => setTab(section.id)} whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }} className={`relative flex w-full items-center gap-3 overflow-hidden rounded-3xl px-4 py-3 text-left font-body text-sm font-900 transition-all ${selectedSection?.id === section.id ? 'text-white shadow-lg' : 'bg-white/70 text-purple-600 hover:bg-pink-50'}`}>
                {selectedSection?.id === section.id && <motion.span layoutId="lesson-workspace-tab" className="absolute inset-0 rounded-3xl bg-gradient-to-r from-pink-400 to-purple-400" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span className="relative z-10 text-lg">{sectionEmoji(section)}</span>
                <span className="relative z-10">{sectionDisplayLabel(section, copy)}</span>
              </motion.button>
            )) : <SmallMessage text={copy.noAssignedSections} />}
          </aside>
          <main className={cardClass('p-5')}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-black text-purple-700">{selectedSection ? sectionDisplayLabel(selectedSection, copy) : copy.lessonStructure}</h2>
              <motion.button type="button" onClick={() => void openAssignedMaterial(selectedSection)} disabled={!selectedSection?.materialUrl && !selectedSection?.sourceLessonId} whileHover={{ y: -2, scale: 1.01, transition: { duration: 0.12 } }} whileTap={{ scale: 0.97, transition: { duration: 0.06 } }} className="group relative overflow-hidden rounded-full border border-pink-200 bg-white px-4 py-2.5 font-body text-xs font-900 text-purple-700 shadow-[0_10px_24px_rgba(168,85,247,0.12)] transition-colors hover:border-pink-300 disabled:cursor-not-allowed disabled:opacity-45">
                <span className="absolute inset-0 bg-gradient-to-r from-pink-100/80 via-purple-100/80 to-blue-100/80 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                <span className="relative z-10 inline-flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white shadow-sm transition-transform duration-150 group-hover:rotate-6 group-hover:scale-105">
                    <ExternalLink className="h-4 w-4" />
                  </span>
                  {copy.openAssignedMaterial}
                </span>
              </motion.button>
            </div>
            <LessonContentPanel section={selectedSection} lesson={lesson} copy={copy} draft={draft} setDraft={setDraft} readOnly={completed} onOpenMaterial={openAssignedMaterial} />
          </main>
          <aside className={cardClass('p-4')}>
            <h2 className="mb-4 font-display text-xl font-black text-purple-700">{copy.studentsLabel}</h2>
            {readOnly && <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 font-body text-xs font-900 text-emerald-700">{copy.readOnlyCompleted}</div>}
            <div className="space-y-3">
              {students.map(student => (
                <AttendanceStudentCard
                  key={student.id}
                  student={student}
                  value={attendanceDraft[student.id] || 'present'}
                  copy={copy}
                  readOnly={readOnly}
                  onChange={status => setAttendanceDraft({ ...attendanceDraft, [student.id]: status })}
                />
              ))}
            </div>
          </aside>
        </div>
      </motion.section>
      {activeMaterialLesson && (
        <InteractiveLessonRoom
          lesson={activeMaterialLesson}
          userId={lesson.studentId}
          lang={copy.lang}
          onExit={() => setActiveMaterialLesson(null)}
          onCompleted={() => {}}
        />
      )}
      {typeof document !== 'undefined' ? createPortal(resultDialog, document.body) : resultDialog}
    </div>
  );
}

function sectionEmoji(section: LessonStructureSection) {
  if (section.id === 'teacher-comment') return '💬';
  if (section.id === 'interactive-tasks') return '🧩';
  const icons: Record<LessonStructureSection['kind'], string> = {
    theory: '📘',
    class_task: '🧩',
    practice: '🎯',
    homework: '📚',
    grammar: '📝',
    listening: '🎧',
    checkpoint: '🏁',
    custom: '✨',
  };
  return icons[section.kind] || '✨';
}

function sectionDisplayLabel(section: LessonStructureSection, copy: TeacherCopy) {
  if (section.id === 'teacher-comment') return copy.teacherComment;
  if (section.id === 'interactive-tasks') return copy.interactiveTasks;
  if (section.kind === 'theory') return copy.theoryContent;
  if (section.kind === 'class_task') return copy.lessonTabs['Lesson Tasks'];
  if (section.kind === 'practice') return copy.practiceContent;
  if (section.kind === 'homework') return copy.homeworkContent;
  if (section.kind === 'grammar') return copy.grammarContent;
  if (section.kind === 'listening') return copy.listeningContent;
  if (section.kind === 'checkpoint') return copy.lessonTabs['Unit Checkpoint'];
  return section.label || copy.assignedContentPreview;
}

function lessonWorkspaceSections(lesson: TeacherLesson, copy: TeacherCopy): LessonStructureSection[] {
  return lesson.structure
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(section => ({
      ...section,
      label: section.materialTitle || section.label || sectionDisplayLabel(section, copy),
    }));
}

function sectionTone(section?: LessonStructureSection | null) {
  if (section?.kind === 'theory') return 'from-blue-50 to-purple-50 border-blue-100 text-blue-600';
  if (section?.kind === 'practice') return 'from-emerald-50 to-cyan-50 border-emerald-100 text-emerald-600';
  if (section?.kind === 'homework') return 'from-pink-50 to-purple-50 border-pink-100 text-pink-600';
  if (section?.kind === 'grammar') return 'from-yellow-50 to-amber-50 border-yellow-100 text-yellow-700';
  if (section?.kind === 'listening') return 'from-cyan-50 to-blue-50 border-cyan-100 text-cyan-700';
  if (section?.kind === 'checkpoint') return 'from-amber-50 to-pink-50 border-amber-100 text-amber-600';
  return 'from-purple-50 to-pink-50 border-purple-100 text-purple-600';
}

function LessonContentPanel({ section, lesson, copy, draft, setDraft, readOnly, onOpenMaterial }: { section: LessonStructureSection | null; lesson: TeacherLesson; copy: TeacherCopy; draft: LessonCompletionDraft; setDraft: (draft: LessonCompletionDraft) => void; readOnly: boolean; onOpenMaterial: (section: LessonStructureSection | null) => Promise<void> }) {
  const cards = section ? lessonSectionCards(section, copy) : [];
  return (
    <div className="rounded-3xl border border-purple-100 bg-gradient-to-br from-white via-pink-50/45 to-purple-50/55 p-5">
      <div className="mb-3 font-body text-xs font-900 uppercase text-purple-300">{copy.lessonStructure}</div>
      <h3 className="font-display text-3xl font-black text-purple-700">{lessonTopic(lesson, copy)}</h3>
      {section ? (
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {(section.adminNote || section.materialUrl) && (
          <div className="rounded-3xl border border-white/80 bg-white/80 p-4 md:col-span-2">
            {section.adminNote && <p className="font-body text-sm text-purple-500">{section.adminNote}</p>}
            {section.materialUrl && <a href={section.materialUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-full bg-purple-100 px-3 py-1 font-body text-xs font-900 text-purple-700">{copy.openAssignedMaterial}</a>}
          </div>
        )}
        {cards.map(card => (
          <motion.button
            key={card.id}
            type="button"
            onClick={() => void onOpenMaterial(section)}
            disabled={!section?.materialUrl && !section?.sourceLessonId}
            whileHover={{ y: -3, scale: 1.008, transition: { duration: 0.12 } }}
            whileTap={{ scale: 0.985, transition: { duration: 0.06 } }}
            className={`rounded-3xl border bg-gradient-to-br p-5 text-left shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${card.tone}`}
          >
            <div className="mb-4 text-3xl">{card.emoji}</div>
            <div className="font-display text-xl font-black text-purple-700">{card.title}</div>
            {card.description && <div className="mt-1 font-body text-xs font-900 uppercase text-purple-300">{card.description}</div>}
            <div className="mt-3 inline-flex rounded-full bg-white/75 px-3 py-1 font-body text-xs font-900">{copy.openContent}</div>
          </motion.button>
        ))}
        {!section.tasks.length && section.kind === 'custom' && section.id !== 'teacher-comment' && <SmallMessage text={copy.noTasksInSection} />}
      </div>
      ) : <SmallMessage text={copy.noAssignedSections} />}
    </div>
  );
}

function lessonSectionCards(section: LessonStructureSection, copy: TeacherCopy) {
  const baseTone = sectionTone(section);
  if (section.id === 'interactive-tasks') {
    const taskCards = section.tasks.map((task, index) => ({
      id: task.id,
      emoji: index === 0 ? '🧩' : '🎮',
      title: task.title || copy.interactiveTask,
      tone: 'from-cyan-50 to-blue-50 border-cyan-100 text-blue-600',
      description: task.mechanicType.replace(/_/g, ' '),
    }));
    return taskCards.length ? taskCards : [{ id: `${section.id}-interactive-empty`, emoji: '🧩', title: copy.interactiveTasks, tone: 'from-cyan-50 to-blue-50 border-cyan-100 text-blue-600', description: copy.noTasksInSection }];
  }
  if (section.kind === 'theory') {
    return [{ id: `${section.id}-theory`, emoji: '📘', title: copy.theoryContent, tone: baseTone, description: section.label }];
  }
  if (section.kind === 'class_task') {
    return [{ id: `${section.id}-lesson-task`, emoji: '📝', title: copy.lessonTaskContent, tone: 'from-purple-50 to-pink-50 border-purple-100 text-purple-600', description: section.label }];
  }
  if (section.kind === 'practice') {
    return [{ id: `${section.id}-practice`, emoji: '🎯', title: copy.practiceContent, tone: baseTone, description: section.label }];
  }
  if (section.kind === 'homework') {
    return [{ id: `${section.id}-homework`, emoji: '📚', title: copy.homeworkContent, tone: baseTone, description: section.label }];
  }
  if (section.kind === 'grammar') {
    return [{ id: `${section.id}-grammar`, emoji: '📝', title: copy.grammarContent, tone: baseTone, description: section.label }];
  }
  if (section.kind === 'listening') {
    return [{ id: `${section.id}-listening`, emoji: '🎧', title: copy.listeningContent, tone: baseTone, description: section.label }];
  }
  if (section.kind === 'checkpoint') {
    return [{ id: `${section.id}-checkpoint`, emoji: '🏁', title: copy.lessonTabs['Unit Checkpoint'], tone: baseTone, description: section.label }];
  }
  const taskCards = section.tasks.map((task, index) => ({
    id: task.id,
    emoji: index === 0 ? '🧩' : '📝',
    title: task.title || copy.interactiveTask,
    tone: 'from-cyan-50 to-blue-50 border-cyan-100 text-blue-600',
    description: task.mechanicType.replace(/_/g, ' '),
  }));
  return taskCards.length ? taskCards : [{ id: `${section.id}-custom`, emoji: '✨', title: section.label || copy.assignedContentPreview, tone: baseTone, description: '' }];
}

function formatElapsedLessonTime(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function LessonResultForm({ draft, setDraft, readOnly, copy, result, students, elapsedSeconds }: { draft: LessonCompletionDraft; setDraft: (draft: LessonCompletionDraft) => void; readOnly: boolean; copy: TeacherCopy; result: TeacherLessonResult | null; students: TeacherStudent[]; elapsedSeconds: number }) {
  const update = (key: Exclude<keyof LessonCompletionDraft, 'grades'>, value: string) => setDraft({ ...draft, [key]: value });
  const updateGrade = (studentId: string, score: number) => setDraft({ ...draft, grades: { ...draft.grades, [studentId]: score } });
  const savedDurationSeconds = Number(result?.payload?.actual_duration_seconds || 0);
  const visibleDuration = savedDurationSeconds || elapsedSeconds;
  return (
    <section className="mt-4 rounded-3xl border border-purple-100 bg-white/70 p-5">
      <div className="mb-4">
        <h3 className="font-display text-2xl font-black text-purple-700">{copy.completeLessonTitle}</h3>
        <p className="font-body text-sm text-purple-400">{readOnly ? copy.readOnlyCompleted : copy.completeLessonDescription}</p>
      </div>
      <div className="grid gap-3">
        {visibleDuration > 0 && (
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-3 font-body text-sm font-900 text-emerald-700">
            {copy.duration}: {formatElapsedLessonTime(visibleDuration)}
          </div>
        )}
        <ResultField label={copy.whatCovered} value={draft.summary} readOnly={readOnly} onChange={value => update('summary', value)} />
        <div>
          <span className="mb-1 block font-body text-xs font-900 uppercase text-purple-300">{copy.result}</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {students.map(student => (
              <label key={student.id} className="rounded-3xl border border-purple-100 bg-white/85 p-3">
                <span className="mb-2 block truncate font-body text-sm font-900 text-purple-700">{student.name}</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.5}
                  value={draft.grades[student.id] ?? 5}
                  readOnly={readOnly}
                  onChange={event => updateGrade(student.id, Number(event.target.value))}
                  className="h-10 w-full rounded-2xl border-2 border-pink-100 bg-white px-3 font-body text-sm font-900 text-purple-700 outline-none focus:border-pink-200"
                />
              </label>
            ))}
          </div>
        </div>
        <ResultField label={copy.teacherComment} value={draft.teacherComment} readOnly={readOnly} onChange={value => update('teacherComment', value)} />
        <ResultField label={copy.homeworkContent} value={draft.homeworkBrief} readOnly={readOnly} onChange={value => update('homeworkBrief', value)} />
        <ResultField label={copy.carryOver} value={draft.carryOverToNextLesson} readOnly={readOnly} onChange={value => update('carryOverToNextLesson', value)} />
        <ResultField label={`${copy.noteTargets.Admin}: ${copy.notes}`} value={draft.adminNote} readOnly={readOnly} onChange={value => update('adminNote', value)} />
      </div>
      {result?.updatedAt && <div className="mt-3 font-body text-xs font-900 text-purple-300">{formatTeacherDate(result.updatedAt, copy.lang, true)}</div>}
    </section>
  );
}

function ResultField({ label, value, readOnly, onChange }: { label: string; value: string; readOnly: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block font-body text-xs font-900 uppercase text-purple-300">{label}</span>
      <textarea
        value={value}
        readOnly={readOnly}
        onChange={event => onChange(event.target.value)}
        className={`min-h-20 w-full rounded-3xl border-2 border-pink-100 bg-white/85 p-4 font-body text-sm leading-6 text-purple-700 outline-none transition ${readOnly ? 'cursor-default opacity-80' : 'focus:border-pink-200 focus:bg-white'}`}
      />
    </label>
  );
}

function AttendanceStudentCard({ student, value, copy, readOnly = false, onChange }: { student: TeacherStudent; value: AttendanceStatus; copy: TeacherCopy; readOnly?: boolean; onChange: (status: AttendanceStatus) => void }) {
  const options: Array<{ value: AttendanceStatus; emoji: string; tone: string; glow: string }> = [
    { value: 'present', emoji: '✅', tone: 'emerald', glow: 'shadow-emerald-200/60' },
    { value: 'absent_unexcused', emoji: '❌', tone: 'red', glow: 'shadow-red-200/60' },
    { value: 'late', emoji: '⏱️', tone: 'yellow', glow: 'shadow-yellow-200/60' },
    { value: 'technical_issue', emoji: '💻', tone: 'blue', glow: 'shadow-blue-200/60' },
  ];
  const toneClass: Record<string, string> = {
    emerald: 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-white text-emerald-700',
    red: 'border-red-200 bg-gradient-to-r from-red-50 to-white text-red-700',
    pink: 'border-pink-200 bg-gradient-to-r from-pink-50 to-white text-pink-700',
    yellow: 'border-yellow-200 bg-gradient-to-r from-yellow-50 to-white text-yellow-700',
    blue: 'border-blue-200 bg-gradient-to-r from-blue-50 to-white text-blue-700',
  };
  const dotClass: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    pink: 'bg-pink-100 text-pink-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return (
    <motion.div layout whileHover={{ y: -2 }} className="rounded-3xl border border-purple-100 bg-white/70 p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <TeacherAvatar name={student.name} size="sm" />
        <div className="min-w-0">
          <div className="truncate font-body text-sm font-900 text-purple-700">{student.name}</div>
          <div className="font-body text-xs text-purple-300">{student.level || copyMissing(copy)}</div>
        </div>
      </div>
      <div className="grid gap-2">
        {options.map(option => {
          const active = value === option.value;
          return (
            <motion.button
              key={option.value}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(option.value)}
              whileHover={{ x: 3, scale: 1.006, transition: { duration: 0.1 } }}
              whileTap={{ scale: 0.985, transition: { duration: 0.05 } }}
              className={`group flex items-center justify-between rounded-2xl border px-3 py-2.5 text-left font-body text-xs font-900 transition-colors ${active ? `${toneClass[option.tone]} shadow-md ${option.glow}` : 'border-purple-100 bg-white/75 text-purple-500 hover:border-pink-100 hover:bg-pink-50/70'}`}
            >
              <span className="flex items-center gap-2">
                <span className={`grid h-7 w-7 place-items-center rounded-xl transition-transform duration-150 group-hover:rotate-3 group-hover:scale-105 ${active ? dotClass[option.tone] : 'bg-purple-50 text-purple-500'}`}>{option.emoji}</span>
                {copy.attendanceOptions[option.value]}
              </span>
              <span className={`h-2.5 w-2.5 rounded-full transition-all ${active ? 'bg-current opacity-70 ring-4 ring-white/70' : 'bg-purple-100 opacity-0 group-hover:opacity-100'}`} />
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

function HomeworkPage({ workspace, copy, onSaveReview }: { workspace: TeacherWorkspace; copy: typeof copyByLang.ru; onSaveReview: (homework: TeacherHomework, patch: { teacherComment?: string; resultPercent?: number | null; starRating?: number | null; status?: 'reviewed' | 'revision_requested' }) => Promise<void> }) {
  const [filter, setFilter] = useState<HomeworkFilter>('Needs Review');
  const [groupId, setGroupId] = useState('all');
  const filters: HomeworkFilter[] = ['Needs Review', 'Reviewed', 'Revision Requested', 'Not Submitted', 'Late'];
  const groupChips = [
    { id: 'all', label: copy.allGroups, emoji: '👥' },
    ...workspace.groups.map(group => ({ id: group.id, label: group.name, emoji: '👥' })),
    { id: 'individual', label: copy.individualLessons, emoji: '👤' },
  ];
  const filteredByStatus = workspace.homeworks.filter(item => homeworkState(item) === filter);
  const belongsToGroup = (homework: TeacherHomework, id: string) => {
    const group = groupForStudent(workspace, homework.studentId);
    if (id === 'all') return true;
    if (id === 'individual') return !group;
    return group?.id === id;
  };
  const visibleItems = filteredByStatus.filter(item => belongsToGroup(item, groupId));
  const sections = groupId === 'all'
    ? groupChips.slice(1).map(group => ({ ...group, items: filteredByStatus.filter(item => belongsToGroup(item, group.id)) })).filter(group => group.items.length)
    : groupChips.filter(group => group.id === groupId).map(group => ({ ...group, items: visibleItems }));
  return (
    <div className="space-y-5">
      <PageTitle title={copy.homework} description={copy.homeworkDescription} />
      <section className="overflow-hidden rounded-3xl border border-white/80 bg-white/70 shadow-[0_14px_40px_rgba(126,87,194,0.07)] backdrop-blur-xl dark-panel-soft">
        <div className="border-b border-purple-100/70 bg-gradient-to-r from-white/85 via-pink-50/75 to-purple-50/75 p-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map(item => (
              <motion.button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                whileHover={{ y: -2, scale: 1.01, transition: { duration: 0.1 } }}
                whileTap={{ scale: 0.97, transition: { duration: 0.05 } }}
                className={`relative min-w-max overflow-hidden rounded-2xl px-4 py-2.5 font-body text-xs font-900 shadow-sm transition-colors ${filter === item ? 'text-white' : 'bg-white/80 text-purple-600 hover:bg-pink-50'}`}
              >
                {filter === item && <motion.span layoutId="homework-status-tab" className="absolute inset-0 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400" transition={{ type: 'spring', stiffness: 520, damping: 36 }} />}
                <span className="relative z-10">{statusLabel(item, copy)}</span>
              </motion.button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto p-3">
          {groupChips.map(group => (
            <motion.button
              key={group.id}
              type="button"
              onClick={() => setGroupId(group.id)}
              whileHover={{ y: -2, scale: 1.01, transition: { duration: 0.1 } }}
              whileTap={{ scale: 0.97, transition: { duration: 0.05 } }}
              className={`min-w-max rounded-2xl border px-4 py-2 font-body text-xs font-900 shadow-sm transition-colors ${groupId === group.id ? 'border-pink-200 bg-gradient-to-r from-pink-50 to-purple-50 text-pink-600' : 'border-purple-100 bg-white/80 text-purple-600 hover:border-pink-100 hover:bg-pink-50/70'}`}
            >
              <span className="mr-2">{group.emoji}</span>{group.label}
            </motion.button>
          ))}
        </div>
      </section>
      {sections.length ? (
        <div className="space-y-4">
          {sections.map(section => <HomeworkGroupSection key={section.id} title={section.label} emoji={section.emoji} items={section.items} workspace={workspace} copy={copy} onSaveReview={onSaveReview} />)}
        </div>
      ) : <CompactEmpty icon={ClipboardCheck} emoji="🤷‍♀️" title={copy.noHomework} description={copy.noHomeworkText} />}
    </div>
  );
}

function HomeworkGroupSection({ title, emoji, items, workspace, copy, onSaveReview }: { title: string; emoji: string; items: TeacherHomework[]; workspace: TeacherWorkspace; copy: TeacherCopy; onSaveReview: (homework: TeacherHomework, patch: { teacherComment?: string; resultPercent?: number | null; starRating?: number | null; status?: 'reviewed' | 'revision_requested' }) => Promise<void> }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/80 bg-white/65 shadow-[0_14px_40px_rgba(126,87,194,0.07)] backdrop-blur-xl dark-panel-soft">
      <div className="flex items-center justify-between gap-3 border-b border-purple-100/70 bg-gradient-to-r from-white/85 via-pink-50/70 to-purple-50/70 px-5 py-4">
        <h2 className="font-display text-2xl font-black text-purple-700"><span className="mr-2">{emoji}</span>{title}</h2>
        <span className="rounded-full bg-white/85 px-3 py-1 font-body text-xs font-900 text-purple-500 shadow-sm">{items.length}</span>
      </div>
      <div className="grid gap-4 p-4 xl:grid-cols-2">
        {items.map(item => <HomeworkReviewCard key={item.id} workspace={workspace} homework={item} copy={copy} onSaveReview={onSaveReview} />)}
      </div>
    </section>
  );
}

function NotesPage({ workspace, localNotes, copy, onSaveNote, onTogglePin, onDeleteNote }: { workspace: TeacherWorkspace; localNotes: LocalNote[]; copy: TeacherCopy; onSaveNote: (note: Omit<LocalNote, 'id' | 'createdAt'>) => Promise<boolean>; onTogglePin: (id: string) => void; onDeleteNote: (id: string) => void }) {
  return (
    <div className="space-y-5">
      <PageTitle title={copy.notes} description="" />
      <NotesComposer targetId={workspace.teacher?.id || 'teacher'} localNotes={localNotes} onSaveNote={onSaveNote} onTogglePin={onTogglePin} onDeleteNote={onDeleteNote} copy={copy} />
    </div>
  );
}

function NotesComposer({ target = 'Teacher', targetId, localNotes, onSaveNote, onTogglePin, onDeleteNote, copy }: { target?: LocalNote['target']; targetId: string; localNotes: LocalNote[]; onSaveNote: (note: Omit<LocalNote, 'id' | 'createdAt'>) => Promise<boolean>; onTogglePin?: (id: string) => void; onDeleteNote?: (id: string) => void; copy: TeacherCopy }) {
  const [form, setForm] = useState({ type: 'Private' as NoteType, text: '', pinned: false });
  const [deleteCandidate, setDeleteCandidate] = useState<LocalNote | null>(null);
  const visibleNotes = [...localNotes].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const textLength = form.text.trim().length;
  const submit = async () => {
    const ok = await onSaveNote({ target, targetId, type: form.type, text: form.text, attachmentLabel: '', pinned: form.pinned });
    if (ok) setForm(prev => ({ ...prev, text: '', pinned: false }));
  };
  const confirmDelete = () => {
    if (!deleteCandidate) return;
    onDeleteNote?.(deleteCandidate.id);
    setDeleteCandidate(null);
  };
  const deleteModal = (
    <AnimatePresence>
      {deleteCandidate && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-purple-950/12 px-4 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 480, damping: 34 }}
            className="w-full max-w-[420px] overflow-hidden rounded-[2rem] bg-white shadow-[0_28px_90px_rgba(126,87,194,0.24)] ring-1 ring-white/90"
          >
            <div className="px-6 pb-3 pt-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-50 to-pink-50 text-2xl shadow-[0_10px_24px_rgba(244,63,94,0.12)]">🗑️</div>
                <div>
                  <h3 className="font-display text-2xl font-black text-purple-700">{copy.deleteNoteConfirm}</h3>
                  <p className="mt-1 font-body text-sm text-purple-400">{noteTypeLabel(deleteCandidate.type, copy)} · {formatTeacherDate(deleteCandidate.createdAt, copy.lang)}</p>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6">
              <p className="line-clamp-2 font-body text-sm leading-6 text-purple-500">
                “{deleteCandidate.text}”
              </p>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <motion.button
                  type="button"
                  onClick={() => setDeleteCandidate(null)}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-2xl bg-white px-5 py-3 font-body text-sm font-900 text-purple-600 shadow-[0_8px_24px_rgba(126,87,194,0.10)] ring-1 ring-purple-100 transition hover:bg-purple-50"
                >
                  {copy.lang === 'ua' ? 'Скасувати' : copy.lang === 'en' ? 'Cancel' : 'Отмена'}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={confirmDelete}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-2xl bg-gradient-to-r from-rose-400 to-pink-500 px-5 py-3 font-body text-sm font-900 text-white shadow-[0_16px_34px_rgba(244,63,94,0.24)] transition hover:shadow-[0_20px_42px_rgba(244,63,94,0.32)]"
                >
                  🗑️ {copy.deleteNote}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return (
    <>
    <section className="overflow-hidden rounded-3xl border border-white/75 bg-white/65 shadow-sm backdrop-blur dark-panel-soft">
      <div className="border-b border-purple-100/70 bg-gradient-to-r from-white/80 via-pink-50/70 to-purple-50/70 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-display text-2xl font-black text-purple-700">✏️ {copy.notes}</div>
          <div className="rounded-full bg-white/80 px-3 py-1 font-body text-xs font-900 text-purple-400">{visibleNotes.length} · {copy.recentNotes}</div>
        </div>
      </div>
      <div className="grid gap-4 p-5">
      <div className="grid gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2 rounded-2xl bg-white/70 p-1">
            {(['Private', 'Visible to Admin'] as NoteType[]).map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, type: item }))}
                className={`rounded-xl px-4 py-2 font-body text-sm font-900 transition-all ${form.type === item ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-md' : 'text-purple-600 hover:bg-pink-50'}`}
              >
                {noteTypeLabel(item, copy)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setForm(prev => ({ ...prev, pinned: !prev.pinned }))}
            className={`rounded-2xl border px-4 py-2 font-body text-sm font-900 transition-all ${form.pinned ? 'border-yellow-200 bg-yellow-50 text-yellow-700' : 'border-purple-100 bg-white/70 text-purple-500 hover:bg-pink-50'}`}
          >
            📌 {copy.pinNote}
          </button>
        </div>
        <textarea
          value={form.text}
          onChange={event => setForm(prev => ({ ...prev, text: event.target.value }))}
          placeholder={copy.internalNotePlaceholder}
          className="min-h-40 rounded-3xl border-2 border-pink-100 bg-white/80 p-5 font-body text-sm leading-6 text-purple-700 outline-none transition focus:border-pink-200 focus:bg-white"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-body text-xs font-900 text-purple-300">{textLength}</div>
        <button type="button" onClick={submit} disabled={!textLength} className={`btn-magic px-5 py-2.5 text-sm text-white ${!textLength ? 'opacity-50' : ''}`}>💾 {copy.saveNote}</button>
      </div>
      <div className="mt-6 space-y-3">
        {visibleNotes.length ? visibleNotes.map(note => <NoteRow key={note.id} note={note} copy={copy} onTogglePin={onTogglePin} onRequestDelete={setDeleteCandidate} />) : <SmallMessage text={copy.noNotes} />}
      </div>
      </div>
    </section>
    {typeof document !== 'undefined' ? createPortal(deleteModal, document.body) : deleteModal}
    </>
  );
}

function NotificationsPage({ notifications, copy, onRead, onOpen }: { notifications: TeacherNotification[]; copy: typeof copyByLang.ru; onRead: (notification: TeacherNotification) => void; onOpen: (notification: TeacherNotification) => void }) {
  return (
    <div className="space-y-5">
      <PageTitle title={copy.notifications} description={copy.notificationsDescription} />
      <section className="overflow-hidden rounded-3xl border border-white/75 bg-white/65 shadow-sm backdrop-blur dark-panel-soft">
        <div className="border-b border-purple-100/70 bg-gradient-to-r from-white/85 via-pink-50/75 to-purple-50/75 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-black text-purple-700">🔔 {copy.notificationFeed}</h2>
              <p className="font-body text-sm text-purple-400">{notifications.filter(item => !item.read).length} / {notifications.length}</p>
            </div>
            <span className="rounded-full bg-white/85 px-3 py-1 font-body text-xs font-900 text-pink-500 shadow-sm">{copy.notifications}</span>
          </div>
        </div>
        <div className="space-y-3 p-5">
          {notifications.length ? notifications.map((item, index) => (
            <NotificationCard key={item.id} notification={item} copy={copy} index={index} onRead={() => onRead(item)} onOpen={() => onOpen(item)} />
          )) : <CompactEmpty icon={Bell} title={copy.noNotifications} description={copy.systemUpdatesEmpty} />}
        </div>
      </section>
    </div>
  );
}

function NotificationCard({ notification, copy, index, onRead, onOpen }: { notification: TeacherNotification; copy: TeacherCopy; index: number; onRead: () => void; onOpen: () => void }) {
  const isLessonNotice = notification.type === 'Lesson rescheduled' || notification.type === 'Lesson cancelled';
  const lessonKind = notification.lessonKind === 'group' ? copy.groupLesson : notification.lessonKind === 'trial' ? copy.trialLesson : copy.individualLesson;
  const tone = notification.read ? 'border-purple-100 bg-white/60' : 'border-pink-200 bg-gradient-to-br from-white via-pink-50/80 to-purple-50/75 shadow-[0_16px_45px_rgba(236,72,153,0.10)]';
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.28 }}
      whileHover={{ y: -3 }}
      className={`relative overflow-hidden rounded-3xl border p-4 transition-all ${tone}`}
    >
      {!notification.read && <span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-pink-400 shadow-[0_0_0_6px_rgba(244,114,182,0.14)]" />}
      <div className="grid gap-4 lg:grid-cols-[auto_1fr_auto] lg:items-start">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-2xl shadow-sm">
          {notification.type === 'Homework received' ? '📚' : notification.type === 'Assigned group' ? '👥' : '🗓️'}
        </div>
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-purple-100 px-3 py-1 font-body text-xs font-900 text-purple-700">{notificationTypeLabel(notification.type, copy)}</span>
            <span className={`rounded-full px-3 py-1 font-body text-xs font-900 ${notification.read ? 'bg-emerald-100 text-emerald-700' : 'bg-pink-100 text-pink-700'}`}>{notification.read ? copy.read : copy.markRead}</span>
          </div>
          <h3 className="font-display text-xl font-black text-purple-700">{notification.topic || notification.text}</h3>
          <p className="mt-1 font-body text-sm text-purple-400">
            {notification.type === 'Lesson rescheduled' ? `${copy.rescheduledTo}: ${formatTeacherDate(notification.date, copy.lang, false)}` : formatTeacherDate(notification.date, copy.lang, false)}
          </p>
          {isLessonNotice && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <NotificationDetail label={copy.format} value={lessonKind} />
              {notification.studentName && <NotificationDetail label={copy.notificationStudent} value={notification.studentName} />}
              {notification.groupName && <NotificationDetail label={copy.notificationGroup} value={notification.groupName} />}
              {notification.groupCategory && <NotificationDetail label={copy.notificationCourse} value={notification.groupCategory} />}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button type="button" onClick={onRead} disabled={notification.read} className={compactButton(notification.read ? 'green' : 'yellow')}>{notification.read ? copy.read : copy.markRead}</button>
          <button type="button" onClick={onOpen} className="btn-magic px-4 py-2 text-xs text-white">{copy.open}</button>
        </div>
      </div>
    </motion.article>
  );
}

function NotificationDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-purple-100 bg-white/70 px-3 py-2">
      <div className="font-body text-[10px] font-900 uppercase text-purple-300">{label}</div>
      <div className="mt-0.5 truncate font-body text-sm font-900 text-purple-700">{value}</div>
    </div>
  );
}

function ProfilePage({ workspace, lang, copy, onRefresh, showToast }: { workspace: TeacherWorkspace; lang: Lang; copy: typeof copyByLang.ru; onRefresh: () => Promise<void>; showToast: (message: string) => void }) {
  const teacher = workspace.teacher!;
  const languageOptions = [
    { value: 'Ukrainian', label: copy.languageUkrainian, emoji: '🇺🇦' },
    { value: 'Russian', label: copy.languageRussian, emoji: '🇷🇺' },
    { value: 'English', label: copy.languageEnglish, emoji: '🇬🇧' },
  ];
  const normalizeLanguages = (values: string[]) => languageOptions
    .filter(option => values.some(value => {
      const normalized = value.toLowerCase();
      return [option.value.toLowerCase(), option.label.toLowerCase()].includes(normalized);
    }))
    .map(option => option.value);
  const [form, setForm] = useState({ firstName: teacher.firstName, lastName: teacher.lastName, phone: teacher.phone || '' });
  const [languageDraft, setLanguageDraft] = useState<string[]>(() => normalizeLanguages(teacher.teachingLanguages));
  const [busy, setBusy] = useState(false);
  const toggleLanguage = (value: string) => {
    setLanguageDraft(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
  };
  const save = async () => {
    setBusy(true);
    try {
      await updateOwnTeacherProfile(teacher.id, { firstName: form.firstName, lastName: form.lastName, phone: form.phone, teachingLanguages: languageDraft });
      await onRefresh();
      showToast(copy.saved);
    } catch (error) {
      showToast(error instanceof Error ? error.message : copy.failed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <PageTitle title={copy.profile} description="" />
      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <TeacherAvatarUploader teacher={teacher} lang={lang} onSaved={async message => { await onRefresh(); showToast(message); }} />
        <div className="rounded-3xl border border-white/70 bg-white/65 p-5 shadow-sm backdrop-blur dark-panel-soft">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-xl font-black text-purple-700">{copy.personalInformation}</h2>
            <span className="rounded-full bg-purple-100 px-3 py-1 font-body text-xs font-900 text-purple-600">{copy.noteTargets.Teacher}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={copy.firstName} value={form.firstName} onChange={value => setForm(prev => ({ ...prev, firstName: value }))} />
            <Field label={copy.lastName} value={form.lastName} onChange={value => setForm(prev => ({ ...prev, lastName: value }))} />
            <Field label={copy.phone} value={form.phone} onChange={value => setForm(prev => ({ ...prev, phone: value }))} />
            <InfoPill label={copy.email} value={teacher.email} />
            <div className="md:col-span-2">
              <div className="mb-2 font-body text-sm font-900 text-purple-600">{copy.teacherLanguages}</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {languageOptions.map(option => {
                  const selected = languageDraft.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleLanguage(option.value)}
                      className={`rounded-2xl border px-4 py-3 text-left font-body text-sm font-900 transition-all ${
                        selected
                          ? 'border-pink-200 bg-gradient-to-r from-pink-100 to-purple-100 text-purple-700 shadow-sm'
                          : 'border-purple-100 bg-white/70 text-purple-500 hover:border-pink-200 hover:bg-pink-50'
                      }`}
                    >
                      <span className="mr-2 text-lg">{option.emoji}</span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <button type="button" disabled={busy} onClick={save} className="btn-magic mt-5 px-5 py-2.5 text-sm text-white">{copy.save}</button>
        </div>
      </section>
    </div>
  );
}

function lessonsForStudentAnalytics(workspace: TeacherWorkspace, student: TeacherStudent) {
  return workspace.lessons
    .filter(lesson => {
      if (lesson.studentId === student.id) return true;
      const group = groupForLesson(workspace, lesson);
      return Boolean(group?.studentIds.includes(student.id));
    })
    .sort((a, b) => dateValue(a) - dateValue(b));
}

function averageValue(values: Array<number | null | undefined>) {
  const clean = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!clean.length) return null;
  return Math.round((clean.reduce((sum, value) => sum + value, 0) / clean.length) * 10) / 10;
}

function ratingLabel(value: number | null, copy: TeacherCopy) {
  if (value === null) return copyMissing(copy);
  return `${value}/5`;
}

function percentFromCount(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function compactDate(value: string | null | undefined, copy: TeacherCopy) {
  return value ? formatTeacherDate(value, copy.lang, false) : copyMissing(copy);
}

function StudentProfile({ student, workspace, copy, onOpenLesson }: { student: TeacherStudent; workspace: TeacherWorkspace; copy: TeacherCopy; onOpenLesson: (lesson: TeacherLesson) => void }) {
  const group = groupForStudent(workspace, student.id);
  const lessons = lessonsForStudentAnalytics(workspace, student);
  const homework = workspace.homeworks.filter(item => item.studentId === student.id).sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));
  const completedLessons = lessons.filter(lesson => lesson.status === 'completed' || lesson.isConducted).length;
  const submittedHomework = homework.filter(item => ['reviewed', 'submitted', 'revision_requested'].includes(item.reviewStatus) || Boolean(item.submittedAt || item.checkedAt)).length;
  const reviewedHomework = homework.filter(item => item.reviewStatus === 'reviewed' || Boolean(item.checkedAt));
  const averageHomeworkRating = averageValue(reviewedHomework.map(item => item.starRating));
  const averageLessonRating = averageValue(workspace.grades.filter(grade => grade.studentId === student.id).map(grade => grade.score));
  const lessonHistory = lessons.slice().sort((a, b) => dateValue(b) - dateValue(a)).slice(0, 8);
  const homeworkHistory = homework.slice(0, 8);
  const lastLesson = lessons.filter(lesson => dateValue(lesson) <= Date.now()).sort((a, b) => dateValue(b) - dateValue(a))[0] || student.lastLesson;
  const nextLesson = lessons.filter(lesson => dateValue(lesson) >= Date.now() && !['completed', 'cancelled'].includes(lesson.status)).sort((a, b) => dateValue(a) - dateValue(b))[0] || student.nextLesson;
  const homeworkCompletion = student.homeworkCompletion || percentFromCount(submittedHomework, homework.length);
  const activityDates = lessonHistory.slice().reverse().map(lesson => ({
    label: lesson.date ? formatTeacherDate(lesson.date, copy.lang, false).split(' ').slice(0, 2).join(' ') : lesson.day || copy.lesson,
    value: lesson.status === 'completed' || lesson.isConducted ? 100 : lesson.status === 'cancelled' ? 18 : 52,
  }));
  return (
    <div className="space-y-5">
      <section className={cardClass('overflow-hidden p-0')}>
        <div className="border-b border-purple-100/70 bg-gradient-to-r from-white/90 via-pink-50/70 to-purple-50/70 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <TeacherAvatar name={student.name} size="lg" />
              <div className="min-w-0">
                <div className="font-body text-xs font-900 uppercase text-pink-400">{copy.studentAnalytics}</div>
                <h1 className="truncate font-display text-3xl font-black text-purple-700">{student.name}</h1>
                <p className="mt-1 font-body text-sm text-purple-400">{student.email} · {group?.name || student.groupNames.join(', ') || copy.individualLessons}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-purple-100 px-3 py-1 font-body text-xs font-900 text-purple-700">{student.level || copyMissing(copy)}</span>
              <span className="rounded-full bg-pink-50 px-3 py-1 font-body text-xs font-900 text-pink-600">{copy.groupLabel}: {group?.name || copy.individualLessons}</span>
              <span className="rounded-full bg-blue-50 px-3 py-1 font-body text-xs font-900 text-blue-600">{copy.course}: {student.course || group?.course || copyMissing(copy)}</span>
            </div>
          </div>
        </div>
        <div className="p-5">
          <p className="font-body text-sm text-purple-400">{copy.analyticsDescription}</p>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CalendarDays} label={copy.attendance} value={`${student.attendance}%`} />
        <MetricCard icon={BookOpen} label={copy.completedLessonsMetric} value={completedLessons} />
        <MetricCard icon={ClipboardCheck} label={copy.completedHomeworkMetric} value={submittedHomework} />
        <MetricCard icon={Star} label={copy.averageHomeworkRating} value={ratingLabel(averageHomeworkRating, copy)} />
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <InfoPill label={copy.averageLessonRating} value={ratingLabel(averageLessonRating, copy)} />
        <InfoPill label={copy.currentUnit} value={group?.currentUnit || (nextLesson || lastLesson || lessons[0] ? lessonUnit(workspace, nextLesson || lastLesson || lessons[0], copy) : copyMissing(copy))} />
        <InfoPill label={copy.currentLesson} value={group?.currentLesson || (nextLesson || lastLesson || lessons[0] ? lessonNumberValue(workspace, nextLesson || lastLesson || lessons[0], copy) : copyMissing(copy))} />
        <InfoPill label={copy.lastLessonDate} value={formatLessonMoment(lastLesson, copy.lang)} />
        <InfoPill label={copy.nextLessonDate} value={formatLessonMoment(nextLesson, copy.lang)} />
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        <AnalyticsBarCard title={copy.attendance} value={student.attendance} tone="green" />
        <AnalyticsBarCard title={copy.homeworkCompletionChart} value={homeworkCompletion} tone="pink" />
        <LessonActivityCard title={copy.lessonActivity} points={activityDates} copy={copy} />
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title={copy.lessonHistory}>
          <div className="space-y-2">
            {lessonHistory.length ? lessonHistory.map(lesson => (
              <button key={lesson.id} type="button" onClick={() => onOpenLesson(lesson)} className="grid w-full gap-3 rounded-3xl border border-purple-100 bg-white/70 p-3 text-left transition hover:border-pink-100 hover:bg-pink-50/60 sm:grid-cols-[1fr_auto] sm:items-center">
                <span className="min-w-0">
                  <span className="block truncate font-body text-sm font-900 text-purple-700">{lessonTopic(lesson, copy)}</span>
                  <span className="mt-1 block font-body text-xs text-purple-400">{formatLessonMoment(lesson, copy.lang)} · {lessonTarget(workspace, lesson)}</span>
                </span>
                {statusBadge(lessonStatus(lesson), copy)}
              </button>
            )) : <SmallMessage text={copy.noHistory} />}
          </div>
        </Panel>
        <Panel title={copy.homeworkHistory}>
          <div className="space-y-2">
            {homeworkHistory.length ? homeworkHistory.map(item => (
              <div key={item.id} className="grid gap-3 rounded-3xl border border-purple-100 bg-white/70 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="truncate font-body text-sm font-900 text-purple-700">{item.title}</div>
                  <div className="mt-1 font-body text-xs text-purple-400">{compactDate(item.dueDate || item.scheduledDate, copy)} · {item.starRating ? `${item.starRating}/5` : copyMissing(copy)}</div>
                </div>
                {statusBadge(homeworkState(item), copy)}
              </div>
            )) : <SmallMessage text={copy.noHistory} />}
          </div>
        </Panel>
      </section>
      <Panel title={copy.assignedLessons}>
        <div className="space-y-2">
          {lessons.length ? lessons.map(lesson => <LessonRow key={lesson.id} workspace={workspace} lesson={lesson} copy={copy} onOpen={() => onOpenLesson(lesson)} />) : <SmallMessage text={copy.noHistory} />}
        </div>
      </Panel>
    </div>
  );
}

function AnalyticsBarCard({ title, value, tone }: { title: string; value: number; tone: 'green' | 'pink' }) {
  const width = Math.max(0, Math.min(100, value));
  const fill = tone === 'green' ? 'from-emerald-300 to-teal-300' : 'from-pink-300 to-purple-300';
  const text = tone === 'green' ? 'text-emerald-700' : 'text-pink-600';
  return (
    <motion.section whileHover={{ y: -4, transition: { duration: 0.12 } }} className={cardClass('p-4 transition-shadow hover:shadow-[0_20px_55px_rgba(126,87,194,0.13)]')}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-black text-purple-700">{title}</h3>
        <span className={`font-display text-2xl font-black ${text}`}>{width}%</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-purple-50">
        <motion.div initial={{ width: 0 }} animate={{ width: `${width}%` }} transition={{ duration: 0.5 }} className={`h-full rounded-full bg-gradient-to-r ${fill}`} />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className={`h-1.5 rounded-full ${width >= (index + 1) * 20 ? `bg-gradient-to-r ${fill}` : 'bg-purple-50'}`} />
        ))}
      </div>
    </motion.section>
  );
}

function LessonActivityCard({ title, points, copy }: { title: string; points: Array<{ label: string; value: number }>; copy: TeacherCopy }) {
  const values = points.length ? points : [{ label: copyMissing(copy), value: 0 }];
  return (
    <motion.section whileHover={{ y: -4, transition: { duration: 0.12 } }} className={cardClass('p-4 transition-shadow hover:shadow-[0_20px_55px_rgba(126,87,194,0.13)]')}>
      <h3 className="mb-3 font-display text-lg font-black text-purple-700">{title}</h3>
      <div className="flex h-24 items-end gap-2 rounded-3xl border border-purple-100 bg-gradient-to-br from-white via-blue-50/50 to-pink-50/50 p-3">
        {values.map((point, index) => (
          <div key={`${point.label}-${index}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <motion.div
              initial={{ height: 8 }}
              animate={{ height: `${Math.max(8, Math.min(100, point.value))}%` }}
              transition={{ duration: 0.35, delay: index * 0.03 }}
              className="w-full rounded-t-2xl bg-gradient-to-t from-purple-300 to-pink-300"
            />
          </div>
        ))}
      </div>
      <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
        {values.map((point, index) => <span key={`${point.label}-label-${index}`} className="truncate text-center font-body text-[10px] font-700 text-purple-300">{point.label}</span>)}
      </div>
    </motion.section>
  );
}

function ScheduleCard({ workspace, lesson, copy, onOpen, onStart, onRequestChange }: { workspace: TeacherWorkspace; lesson: TeacherLesson; copy: typeof copyByLang.ru; onOpen: () => void; onStart: () => void; onRequestChange: () => void }) {
  const group = groupForLesson(workspace, lesson);
  const status = lessonStatus(lesson);
  const students = studentsForLesson(workspace, lesson);
  const isGroupLesson = Boolean(group) || lesson.type === 'group';
  const completed = status === 'Completed';
  const lessonDate = dateFromIso(lesson.date || todayIso());
  const dayNumber = lessonDate.toLocaleDateString(langLocale(copy.lang), { day: '2-digit' });
  const monthName = lessonDate.toLocaleDateString(langLocale(copy.lang), { month: 'short' });
  const duration = lesson.durationMinutes || group?.lessonDurationMinutes || 60;
  const title = isGroupLesson ? group?.name || lessonTarget(workspace, lesson) : students[0]?.name || lessonTarget(workspace, lesson);
  return (
    <article className={`relative overflow-hidden rounded-3xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(126,87,194,0.10)] ${
      completed ? 'border-emerald-100 bg-white/55' : 'border-purple-100 bg-white/78'
    }`}>
      <div className="grid gap-4 lg:grid-cols-[110px_1fr_auto] lg:items-start">
        <div className={`rounded-3xl border p-4 text-center ${completed ? 'border-emerald-100 bg-emerald-50/60' : 'border-pink-100 bg-gradient-to-br from-white to-pink-50/80'}`}>
          <div className={`font-display text-3xl font-black ${completed ? 'text-emerald-600' : 'text-purple-700'}`}>
            <GreenStrike active={completed}>{dayNumber}</GreenStrike>
          </div>
          <div className="font-body text-xs font-900 uppercase text-purple-300">{monthName}</div>
          <div className={`mt-3 rounded-2xl px-3 py-2 font-display text-xl font-black ${completed ? 'bg-white/70 text-emerald-600' : 'bg-white/85 text-purple-700'}`}>
            <GreenStrike active={completed}>{lesson.time}</GreenStrike>
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-purple-100 px-3 py-1 font-body text-xs font-900 text-purple-700">{lessonTypeLabel(lesson, copy)}</span>
            {statusBadge(status, copy)}
          </div>
          <h3 className="font-display text-2xl font-black text-purple-700">
            <GreenStrike active={completed}>{title}</GreenStrike>
          </h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
            <ScheduleInfo label={copy.duration} value={`${duration} ${copy.minutesShort}`} />
            <ScheduleInfo label={copy.format} value={lessonTypeLabel(lesson, copy)} />
            <ScheduleInfo label={copy.course} value={lessonCourse(workspace, lesson)} />
            <ScheduleInfo label={copy.unit} value={lessonUnit(workspace, lesson, copy)} />
            <ScheduleInfo label={copy.topic} value={lessonTopic(lesson, copy)} />
            {!isGroupLesson && <ScheduleInfo label={copy.level} value={students[0] ? studentPlan(students[0], copy) : copyMissing(copy)} />}
          </div>
          {isGroupLesson && (
            <div className="mt-4 rounded-3xl border border-purple-100 bg-white/60 p-3">
              <div className="mb-2 font-body text-xs font-900 uppercase text-purple-300">{copy.studentsInGroup}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {students.map(student => (
                  <div key={student.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/75 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <TeacherAvatar name={student.name} size="sm" />
                      <span className="truncate font-body text-sm font-900 text-purple-700">{student.name}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-pink-50 px-2.5 py-1 font-body text-[11px] font-900 text-pink-600">{studentPlan(student, copy)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-40 lg:justify-end">
          {(status === 'Upcoming' || status === 'Ready' || status === 'In Progress') && <button type="button" onClick={onOpen} className={compactButton('purple')}>{copy.openLesson}</button>}
          {status === 'Ready' && <button type="button" onClick={onStart} className={compactButton('green')}>{copy.startLesson}</button>}
          {(status === 'Upcoming' || status === 'Rescheduled') && <button type="button" onClick={onRequestChange} className={compactButton('yellow')}>{copy.requestChange}</button>}
        </div>
      </div>
    </article>
  );
}

function GreenStrike({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      <span className={active ? 'opacity-85' : ''}>{children}</span>
      {active && <span className="pointer-events-none absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 -rotate-1 rounded-full bg-emerald-400/80 shadow-[0_0_0_2px_rgba(209,250,229,0.9)]" />}
    </span>
  );
}

function ScheduleInfo({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-purple-100 bg-white/65 px-3 py-2">
      <div className="font-body text-[11px] font-900 uppercase text-purple-300">{label}</div>
      <div className="mt-0.5 truncate font-body text-sm font-900 text-purple-700">{value}</div>
    </div>
  );
}

function LessonCard({ workspace, lesson, copy, onOpen, onStart }: { workspace: TeacherWorkspace; lesson: TeacherLesson; copy: typeof copyByLang.ru; onOpen: () => void; onStart: () => void }) {
  const group = groupForLesson(workspace, lesson);
  const status = lessonStatus(lesson);
  const students = studentsForLesson(workspace, lesson);
  return (
    <motion.article whileHover={{ y: -4 }} className={cardClass('overflow-hidden p-0')}>
      <div className="border-b border-purple-100/70 bg-gradient-to-r from-white/85 via-pink-50/60 to-purple-50/60 p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-2xl font-black text-purple-700">{lessonTopic(lesson, copy)}</h3>
            <p className="mt-1 font-body text-sm capitalize text-purple-400">{lessonDateLabel(lesson, copy)}</p>
          </div>
          {statusBadge(status, copy)}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white/80 px-3 py-1 font-body text-xs font-900 text-purple-600">{lessonTypeLabel(lesson, copy)}</span>
          <span className="rounded-full bg-pink-50 px-3 py-1 font-body text-xs font-900 text-pink-600">{lessonTarget(workspace, lesson)}</span>
        </div>
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-2">
        <ScheduleInfo label={copy.course} value={group?.course || courseForStudent(workspace, lesson.studentId)} />
        <ScheduleInfo label={copy.unit} value={lessonUnit(workspace, lesson, copy)} />
        <ScheduleInfo label={copy.lesson} value={lessonNumberValue(workspace, lesson, copy)} />
        <ScheduleInfo label={copy.student} value={students.map(student => student.name).join(', ') || copyMissing(copy)} />
      </div>
      <div className="flex flex-wrap gap-2 px-5 pb-5">
        <button type="button" onClick={onOpen} className="btn-magic px-4 py-2.5 text-sm text-white">{copy.openLesson}</button>
        {status === 'Ready' && <button type="button" onClick={onStart} className={compactButton('green')}>{copy.startLesson}</button>}
      </div>
    </motion.article>
  );
}

function HomeworkReviewCard({ workspace, homework, copy, onSaveReview }: { workspace: TeacherWorkspace; homework: TeacherHomework; copy: TeacherCopy; onSaveReview: (homework: TeacherHomework, patch: { teacherComment?: string; resultPercent?: number | null; starRating?: number | null; status?: 'reviewed' | 'revision_requested' }) => Promise<void> }) {
  const [comment, setComment] = useState(homework.teacherComment || '');
  const [stars, setStars] = useState(homework.starRating || 0);
  const [openWork, setOpenWork] = useState(false);
  const [openingSubmission, setOpeningSubmission] = useState(false);
  const [workError, setWorkError] = useState('');
  const student = workspace.students.find(item => item.id === homework.studentId);
  const group = groupForStudent(workspace, homework.studentId);
  const studentSubmissionUrl = homework.submittedAttachmentUrl?.trim() || '';
  const studentSubmissionName = homework.submittedAttachmentName?.trim() || '';
  const hasInteractiveResult = !!homework.interactiveCompletedAt || homework.studentResult === 'Interactive completed' || homework.interactiveScorePercent != null;
  const hasStudentSubmission = !!studentSubmissionUrl || hasInteractiveResult;
  const attachments = [
    studentSubmissionName || studentSubmissionUrl,
    hasInteractiveResult ? `${copy.interactiveTask}: ${homework.interactiveScorePercent ?? homework.resultPercent ?? 100}%` : '',
  ].filter(Boolean);
  const meta = homeworkTypeMeta(homework.type, copy);
  const openStudentSubmission = async () => {
    setWorkError('');
    if (!studentSubmissionUrl) {
      setOpenWork(true);
      return;
    }
    setOpeningSubmission(true);
    const targetWindow = window.open('about:blank', '_blank');
    try {
      const url = await resolveFileUrl(studentSubmissionUrl);
      if (targetWindow) {
        targetWindow.opener = null;
        targetWindow.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('open submitted homework failed', error);
      if (targetWindow) targetWindow.close();
      setWorkError(copy.failed);
      setOpenWork(true);
    } finally {
      setOpeningSubmission(false);
    }
  };
  const saveDraft = (status: 'reviewed' | 'revision_requested') => {
    void onSaveReview(homework, {
      teacherComment: comment,
      starRating: stars || null,
      status,
    });
  };
  return (
    <motion.article layout whileHover={{ y: -3 }} className={cardClass('overflow-hidden p-0')}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 px-5 pt-5">
          <h3 className="truncate font-display text-xl font-black text-purple-700">{homework.title}</h3>
          <p className="mt-1 font-body text-xs text-purple-400">{student?.name || copy.student} · {group?.name || copy.individualLessons} · {formatTeacherDate(homework.dueDate, copy.lang, false)}</p>
        </div>
        <div className="flex flex-col items-end gap-2 px-5 pt-5">
          <span className={`rounded-full border px-3 py-1 font-body text-xs font-900 ${meta.tone}`}>{meta.emoji} {meta.label}</span>
          {statusBadge(homeworkState(homework), copy)}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 px-5 pb-4">
        <motion.button
          type="button"
          onClick={() => void openStudentSubmission()}
          disabled={openingSubmission || !hasStudentSubmission}
          whileHover={{ y: -2, scale: 1.01, transition: { duration: 0.1 } }}
          whileTap={{ scale: 0.97, transition: { duration: 0.05 } }}
          className="group relative overflow-hidden rounded-full border border-blue-100 bg-white px-4 py-2.5 font-body text-xs font-900 text-blue-600 shadow-sm transition-colors hover:border-pink-200 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-blue-50 via-white to-pink-50 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
          <span className="relative z-10 inline-flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-50 text-blue-600 transition-transform duration-150 group-hover:rotate-6 group-hover:scale-105">
              <ExternalLink className="h-4 w-4" />
            </span>
            {openingSubmission ? '...' : copy.openStudentSubmission}
          </span>
        </motion.button>
        {homework.externalLink && (
          <motion.button
            type="button"
            onClick={() => window.open(homework.externalLink!, '_blank', 'noopener,noreferrer')}
            whileHover={{ y: -2, scale: 1.01, transition: { duration: 0.1 } }}
            whileTap={{ scale: 0.97, transition: { duration: 0.05 } }}
            className="group relative overflow-hidden rounded-full border border-pink-100 bg-white px-4 py-2.5 font-body text-xs font-900 text-purple-600 shadow-sm transition-colors hover:border-pink-200"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-pink-50 via-white to-purple-50 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
            <span className="relative z-10 inline-flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {copy.openAssignedMaterial}
            </span>
          </motion.button>
        )}
        <button
          type="button"
          onClick={() => setOpenWork(prev => !prev)}
          className="rounded-full border border-purple-100 bg-white/75 px-4 py-2.5 font-body text-xs font-900 text-purple-500 shadow-sm transition hover:border-pink-200 hover:bg-pink-50"
        >
          {openWork ? copy.close : copy.attachments}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {openWork && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mx-5 mb-4 overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-pink-50/70"
          >
            <div className="grid gap-3 p-4 md:grid-cols-3">
              <InfoPill label={copy.student} value={student?.name || copyMissing(copy)} />
              <InfoPill label={meta.label} value={homework.title} />
              <InfoPill label={copy.studentSubmission} value={attachments.length ? attachments.join(', ') : copy.noStudentSubmission} />
            </div>
            {hasInteractiveResult && (
              <div className="mx-4 mb-3 grid gap-2 rounded-2xl border border-blue-100 bg-white/85 p-3 font-body text-xs font-800 text-blue-600 sm:grid-cols-3">
                <span>{copy.interactiveTask}</span>
                <span>{copy.result}: {homework.interactiveScorePercent ?? homework.resultPercent ?? 100}%</span>
                <span>{copy.stars}: {homework.starRating ?? 0}/5</span>
              </div>
            )}
            {workError && (
              <div className="mx-4 mb-3 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 font-body text-xs font-900 text-rose-600">
                {workError}
              </div>
            )}
            {!hasStudentSubmission && (
              <div className="mx-4 mb-3 rounded-2xl border border-yellow-100 bg-yellow-50 px-3 py-2 font-body text-xs font-900 text-yellow-700">
                {copy.noStudentSubmission}
              </div>
            )}
            {homework.externalLink && (
              <div className="px-4 pb-3">
                <a href={homework.externalLink} target="_blank" rel="noreferrer" className="inline-flex rounded-full border border-pink-100 bg-white/85 px-3 py-1.5 font-body text-xs font-900 text-purple-600 shadow-sm">
                  {copy.openAssignedMaterial}
                </a>
              </div>
            )}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pb-4">
                {attachments.map(item => (
                  <span key={item} className="rounded-full border border-white/80 bg-white/80 px-3 py-1.5 font-body text-xs font-900 text-purple-500 shadow-sm">📎 {item}</span>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="px-5 pb-5">
        <textarea
          value={comment}
          onChange={event => setComment(event.target.value)}
          placeholder={copy.shortFeedback}
          className="min-h-24 w-full rounded-3xl border-2 border-pink-100 bg-white/85 p-4 font-body text-sm leading-6 text-purple-700 outline-none transition focus:border-pink-200 focus:bg-white focus:shadow-[0_0_0_5px_rgba(244,114,182,0.08)]"
        />
        <div className="mt-3">
          <StarRating value={stars} onChange={setStars} copy={copy} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => saveDraft('reviewed')} className={compactButton('green')}>{copy.markDone}</button>
          <button type="button" onClick={() => saveDraft('revision_requested')} className={compactButton('yellow')}>{copy.returnRevision}</button>
        </div>
      </div>
    </motion.article>
  );
}

function homeworkTypeMeta(type: string, copy: TeacherCopy) {
  const map: Record<string, { label: string; emoji: string; tone: string }> = {
    homework: { label: copy.homeworkContent, emoji: '📚', tone: 'border-purple-100 bg-purple-50 text-purple-700' },
    practice: { label: copy.practiceContent, emoji: '🎯', tone: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
    grammar: { label: copy.grammarContent, emoji: '📝', tone: 'border-yellow-100 bg-yellow-50 text-yellow-700' },
    listening: { label: copy.listeningContent, emoji: '🎧', tone: 'border-cyan-100 bg-cyan-50 text-cyan-700' },
    checkpoint: { label: copy.lessonTabs['Unit Checkpoint'], emoji: '🏁', tone: 'border-amber-100 bg-amber-50 text-amber-700' },
  };
  return map[type] || { label: copy.homework, emoji: '📚', tone: 'border-purple-100 bg-purple-50 text-purple-700' };
}

function StarRating({ value, onChange, copy }: { value: number; onChange: (value: number) => void; copy: TeacherCopy }) {
  return (
    <div className="rounded-3xl border border-yellow-100 bg-gradient-to-br from-white via-yellow-50/60 to-pink-50/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-body text-xs font-900 text-purple-400">{copy.stars}</span>
        <span className="rounded-full bg-white/80 px-2.5 py-1 font-body text-xs font-900 text-yellow-600 shadow-sm">{value}/5</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(star => {
          const active = star <= value;
          return (
            <motion.button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              whileHover={{ y: -2, scale: 1.08, rotate: -4, transition: { duration: 0.1 } }}
              whileTap={{ scale: 0.9, transition: { duration: 0.05 } }}
              className="rounded-2xl bg-white/75 p-2 shadow-sm transition-colors hover:bg-yellow-50"
            >
              <Star className={`h-6 w-6 transition-colors ${active ? 'fill-yellow-300 text-yellow-400' : 'fill-transparent text-yellow-300'}`} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function StudentsList({ students, workspace, copy }: { students: TeacherStudent[]; workspace: TeacherWorkspace; copy: TeacherCopy }) {
  return (
    <Panel title={copy.studentsLabel}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-purple-100 bg-white/45">{[copy.student, copy.level, copy.attendance, copy.homework, copy.nextLessonTable].map(header => <th key={header} className="px-4 py-4 text-left font-display text-sm font-bold text-purple-600">{header}</th>)}</tr></thead>
          <tbody>{students.map(student => <tr key={student.id} className="border-b border-purple-50"><td className="px-4 py-4"><div className="flex items-center gap-3"><TeacherAvatar name={student.name} size="sm" /><div><div className="font-body text-sm font-900 text-purple-700">{student.name}</div><div className="font-body text-xs text-purple-300">{student.email}</div></div></div></td><td className="px-4 py-4 font-body text-sm text-purple-500">{student.level || copyMissing(copy)}</td><td className="px-4 py-4 font-body text-sm text-purple-500">{student.attendance}%</td><td className="px-4 py-4 font-body text-sm text-purple-500">{workspace.homeworks.filter(item => item.studentId === student.id).length}</td><td className="px-4 py-4 font-body text-sm text-purple-500">{formatLessonMoment(student.nextLesson, copy.lang)}</td></tr>)}</tbody>
        </table>
      </div>
    </Panel>
  );
}

function PageTitle({ title, description }: { title: string; description: string }) {
  return (
    <section>
      <h1 className="font-display text-3xl font-black text-purple-700 md:text-4xl">{title}</h1>
      {description && <p className="mt-1 font-body text-sm text-purple-400">{description}</p>}
    </section>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={cardClass('p-5')}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-black text-purple-700">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <motion.div whileHover={{ y: -4, scale: 1.01, transition: { duration: 0.12 } }} whileTap={{ scale: 0.99, transition: { duration: 0.05 } }} className={cardClass('group p-4 transition-shadow hover:shadow-[0_20px_55px_rgba(126,87,194,0.13)]')}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-50 to-purple-50 text-purple-500 transition-transform duration-150 group-hover:rotate-3 group-hover:scale-105">
        <Icon className="h-5 w-5" />
      </div>
      <div className="font-display text-2xl font-black text-purple-700">{value}</div>
      <div className="mt-1 font-body text-xs font-900 text-purple-400">{label}</div>
    </motion.div>
  );
}

function CompactEmpty({ icon: Icon, emoji, title, description }: { icon: typeof Users; emoji?: string; title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-purple-100 bg-white/70 p-6 text-center shadow-sm">
      {emoji ? <div className="mb-3 text-4xl leading-none">{emoji}</div> : <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-500"><Icon className="h-6 w-6" /></div>}
      <h2 className="font-display text-xl font-black text-purple-700">{title}</h2>
      <p className="mt-1 font-body text-sm text-purple-400">{description}</p>
    </div>
  );
}

function SmallMessage({ text }: { text: string }) {
  return <div className="rounded-2xl border border-purple-100 bg-white/65 p-4 font-body text-sm text-purple-400 shadow-sm">{text}</div>;
}

function LessonRow({ workspace, lesson, copy, onOpen }: { workspace: TeacherWorkspace; lesson: TeacherLesson; copy: TeacherCopy; onOpen: () => void }) {
  const status = lessonStatus(lesson);
  const tone = dashboardLessonTone(status);
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -2, scale: 1.006, transition: { duration: 0.1 } }}
      whileTap={{ scale: 0.985, transition: { duration: 0.05 } }}
      className={`group relative grid w-full overflow-hidden rounded-3xl border bg-white/75 p-3 text-left shadow-sm transition-colors hover:bg-white md:grid-cols-[88px_1fr_auto] md:items-center ${tone.border}`}
    >
      <span className={`absolute bottom-0 left-0 top-0 w-1.5 ${tone.bar}`} />
      <div className={`ml-2 rounded-2xl px-3 py-2 text-center ${tone.time}`}>
        <div className="font-display text-lg font-black">{lesson.time || '--:--'}</div>
        <div className="font-body text-[10px] font-900 uppercase opacity-70">{formatTeacherDate(lesson.date, copy.lang, false).split(' ')[0]}</div>
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-lg leading-none">{tone.emoji}</span>
          <div className="truncate font-body text-sm font-900 text-purple-700">{lessonTarget(workspace, lesson)}</div>
        </div>
        <div className="mt-1 truncate font-body text-xs text-purple-400">{lesson.topic || lesson.title}</div>
      </div>
      <div className="flex justify-start md:justify-end">{statusBadge(status, copy)}</div>
    </motion.button>
  );
}

function HomeworkMiniRow({ workspace, homework, copy }: { workspace: TeacherWorkspace; homework: TeacherHomework; copy: TeacherCopy }) {
  const student = workspace.students.find(item => item.id === homework.studentId);
  const stars = homework.starRating || 0;
  const meta = homeworkTypeMeta(homework.type, copy);
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.006, transition: { duration: 0.1 } }}
      className="rounded-3xl border border-pink-100 bg-gradient-to-br from-white via-pink-50/45 to-purple-50/45 p-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-body text-sm font-900 text-purple-700">{meta.emoji} {homework.title}</div>
          <div className="mt-1 font-body text-xs text-purple-400">{student?.name || copy.student} · {formatTeacherDate(homework.submittedAt || homework.dueDate, copy.lang, false)}</div>
        </div>
        {statusBadge(homeworkState(homework), copy)}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map(item => (
          <Star key={item} className={`h-4 w-4 ${item <= stars ? 'fill-yellow-300 text-yellow-400' : 'fill-transparent text-yellow-300'}`} />
        ))}
      </div>
    </motion.div>
  );
}

function NotificationMini({ notification, copy }: { notification: TeacherNotification; copy: TeacherCopy }) {
  const tone = dashboardNotificationTone(notification.type);
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.004, transition: { duration: 0.1 } }}
      className={`relative overflow-hidden rounded-3xl border p-3 shadow-sm ${tone.card}`}
    >
      <span className={`absolute bottom-0 left-0 top-0 w-1.5 ${tone.bar}`} />
      <div className="ml-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`font-body text-sm font-900 ${tone.title}`}><span className="mr-2">{tone.emoji}</span>{notificationTypeLabel(notification.type, copy)}</div>
          <div className="mt-1 truncate font-body text-xs text-purple-400">{notification.text}</div>
        </div>
        <span className={`rounded-full px-3 py-1 font-body text-[11px] font-900 ${tone.badge}`}>{formatTeacherDate(notification.date, copy.lang, false)}</span>
      </div>
    </motion.div>
  );
}

function dashboardLessonTone(status: string) {
  if (status === 'Cancelled') return { emoji: '⛔', border: 'border-red-200', bar: 'bg-red-400', time: 'bg-red-50 text-red-600' };
  if (status === 'Rescheduled') return { emoji: '🟡', border: 'border-yellow-200', bar: 'bg-yellow-400', time: 'bg-yellow-50 text-yellow-700' };
  if (status === 'Completed') return { emoji: '✅', border: 'border-emerald-200', bar: 'bg-emerald-400', time: 'bg-emerald-50 text-emerald-700' };
  return { emoji: '🗓️', border: 'border-purple-100', bar: 'bg-purple-300', time: 'bg-purple-50 text-purple-700' };
}

function dashboardNotificationTone(type: string) {
  if (type === 'Lesson cancelled') return { emoji: '⛔', card: 'border-red-200 bg-red-50/70', bar: 'bg-red-400', title: 'text-red-600', badge: 'bg-white/85 text-red-600' };
  if (type === 'Lesson rescheduled') return { emoji: '🟡', card: 'border-yellow-200 bg-yellow-50/75', bar: 'bg-yellow-400', title: 'text-yellow-700', badge: 'bg-white/85 text-yellow-700' };
  if (type === 'Homework received') return { emoji: '📚', card: 'border-pink-100 bg-pink-50/60', bar: 'bg-pink-300', title: 'text-pink-600', badge: 'bg-white/85 text-pink-600' };
  return { emoji: '✨', card: 'border-purple-100 bg-white/70', bar: 'bg-purple-300', title: 'text-purple-700', badge: 'bg-purple-50 text-purple-600' };
}

function FilterSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <section className={cardClass('p-4')}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-300" />
        <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="h-12 w-full rounded-2xl border-2 border-pink-100 bg-white/80 pl-10 pr-4 font-body text-sm text-purple-700 outline-none" />
      </div>
    </section>
  );
}

function Tabs<T extends string>({ tabs, active, setActive, getLabel }: { tabs: readonly T[]; active: T; setActive: (value: T) => void; getLabel?: (value: T) => string }) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-3xl border border-white/70 bg-white/65 p-2 shadow-sm">
      {tabs.map(tab => <button key={tab} type="button" onClick={() => setActive(tab)} className={`min-w-max rounded-2xl px-4 py-2.5 font-body text-sm font-900 ${active === tab ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-md' : 'text-purple-600 hover:bg-white/80'}`}>{getLabel ? getLabel(tab) : tab}</button>)}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string | number }) {
  return <div className="flex justify-between gap-3"><span>{label}</span><b className="text-right text-purple-700">{value}</b></div>;
}

function InfoPill({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-purple-100 bg-white/70 px-4 py-3"><div className="font-body text-xs font-900 uppercase text-purple-300">{label}</div><div className="mt-1 font-body text-sm font-900 text-purple-700">{value}</div></div>;
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block font-body text-sm font-900 text-purple-600">{label}</span>
      <input type={type} value={value} onChange={event => onChange(event.target.value)} className="h-12 w-full rounded-2xl border-2 border-pink-100 bg-white/80 px-4 font-body text-sm text-purple-700 outline-none" />
    </label>
  );
}

function NoteRow({ note, copy, onTogglePin, onRequestDelete }: { note: LocalNote; copy: TeacherCopy; onTogglePin?: (id: string) => void; onRequestDelete?: (note: LocalNote) => void }) {
  return (
    <motion.div layout whileHover={{ y: -3, scale: 1.005 }} className={`rounded-3xl border p-4 transition ${note.pinned ? 'border-yellow-200 bg-yellow-50/70 shadow-sm' : 'border-purple-100 bg-white/70 hover:border-pink-200 hover:bg-white/90'}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {note.pinned && <span className="rounded-full bg-yellow-100 px-3 py-1 font-body text-xs font-900 text-yellow-700">📌 {copy.pinned}</span>}
          <span className="rounded-full bg-pink-100 px-3 py-1 font-body text-xs font-900 text-pink-700">{noteTypeLabel(note.type, copy)}</span>
        </div>
        <div className="flex gap-2">
          {onTogglePin && (
            <button type="button" onClick={() => onTogglePin(note.id)} className={`rounded-full px-3 py-1 font-body text-xs font-900 transition ${note.pinned ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-white/80 text-purple-500 hover:bg-purple-100 hover:text-purple-700'}`}>
              📌
            </button>
          )}
          {onRequestDelete && (
            <button type="button" onClick={() => onRequestDelete(note)} className="rounded-full bg-white/80 px-3 py-1 font-body text-xs font-900 text-red-500 transition hover:bg-red-50 hover:text-red-600">
              🗑️ {copy.deleteNote}
            </button>
          )}
        </div>
      </div>
      <p className="font-body text-sm text-purple-600">{note.text}</p>
      <div className="mt-2 font-body text-xs text-purple-300">{formatTeacherDate(note.createdAt, copy.lang)}</div>
    </motion.div>
  );
}
