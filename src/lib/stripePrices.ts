import type { PricingPlanId } from './pricingCurrency';

export type LessonFormat = 'group' | 'individual';

export const STRIPE_PRICE_GROUP_LITE = 'price_1Txb9HLCIsxnginYf4mX2Uwg';
export const STRIPE_PRICE_GROUP_PROGRESS = 'price_1TxbAFLCIsxnginY7Mlaf63r';
export const STRIPE_PRICE_GROUP_INTENSIVE = 'price_1TxbAnLCIsxnginYE3at3vOH';
export const STRIPE_PRICE_INDIVIDUAL_LITE = 'price_1TxbBMLCIsxnginYHI1sficF';
export const STRIPE_PRICE_INDIVIDUAL_PROGRESS = 'price_1TxbBqLCIsxnginYkBwPHgg8';
export const STRIPE_PRICE_INDIVIDUAL_INTENSIVE = 'price_1TxbCJLCIsxnginYq2t7tAIs';

export const stripePriceIdsByPlan: Record<PricingPlanId, string> = {
  'group-lite': STRIPE_PRICE_GROUP_LITE,
  'group-progress': STRIPE_PRICE_GROUP_PROGRESS,
  'group-intensive': STRIPE_PRICE_GROUP_INTENSIVE,
  'individual-lite': STRIPE_PRICE_INDIVIDUAL_LITE,
  'individual-progress': STRIPE_PRICE_INDIVIDUAL_PROGRESS,
  'individual-intensive': STRIPE_PRICE_INDIVIDUAL_INTENSIVE,
};

export const stripePlanConfig: Record<PricingPlanId, {
  priceId: string;
  lessonFormat: LessonFormat;
  lessonsTotal: number;
}> = {
  'group-lite': { priceId: STRIPE_PRICE_GROUP_LITE, lessonFormat: 'group', lessonsTotal: 4 },
  'group-progress': { priceId: STRIPE_PRICE_GROUP_PROGRESS, lessonFormat: 'group', lessonsTotal: 8 },
  'group-intensive': { priceId: STRIPE_PRICE_GROUP_INTENSIVE, lessonFormat: 'group', lessonsTotal: 12 },
  'individual-lite': { priceId: STRIPE_PRICE_INDIVIDUAL_LITE, lessonFormat: 'individual', lessonsTotal: 4 },
  'individual-progress': { priceId: STRIPE_PRICE_INDIVIDUAL_PROGRESS, lessonFormat: 'individual', lessonsTotal: 8 },
  'individual-intensive': { priceId: STRIPE_PRICE_INDIVIDUAL_INTENSIVE, lessonFormat: 'individual', lessonsTotal: 12 },
};

export function planIdFromStripePriceId(priceId: string | null | undefined): PricingPlanId | null {
  if (!priceId) return null;
  const entry = Object.entries(stripePlanConfig).find(([, config]) => config.priceId === priceId);
  return entry ? entry[0] as PricingPlanId : null;
}
