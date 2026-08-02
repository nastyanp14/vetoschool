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

/** Parses the Stripe-Signature header into its timestamp and v1 signatures. */
export function parseStripeSignatureHeader(header: string | null | undefined) {
  if (!header) return null;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.split('=', 2).map((chunk) => chunk?.trim());
    if (key === 't' && value) timestamp = Number(value);
    if (key === 'v1' && value) signatures.push(value);
  }
  if (timestamp === null || !Number.isFinite(timestamp) || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifies a Stripe webhook signature against the RAW request body.
 * Fails closed when the secret or header is missing.
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string | null | undefined,
  options: { toleranceSeconds?: number; nowMs?: number } = {},
): Promise<boolean> {
  if (!secret) return false;
  const parsed = parseStripeSignatureHeader(header);
  if (!parsed) return false;

  const tolerance = options.toleranceSeconds ?? 300;
  const now = Math.floor((options.nowMs ?? Date.now()) / 1000);
  if (Math.abs(now - parsed.timestamp) > tolerance) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${parsed.timestamp}.${rawBody}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return parsed.signatures.some((signature) => timingSafeEqual(signature, expected));
}
