import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Baby, BookOpen, GraduationCap } from 'lucide-react';
import { t } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ChildInfo, EnglishExperience, TrialBookingStepProps } from './types';

const childSchema = z.object({
  childName: z.string().trim().min(2),
  age: z.coerce.number().min(4).max(16),
  schoolGrade: z.string().trim().min(1),
  englishExperience: z.enum(['none', 'lt1', '1-2', 'gt2']),
  notes: z.string().trim().optional(),
});

const experienceOptions: Array<{ value: EnglishExperience; key: 'trial_exp_none' | 'trial_exp_lt1' | 'trial_exp_1_2' | 'trial_exp_gt2' }> = [
  { value: 'none', key: 'trial_exp_none' },
  { value: 'lt1', key: 'trial_exp_lt1' },
  { value: '1-2', key: 'trial_exp_1_2' },
  { value: 'gt2', key: 'trial_exp_gt2' },
];

export default function ChildStep({ lang, data, updateData, onNext }: TrialBookingStepProps) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChildInfo>({
    resolver: zodResolver(childSchema),
    defaultValues: data.child,
    mode: 'onBlur',
  });

  const onSubmit = (values: ChildInfo) => {
    updateData({ child: values });
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-3xl">
      <div className="mb-6 text-center">
        <h2 className="font-display text-3xl font-black text-purple-700 dark:text-purple-100">
          {t(lang, 'trial_child_title')}
        </h2>
        <p className="mt-2 font-body text-sm font-semibold text-purple-500 dark:text-purple-200">
          {t(lang, 'trial_child_subtitle')}
        </p>
      </div>

      <div className="rounded-[2rem] border border-white/80 bg-white/85 p-4 shadow-2xl shadow-purple-100/60 backdrop-blur dark:border-purple-700 dark:bg-[#1b0c2f]/85 dark:shadow-black/30 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-2 flex items-center gap-2 font-body text-sm font-black text-purple-600 dark:text-purple-100">
              <Baby className="h-4 w-4" aria-hidden="true" />
              {t(lang, 'trial_child_name')}
            </span>
            <Input
              {...register('childName')}
              className="h-12 rounded-2xl border-purple-100 bg-white/90 font-body font-semibold text-purple-700 focus-visible:ring-pink-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
            />
            {errors.childName && <p className="mt-1.5 font-body text-xs font-bold text-red-500">{t(lang, 'trial_error_required')}</p>}
          </label>

          <label className="block">
            <span className="mb-2 block font-body text-sm font-black text-purple-600 dark:text-purple-100">
              {t(lang, 'trial_age')}
            </span>
            <Input
              {...register('age')}
              type="number"
              min={4}
              max={16}
              className="h-12 rounded-2xl border-purple-100 bg-white/90 font-body font-semibold text-purple-700 focus-visible:ring-pink-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
            />
            {errors.age && <p className="mt-1.5 font-body text-xs font-bold text-red-500">{t(lang, 'trial_error_age')}</p>}
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 font-body text-sm font-black text-purple-600 dark:text-purple-100">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              {t(lang, 'trial_school_grade')}
            </span>
            <Input
              {...register('schoolGrade')}
              className="h-12 rounded-2xl border-purple-100 bg-white/90 font-body font-semibold text-purple-700 focus-visible:ring-pink-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
            />
            {errors.schoolGrade && <p className="mt-1.5 font-body text-xs font-bold text-red-500">{t(lang, 'trial_error_required')}</p>}
          </label>

          <div className="sm:col-span-2">
            <span className="mb-2 flex items-center gap-2 font-body text-sm font-black text-purple-600 dark:text-purple-100">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              {t(lang, 'trial_english_before')}
            </span>
            <Controller
              control={control}
              name="englishExperience"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-12 rounded-2xl border-purple-100 bg-white/90 font-body font-bold text-purple-700 focus:ring-pink-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-purple-100 bg-white/95 dark:border-purple-700 dark:bg-[#241331]">
                    {experienceOptions.map(option => (
                      <SelectItem key={option.value} value={option.value} className="rounded-xl font-body font-bold">
                        {t(lang, option.key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <label className="block sm:col-span-2">
            <span className="mb-2 block font-body text-sm font-black text-purple-600 dark:text-purple-100">
              {t(lang, 'trial_notes')} <span className="text-purple-300">{t(lang, 'trial_optional')}</span>
            </span>
            <Textarea
              {...register('notes')}
              rows={4}
              className="rounded-2xl border-purple-100 bg-white/90 font-body font-semibold text-purple-700 focus-visible:ring-pink-200 dark:border-purple-700 dark:bg-white/10 dark:text-purple-100"
            />
          </label>
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
