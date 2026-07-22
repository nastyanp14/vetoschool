import { CalendarDays, Clock3 } from 'lucide-react';
import type { Lang } from '@/lib/i18n';

type BookingSelectionSummaryProps = {
  lang: Lang;
  selectedDate?: string;
  selectedTime?: string;
};

function formatDisplayDate(value: string, lang: Lang) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';
  return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function BookingSelectionSummary({ lang, selectedDate, selectedTime }: BookingSelectionSummaryProps) {
  const displayDate = selectedDate ? formatDisplayDate(selectedDate, lang) : '';

  if (!displayDate && !selectedTime) return null;

  return (
    <div className="mb-5 inline-flex max-w-full flex-wrap items-center gap-2 rounded-3xl border border-pink-100 bg-white/85 px-4 py-3 shadow-lg shadow-purple-100/50 backdrop-blur dark:border-purple-700 dark:bg-white/10 dark:shadow-black/20">
      {displayDate && (
        <span className="inline-flex min-w-0 items-center gap-2 font-body text-sm font-black text-purple-600 dark:text-purple-100">
          <CalendarDays className="h-4 w-4 flex-shrink-0 text-pink-500 dark:text-pink-200" aria-hidden="true" />
          <span className="truncate">{displayDate}</span>
        </span>
      )}
      {selectedTime && (
        <span className="inline-flex items-center gap-2 font-body text-sm font-black text-purple-600 dark:text-purple-100">
          <Clock3 className="h-4 w-4 flex-shrink-0 text-blue-500 dark:text-blue-200" aria-hidden="true" />
          {selectedTime}
        </span>
      )}
    </div>
  );
}
