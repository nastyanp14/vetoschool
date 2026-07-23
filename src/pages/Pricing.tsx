import { useState } from 'react';
import type React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Compass,
  Crown,
  Gamepad2,
  Gem,
  GraduationCap,
  Headphones,
  Leaf,
  RefreshCw,
  MessageCircle,
  NotebookPen,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import Footer from '../components/Footer';
import { Lang, TranslationKey, t } from '../lib/i18n';
import {
  DisplayCurrency,
  formatCurrencyAmount,
  pricingPlanPrices,
  supportedCurrencies,
  type PricingPlanId,
} from '../lib/pricingCurrency';
import { cn } from '../lib/utils';

interface PricingProps {
  lang: Lang;
}

type LessonType = 'group' | 'individual';
type LearningFormat = 'group' | 'individual';
type PlanId = 'lite' | 'progress' | 'intensive';
type AccentTone = 'pink' | 'blue' | 'purple' | 'green' | 'gold';

type Plan = {
  id: PricingPlanId;
  planId: PlanId;
  icon: React.ElementType;
  nameKey: TranslationKey;
  descriptionKey: TranslationKey;
  lessonsPerMonth: number;
  lessonsPerWeek: number;
  checkoutPath: string;
  buttonKey: TranslationKey;
  tone: AccentTone;
  popular?: boolean;
};

type IncludedFeature = {
  titleKey: TranslationKey;
  icon: React.ElementType;
  tone: AccentTone;
};

const teacherRecommendation: { recommendedFormat: LearningFormat | null; recommendedPlan: PlanId | null } = {
  recommendedFormat: null,
  recommendedPlan: null,
};

const toneStyles: Record<AccentTone, { icon: string; shell: string; glow: string; line: string }> = {
  pink: {
    icon: 'bg-pink-100 text-pink-500 dark:bg-pink-400/12 dark:text-pink-200',
    shell: 'from-pink-50/88 via-white/74 to-rose-50/78 dark:from-pink-400/10 dark:via-white/[0.04] dark:to-purple-400/8',
    glow: 'shadow-pink-200/45 dark:shadow-pink-950/24',
    line: 'from-pink-200 via-purple-200 to-blue-200',
  },
  blue: {
    icon: 'bg-blue-100 text-blue-500 dark:bg-blue-400/12 dark:text-blue-200',
    shell: 'from-blue-50/88 via-white/74 to-cyan-50/78 dark:from-blue-400/10 dark:via-white/[0.04] dark:to-purple-400/8',
    glow: 'shadow-blue-200/45 dark:shadow-blue-950/24',
    line: 'from-blue-200 via-purple-200 to-pink-200',
  },
  purple: {
    icon: 'bg-purple-100 text-purple-500 dark:bg-purple-400/12 dark:text-purple-200',
    shell: 'from-purple-50/88 via-white/74 to-pink-50/78 dark:from-purple-400/12 dark:via-white/[0.04] dark:to-pink-400/8',
    glow: 'shadow-purple-200/45 dark:shadow-purple-950/24',
    line: 'from-purple-200 via-pink-200 to-blue-200',
  },
  green: {
    icon: 'bg-green-100 text-green-600 dark:bg-emerald-400/12 dark:text-emerald-200',
    shell: 'from-green-50/88 via-white/74 to-teal-50/78 dark:from-emerald-400/10 dark:via-white/[0.04] dark:to-blue-400/8',
    glow: 'shadow-green-200/40 dark:shadow-emerald-950/22',
    line: 'from-emerald-200 via-blue-200 to-purple-200',
  },
  gold: {
    icon: 'bg-amber-100 text-amber-600 dark:bg-amber-300/14 dark:text-amber-100',
    shell: 'from-amber-50/88 via-white/74 to-pink-50/78 dark:from-amber-300/12 dark:via-white/[0.04] dark:to-pink-400/8',
    glow: 'shadow-amber-200/45 dark:shadow-amber-950/22',
    line: 'from-amber-200 via-pink-200 to-purple-200',
  },
};

