import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Search,
  StickyNote,
  UserRound,
  XCircle,
} from 'lucide-react';
import type { Lang } from '@/lib/i18n';
import {
  loadTrialBookings,
  updateTrialBooking,
  type TrialBookingRecord,
  type TrialBookingStatus,
  type TrialBookingUpdate,
} from '@/lib/trialBookings';

type FilterState = {
  status: 'all' | TrialBookingStatus;
  date: string;
  language: 'all' | 'ru' | 'ua' | 'en';
  recommendation: 'all' | TrialBookingRecord['preliminary_recommendation'];
  search: string;
};

const statuses: TrialBookingStatus[] = ['submitted', 'confirmed', 'completed', 'cancelled', 'no_show', 'converted'];
const recommendations: TrialBookingRecord['preliminary_recommendation'][] = [
  'Mini Kids',
  'Kids Beginners',
  'Junior Beginners',
  'Kids A1',
  'Junior A1',
];

const copy = {
  ru: {
    title: 'Пробные уроки',
    subtitle: 'Новые заявки с сайта, предварительная рекомендация и подтверждение пробного урока.',
    new: 'Новые',
    confirmed: 'Подтверждены',
    today: 'Сегодня',
    converted: 'Конвертированы',
    status: 'Статус',
    date: 'Дата',
    language: 'Язык',
    recommendation: 'Рекомендация',
    all: 'Все',
    search: 'Поиск по родителю, ребёнку или email',
    child: 'Ребёнок',
    parent: 'Родитель',
    age: 'Возраст',
    time: 'Время',
    created: 'Создано',
    details: 'Детали заявки',
    select: 'Выберите заявку из списка',
    parentBlock: 'Родитель',
    childBlock: 'Ребёнок',
    assessment: 'Оценка',
    lesson: 'Пробный урок',
    consents: 'Согласия',
    actions: 'Действия администратора',
    phone: 'Телефон',
    grade: 'Класс',
    experience: 'Опыт английского',
    notes: 'Заметки родителя',
    score: 'Внутренний балл',
    teacherLevel: 'Уровень после урока',
    teacherDirection: 'Направление после урока',
    internalNotes: 'Внутренние заметки',
    timezone: 'Часовой пояс',
    privacy: 'Privacy Policy',
    guardian: 'Подтверждение родителя',
    marketing: 'Маркетинг',
    notProvided: 'Не указано',
    noMarketing: 'Нет согласия',
    save: 'Сохранить изменения',
    reload: 'Обновить',
    loading: 'Загрузка заявок...',
    empty: 'Заявок пока нет',
    error: 'Не удалось загрузить заявки.',
    saved: 'Изменения сохранены',
    statuses: {
      submitted: 'Новая',
      confirmed: 'Подтверждена',
      completed: 'Проведена',
      cancelled: 'Отменена',
      no_show: 'Не пришли',
      converted: 'Конвертирована',
    },
    experiences: {
      none: 'Нет',
      lt1: 'Менее 1 года',
      '1-2': '1–2 года',
      gt2: 'Более 2 лет',
    },
    languages: { ru: 'Русский', ua: 'Украинский', en: 'English' },
  },
  en: {
    title: 'Trial Lessons',
    subtitle: 'New website requests, preliminary recommendation, and trial lesson confirmation.',
    new: 'New',
    confirmed: 'Confirmed',
    today: 'Today',
    converted: 'Converted',
    status: 'Status',
    date: 'Date',
    language: 'Language',
    recommendation: 'Recommendation',
    all: 'All',
    search: 'Search parent, child, or email',
    child: 'Child',
    parent: 'Parent',
    age: 'Age',
    time: 'Time',
    created: 'Created',
    details: 'Booking details',
    select: 'Select a booking from the list',
    parentBlock: 'Parent',
    childBlock: 'Child',
    assessment: 'Assessment',
    lesson: 'Trial lesson',
    consents: 'Consents',
    actions: 'Admin actions',
    phone: 'Phone',
    grade: 'Grade',
    experience: 'English experience',
    notes: 'Parent notes',
    score: 'Internal score',
    teacherLevel: 'Teacher-confirmed level',
    teacherDirection: 'Teacher-confirmed direction',
    internalNotes: 'Internal notes',
    timezone: 'Timezone',
    privacy: 'Privacy Policy',
    guardian: 'Guardian confirmation',
    marketing: 'Marketing',
    notProvided: 'Not provided',
    noMarketing: 'No consent',
    save: 'Save changes',
    reload: 'Reload',
    loading: 'Loading bookings...',
    empty: 'No bookings yet',
    error: 'Could not load bookings.',
    saved: 'Changes saved',
    statuses: {
      submitted: 'New',
      confirmed: 'Confirmed',
      completed: 'Completed',
      cancelled: 'Cancelled',
      no_show: 'No-show',
      converted: 'Converted',
    },
    experiences: {
      none: 'No',
      lt1: 'Less than 1 year',
      '1-2': '1–2 years',
      gt2: 'More than 2 years',
    },
    languages: { ru: 'Russian', ua: 'Ukrainian', en: 'English' },
  },
  ua: {
    title: 'Пробні уроки',
    subtitle: 'Нові заявки із сайту, попередня рекомендація та підтвердження пробного уроку.',
    new: 'Нові',
    confirmed: 'Підтверджені',
    today: 'Сьогодні',
    converted: 'Конвертовані',
    status: 'Статус',
    date: 'Дата',
    language: 'Мова',
    recommendation: 'Рекомендація',
    all: 'Усі',
    search: 'Пошук за батьками, дитиною або email',
    child: 'Дитина',
    parent: 'Батьки',
    age: 'Вік',
    time: 'Час',
    created: 'Створено',
    details: 'Деталі заявки',
    select: 'Оберіть заявку зі списку',
    parentBlock: 'Батьки',
    childBlock: 'Дитина',
    assessment: 'Оцінка',
    lesson: 'Пробний урок',
    consents: 'Згоди',
    actions: 'Дії адміністратора',
    phone: 'Телефон',
    grade: 'Клас',
    experience: 'Досвід англійської',
    notes: 'Нотатки батьків',
    score: 'Внутрішній бал',
    teacherLevel: 'Рівень після уроку',
    teacherDirection: 'Напрям після уроку',
    internalNotes: 'Внутрішні нотатки',
    timezone: 'Часовий пояс',
    privacy: 'Privacy Policy',
    guardian: 'Підтвердження батьків',
    marketing: 'Маркетинг',
    notProvided: 'Не вказано',
    noMarketing: 'Немає згоди',
    save: 'Зберегти зміни',
    reload: 'Оновити',
    loading: 'Завантаження заявок...',
    empty: 'Заявок поки немає',
    error: 'Не вдалося завантажити заявки.',
    saved: 'Зміни збережено',
    statuses: {
      submitted: 'Нова',
      confirmed: 'Підтверджена',
      completed: 'Проведена',
      cancelled: 'Скасована',
      no_show: 'Не прийшли',
      converted: 'Конвертована',
    },
    experiences: {
      none: 'Ні',
      lt1: 'Менше 1 року',
      '1-2': '1–2 роки',
      gt2: 'Більше 2 років',
    },
    languages: { ru: 'Російська', ua: 'Українська', en: 'English' },
  },
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function timeLabel(value: string) {
  return value.slice(0, 5);
}

function dateLabel(value: string, lang: Lang) {
  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function timestampLabel(value: string, lang: Lang) {
  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';
  return new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof UserRound }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-lg shadow-purple-100/40 dark:border-purple-700 dark:bg-white/10 dark:shadow-black/20">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-blue-100 text-purple-600 dark:from-white/10 dark:to-white/10 dark:text-purple-100">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-purple-400 dark:text-purple-200">{label}</p>
          <p className="font-display text-2xl font-black text-purple-700 dark:text-purple-100">{value}</p>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <p className="font-body text-xs font-black uppercase tracking-[0.12em] text-purple-400 dark:text-purple-300">{label}</p>
      <p className="mt-1 break-words font-body text-sm font-bold text-purple-700 dark:text-purple-100">{value || '—'}</p>
    </div>
  );
}

