import { useMemo, useState } from 'react';
import type { Locale } from 'date-fns';
import { enGB, ru as ruLocale, uk as ukLocale } from 'date-fns/locale';
import { CalendarDays, CheckCircle2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import { Calendar } from '@/components/ui/calendar';
import BookingSelectionSummary from './BookingSelectionSummary';
import { formatDateKey, getMockAvailableDates } from './MockAssessmentData';
import type { Lang } from '@/lib/i18n';
import type { TrialBookingStepProps } from './types';

function parseDateKey(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function sameDate(a: Date, b: Date) {
  return formatDateKey(a) === formatDateKey(b);
}

function formatDisplayDate(value: string, lang: Lang) {
  const date = parseDateKey(value);
  if (!date) return '';
  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';
  return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

const calendarLocales: Record<Lang, Locale> = {
  ru: ruLocale,
  ua: ukLocale,
  en: enGB,
};

export default function DateStep({ lang, data, updateData, onNext }: TrialBookingStepProps) {
  const availableDates = useMemo(() => getMockAvailableDates(), []);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => parseDateKey(data.selectedDate));
  const selectedKey = selectedDate ? formatDateKey(selectedDate) : '';

  const handleContinue = () => {
    if (!selectedKey) return;
    updateData({
      selectedDate: selectedKey,
      selectedTime: selectedKey === data.selectedDate ? data.selectedTime : '',
    });
    onNext();
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-pink-400 to-blue-400 text-white shadow-xl shadow-purple-200/50">
          <CalendarDays className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="font-display text-3xl font-black text-purple-700 dark:text-purple-100">
          {t(lang, 'trial_date_title')}
        </h2>
        <p className="mt-2 font-body text-sm font-semibold text-purple-500 dark:text-purple-200">
          {t(lang, 'trial_date_subtitle')}
        </p>
      </div>

      {selectedKey && (
        <div className="text-center">
          <BookingSelectionSummary lang={lang} selectedDate={selectedKey} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-[2rem] border border-white/80 bg-white/90 p-3 shadow-2xl shadow-purple-100/60 backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/90 dark:shadow-black/30 sm:p-5">
          <Calendar
            key={lang}
            mode="single"
            selected={selectedDate}
            onSelect={date => {
              if (date && availableDates.some(available => sameDate(available, date))) {
                setSelectedDate(date);
              }
            }}
            disabled={date => !availableDates.some(available => sameDate(available, date))}
            defaultMonth={availableDates[0]}
            locale={calendarLocales[lang]}
            className="mx-auto"
            classNames={{
              months: 'flex justify-center',
              month: 'space-y-5',
              caption_label: 'font-display text-lg font-black text-purple-700 dark:text-purple-100',
              head_cell: 'w-10 rounded-xl text-xs font-black text-purple-300 dark:text-purple-200/80',
              cell: 'h-11 w-11 p-0 text-center',
              day: 'h-11 w-11 rounded-2xl p-0 font-body font-black text-purple-600 transition-transform hover:scale-105 hover:bg-pink-50 dark:text-purple-100 dark:hover:bg-white/10',
              day_selected: 'bg-gradient-to-br from-pink-400 to-purple-400 text-white ring-2 ring-pink-200 hover:text-white shadow-lg shadow-purple-200/60',
              day_today: 'bg-blue-50 text-blue-500 dark:bg-white/10 dark:text-blue-200',
              day_disabled: 'text-purple-200 opacity-35 dark:text-purple-700',
            }}
          />
        </div>

        <aside className="rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-xl shadow-purple-100/50 backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/85 dark:shadow-black/30">
          <p className="font-body text-xs font-black uppercase tracking-[0.18em] text-pink-500 dark:text-pink-200">
            {t(lang, 'trial_available_dates')}
          </p>
          <div className="mt-4 grid gap-2">
            {availableDates.slice(0, 5).map(date => {
              const key = formatDateKey(date);
              const active = key === selectedKey;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelectedDate(date)}
                  aria-pressed={active}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left font-body text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 ${
                    active
                      ? 'scale-[1.01] border-pink-300 bg-gradient-to-r from-pink-100 to-blue-100 text-purple-700 shadow-lg dark:from-white/20 dark:to-white/10 dark:text-purple-100'
                      : 'border-purple-100 bg-white/70 text-purple-500 hover:-translate-y-0.5 hover:bg-pink-50 dark:border-purple-700 dark:bg-white/10 dark:text-purple-200'
                  }`}
                >
                  <span>{formatDisplayDate(key, lang)}</span>
                  {active && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-pink-500 dark:text-pink-200" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      <button
        type="button"
        onClick={handleContinue}
        disabled={!selectedKey}
        className="pricing-button pricing-button-soft relative mt-6 inline-flex min-h-14 w-full items-center justify-center overflow-hidden rounded-3xl border border-pink-200/80 px-8 py-4 font-display text-base font-black shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
      >
        <span className="relative z-10">{t(lang, 'trial_continue')}</span>
      </button>
    </div>
  );
}
