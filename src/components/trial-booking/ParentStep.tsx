import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Phone, UserRound } from 'lucide-react';
import { t } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LanguagePreference, ParentInfo, TrialBookingStepProps } from './types';

const parentSchema = z.object({
  parentName: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  languagePreference: z.enum(['ua', 'ru', 'en']),
});

const languageOptions: Array<{ value: LanguagePreference; key: 'trial_lang_ua' | 'trial_lang_ru' | 'trial_lang_en' }> = [
  { value: 'ua', key: 'trial_lang_ua' },
  { value: 'ru', key: 'trial_lang_ru' },
  { value: 'en', key: 'trial_lang_en' },
];

export default function ParentStep({ lang, data, updateData, onNext }: TrialBookingStepProps) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ParentInfo>({
    resolver: zodResolver(parentSchema),
    defaultValues: data.parent,
    mode: 'onBlur',
  });

  const onSubmit = (values: ParentInfo) => {
    updateData({ parent: values });
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h2 className="font-display text-3xl font-black text-purple-700 dark:text-purple-100">
          {t(lang, 'trial_parent_title')}
        </h2>
        <p className="mt-2 font-body text-sm font-semibold text-purple-500 dark:text-purple-200">
          {t(lang, 'trial_parent_subtitle')}
        </p>
      </div>

      <div className="rounded-[2rem] border border-white/80 bg-white/85 p-4 shadow-2xl shadow-purple-100/60 backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/85 dark:shadow-black/30 sm:p-6">
        <div className="grid gap-4">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 font-body text-sm font-black text-purple-600 dark:text-purple-100">
              <UserRound className="h-4 w-4" aria-hidden="true" />
              {t(lang, 'trial_parent_name')}
            </span>
            <Input
              {...register('parentName')}
              autoComplete="name"
              className="h-12 rounded-2xl border-purple-100 bg-white/90 font-body font-semibold text-purple-700 focus-visible:ring-pink-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
            />
            {errors.parentName && <p className="mt-1.5 font-body text-xs font-bold text-red-500">{t(lang, 'trial_error_required')}</p>}
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 font-body text-sm font-black text-purple-600 dark:text-purple-100">
              <Mail className="h-4 w-4" aria-hidden="true" />
              {t(lang, 'trial_email')}
            </span>
            <Input
              {...register('email')}
              type="email"
              autoComplete="email"
              className="h-12 rounded-2xl border-purple-100 bg-white/90 font-body font-semibold text-purple-700 focus-visible:ring-pink-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
            />
            {errors.email && <p className="mt-1.5 font-body text-xs font-bold text-red-500">{t(lang, 'trial_error_email')}</p>}
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 font-body text-sm font-black text-purple-600 dark:text-purple-100">
              <Phone className="h-4 w-4" aria-hidden="true" />
              {t(lang, 'trial_phone')} <span className="text-purple-300">{t(lang, 'trial_optional')}</span>
            </span>
            <Input
              {...register('phone')}
              type="tel"
              autoComplete="tel"
              className="h-12 rounded-2xl border-purple-100 bg-white/90 font-body font-semibold text-purple-700 focus-visible:ring-pink-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
            />
          </label>

          <div>
            <span className="mb-2 block font-body text-sm font-black text-purple-600 dark:text-purple-100">
              {t(lang, 'trial_language_preference')}
            </span>
            <Controller
              control={control}
              name="languagePreference"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-12 rounded-2xl border-purple-100 bg-white/90 font-body font-bold text-purple-700 focus:ring-pink-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-purple-100 bg-white/95 dark:border-purple-700 dark:bg-[#241331]">
                    {languageOptions.map(option => (
                      <SelectItem key={option.value} value={option.value} className="rounded-xl font-body font-bold">
                        {t(lang, option.key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
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