export default function TrialLessonsAdmin({ lang }: { lang: Lang }) {
  const labels = copy[lang];
  const [bookings, setBookings] = useState<TrialBookingRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    date: '',
    language: 'all',
    recommendation: 'all',
    search: '',
  });
  const [draft, setDraft] = useState<TrialBookingUpdate>({});

  const selected = bookings.find(booking => booking.id === selectedId) || bookings[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await loadTrialBookings();
      setBookings(rows);
      setSelectedId(current => current || rows[0]?.id || '');
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }, [labels.error]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setDraft({
      selected_date: selected.selected_date,
      selected_time: timeLabel(selected.selected_time),
      teacher_confirmed_level: selected.teacher_confirmed_level || '',
      teacher_confirmed_direction: selected.teacher_confirmed_direction || '',
      internal_notes: selected.internal_notes || '',
    });
  }, [selected]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return bookings.filter(booking => {
      const matchesSearch = !search
        || booking.parent_name.toLowerCase().includes(search)
        || booking.child_name.toLowerCase().includes(search)
        || booking.parent_email.toLowerCase().includes(search);
      return matchesSearch
        && (filters.status === 'all' || booking.status === filters.status)
        && (!filters.date || booking.selected_date === filters.date)
        && (filters.language === 'all' || booking.preferred_language === filters.language)
        && (filters.recommendation === 'all' || booking.preliminary_recommendation === filters.recommendation);
    });
  }, [bookings, filters]);

  const stats = useMemo(() => ({
    new: bookings.filter(booking => booking.status === 'submitted').length,
    confirmed: bookings.filter(booking => booking.status === 'confirmed').length,
    today: bookings.filter(booking => booking.selected_date === todayIso()).length,
    converted: bookings.filter(booking => booking.status === 'converted').length,
  }), [bookings]);

  const replaceBooking = (updated: TrialBookingRecord) => {
    setBookings(current => current.map(booking => booking.id === updated.id ? updated : booking));
    setMessage(labels.saved);
    window.setTimeout(() => setMessage(''), 2400);
  };

  const savePatch = async (patch: TrialBookingUpdate) => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateTrialBooking(selected.id, patch);
      replaceBooking(updated);
    } catch {
      setError(labels.error);
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = () => {
    void savePatch({
      selected_date: draft.selected_date,
      selected_time: draft.selected_time,
      teacher_confirmed_level: draft.teacher_confirmed_level || null,
      teacher_confirmed_direction: draft.teacher_confirmed_direction || null,
      internal_notes: draft.internal_notes || null,
    });
  };

  return (
    <motion.div key="trial-lessons" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl font-black text-purple-700 dark:text-purple-100">{labels.title}</h2>
          <p className="mt-1 max-w-2xl font-body text-sm font-semibold text-purple-500 dark:text-purple-200">{labels.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-purple-200 bg-white/70 px-4 py-2 font-body text-sm font-bold text-purple-600 transition hover:bg-purple-50 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Clock3 className="h-4 w-4" aria-hidden="true" />}
          {labels.reload}
        </button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={labels.new} value={stats.new} icon={UserRound} />
        <StatCard label={labels.confirmed} value={stats.confirmed} icon={CheckCircle2} />
        <StatCard label={labels.today} value={stats.today} icon={CalendarDays} />
        <StatCard label={labels.converted} value={stats.converted} icon={StickyNote} />
      </div>

      <div className="mb-6 grid gap-3 rounded-3xl border border-white/70 bg-white/60 p-4 shadow-lg shadow-purple-100/30 dark:border-purple-700 dark:bg-white/10 dark:shadow-black/20 md:grid-cols-5">
        <label className="md:col-span-2">
          <span className="sr-only">{labels.search}</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-300" aria-hidden="true" />
            <input
              value={filters.search}
              onChange={event => setFilters(current => ({ ...current, search: event.target.value }))}
              placeholder={labels.search}
              className="w-full rounded-2xl border border-purple-100 bg-white/80 py-3 pl-10 pr-3 font-body text-sm font-semibold text-purple-700 outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-100 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
            />
          </div>
        </label>
        <select value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value as FilterState['status'] }))} className="rounded-2xl border border-purple-100 bg-white/80 px-3 py-3 font-body text-sm font-semibold text-purple-700 outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-100 dark:border-purple-700 dark:bg-[#1b0c2f] dark:text-purple-100">
          <option value="all">{labels.status}: {labels.all}</option>
          {statuses.map(status => <option key={status} value={status}>{labels.statuses[status]}</option>)}
        </select>
        <input type="date" value={filters.date} onChange={event => setFilters(current => ({ ...current, date: event.target.value }))} className="rounded-2xl border border-purple-100 bg-white/80 px-3 py-3 font-body text-sm font-semibold text-purple-700 outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-100 dark:border-purple-700 dark:bg-[#1b0c2f] dark:text-purple-100" aria-label={labels.date} />
        <select value={filters.language} onChange={event => setFilters(current => ({ ...current, language: event.target.value as FilterState['language'] }))} className="rounded-2xl border border-purple-100 bg-white/80 px-3 py-3 font-body text-sm font-semibold text-purple-700 outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-100 dark:border-purple-700 dark:bg-[#1b0c2f] dark:text-purple-100">
          <option value="all">{labels.language}: {labels.all}</option>
          <option value="ru">{labels.languages.ru}</option>
          <option value="ua">{labels.languages.ua}</option>
          <option value="en">{labels.languages.en}</option>
        </select>
        <select value={filters.recommendation} onChange={event => setFilters(current => ({ ...current, recommendation: event.target.value as FilterState['recommendation'] }))} className="rounded-2xl border border-purple-100 bg-white/80 px-3 py-3 font-body text-sm font-semibold text-purple-700 outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-100 dark:border-purple-700 dark:bg-[#1b0c2f] dark:text-purple-100 md:col-span-5">
          <option value="all">{labels.recommendation}: {labels.all}</option>
          {recommendations.map(recommendation => <option key={recommendation} value={recommendation}>{recommendation}</option>)}
        </select>
      </div>

      {message && <div className="mb-4 rounded-2xl bg-green-50 px-4 py-3 font-body text-sm font-bold text-green-700 dark:bg-green-950/30 dark:text-green-100">{message}</div>}
      {error && <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 font-body text-sm font-bold text-red-700 dark:bg-red-950/30 dark:text-red-100">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
        <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/70 shadow-xl shadow-purple-100/40 dark:border-purple-700 dark:bg-white/10 dark:shadow-black/20">
          {loading ? (
            <div className="flex items-center justify-center gap-3 p-12 font-body font-bold text-purple-500 dark:text-purple-100">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              {labels.loading}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center font-display text-xl font-black text-purple-600 dark:text-purple-100">{labels.empty}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead>
                  <tr className="border-b border-purple-100 bg-white/50 dark:border-purple-700 dark:bg-white/10">
                    {[labels.child, labels.parent, labels.age, labels.recommendation, labels.date, labels.time, labels.language, labels.status, labels.created].map(header => (
                      <th key={header} className="px-4 py-3 text-left font-display text-xs font-black uppercase tracking-[0.12em] text-purple-500 dark:text-purple-200">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(booking => (
                    <tr
                      key={booking.id}
                      onClick={() => setSelectedId(booking.id)}
                      className={`cursor-pointer border-b border-purple-50 transition hover:bg-pink-50/70 dark:border-purple-800 dark:hover:bg-white/10 ${selected?.id === booking.id ? 'bg-purple-50 dark:bg-white/10' : 'bg-white/20'}`}
                    >
                      <td className="px-4 py-4 font-body text-sm font-black text-purple-700 dark:text-purple-100">{booking.child_name}</td>
                      <td className="px-4 py-4">
                        <p className="font-body text-sm font-bold text-purple-700 dark:text-purple-100">{booking.parent_name}</p>
                        <p className="font-body text-xs font-semibold text-purple-400 dark:text-purple-300">{booking.parent_email}</p>
                      </td>
                      <td className="px-4 py-4 font-body text-sm font-bold text-purple-600 dark:text-purple-100">{booking.child_age}</td>
                      <td className="px-4 py-4 font-body text-sm font-bold text-purple-600 dark:text-purple-100">{booking.preliminary_recommendation}</td>
                      <td className="px-4 py-4 font-body text-sm font-bold text-purple-600 dark:text-purple-100">{dateLabel(booking.selected_date, lang)}</td>
                      <td className="px-4 py-4 font-body text-sm font-bold text-purple-600 dark:text-purple-100">{timeLabel(booking.selected_time)}</td>
                      <td className="px-4 py-4 font-body text-sm font-bold text-purple-600 dark:text-purple-100">{labels.languages[booking.preferred_language]}</td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-pink-100 px-3 py-1 font-body text-xs font-black text-pink-600 dark:bg-pink-500/20 dark:text-pink-100">{labels.statuses[booking.status]}</span>
                      </td>
                      <td className="px-4 py-4 font-body text-xs font-bold text-purple-400 dark:text-purple-300">{timestampLabel(booking.created_at, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-xl shadow-purple-100/40 dark:border-purple-700 dark:bg-white/10 dark:shadow-black/20">
          {!selected ? (
            <div className="flex min-h-[260px] items-center justify-center text-center font-body font-bold text-purple-500 dark:text-purple-100">{labels.select}</div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl font-black text-purple-700 dark:text-purple-100">{labels.details}</h3>
                  <p className="mt-1 font-body text-sm font-bold text-purple-400 dark:text-purple-300">{selected.child_name} · {labels.statuses[selected.status]}</p>
                </div>
                <button type="button" onClick={() => setSelectedId('')} className="rounded-full p-2 text-purple-300 transition hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-white/10">
                  <XCircle className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <section className="grid gap-3 rounded-3xl bg-pink-50/80 p-4 dark:bg-white/10">
                <h4 className="font-display text-lg font-black text-purple-700 dark:text-purple-100">{labels.parentBlock}</h4>
                <DetailRow label={labels.parent} value={selected.parent_name} />
                <DetailRow label="Email" value={selected.parent_email} />
                <DetailRow label={labels.phone} value={selected.parent_phone || labels.notProvided} />
                <DetailRow label={labels.language} value={labels.languages[selected.preferred_language]} />
              </section>

              <section className="grid gap-3 rounded-3xl bg-blue-50/80 p-4 dark:bg-white/10">
                <h4 className="font-display text-lg font-black text-purple-700 dark:text-purple-100">{labels.childBlock}</h4>
                <DetailRow label={labels.child} value={selected.child_name} />
                <DetailRow label={labels.age} value={selected.child_age} />
                <DetailRow label={labels.grade} value={selected.school_grade} />
                <DetailRow label={labels.experience} value={labels.experiences[selected.english_experience]} />
                <DetailRow label={labels.notes} value={selected.parent_notes || labels.notProvided} />
              </section>

              <section className="grid gap-3 rounded-3xl bg-purple-50/80 p-4 dark:bg-white/10">
                <h4 className="font-display text-lg font-black text-purple-700 dark:text-purple-100">{labels.assessment}</h4>
                <DetailRow label={labels.recommendation} value={selected.preliminary_recommendation} />
                <DetailRow label={labels.score} value={selected.assessment_score} />
                <input value={draft.teacher_confirmed_level || ''} onChange={event => setDraft(current => ({ ...current, teacher_confirmed_level: event.target.value }))} placeholder={labels.teacherLevel} className="rounded-2xl border border-purple-100 bg-white/80 px-3 py-2 font-body text-sm font-semibold text-purple-700 outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-100 dark:border-purple-700 dark:bg-[#1b0c2f] dark:text-purple-100" />
                <input value={draft.teacher_confirmed_direction || ''} onChange={event => setDraft(current => ({ ...current, teacher_confirmed_direction: event.target.value }))} placeholder={labels.teacherDirection} className="rounded-2xl border border-purple-100 bg-white/80 px-3 py-2 font-body text-sm font-semibold text-purple-700 outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-100 dark:border-purple-700 dark:bg-[#1b0c2f] dark:text-purple-100" />
              </section>

              <section className="grid gap-3 rounded-3xl bg-green-50/80 p-4 dark:bg-white/10">
                <h4 className="font-display text-lg font-black text-purple-700 dark:text-purple-100">{labels.lesson}</h4>
                <input type="date" value={draft.selected_date || ''} onChange={event => setDraft(current => ({ ...current, selected_date: event.target.value }))} className="rounded-2xl border border-purple-100 bg-white/80 px-3 py-2 font-body text-sm font-semibold text-purple-700 outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-100 dark:border-purple-700 dark:bg-[#1b0c2f] dark:text-purple-100" aria-label={labels.date} />
                <input type="time" value={draft.selected_time || ''} onChange={event => setDraft(current => ({ ...current, selected_time: event.target.value }))} className="rounded-2xl border border-purple-100 bg-white/80 px-3 py-2 font-body text-sm font-semibold text-purple-700 outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-100 dark:border-purple-700 dark:bg-[#1b0c2f] dark:text-purple-100" aria-label={labels.time} />
                <DetailRow label={labels.timezone} value={selected.timezone} />
              </section>

              <section className="grid gap-3 rounded-3xl bg-yellow-50/80 p-4 dark:bg-white/10">
                <h4 className="font-display text-lg font-black text-purple-700 dark:text-purple-100">{labels.consents}</h4>
                <DetailRow label={labels.privacy} value={timestampLabel(selected.privacy_accepted_at, lang)} />
                <DetailRow label={labels.guardian} value={timestampLabel(selected.guardian_confirmed_at, lang)} />
                <DetailRow label={labels.marketing} value={selected.marketing_consent_at ? timestampLabel(selected.marketing_consent_at, lang) : labels.noMarketing} />
              </section>

              <section className="grid gap-3 rounded-3xl bg-white/70 p-4 dark:bg-white/10">
                <h4 className="font-display text-lg font-black text-purple-700 dark:text-purple-100">{labels.actions}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {statuses.map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => void savePatch({ status })}
                      disabled={saving || selected.status === status}
                      className={`rounded-2xl px-3 py-2 font-body text-xs font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-100 disabled:cursor-not-allowed disabled:opacity-60 ${selected.status === status ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white' : 'bg-purple-50 text-purple-600 hover:bg-pink-50 dark:bg-white/10 dark:text-purple-100'}`}
                    >
                      {labels.statuses[status]}
                    </button>
                  ))}
                </div>
                <textarea value={draft.internal_notes || ''} onChange={event => setDraft(current => ({ ...current, internal_notes: event.target.value }))} rows={4} placeholder={labels.internalNotes} className="rounded-2xl border border-purple-100 bg-white/80 px-3 py-2 font-body text-sm font-semibold text-purple-700 outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-100 dark:border-purple-700 dark:bg-[#1b0c2f] dark:text-purple-100" />
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 px-4 py-3 font-display text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {labels.save}
                </button>
              </section>
            </div>
          )}
        </aside>
      </div>
    </motion.div>
  );
}
