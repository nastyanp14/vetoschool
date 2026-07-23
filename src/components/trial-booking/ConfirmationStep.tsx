import { useRef, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, Edit3, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { t } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import type { TrialBookingStepProps } from './types';
import { createIdempotencyKey, submitTrialBooking } from '@/lib/trialBookings';

type ConfirmationStepProps = TrialBookingStepProps & {
  onEditBooking: () => void;
};

function formatDisplayDate(value: string, lang: Lang) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';
  return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/75 px-4 py-3 dark:bg-white/10">
      <p className="font-body text-xs font-black uppercase tracking-[0.14em] text-pink-500 dark:text-pink-200">{label}</p>
      <p className="mt-1 font-body text-sm font-black text-purple-700 dark:text-purple-100">{value || '—'}</p>
    </div>
  );
}

export default function ConfirmationStep({ lang, data, onEditBooking }: ConfirmationStepProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const idempotencyKeyRef = useRef(createIdempotencyKey());
  const nextSteps = [
    t(lang, 'trial_success_next_step_1'),
    t(lang, 'trial_success_next_step_2'),
    t(lang, 'trial_success_next_step_3'),
    t(lang, 'trial_success_next_step_4'),
  ];
  const selectedDate = formatDisplayDate(data.selectedDate, lang);

  const handleConfirm = async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await submitTrialBooking(data, idempotencyKeyRef.current);
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t(lang, 'trial_submit_error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="mx-auto max-w-2xl rounded-[2rem] border border-white/80 bg-white/90 p-6 text-center shadow-2xl shadow-purple-100/60 backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/90 dark:shadow-black/30 sm:p-9"
      >
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-green-300 via-blue-400 to-purple-400 text-white shadow-2xl">
          <CheckCircle2 className="h-12 w-12" aria-hidden="true" />
        </div>
        <h2 className="font-display text-3xl font-black text-purple-700 dark:text-purple-100">
          {t(lang, 'trial_success_title')}
        </h2>
        <p className="mx-auto mt-3 max-w-xl font-body text-sm font-semibold leading-relaxed text-purple-500 dark:text-purple-200">
          {t(lang, 'trial_success_body')}
        </p>
        <div className="mt-6 grid gap-3 rounded-3xl border border-purple-100 bg-white/75 p-4 text-left dark:border-purple-700 dark:bg-white/10 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-2xl bg-pink-50 px-4 py-3 dark:bg-white/10">
            <CalendarDays className="h-5 w-5 text-pink-500 dark:text-pink-200" aria-hidden="true" />
            <div>
              <p className="font-body text-xs font-black uppercase tracking-[0.14em] text-pink-500 dark:text-pink-200">
                {t(lang, 'trial_selected_date')}
              </p>
              <p className="font-body text-sm font-black text-purple-700 dark:text-purple-100">{selectedDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-blue-50 px-4 py-3 dark:bg-white/10">
            <Clock3 className="h-5 w-5 text-blue-500 dark:text-blue-200" aria-hidden="true" />
            <div>
              <p className="font-body text-xs font-black uppercase tracking-[0.14em] text-blue-500 dark:text-blue-200">
                {t(lang, 'trial_selected_time')}
              </p>
              <p className="font-body text-sm font-black text-purple-700 dark:text-purple-100">{data.selectedTime}</p>
            </div>
          </div>
        </div>
        <div className="mt-6 rounded-3xl bg-gradient-to-r from-pink-50 to-blue-50 p-5 text-left dark:from-white/10 dark:to-white/10">
          <h3 className="font-display text-xl font-black text-purple-700 dark:text-purple-100">
            {t(lang, 'trial_success_next_title')}
          </h3>
          <div className="mt-4 grid gap-3">
            {nextSteps.map(step => (
              <div key={step} className="flex items-start gap-3 rounded-2xl bg-white/75 px-4 py-3 dark:bg-white/10">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-pink-500 dark:text-pink-200" aria-hidden="true" />
                <span className="font-body text-sm font-black leading-relaxed text-purple-600 dark:text-purple-100">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-pink-400 to-blue-400 text-white shadow-xl shadow-purple-200/50">
          <Sparkles className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="font-display text-3xl font-black text-purple-700 dark:text-purple-100">
          {t(lang, 'trial_confirmation_title')}
        </h2>
        <p className="mt-2 font-body text-sm font-semibold text-purple-500 dark:text-purple-200">
          {t(lang, 'trial_confirmation_subtitle')}
        </p>
      </div>

      <div className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-2xl shadow-purple-100/60 backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/90 dark:shadow-black/30 sm:p-7">
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-3xl bg-gradient-to-br from-pink-50 to-purple-50 p-4 dark:from-white/10 dark:to-white/10">
            <h3 className="mb-3 font-display text-xl font-black text-purple-700 dark:text-purple-100">
              {t(lang, 'trial_summary_parent')}
            </h3>
            <div className="grid gap-2">
              <InfoRow label={t(lang, 'trial_parent_name')} value={data.parent.parentName} />
              <InfoRow label={t(lang, 'trial_email')} value={data.parent.email} />
              <InfoRow label={t(lang, 'trial_phone')} value={data.parent.phone || t(lang, 'trial_not_provided')} />
            </div>
          </section>

          <section className="rounded-3xl bg-gradient-to-br from-blue-50 to-purple-50 p-4 dark:from-white/10 dark:to-white/10">
            <h3 className="mb-3 font-display text-xl font-black text-purple-700 dark:text-purple-100">
              {t(lang, 'trial_summary_child')}
            </h3>
            <div className="grid gap-2">
              <InfoRow label={t(lang, 'trial_child_name')} value={data.child.childName} />
              <InfoRow label={t(lang, 'trial_age')} value={String(data.child.age || '')} />
              <InfoRow label={t(lang, 'trial_school_grade')} value={data.child.schoolGrade} />
            </div>
          </section>

          <section className="rounded-3xl bg-gradient-to-br from-purple-50 to-pink-50 p-4 dark:from-white/10 dark:to-white/10">
            <h3 className="mb-3 font-display text-xl font-black text-purple-700 dark:text-purple-100">
              {t(lang, 'trial_summary_lesson')}
            </h3>
            <div className="grid gap-2">
              <InfoRow label={t(lang, 'trial_selected_date')} value={formatDisplayDate(data.selectedDate, lang)} />
              <InfoRow label={t(lang, 'trial_selected_time')} value={data.selectedTime} />
            </div>
          </section>

          <section className="rounded-3xl bg-gradient-to-br from-green-50 to-blue-50 p-4 dark:from-white/10 dark:to-white/10">
            <h3 className="mb-3 font-display text-xl font-black text-purple-700 dark:text-purple-100">
              {t(lang, 'trial_summary_recommendation')}
            </h3>
            <div className="rounded-2xl bg-white/75 px-4 py-4 dark:bg-white/10">
              <p className="font-display text-2xl font-black text-purple-700 dark:text-purple-100">
                {data.assessment?.recommendation || '—'}
              </p>
              <p className="mt-2 font-body text-xs font-bold leading-relaxed text-purple-500 dark:text-purple-200">
                {t(lang, 'trial_preliminary_note')}
              </p>
            </div>
          </section>
        </div>
      </div>

      {submitError && (
        <div className="mt-5 flex items-start gap-3 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-left text-red-700 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-100">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="font-body text-sm font-black">{t(lang, 'trial_submit_error_title')}</p>
            <p className="mt-1 font-body text-sm font-semibold leading-relaxed">{t(lang, 'trial_submit_error')}</p>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onEditBooking}
          disabled={submitting}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-3xl border border-purple-200 bg-white px-5 py-4 font-display text-sm font-black text-purple-600 transition hover:-translate-y-0.5 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
        >
          <Edit3 className="h-4 w-4" aria-hidden="true" />
          {t(lang, 'trial_edit_booking')}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="pricing-button pricing-button-soft relative inline-flex min-h-14 flex-1 items-center justify-center gap-2 overflow-hidden rounded-3xl border border-pink-200/80 px-5 py-4 font-display text-sm font-black shadow-xl disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
        >
          <span className="relative z-10 inline-flex items-center gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? t(lang, 'trial_submitting') : t(lang, 'trial_confirm_booking')}
          </span>
        </button>
      </div>
    </div>
  );
}
