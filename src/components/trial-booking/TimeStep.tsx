import { useState } from 'react';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { t } from '@/lib/i18n';
import BookingSelectionSummary from './BookingSelectionSummary';
import { mockTimeSlots } from './MockAssessmentData';
import type { TrialBookingStepProps } from './types';

export default function TimeStep({ lang, data, updateData, onNext }: TrialBookingStepProps) {
  const [selectedTime, setSelectedTime] = useState(data.selectedTime);

  const handleContinue = () => {
    if (!selectedTime) return;
    updateData({ selectedTime });
    onNext();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-pink-400 to-blue-400 text-white shadow-xl shadow-purple-200/50">
          <Clock3 className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="font-display text-3xl font-black text-purple-700 dark:text-purple-100">
          {t(lang, 'trial_time_title')}
        </h2>
        <p className="mt-2 font-body text-sm font-semibold text-purple-500 dark:text-purple-200">
          {t(lang, 'trial_time_subtitle')}
        </p>
      </div>

      <div className="text-center">
        <BookingSelectionSummary lang={lang} selectedDate={data.selectedDate} selectedTime={selectedTime} />
      </div>

      <div className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-2xl shadow-purple-100/60 backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/90 dark:shadow-black/30 sm:p-7">
        <div className="grid gap-3 sm:grid-cols-2">
          {mockTimeSlots.map(slot => {
            const active = selectedTime === slot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedTime(slot)}
                aria-pressed={active}
                className={`relative rounded-3xl border p-5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 ${
                  active
                    ? 'scale-[1.01] border-pink-300 bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 shadow-xl shadow-purple-100/70 dark:from-white/20 dark:via-white/10 dark:to-white/10'
                    : 'border-purple-100 bg-white/75 hover:-translate-y-0.5 hover:border-pink-200 hover:bg-pink-50 dark:border-purple-700 dark:bg-white/10 dark:hover:bg-white/15'
                }`}
              >
                {active && (
                  <CheckCircle2 className="absolute right-4 top-4 h-5 w-5 text-pink-500 dark:text-pink-200" aria-hidden="true" />
                )}
                <span className="block font-display text-3xl font-black text-purple-700 dark:text-purple-100">{slot}</span>
                <span className="mt-1 block font-body text-sm font-bold text-purple-400 dark:text-purple-200">
                  {t(lang, 'trial_time_slot_hint')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={handleContinue}
        disabled={!selectedTime}
        className="mt-6 w-full rounded-3xl bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 px-8 py-4 font-display text-base font-black text-white shadow-xl shadow-purple-200/60 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:shadow-purple-950/50"
      >
        {t(lang, 'trial_continue')}
      </button>
    </div>
  );
}
