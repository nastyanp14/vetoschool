// Pure, runtime-agnostic Stripe helpers shared by edge functions and unit tests.
// No Deno globals at module scope so this file can be imported by vitest.

export type LessonFormat = 'group' | 'individual';

export type StripePlan = {
  planId: string;
  lessonFormat: LessonFormat;
  /** internal tier used by the app */
  tier: 'lite' | 'progress' | 'intensive';
  lessonsTotal: number;
  /** amount in the smallest currency unit (haléř) */
  unitAmount: number;
  currency: 'czk';
  lookupKey: string;
  productName: string;
};

export const stripePlanConfig: Record<string, StripePlan> = {
  'group-lite': {
    planId: 'group-lite',
    lessonFormat: 'group',
    tier: 'lite',
    lessonsTotal: 4,
    unitAmount: 128000,
    currency: 'czk',
    lookupKey: 'vetoschool_group_lite_monthly',
    productName: 'Vetoschool Group Lite (4 lessons / month)',
  },
  'group-progress': {
    planId: 'group-progress',
    lessonFormat: 'group',
    tier: 'progress',
    lessonsTotal: 8,
    unitAmount: 240000,
    currency: 'czk',
    lookupKey: 'vetoschool_group_progress_monthly',
    productName: 'Vetoschool Group Progress (8 lessons / month)',
  },
  'group-intensive': {
    planId: 'group-intensive',
    lessonFormat: 'group',
    tier: 'intensive',
    lessonsTotal: 12,
    unitAmount: 342000,
    currency: 'czk',
    lookupKey: 'vetoschool_group_intensive_monthly',
    productName: 'Vetoschool Group Intensive (12 lessons / month)',
  },
  'individual-lite': {
    planId: 'individual-lite',
    lessonFormat: 'individual',
    tier: 'lite',
    lessonsTotal: 4,
    unitAmount: 180000,
    currency: 'czk',
    lookupKey: 'vetoschool_individual_lite_monthly',
    productName: 'Vetoschool Individual Lite (4 lessons / month)',
  },
  'individual-progress': {
    planId: 'individual-progress',
    lessonFormat: 'individual',
    tier: 'progress',
    lessonsTotal: 8,
    unitAmount: 344000,
    currency: 'czk',
    lookupKey: 'vetoschool_individual_progress_monthly',
    productName: 'Vetoschool Individual Progress (8 lessons / month)',
  },
  'individual-intensive': {
    planId: 'individual-intensive',
    lessonFormat: 'individual',
    tier: 'intensive',
    lessonsTotal: 12,
    unitAmount: 480000,
    currency: 'czk',
    lookupKey: 'vetoschool_individual_intensive_monthly',
    productName: 'Vetoschool Individual Intensive (12 lessons / month)',
  },
};

export function resolvePlan(planId: unknown): StripePlan | null {
  if (typeof planId !== 'string') return null;
  return stripePlanConfig[planId] ?? null;
}

/** Only the planId is ever accepted from the client. */
export function readCheckoutRequest(body: unknown): { ok: true; plan: StripePlan } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request body' };
  const plan = resolvePlan((body as Record<string, unknown>).planId);
  if (!plan) return { ok: false, error: 'Unknown plan' };
  return { ok: true, plan };
}

export function assertProductionAppUrl(appUrl: string | undefined | null): string {
  if (!appUrl) throw new Error('APP_URL is not configured');
  let url: URL;
  try {
    url = new URL(appUrl);
  } catch {
    throw new Error('APP_URL is not a valid URL');
  }
  if (url.protocol !== 'https:') throw new Error('APP_URL must use https');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')) {
    throw new Error('APP_URL must not point to a local host');
  }
  return url.origin;
}

export function checkoutUrls(appOrigin: string) {
  return {
    success_url: `${appOrigin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appOrigin}/payment/cancel`,
  };
}

export function assertPortalConfigurationId(value: string | undefined | null): string {
  if (!value) throw new Error('STRIPE_PORTAL_CONFIGURATION_ID is not configured');
  if (!value.startsWith('bpc_')) throw new Error('STRIPE_PORTAL_CONFIGURATION_ID is invalid');
  return value;
}

export type RefundValidationInput = {
  amount: unknown;
  paymentAmount: number;
  alreadyRefunded: number;
};

export function validateRefundAmount(input: RefundValidationInput): { ok: true; amount: number } | { ok: false; error: string } {
  const { amount, paymentAmount, alreadyRefunded } = input;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || !Number.isInteger(amount)) {
    return { ok: false, error: 'Refund amount must be an integer in the smallest currency unit' };
  }
  if (amount <= 0) return { ok: false, error: 'Refund amount must be greater than zero' };
  const remaining = paymentAmount - alreadyRefunded;
  if (remaining <= 0) return { ok: false, error: 'This payment is already fully refunded' };
  if (amount > remaining) return { ok: false, error: 'Refund amount exceeds the refundable balance' };
  return { ok: true, amount };
}

export function refundType(amount: number, paymentAmount: number): 'full' | 'partial' {
  return amount >= paymentAmount ? 'full' : 'partial';
}

/** Events the webhook is allowed to act on. */
export const handledWebhookEvents = [
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const;

export type HandledWebhookEvent = (typeof handledWebhookEvents)[number];

export function isHandledEvent(type: string): type is HandledWebhookEvent {
  return (handledWebhookEvents as readonly string[]).includes(type);
}

export function toIso(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

/** Never leak provider internals to the browser. */
export function safeErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (error && typeof error === 'object') {
    const type = (error as { type?: string }).type;
    if (type === 'StripeInvalidRequestError' || type === 'StripeCardError') {
      return 'Payment provider rejected the request';
    }
  }
  if (error instanceof Error && /^[A-Za-z0-9 _.,'()-]{0,160}$/.test(error.message)) return error.message;
  return fallback;
}
