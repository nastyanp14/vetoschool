import { Link } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { t } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import type { PrivacyConsents, TrialBookingStepProps } from './types';

const privacySchema = z.object({
  privacyAccepted: z.boolean().refine(Boolean),
  guardianConfirmed: z.boolean().refine(Boolean),
  marketingAccepted: z.boolean(),
});

export default function PrivacyStep({ lang, data, updateData, onNext }: TrialBookingStepProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PrivacyConsents>({
    resolver: zodResolver(privacySchema),
    defaultValues: data.privacy,
    mode: 'onChange',
  });

  const onSubmit = (values: PrivacyConsents) => {
    updateData({ privacy: values });
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-3xl">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-pink-400 to-blue-400 text-white shadow-xl shadow-purple-200/50">
          <ShieldCheck className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="font-display text-3xl font-black text-purple-700 dark:text-purple-100">
          {t(lang, 'trial_privacy_title')}
        </h2>
        <p className="mt-2 font-body text-sm font-semibold text-purple-500 dark:text-purple-200">
          {t(lang, 'trial_privacy_subtitle')}
        </p>
      </div>

      <div className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-2xl shadow-purple-100/60 backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/90 dark:shadow-black/30 sm:p-7">
        <div className="space-y-4">
          <Controller
            control={control}
            name="privacyAccepted"
            render={({ field }) => (
              <label className="flex cursor-pointer items-start gap-3 rounded-3xl border border-purple-100 bg-white/75 p-4 transition hover:bg-pink-50 dark:border-purple-700 dark:bg-white/10 dark:hover:bg-white/15">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={value => field.onChange(value === true)}
                  className="mt-1 h-5 w-5 rounded-lg"
                />
                <span className="font-body text-sm font-bold leading-relaxed text-purple-600 dark:text-purple-100">
                  {t(lang, 'trial_privacy_read')}{' '}
                  <Link to="/privacy-policy" target="_blank" className="text-pink-500 underline decoration-pink-200 underline-offset-4 hover:text-pink-600">
                    {t(lang, 'trial_privacy_policy_link')}
                  </Link>
                  .
                </span>
              </label>
            )}
          />
          {errors.privacyAccepted && <p className="font-body text-xs font-bold text-red-500">{t(lang, 'trial_error_privacy')}</p>}

          <Controller
            control={control}
            name="guardianConfirmed"
            render={({ field }) => (
              <label className="flex cursor-pointer items-start gap-3 rounded-3xl border border-purple-100 bg-white/75 p-4 transition hover:bg-pink-50 dark:border-purple-700 dark:bg-white/10 dark:hover:bg-white/15">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={value => field.onChange(value === true)}
                  className="mt-1 h-5 w-5 rounded-lg"
                />
                <span className="font-body text-sm font-bold leading-relaxed text-purple-600 dark:text-purple-100">
                  {t(lang, 'trial_privacy_guardian')}
                </span>
              </label>
            )}
          />
          {errors.guardianConfirmed && <p className="font-body text-xs font-bold text-red-500">{t(lang, 'trial_error_guardian')}</p>}

          <Controller
            control={control}
            name="marketingAccepted"
            render={({ field }) => (
              <label className="flex cursor-pointer items-start gap-3 rounded-3xl border border-blue-100 bg-blue-50/70 p-4 transition hover:bg-blue-50 dark:border-purple-700 dark:bg-white/10 dark:hover:bg-white/15">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={value => field.onChange(value === true)}
                  className="mt-1 h-5 w-5 rounded-lg"
                />
                <span className="font-body text-sm font-bold leading-relaxed text-purple-600 dark:text-purple-100">
                  {t(lang, 'trial_privacy_marketing')}
                </span>
              </label>
            )}
          />
        </div>

        <p className="mt-5 rounded-2xl bg-purple-50 px-4 py-3 font-body text-xs font-bold leading-relaxed text-purple-400 dark:bg-white/10 dark:text-purple-200">
          {t(lang, 'trial_privacy_cookie_hint')}{' '}
          <Link to="/cookie-policy" target="_blank" className="text-pink-500 underline decoration-pink-200 underline-offset-4 hover:text-pink-600">
            {t(lang, 'footer_cookie_policy')}
          </Link>
          .
        </p>
      </div>

      <button
        type="submit"
        className="mt-6 w-full rounded-3xl bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 px-8 py-4 font-display text-base font-black text-white shadow-xl shadow-purple-200/60 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 dark:shadow-purple-950/50"
      >
        {t(lang, 'trial_continue')}
      </button>
    </form>
  );
}
