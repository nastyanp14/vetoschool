export type BillingLike = {
  paymentStatus?: string | null;
  subscriptionStatus?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  manualAccessOverride?: boolean | null;
  accessStatus?: string | null;
};

export type BillingStatusKind =
  | 'active'
  | 'trial'
  | 'pending_payment'
  | 'payment_failed'
  | 'cancels_at_period_end'
  | 'cancelled'
  | 'manual_access';

export function hasStripeSubscriptionLink(input: BillingLike) {
  return Boolean(input.stripeCustomerId?.trim() && input.stripeSubscriptionId?.trim());
}

export function hasManualAccessOverride(input: BillingLike) {
  return Boolean(input.manualAccessOverride || (input.accessStatus === 'active' && !hasStripeSubscriptionLink(input)));
}

export function hasConfirmedStripePayment(input: BillingLike) {
  return input.paymentStatus === 'paid' && hasStripeSubscriptionLink(input);
}

export function activeSubscriptionStatus(input: BillingLike) {
  if (hasManualAccessOverride(input)) return 'manual_access';
  if (input.subscriptionStatus === 'canceled' || input.accessStatus === 'cancelled') return 'cancelled';
  if (
    input.paymentStatus === 'failed'
    || input.subscriptionStatus === 'past_due'
    || input.subscriptionStatus === 'unpaid'
    || input.subscriptionStatus === 'incomplete_expired'
  ) return 'payment_failed';
  if (input.cancelAtPeriodEnd && hasStripeSubscriptionLink(input)) return 'cancels_at_period_end';
  if (input.subscriptionStatus === 'trialing' && hasStripeSubscriptionLink(input)) return 'trial';
  if (input.subscriptionStatus === 'active' && hasStripeSubscriptionLink(input)) return 'active';
  return 'pending_payment';
}

export function shouldShowActiveTariff(input: BillingLike) {
  const status = activeSubscriptionStatus(input);
  return status === 'active' || status === 'trial' || status === 'cancels_at_period_end' || status === 'manual_access';
}

export function billingStatusLabel(kind: BillingStatusKind, lang: 'ru' | 'ua' | 'en') {
  const labels: Record<BillingStatusKind, Record<'ru' | 'ua' | 'en', string>> = {
    active: { ru: 'Активна', ua: 'Активна', en: 'Active' },
    trial: { ru: 'Пробный период', ua: 'Пробний період', en: 'Trial' },
    pending_payment: { ru: 'Ожидает оплаты', ua: 'Очікує оплати', en: 'Pending payment' },
    payment_failed: { ru: 'Проблема с оплатой', ua: 'Проблема з оплатою', en: 'Payment failed' },
    cancels_at_period_end: { ru: 'Отменится в конце периода', ua: 'Скасується в кінці періоду', en: 'Cancels at period end' },
    cancelled: { ru: 'Отменена', ua: 'Скасована', en: 'Cancelled' },
    manual_access: { ru: 'Ручной доступ', ua: 'Ручний доступ', en: 'Manual access' },
  };
  return labels[kind][lang];
}

export function billingStatusClass(kind: BillingStatusKind) {
  if (kind === 'payment_failed') return 'border-red-200 bg-red-50 text-red-700';
  if (kind === 'cancelled') return 'border-gray-200 bg-gray-100 text-gray-600';
  if (kind === 'cancels_at_period_end') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (kind === 'manual_access') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (kind === 'pending_payment') return 'border-purple-200 bg-purple-50 text-purple-600';
  return 'border-green-200 bg-green-50 text-green-700';
}