const accentStyles: Record<LessonType, {
  icon: React.ElementType;
  labelKey: TranslationKey;
  eyebrowKey: TranslationKey;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  gradient: string;
  panel: string;
  ring: string;
  shadow: string;
}> = {
  group: {
    icon: Users,
    labelKey: 'pricing_switch_group',
    eyebrowKey: 'pricing_group_eyebrow',
    titleKey: 'pricing_group_title',
    subtitleKey: 'pricing_group_subtitle',
    gradient: 'from-pink-300 via-purple-300 to-blue-300',
    panel: 'from-pink-50/86 via-white/72 to-blue-50/86 dark:from-pink-400/12 dark:via-white/[0.04] dark:to-blue-400/10',
    ring: 'border-pink-200/80 dark:border-pink-300/20',
    shadow: 'shadow-pink-200/36 dark:shadow-pink-950/22',
  },
  individual: {
    icon: User,
    labelKey: 'pricing_switch_individual',
    eyebrowKey: 'pricing_individual_eyebrow',
    titleKey: 'pricing_individual_title',
    subtitleKey: 'pricing_individual_subtitle',
    gradient: 'from-blue-300 via-purple-300 to-pink-300',
    panel: 'from-blue-50/86 via-white/72 to-purple-50/86 dark:from-blue-400/12 dark:via-white/[0.04] dark:to-purple-400/10',
    ring: 'border-blue-200/80 dark:border-blue-300/20',
    shadow: 'shadow-blue-200/36 dark:shadow-blue-950/22',
  },
};

const planGroups: Record<LessonType, Plan[]> = {
  group: [
    {
      id: 'group-lite',
      planId: 'lite',
      icon: Leaf,
      nameKey: 'pricing_group_lite_name',
      descriptionKey: 'pricing_group_lite_desc',
      lessonsPerMonth: 4,
      lessonsPerWeek: 1,
      checkoutPath: '/checkout/group-lite',
      buttonKey: 'pricing_group_lite_button',
      tone: 'green',
    },
    {
      id: 'group-progress',
      planId: 'progress',
      icon: Rocket,
      nameKey: 'pricing_group_progress_name',
      descriptionKey: 'pricing_group_progress_desc',
      lessonsPerMonth: 8,
      lessonsPerWeek: 2,
      checkoutPath: '/checkout/group-progress',
      buttonKey: 'pricing_group_progress_button',
      tone: 'pink',
      popular: true,
    },
    {
      id: 'group-intensive',
      planId: 'intensive',
      icon: Crown,
      nameKey: 'pricing_group_intensive_name',
      descriptionKey: 'pricing_group_intensive_desc',
      lessonsPerMonth: 12,
      lessonsPerWeek: 3,
      checkoutPath: '/checkout/group-intensive',
      buttonKey: 'pricing_group_intensive_button',
      tone: 'gold',
    },
  ],
  individual: [
    {
      id: 'individual-lite',
      planId: 'lite',
      icon: Compass,
      nameKey: 'pricing_individual_lite_name',
      descriptionKey: 'pricing_individual_lite_desc',
      lessonsPerMonth: 4,
      lessonsPerWeek: 1,
      checkoutPath: '/checkout/individual-lite',
      buttonKey: 'pricing_individual_lite_button',
      tone: 'blue',
    },
    {
      id: 'individual-progress',
      planId: 'progress',
      icon: Star,
      nameKey: 'pricing_individual_progress_name',
      descriptionKey: 'pricing_individual_progress_desc',
      lessonsPerMonth: 8,
      lessonsPerWeek: 2,
      checkoutPath: '/checkout/individual-progress',
      buttonKey: 'pricing_individual_progress_button',
      tone: 'purple',
      popular: true,
    },
    {
      id: 'individual-intensive',
      planId: 'intensive',
      icon: Gem,
      nameKey: 'pricing_individual_intensive_name',
      descriptionKey: 'pricing_individual_intensive_desc',
      lessonsPerMonth: 12,
      lessonsPerWeek: 3,
      checkoutPath: '/checkout/individual-intensive',
      buttonKey: 'pricing_individual_intensive_button',
      tone: 'pink',
    },
  ],
};

const includedFeatures: IncludedFeature[] = [
  { titleKey: 'pricing_feature_interactive_lessons', icon: BookOpen, tone: 'pink' },
  { titleKey: 'pricing_feature_interactive_games', icon: Gamepad2, tone: 'blue' },
  { titleKey: 'pricing_feature_interactive_workbook', icon: NotebookPen, tone: 'purple' },
  { titleKey: 'pricing_feature_homework', icon: GraduationCap, tone: 'green' },
  { titleKey: 'pricing_feature_listening', icon: Headphones, tone: 'gold' },
  { titleKey: 'pricing_feature_speaking', icon: MessageCircle, tone: 'pink' },
  { titleKey: 'pricing_feature_vocabulary', icon: Sparkles, tone: 'purple' },
  { titleKey: 'pricing_feature_practice_center', icon: Trophy, tone: 'blue' },
  { titleKey: 'pricing_feature_grammar', icon: BookOpen, tone: 'purple' },
  { titleKey: 'pricing_feature_unit_checkpoints', icon: Check, tone: 'green' },
  { titleKey: 'pricing_feature_schedule', icon: CalendarDays, tone: 'pink' },
  { titleKey: 'pricing_feature_grades', icon: Star, tone: 'gold' },
  { titleKey: 'pricing_feature_reward_shop', icon: Crown, tone: 'purple' },
];

const faqItems: { questionKey: TranslationKey; answerKey: TranslationKey }[] = [
  { questionKey: 'pricing_faq_trial_q', answerKey: 'pricing_faq_trial_a' },
  { questionKey: 'pricing_faq_change_q', answerKey: 'pricing_faq_change_a' },
  { questionKey: 'pricing_faq_cancel_q', answerKey: 'pricing_faq_cancel_a' },
  { questionKey: 'pricing_faq_length_q', answerKey: 'pricing_faq_length_a' },
  { questionKey: 'pricing_faq_switch_q', answerKey: 'pricing_faq_switch_a' },
];

const learningPolicyItems: { titleKey: TranslationKey; bodyKey: TranslationKey; icon: React.ElementType; tone: AccentTone }[] = [
  { titleKey: 'pricing_policy_reschedule_title', bodyKey: 'pricing_policy_reschedule_body', icon: RefreshCw, tone: 'blue' },
  { titleKey: 'pricing_policy_missed_title', bodyKey: 'pricing_policy_missed_body', icon: Clock, tone: 'pink' },
  { titleKey: 'pricing_policy_schedule_title', bodyKey: 'pricing_policy_schedule_body', icon: CalendarDays, tone: 'purple' },
  { titleKey: 'pricing_policy_group_title', bodyKey: 'pricing_policy_group_body', icon: Users, tone: 'green' },
  { titleKey: 'pricing_policy_trial_title', bodyKey: 'pricing_policy_trial_body', icon: ShieldCheck, tone: 'gold' },
];

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-90px' }}
      transition={{ duration: 0.72, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function LessonTypeSwitch({ value, onChange, lang }: { value: LessonType; onChange: (value: LessonType) => void; lang: Lang }) {
  return (
    <motion.div
      className="pricing-switch relative mx-auto grid w-full max-w-[28rem] grid-cols-2 rounded-full border border-white/80 bg-white/54 p-1.5 shadow-2xl shadow-purple-100/50 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-purple-950/26"
      animate={{
        boxShadow: value === 'group' ? '0 24px 70px rgba(244, 114, 182, 0.24)' : '0 24px 70px rgba(96, 165, 250, 0.24)',
      }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        layout
        className={cn('absolute bottom-1.5 top-1.5 w-[calc(50%-0.375rem)] rounded-full bg-gradient-to-r shadow-lg', accentStyles[value].gradient)}
        animate={{ x: value === 'group' ? 0 : '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 34, mass: 1.05 }}
      >
        <div className="absolute inset-0 rounded-full bg-white/18" />
        <div className="absolute inset-x-6 top-0 h-px bg-white/65" />
      </motion.div>
      {(['group', 'individual'] as LessonType[]).map((option) => {
        const Icon = accentStyles[option].icon;
        const active = value === option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              'relative z-10 flex min-h-12 items-center justify-center gap-2 rounded-full px-3 font-display text-sm font-bold transition-colors duration-300 sm:min-h-14 sm:text-base',
              active ? 'text-white' : 'text-purple-500 hover:text-pink-500 dark:text-purple-200 dark:hover:text-pink-100',
            )}
          >
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            {t(lang, accentStyles[option].labelKey)}
          </button>
        );
      })}
    </motion.div>
  );
}

function CurrencySelector({
  value,
  onChange,
  lang,
}: {
  value: DisplayCurrency;
  onChange: (value: DisplayCurrency) => void;
  lang: Lang;
}) {
  return (
    <div className="pricing-currency-control mx-auto flex w-fit items-center gap-1 rounded-full border border-white/80 bg-white/56 p-1.5 shadow-xl shadow-purple-100/40 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055] dark:shadow-purple-950/22">
      {supportedCurrencies.map((currency) => {
        const active = value === currency;

        return (
          <button
            key={currency}
            type="button"
            onClick={() => onChange(currency)}
            aria-pressed={active}
            aria-label={t(lang, currency === 'CZK' ? 'pricing_currency_czk' : 'pricing_currency_eur')}
            className={cn(
              'relative min-w-16 rounded-full px-4 py-2 font-display text-sm font-bold transition-[background,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 dark:focus-visible:ring-purple-300/40',
              active
                ? 'bg-gradient-to-r from-pink-300 via-purple-300 to-blue-300 text-white shadow-lg shadow-purple-200/40 dark:shadow-black/24'
                : 'text-purple-500 hover:-translate-y-0.5 hover:bg-white/70 hover:text-pink-500 dark:text-purple-100 dark:hover:bg-white/10 dark:hover:text-pink-100',
            )}
          >
            {currency === 'CZK' ? 'Kč' : '€'}
          </button>
        );
      })}
    </div>
  );
}

function PlanCard({
  plan,
  lessonType,
  index,
  lang,
  currency,
}: {
  plan: Plan;
  lessonType: LessonType;
  index: number;
  lang: Lang;
  currency: DisplayCurrency;
}) {
  const recommended = teacherRecommendation.recommendedFormat === lessonType && teacherRecommendation.recommendedPlan === plan.planId;
  const tone = toneStyles[plan.tone];
  const accent = accentStyles[lessonType];
  const Icon = plan.icon;
  const price = pricingPlanPrices[plan.id];
  const checkoutPath = `${plan.checkoutPath}?currency=${currency}`;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 32, scale: 0.965, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, scale: recommended ? 1.015 : 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, scale: 0.97, filter: 'blur(8px)' }}
      transition={{ duration: 0.48, delay: index * 0.055, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -9, scale: recommended ? 1.025 : 1.012 }}
      className={cn(
        'pricing-card group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border bg-gradient-to-br p-5 shadow-2xl backdrop-blur-2xl transition-colors duration-500 sm:p-6 lg:p-7',
        tone.shell,
        recommended ? 'border-amber-300/70 shadow-amber-200/40 dark:border-amber-300/48 dark:shadow-amber-950/26' : cn('border-white/70 dark:border-white/10', tone.glow),
      )}
    >
      <motion.div
        className={cn('absolute -right-16 -top-16 h-44 w-44 rounded-full bg-gradient-to-br opacity-30 blur-3xl group-hover:opacity-70', tone.line)}
        animate={{ scale: [1, 1.08, 1], rotate: [0, 8, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: index * 0.7 }}
      />
      <div className="pricing-card-sheen absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className={cn('absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/24')} />

      {(plan.popular || recommended) && (
        <div className="relative z-10 mb-5 flex flex-wrap items-center gap-2">
          {plan.popular && (
            <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r px-3 py-1.5 font-body text-xs font-700 text-white shadow-lg shadow-purple-200/30 dark:shadow-purple-950/20', accent.gradient)}>
              <Star className="h-3.5 w-3.5 fill-white" aria-hidden="true" />
              {t(lang, 'pricing_badge_popular')}
            </span>
          )}
          {recommended && (
            <span className="pricing-recommendation-badge inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-gradient-to-r from-amber-100 via-yellow-50 to-orange-100 px-3 py-1.5 font-body text-xs font-700 text-amber-950 shadow-md shadow-amber-200/36 dark:border-amber-700/70 dark:from-amber-300 dark:via-yellow-300 dark:to-orange-300 dark:text-amber-950 dark:shadow-black/30">
              <Star className="h-3.5 w-3.5 fill-amber-700 text-amber-700 dark:fill-amber-950 dark:text-amber-950" aria-hidden="true" />
              {t(lang, 'pricing_badge_teacher')}
            </span>
          )}
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col">
        <div className="mb-5 flex items-start gap-4">
          <motion.div
            whileHover={{ rotate: [0, -4, 4, 0], scale: 1.08 }}
            transition={{ duration: 0.45 }}
            className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg ring-1 ring-white/70 dark:ring-white/10 sm:h-16 sm:w-16', tone.icon)}
          >
            <Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.15} aria-hidden="true" />
          </motion.div>
          <div>
            <h3 className="font-display text-2xl font-black leading-tight text-purple-700 dark:text-purple-50">{t(lang, plan.nameKey)}</h3>
            <p className="mt-1 font-body text-sm font-700 text-purple-400 dark:text-purple-200/70">{t(lang, 'pricing_plan_60_min')}</p>
          </div>
        </div>

        <p className="min-h-[4.5rem] font-body text-sm leading-relaxed text-purple-500 dark:text-purple-100/75">{t(lang, plan.descriptionKey)}</p>

        <div className="my-6 grid gap-2.5">
          {[
            `${plan.lessonsPerMonth} ${t(lang, 'pricing_lessons_month')}`,
            `${plan.lessonsPerWeek} ${t(lang, plan.lessonsPerWeek === 1 ? 'pricing_lesson_week' : 'pricing_lessons_week')}`,
            t(lang, 'pricing_duration_60'),
          ].map((detail) => (
            <div key={detail} className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/55 px-4 py-3 font-body text-sm font-700 text-purple-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.055] dark:text-purple-100">
              {detail === t(lang, 'pricing_duration_60') ? <Clock className="h-4 w-4 text-pink-400 dark:text-pink-200" aria-hidden="true" /> : <Check className="h-4 w-4 text-green-500 dark:text-emerald-200" aria-hidden="true" />}
              {detail}
            </div>
          ))}
        </div>

        <div className="mb-6 mt-auto">
          <div className="flex items-end gap-2">
            <p className="font-display text-4xl font-black leading-none text-purple-700 dark:text-white">
              {formatCurrencyAmount(price.monthlyCzk, currency, lang)}
            </p>
            <p className="pb-1 font-body text-sm font-700 text-purple-400 dark:text-purple-200/70">{t(lang, 'pricing_per_month')}</p>
          </div>
          <p className="mt-2 font-body text-sm font-700 text-purple-400 dark:text-purple-200/70">
            {formatCurrencyAmount(price.perLessonCzk, currency, lang)} {t(lang, 'pricing_per_lesson')}
          </p>
        </div>
      </div>

      <Link
        to={checkoutPath}
        className={cn(
          'pricing-button pricing-button-soft relative z-10 inline-flex min-h-12 items-center justify-center overflow-hidden rounded-full border px-6 py-3 text-center font-display text-sm font-bold shadow-xl',
          accent.ring,
        )}
      >
        <span className="relative z-10">{t(lang, plan.buttonKey)}</span>
      </Link>
    </motion.article>
  );
}

function PricingCards({
  lessonType,
  lang,
  currency,
  onCurrencyChange,
}: {
  lessonType: LessonType;
  lang: Lang;
  currency: DisplayCurrency;
  onCurrencyChange: (currency: DisplayCurrency) => void;
}) {
  const accent = accentStyles[lessonType];

  return (
    <section className="pricing-section relative overflow-hidden px-4 py-16 sm:py-20">
      <div className="absolute inset-0 bg-gradient-to-b from-white/56 via-pink-50/52 to-blue-50/50 dark:from-[#140624]/92 dark:via-[#10051d]/88 dark:to-[#0b1024]/92" />
      <div className="absolute left-1/2 top-4 h-60 w-[min(44rem,85vw)] -translate-x-1/2 rounded-full bg-pink-200/30 blur-3xl dark:bg-pink-500/8" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <FadeIn className="mb-10 text-center sm:mb-12">
          <motion.div
            key={`${lessonType}-eyebrow`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36 }}
            className={cn('mb-4 inline-flex items-center gap-2 rounded-full border bg-gradient-to-r px-4 py-2 shadow-lg backdrop-blur', accent.panel, accent.ring, accent.shadow)}
          >
            <Sparkles className="h-4 w-4 text-pink-400 dark:text-pink-200" aria-hidden="true" />
            <span className="font-body text-sm font-700 text-purple-600 dark:text-purple-100">{t(lang, accent.eyebrowKey)}</span>
          </motion.div>
          <AnimatePresence mode="wait">
            <motion.div
              key={lessonType}
              initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="font-display text-4xl font-black text-purple-700 dark:text-purple-50 md:text-5xl">
                {t(lang, accent.titleKey)}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl font-body text-lg leading-relaxed text-purple-500 dark:text-purple-100/76">
                {t(lang, accent.subtitleKey)}
              </p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-7">
            <CurrencySelector value={currency} onChange={onCurrencyChange} lang={lang} />
            <AnimatePresence>
              {currency === 'EUR' && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="mx-auto mt-3 max-w-xl font-body text-xs font-bold leading-relaxed text-purple-400 dark:text-purple-100/62"
                >
                  {t(lang, 'pricing_currency_note_eur')}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </FadeIn>

        <AnimatePresence mode="wait">
          <motion.div
            key={lessonType}
            className="grid gap-5 md:grid-cols-3 md:gap-4 lg:gap-6"
            initial={{ opacity: 0, x: lessonType === 'group' ? -18 : 18, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: lessonType === 'group' ? 18 : -18, scale: 0.985 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            {planGroups[lessonType].map((plan, index) => (
              <PlanCard key={plan.id} plan={plan} lessonType={lessonType} index={index} lang={lang} currency={currency} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function IncludedSection({ lang }: { lang: Lang }) {
  return (
    <section className="pricing-included relative overflow-hidden px-4 py-16 sm:py-20">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/72 via-purple-50/62 to-pink-50/58 dark:from-[#0b1024]/92 dark:via-[#130720]/88 dark:to-[#16071f]/92" />
      <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-blue-200/35 blur-3xl dark:bg-blue-500/10" />
      <div className="absolute -right-24 bottom-16 h-72 w-72 rounded-full bg-pink-200/35 blur-3xl dark:bg-pink-500/10" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <FadeIn className="mb-10 text-center sm:mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-blue-100/75 px-4 py-2 shadow-lg shadow-blue-100/50 backdrop-blur dark:border-blue-300/15 dark:bg-blue-400/10 dark:shadow-blue-950/25">
            <Sparkles className="h-4 w-4 text-blue-500 dark:text-blue-200" aria-hidden="true" />
            <span className="font-body text-sm font-700 text-blue-500 dark:text-blue-100">{t(lang, 'pricing_included_badge')}</span>
          </div>
          <h2 className="font-display text-4xl font-black text-purple-700 dark:text-purple-50 md:text-5xl">
            {t(lang, 'pricing_included_title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl font-body text-lg leading-relaxed text-purple-500 dark:text-purple-100/76">
            {t(lang, 'pricing_included_subtitle')}
          </p>
        </FadeIn>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {includedFeatures.map((feature, index) => {
            const Icon = feature.icon;
            const tone = toneStyles[feature.tone];

            return (
              <FadeIn key={feature.titleKey} delay={index * 0.025}>
                <motion.div
                  whileHover={{ y: -6, scale: 1.018 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                  className={cn('pricing-feature-card group h-full rounded-[1.35rem] border bg-gradient-to-br p-4 shadow-lg backdrop-blur-xl sm:p-5', tone.shell, 'border-white/70 shadow-purple-100/30 dark:border-white/10 dark:shadow-purple-950/20')}
                >
                  <div className={cn('mb-4 flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm ring-1 ring-white/70 dark:ring-white/10', tone.icon)}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-base font-bold leading-tight text-purple-700 dark:text-purple-50">{t(lang, feature.titleKey)}</h3>
                </motion.div>
              </FadeIn>
            );
          })}
        </div>

        <FadeIn delay={0.16} className="mt-10">
          <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-white/75 bg-white/58 p-6 text-center shadow-2xl shadow-purple-100/40 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055] dark:shadow-purple-950/25">
            <p className="font-body text-lg font-700 text-purple-700 dark:text-purple-50">
              {t(lang, 'pricing_included_full_access')}
            </p>
            <p className="mt-2 font-body text-purple-500 dark:text-purple-100/72">
              {t(lang, 'pricing_included_difference')}
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function FAQSection({ lang }: { lang: Lang }) {
  const [openQuestion, setOpenQuestion] = useState<TranslationKey | null>(faqItems[0].questionKey);

  return (
    <section className="pricing-faq relative overflow-hidden px-4 py-16 sm:py-20">
      <div className="absolute inset-0 bg-gradient-to-b from-pink-50/58 via-purple-50/62 to-white/68 dark:from-[#16071f]/92 dark:via-[#10051d]/88 dark:to-[#0a0613]/92" />
      <div className="relative z-10 mx-auto max-w-3xl">
        <FadeIn className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-200/70 bg-purple-100/75 px-4 py-2 shadow-lg shadow-purple-100/50 backdrop-blur dark:border-purple-300/15 dark:bg-purple-400/10 dark:shadow-purple-950/25">
            <Sparkles className="h-4 w-4 text-purple-500 dark:text-purple-200" aria-hidden="true" />
            <span className="font-body text-sm font-700 text-purple-500 dark:text-purple-100">{t(lang, 'pricing_faq_badge')}</span>
          </div>
          <h2 className="font-display text-4xl font-black text-purple-700 dark:text-purple-50 md:text-5xl">{t(lang, 'pricing_faq_title')}</h2>
        </FadeIn>

        <div className="space-y-4">
          {faqItems.map((faq, index) => {
            const isOpen = openQuestion === faq.questionKey;

            return (
              <FadeIn key={faq.questionKey} delay={index * 0.025}>
                <motion.div
                  className={cn(
                    'pricing-faq-card overflow-hidden rounded-[1.45rem] border bg-white/58 backdrop-blur-2xl transition-[border-color,background-color,box-shadow,transform] duration-200 dark:bg-white/[0.055]',
                    isOpen
                      ? 'border-purple-200/90 shadow-xl shadow-purple-100/38 dark:border-purple-300/20 dark:shadow-purple-950/24'
                      : 'border-white/75 shadow-lg shadow-purple-100/24 hover:-translate-y-0.5 hover:border-purple-100/90 hover:shadow-purple-100/30 dark:border-white/10 dark:shadow-purple-950/16 dark:hover:border-purple-300/14',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpenQuestion(isOpen ? null : faq.questionKey)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left font-display text-lg font-bold leading-snug text-purple-700 sm:px-6 dark:text-purple-50"
                  >
                    {t(lang, faq.questionKey)}
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-500 shadow-sm dark:bg-purple-400/12 dark:text-purple-100"
                    >
                      <ChevronDown className="h-5 w-5" aria-hidden="true" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <motion.p
                          initial={{ y: -8 }}
                          animate={{ y: 0 }}
                          exit={{ y: -8 }}
                          className="px-5 pb-6 font-body leading-relaxed text-purple-500 sm:px-6 dark:text-purple-100/74"
                        >
                          {t(lang, faq.answerKey)}
                        </motion.p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LearningPolicySection({ lang }: { lang: Lang }) {
  return (
    <section className="pricing-policy relative overflow-hidden px-4 py-16 sm:py-20">
      <div className="absolute inset-0 bg-gradient-to-b from-white/68 via-blue-50/55 to-pink-50/64 dark:from-[#0a0613]/92 dark:via-[#0f0821]/90 dark:to-[#14061f]/92" />
      <div className="absolute left-[8%] top-14 h-64 w-64 rounded-full bg-purple-200/30 blur-3xl dark:bg-purple-500/10" />
      <div className="absolute bottom-8 right-[8%] h-72 w-72 rounded-full bg-blue-200/28 blur-3xl dark:bg-blue-500/9" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <FadeIn className="mb-10 text-center sm:mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pink-200/70 bg-white/55 px-4 py-2 shadow-lg shadow-pink-100/40 backdrop-blur-xl dark:border-pink-300/15 dark:bg-white/[0.055] dark:shadow-purple-950/24">
            <ShieldCheck className="h-4 w-4 text-pink-500 dark:text-pink-200" aria-hidden="true" />
            <span className="font-body text-sm font-700 text-purple-600 dark:text-purple-100">{t(lang, 'pricing_policy_badge')}</span>
          </div>
          <h2 className="font-display text-4xl font-black text-purple-700 dark:text-purple-50 md:text-5xl">
            {t(lang, 'pricing_policy_title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl font-body text-lg leading-relaxed text-purple-500 dark:text-purple-100/76">
            {t(lang, 'pricing_policy_subtitle')}
          </p>
        </FadeIn>

        <div className="mx-auto grid w-full max-w-7xl gap-4 md:grid-cols-2 lg:grid-cols-5">
          {learningPolicyItems.map((item, index) => {
            const Icon = item.icon;
            const tone = toneStyles[item.tone];
            const tabletCenter = index === 4 ? 'md:col-span-2 md:mx-auto md:w-full md:max-w-[calc(50%-0.5rem)] lg:col-span-1 lg:max-w-none' : '';

            return (
              <FadeIn key={item.titleKey} delay={index * 0.035} className={cn('h-full', tabletCenter)}>
                <motion.div
                  whileHover={{ y: -6, scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                  className={cn('pricing-feature-card relative h-full overflow-hidden rounded-[1.5rem] border bg-gradient-to-br p-5 shadow-xl backdrop-blur-2xl sm:p-6', tone.shell, 'border-white/70 shadow-purple-100/30 dark:border-white/10 dark:shadow-purple-950/22')}
                >
                  <div className={cn('mb-5 flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-1 ring-white/70 dark:ring-white/10', tone.icon)}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-xl font-bold leading-tight text-purple-700 dark:text-purple-50">{t(lang, item.titleKey)}</h3>
                  <p className="mt-3 font-body text-sm leading-relaxed text-purple-500 dark:text-purple-100/74">{t(lang, item.bodyKey)}</p>
                </motion.div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Pricing({ lang }: PricingProps) {
  const [lessonType, setLessonType] = useState<LessonType>(teacherRecommendation.recommendedFormat ?? 'group');
  const [currency, setCurrency] = useState<DisplayCurrency>('CZK');

  return (
    <main className="pricing-page overflow-x-hidden bg-[#fff8ff] dark:bg-[#0a0613]">
      <section className="pricing-hero-gradient relative flex min-h-[84vh] items-center overflow-hidden px-4 pb-16 pt-32 sm:pb-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {[
            'left-[3%] top-[12%] h-64 w-64 bg-pink-200/42 dark:bg-pink-500/12',
            'right-[4%] top-[18%] h-72 w-72 bg-purple-200/42 dark:bg-purple-500/12',
            'bottom-[7%] left-[18%] h-80 w-80 bg-blue-200/34 dark:bg-blue-500/10',
          ].map((classes, index) => (
            <motion.div
              key={classes}
              className={cn('absolute rounded-full blur-3xl', classes)}
              animate={{ scale: [1, 1.12, 1], x: [0, index % 2 === 0 ? 12 : -10, 0], y: [0, -12, 0] }}
              transition={{ duration: 18 + index * 3, repeat: Infinity, ease: 'easeInOut', delay: index * 1.4 }}
            />
          ))}
        </div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
            className="pricing-hero-badge mb-7 inline-flex max-w-[min(92vw,46rem)] items-center gap-2 rounded-full px-5 py-2.5"
          >
            <BookOpen className="h-4 w-4 shrink-0 text-purple-500 dark:text-purple-100" aria-hidden="true" />
            <span className="font-body text-sm font-700 text-purple-700 dark:text-purple-50">{t(lang, 'pricing_hero_badge')}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.78, type: 'spring', stiffness: 105, damping: 18 }}
            className="font-display text-5xl font-black leading-[1.05] md:text-7xl"
          >
            <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent dark:from-pink-200 dark:via-purple-100 dark:to-blue-200">
              {t(lang, 'pricing_hero_title')}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-6 max-w-2xl font-body text-xl font-600 leading-relaxed text-purple-500 md:text-2xl dark:text-purple-100/76"
          >
            {t(lang, 'pricing_hero_subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10"
          >
            <LessonTypeSwitch value={lessonType} onChange={setLessonType} lang={lang} />
          </motion.div>

        </div>
      </section>

      <PricingCards lessonType={lessonType} lang={lang} currency={currency} onCurrencyChange={setCurrency} />
      <IncludedSection lang={lang} />
      <FAQSection lang={lang} />
      <LearningPolicySection lang={lang} />
      <Footer lang={lang} />
    </main>
  );
}
