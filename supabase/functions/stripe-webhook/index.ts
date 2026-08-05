type PricingPlanId =
  | 'group-lite'
  | 'group-progress'
  | 'group-intensive'
  | 'individual-lite'
  | 'individual-progress'
  | 'individual-intensive';

type LessonFormat = 'group' | 'individual';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
} | undefined;

const STRIPE_PRICE_GROUP_LITE = 'price_1Txb9HLCIsxnginYf4mX2Uwg';
const STRIPE_PRICE_GROUP_PROGRESS = 'price_1TxbAFLCIsxnginY7Mlaf63r';
const STRIPE_PRICE_GROUP_INTENSIVE = 'price_1TxbAnLCIsxnginYE3at3vOH';
const STRIPE_PRICE_INDIVIDUAL_LITE = 'price_1TxbBMLCIsxnginYHI1sficF';
const STRIPE_PRICE_INDIVIDUAL_PROGRESS = 'price_1TxbBqLCIsxnginYkBwPHgg8';
const STRIPE_PRICE_INDIVIDUAL_INTENSIVE = 'price_1TxbCJLCIsxnginYq2t7tAIs';

const stripePriceIdsByPlan: Record<PricingPlanId, string> = {
  'group-lite': STRIPE_PRICE_GROUP_LITE,
  'group-progress': STRIPE_PRICE_GROUP_PROGRESS,
  'group-intensive': STRIPE_PRICE_GROUP_INTENSIVE,
  'individual-lite': STRIPE_PRICE_INDIVIDUAL_LITE,
  'individual-progress': STRIPE_PRICE_INDIVIDUAL_PROGRESS,
  'individual-intensive': STRIPE_PRICE_INDIVIDUAL_INTENSIVE,
};

const stripePlanConfig: Record<PricingPlanId, {
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

function planIdFromStripePriceId(priceId: string | null | undefined): PricingPlanId | null {
  if (!priceId) return null;
  const entry = Object.entries(stripePlanConfig).find(([, config]) => config.priceId === priceId);
  return entry ? entry[0] as PricingPlanId : null;
}

function planIdFromMetadataValue(value: unknown): PricingPlanId | null {
  return typeof value === 'string' && isPricingPlanId(value) ? value as PricingPlanId : null;
}

function invoiceSubscriptionId(invoice: unknown): string {
  const raw = invoice as Record<string, any> | undefined;
  return normalizeStripeId(raw?.subscription)
    || normalizeStripeId(raw?.parent?.subscription_details?.subscription)
    || normalizeStripeId(raw?.lines?.data?.[0]?.subscription)
    || normalizeStripeId(raw?.lines?.data?.[0]?.parent?.subscription_item_details?.subscription)
    || '';
}

function stripeMetadataPlanId(...sources: Array<unknown>): PricingPlanId | null {
  for (const source of sources) {
    const metadata = (source as Record<string, any> | undefined)?.metadata;
    const planId = planIdFromMetadataValue(metadata?.plan_id);
    if (planId) return planId;
  }
  return null;
}

export const DEFAULT_STRIPE_PORTAL_RETURN_PATH = '/dashboard';

type StripeCheckoutEnv = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PORTAL_CONFIGURATION_ID?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SENDPULSE_CLIENT_ID?: string;
  SENDPULSE_CLIENT_SECRET?: string;
  SENDPULSE_FROM_EMAIL?: string;
  SENDPULSE_FROM_NAME?: string;
  SENDPULSE_EMAIL_ENDPOINT?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ADMIN_CHAT_ID?: string;
  TELEGRAM_ADMIN_CHAT_IDS?: string;
  STRIPE_TELEGRAM_NOTIFICATION_WINDOW_SECONDS?: string;
  APP_URL?: string;
  stripeWebhookProcessor?: (event: StripeWebhookLogEvent) => Promise<void> | void;
};

type CheckoutRequestBody = {
  planId?: string;
  currency?: string;
};

type StripeRefundRequestBody = {
  stripePaymentId?: string;
  refundType?: 'full' | 'partial';
  amount?: number;
  reason?: string;
  idempotencyKey?: string;
};

const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
const DEFAULT_STRIPE_TELEGRAM_NOTIFICATION_WINDOW_SECONDS = 30 * 60;
const HANDLED_STRIPE_WEBHOOK_EVENTS = new Set([
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

type StripeWebhookEvent = {
  id?: string;
  type?: string;
  created?: number;
  livemode?: boolean;
  data?: {
    object?: StripeCheckoutSession | StripeInvoice | StripeSubscription;
  };
};

type StripeCheckoutSession = {
  id?: string;
  payment_intent?: string | StripePaymentIntent | null;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string; status?: string; current_period_start?: number; current_period_end?: number } | null;
  customer_email?: string | null;
  customer_details?: {
    email?: string | null;
  } | null;
  metadata?: Record<string, string | null> | null;
  payment_status?: string | null;
  invoice?: string | (StripeInvoice & { id?: string }) | null;
  amount_total?: number | null;
  currency?: string | null;
  line_items?: StripeLineItems | null;
};

type StripeLineItems = {
  data?: Array<{
    price?: {
      id?: string;
    } | null;
  }>;
};

type StripeSubscription = {
  id?: string;
  customer?: string | { id?: string } | null;
  status?: string | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean | null;
  cancel_at?: number | null;
  canceled_at?: number | null;
  latest_invoice?: string | { id?: string } | null;
  items?: {
    data?: Array<{
      current_period_start?: number | null;
      current_period_end?: number | null;
      price?: {
        id?: string;
      } | null;
    }>;
  } | null;
};

type StripeInvoice = {
  id?: string;
  charge?: string | StripeCharge | null;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  status?: string | null;
  paid?: boolean;
  amount_paid?: number | null;
  amount_due?: number | null;
  currency?: string | null;
  customer_email?: string | null;
  next_payment_attempt?: number | null;
  period_start?: number | null;
  period_end?: number | null;
  last_finalization_error?: {
    message?: string | null;
  } | null;
  payment_intent?: string | StripePaymentIntent | {
    last_payment_error?: {
      code?: string | null;
      decline_code?: string | null;
      message?: string | null;
    } | null;
  } | null;
  lines?: {
    data?: Array<{
      period?: {
        start?: number | null;
        end?: number | null;
      } | null;
      price?: {
        id?: string;
      } | null;
    }>;
  } | null;
};

type StripePaymentIntent = {
  id?: string;
  last_payment_error?: {
    code?: string | null;
    decline_code?: string | null;
    message?: string | null;
  } | null;
  latest_charge?: string | StripeCharge | null;
  charges?: {
    data?: StripeCharge[];
  };
};

type StripeCharge = {
  id?: string;
  amount?: number | null;
  amount_refunded?: number | null;
  currency?: string | null;
  payment_intent?: string | null;
};

type StripeRefund = {
  id?: string;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  payment_intent?: string | null;
  charge?: string | null;
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
};

type VetoschoolProfile = {
  id: string;
  email: string;
  name?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

type VetoschoolRoleRow = {
  user_id: string;
  role: string;
};

type VetoschoolStripePayment = {
  id: string;
  user_id: string;
  checkout_session_id?: string | null;
  stripe_invoice_id?: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  plan_id: string;
  lesson_format: string;
  amount_total?: number | null;
  currency?: string | null;
  paid_at?: string | null;
  created_at: string;
};

type VetoschoolStripeRefund = {
  id: string;
  user_id: string;
  stripe_payment_id: string;
  stripe_refund_id: string;
  amount: number;
  currency: string;
  refund_type: string;
  reason: string;
  status: string;
  created_by_admin_id: string;
  created_at: string;
  updated_at: string;
};

type EmailNotificationType =
  | 'checkout.session.completed'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'customer.subscription.updated.cancel_at_period_end'
  | 'customer.subscription.updated.renewal_restored'
  | 'customer.subscription.deleted'
  | 'stripe.refund';

type EmailNotificationInput = {
  notificationKey: string;
  type: EmailNotificationType;
  userId?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  stripeEventId?: string | null;
  stripePaymentId?: string | null;
  stripeRefundId?: string | null;
  subject: string;
  preview: string;
  title: string;
  intro: string;
  rows: Array<{ label: string; value: string | null | undefined }>;
  cta?: { label: string; url: string | null | undefined };
  footer?: string;
};

type EmailNotificationRow = {
  id: string;
  notification_key: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';
};

type TelegramNotificationInput = {
  notificationKey: string;
  type: string;
  userId: string;
  text: string;
  stripeEventId?: string | null;
  stripeEventCreatedAt?: number | null;
  stripePaymentId?: string | null;
  stripeRefundId?: string | null;
};

type TelegramNotificationRow = {
  id: string;
  event_key: string;
  status: 'pending' | 'sent' | 'canceled' | 'failed';
};

type StripeWebhookLogStatus = 'processing' | 'processed' | 'failed' | 'ignored';

type StripeWebhookLogEvent = Required<Pick<StripeWebhookEvent, 'id' | 'type' | 'created' | 'livemode'>> & {
  data?: StripeWebhookEvent['data'];
};

type StripeWebhookLogReservation = {
  shouldProcess: boolean;
  duplicate: boolean;
  status: StripeWebhookLogStatus;
};

const localStripeWebhookEvents = new Map<string, StripeWebhookLogStatus>();

function stripeCreatedAt(event: Pick<StripeWebhookEvent, 'created'>) {
  return new Date((event.created || 0) * 1000).toISOString();
}

function normalizeStripeWebhookStatus(value: unknown): StripeWebhookLogStatus | undefined {
  if (value === 'processing' || value === 'processed' || value === 'failed' || value === 'ignored') return value;
  if (value === 'error') return 'failed';
  return undefined;
}

function processingStatusForLegacyColumn(status: StripeWebhookLogStatus) {
  if (status === 'failed') return 'error';
  return status;
}

function sanitizeStripeWebhookErrorMessage(message: string) {
  return message
    .replace(/sk_(test|live)_[A-Za-z0-9_]+/g, '[redacted_stripe_secret]')
    .replace(/whsec_[A-Za-z0-9_]+/g, '[redacted_webhook_secret]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted_email]')
    .slice(0, 1000);
}

function sanitizeEmailDeliveryError(message: string) {
  return sanitizeStripeWebhookErrorMessage(message)
    .replace(/sp_[A-Za-z0-9._-]+/g, '[redacted_sendpulse_token]')
    .slice(0, 1000);
}

function sanitizeTelegramDeliveryError(message: string) {
  return sanitizeStripeWebhookErrorMessage(message)
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot[redacted_telegram_token]')
    .replace(/\d{6,}:[A-Za-z0-9_-]+/g, '[redacted_telegram_token]')
    .slice(0, 1000);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function appBaseUrl(env: StripeCheckoutEnv) {
  return (env.APP_URL || 'https://vetoschool.eu').replace(/\/+$/, '');
}

function formatEmailDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatEmailMoney(amount?: number | null, currency?: string | null) {
  if (amount == null) return '—';
  const major = amount / 100;
  return `${major.toLocaleString('ru-RU')} ${(currency || '').toUpperCase()}`;
}

function formatTelegramDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatTelegramMoney(amount?: number | null, currency?: string | null) {
  return formatEmailMoney(amount, currency);
}

function planDisplayName(planId?: string | null) {
  const names: Record<string, string> = {
    'group-lite': 'Group Lite',
    'group-progress': 'Group Progress',
    'group-intensive': 'Group Intensive',
    'individual-lite': 'Individual Lite',
    'individual-progress': 'Individual Progress',
    'individual-intensive': 'Individual Intensive',
  };
  return planId ? names[planId] || planId : '—';
}

function lessonFormatLabel(value?: string | null) {
  if (value === 'group') return 'Group';
  if (value === 'individual') return 'Individual';
  return value || '—';
}

function studentDisplayName(profile?: VetoschoolProfile | null) {
  return profile?.name?.trim() || 'Ученик';
}

function adminDisplayName(profile?: VetoschoolProfile | null) {
  return profile?.name?.trim() || 'Администратор';
}

function telegramLines(lines: Array<[string, string | number | null | undefined]>) {
  return lines
    .filter(([, value]) => value != null && value !== '')
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
}

function renderVetoschoolEmail(input: EmailNotificationInput) {
  const rows = input.rows
    .filter(row => row.value != null && row.value !== '')
    .map(row => `
      <tr>
        <td style="padding:10px 0;color:#8b5fbf;font-size:14px;">${escapeHtml(row.label)}</td>
        <td style="padding:10px 0;color:#55307a;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(String(row.value))}</td>
      </tr>
    `).join('');
  const cta = input.cta?.url ? `
    <div style="margin-top:24px;text-align:center;">
      <a href="${escapeHtml(input.cta.url)}" style="display:inline-block;background:linear-gradient(135deg,#f472b6,#a78bfa);color:#ffffff;text-decoration:none;border-radius:999px;padding:13px 22px;font-weight:800;font-size:14px;">
        ${escapeHtml(input.cta.label)}
      </a>
    </div>
  ` : '';

  const html = `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>${escapeHtml(input.subject)}</title>
  </head>
  <body style="margin:0;background:#f8f1ff;font-family:Arial,Helvetica,sans-serif;color:#55307a;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(input.preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f1ff;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #eadcff;">
            <tr>
              <td style="background:linear-gradient(135deg,#a78bfa,#f472b6);padding:24px;color:#ffffff;">
                <div style="font-size:24px;font-weight:900;letter-spacing:.2px;">Vetoschool</div>
                <div style="font-size:14px;opacity:.9;margin-top:4px;">English learning subscription</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px;">
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#55307a;">${escapeHtml(input.title)}</h1>
                <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#6f4b95;">${escapeHtml(input.intro)}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #eadcff;border-bottom:1px solid #eadcff;">
                  ${rows}
                </table>
                ${cta}
                <p style="margin:24px 0 0;font-size:13px;line-height:1.55;color:#9b7abc;">
                  ${escapeHtml(input.footer || 'Если у вас есть вопросы, просто ответьте на это письмо или напишите администратору Vetoschool.')}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    'Vetoschool',
    input.title,
    input.intro,
    ...input.rows.filter(row => row.value != null && row.value !== '').map(row => `${row.label}: ${row.value}`),
    input.cta?.url ? `${input.cta.label}: ${input.cta.url}` : '',
    input.footer || '',
  ].filter(Boolean).join('\n\n');

  return { html, text };
}

function logStripeWebhookSupabaseDebug(details: {
  stage: string;
  table?: string;
  rpc?: string;
  status?: number | null;
  supabaseCode?: string | null;
}) {
  console.warn('[Stripe webhook Supabase debug]', {
    stage: details.stage,
    table: details.table || null,
    rpc: details.rpc || null,
    status: details.status ?? null,
    supabaseCode: details.supabaseCode || null,
  });
}

// PostgREST maps plpgsql RAISE (and trigger errors) to HTTP 400 with the real
// reason in the JSON body. Surface it instead of a bare status code.
async function readSupabaseRpcFailure(response: Response): Promise<{ code: string | null; detail: string }> {
  const raw = await response.clone().text().catch(() => '');
  try {
    const payload = JSON.parse(raw) as { code?: string; message?: string; details?: string; hint?: string };
    const detail = [payload.code, payload.message, payload.details, payload.hint].filter(Boolean).join(' | ');
    return { code: payload.code || payload.message || null, detail: detail || raw.slice(0, 500) };
  } catch {
    return { code: null, detail: raw.slice(0, 500) };
  }
}


function reserveLocalStripeWebhookEvent(event: StripeWebhookLogEvent): StripeWebhookLogReservation {
  const existingStatus = localStripeWebhookEvents.get(event.id);
  if (existingStatus === 'processed' || existingStatus === 'processing') {
    return {
      shouldProcess: false,
      duplicate: true,
      status: existingStatus,
    };
  }

  localStripeWebhookEvents.set(event.id, 'processing');
  console.info('Stripe webhook event reserved without database log', {
    eventId: event.id,
    eventType: event.type,
    created: event.created,
    livemode: event.livemode,
    status: 'processing',
  });

  return {
    shouldProcess: true,
    duplicate: false,
    status: 'processing',
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function isPricingPlanId(value: string | undefined): value is PricingPlanId {
  return Boolean(value && value in stripePriceIdsByPlan);
}

function normalizeStripeId(value: string | { id?: string } | null | undefined) {
  if (typeof value === 'string') return value;
  return value?.id || '';
}

function asStripeCheckoutSession(value: unknown) {
  return value as StripeCheckoutSession | undefined;
}

function asStripeInvoice(value: unknown) {
  return value as StripeInvoice | undefined;
}

function asStripeSubscription(value: unknown) {
  return value as StripeSubscription | undefined;
}

function stripeTimestampToIso(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function checkoutSuccessUrlWithSessionId(successUrl: string) {
  const separator = successUrl.includes('?') ? '&' : '?';
  return `${successUrl}${separator}session_id={CHECKOUT_SESSION_ID}`;
}

function supabaseHeaders(env: StripeCheckoutEnv) {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('supabase_service_role_key_missing');

  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    'content-type': 'application/json',
  };
}

function supabaseUserHeaders(env: StripeCheckoutEnv, accessToken: string) {
  const apiKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey) throw new Error('supabase_auth_key_missing');

  return {
    apikey: apiKey,
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
  };
}

function requireSupabaseUrl(env: StripeCheckoutEnv) {
  const supabaseUrl = env.SUPABASE_URL;
  if (!supabaseUrl) throw new Error('supabase_url_missing');
  return supabaseUrl.replace(/\/+$/, '');
}

function authorizationBearerToken(request: Request) {
  return request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
}

async function readCheckoutBody(request: Request): Promise<CheckoutRequestBody> {
  try {
    return (await request.json()) as CheckoutRequestBody;
  } catch {
    return {};
  }
}

async function readStripeRefundBody(request: Request): Promise<StripeRefundRequestBody> {
  try {
    return (await request.json()) as StripeRefundRequestBody;
  } catch {
    return {};
  }
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string) {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false;
  const aBytes = hexToBytes(a);
  const bBytes = hexToBytes(b);
  let diff = aBytes.length ^ bBytes.length;
  const length = Math.max(aBytes.length, bBytes.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (aBytes[index] || 0) ^ (bBytes[index] || 0);
  }
  return diff === 0;
}

function parseStripeSignature(signatureHeader: string | null) {
  const parts = (signatureHeader || '').split(',').map(part => part.trim());
  const timestamp = parts.find(part => part.startsWith('t='))?.slice(2);
  const signatures = parts.filter(part => part.startsWith('v1=')).map(part => part.slice(3));
  return { timestamp, signatures };
}

async function computeStripeSignature(timestamp: string, rawBody: string, webhookSecret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`));
  return bytesToHex(signature);
}

async function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string | null, webhookSecret: string) {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || !signatures.length) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > STRIPE_WEBHOOK_TOLERANCE_SECONDS) return false;

  const expectedSignature = await computeStripeSignature(timestamp, rawBody, webhookSecret);
  return signatures.some(signature => constantTimeEqual(signature, expectedSignature));
}

async function requireAuthenticatedCheckoutUser(request: Request, env: StripeCheckoutEnv): Promise<SupabaseAuthUser> {
  const token = authorizationBearerToken(request);
  if (!token) throw new Error('checkout_auth_required');

  const supabaseUrl = requireSupabaseUrl(env);

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: supabaseUserHeaders(env, token),
  });

  if (!response.ok) throw new Error('checkout_auth_invalid');

  const user = await response.json() as SupabaseAuthUser;
  if (!user.id) throw new Error('checkout_auth_invalid');
  return user;
}

async function requireAdminUser(request: Request, env: StripeCheckoutEnv): Promise<SupabaseAuthUser> {
  const authUser = await requireAuthenticatedCheckoutUser(request, env);
  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(
    `${supabaseUrl}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(authUser.id || '')}&role=eq.admin&select=user_id,role&limit=1`,
    { headers: supabaseHeaders(env) },
  );

  if (!response.ok) throw new Error(`admin_role_lookup_failed_${response.status}`);

  const rows = await response.json() as VetoschoolRoleRow[];
  if (!rows.length) throw new Error('admin_required');
  return authUser;
}

async function loadProfileById(userId: string, env: StripeCheckoutEnv, accessToken?: string): Promise<VetoschoolProfile | null> {
  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,name,stripe_customer_id,stripe_subscription_id&limit=1`,
    { headers: accessToken ? supabaseUserHeaders(env, accessToken) : supabaseHeaders(env) },
  );

  if (!response.ok) throw new Error(`profile_lookup_failed_${response.status}`);

  const rows = await response.json() as VetoschoolProfile[];
  return rows[0] || null;
}

async function loadStripePaymentById(stripePaymentId: string, env: StripeCheckoutEnv): Promise<VetoschoolStripePayment | null> {
  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(
    `${supabaseUrl}/rest/v1/stripe_payments?id=eq.${encodeURIComponent(stripePaymentId)}&select=id,user_id,checkout_session_id,stripe_invoice_id,stripe_customer_id,stripe_subscription_id,stripe_payment_intent_id,stripe_charge_id,plan_id,lesson_format,amount_total,currency,paid_at,created_at&limit=1`,
    { headers: supabaseHeaders(env) },
  );

  if (!response.ok) throw new Error(`stripe_payment_lookup_failed_${response.status}`);

  const rows = await response.json() as VetoschoolStripePayment[];
  return rows[0] || null;
}

async function loadStripeRefundByIdempotencyKey(idempotencyKey: string, env: StripeCheckoutEnv): Promise<VetoschoolStripeRefund | null> {
  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(
    `${supabaseUrl}/rest/v1/stripe_refunds?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,user_id,stripe_payment_id,stripe_refund_id,amount,currency,refund_type,reason,status,created_by_admin_id,created_at,updated_at&limit=1`,
    { headers: supabaseHeaders(env) },
  );

  if (!response.ok) throw new Error(`stripe_refund_lookup_failed_${response.status}`);

  const rows = await response.json() as VetoschoolStripeRefund[];
  return rows[0] || null;
}

async function loadProfileByEmail(email: string, env: StripeCheckoutEnv): Promise<VetoschoolProfile | null> {
  const supabaseUrl = requireSupabaseUrl(env);
  const normalizedEmail = email.trim().toLowerCase();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,email,name,stripe_customer_id&limit=2`,
    { headers: supabaseHeaders(env) },
  );

  if (!response.ok) throw new Error(`profile_email_lookup_failed_${response.status}`);

  const rows = await response.json() as VetoschoolProfile[];
  if (rows.length !== 1) return null;
  return rows[0];
}

async function loadProfileByStripeSubscription(customerId: string, subscriptionId: string, env: StripeCheckoutEnv): Promise<VetoschoolProfile | null> {
  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(
    `${supabaseUrl}/rest/v1/profiles?stripe_customer_id=eq.${encodeURIComponent(customerId)}&stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}&select=id,email,name,stripe_customer_id,stripe_subscription_id&limit=1`,
    { headers: supabaseHeaders(env) },
  );

  if (!response.ok) throw new Error(`profile_stripe_subscription_lookup_failed_${response.status}`);

  const rows = await response.json() as VetoschoolProfile[];
  return rows[0] || null;
}

async function loadProfileByStripeCustomer(customerId: string, env: StripeCheckoutEnv): Promise<VetoschoolProfile | null> {
  if (!customerId) return null;
  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(
    `${supabaseUrl}/rest/v1/profiles?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=id,email,name,stripe_customer_id,stripe_subscription_id&limit=1`,
    { headers: supabaseHeaders(env) },
  );
  if (!response.ok) throw new Error(`profile_stripe_customer_lookup_failed_${response.status}`);
  const rows = await response.json() as VetoschoolProfile[];
  return rows[0] || null;
}

async function loadProfileFromStripeMetadata(...args: Array<unknown>): Promise<VetoschoolProfile | null> {
  const env = args[args.length - 1] as StripeCheckoutEnv;
  for (const source of args.slice(0, -1)) {
    const userId = (source as Record<string, any> | undefined)?.metadata?.user_id;
    if (typeof userId === 'string' && userId) {
      const profile = await loadProfileById(userId, env);
      if (profile) return profile;
    }
  }
  return null;
}

async function stripeApiGet<T>(path: string, env: StripeCheckoutEnv): Promise<T> {
  if (!env.STRIPE_SECRET_KEY) throw new Error('stripe_secret_key_missing');

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    },
  });

  if (!response.ok) throw new Error(`stripe_api_get_failed_${response.status}`);
  return await response.json() as T;
}

async function stripeApiPostForm<T>(path: string, body: URLSearchParams, env: StripeCheckoutEnv, idempotencyKey?: string): Promise<T> {
  if (!env.STRIPE_SECRET_KEY) throw new Error('stripe_secret_key_missing');

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
    body,
  });

  if (!response.ok) throw new Error(`stripe_api_post_failed_${response.status}`);
  return await response.json() as T;
}

async function createStripeCustomerForProfile(profile: VetoschoolProfile, authUser: SupabaseAuthUser, env: StripeCheckoutEnv) {
  const body = new URLSearchParams({
    'metadata[user_id]': authUser.id || profile.id,
    'metadata[profile_id]': profile.id,
    'metadata[source]': 'vetoschool',
  });
  const email = profile.email || authUser.email || '';
  if (email) body.set('email', email);
  if (profile.name) body.set('name', profile.name);

  const payload = await stripeApiPostForm<{ id?: string }>('/customers', body, env, `vetoschool-customer-${profile.id}`);
  if (!payload.id) throw new Error('stripe_customer_creation_failed');
  return payload.id;
}

async function saveStripeCustomerId(profileId: string, customerId: string, env: StripeCheckoutEnv) {
  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}`,
    {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(env),
        prefer: 'return=minimal',
      },
      body: JSON.stringify({ stripe_customer_id: customerId }),
    },
  );

  if (!response.ok) throw new Error(`profile_customer_update_failed_${response.status}`);
}

function asStripePaymentIntent(value: StripeInvoice['payment_intent'] | StripeCheckoutSession['payment_intent']) {
  return typeof value === 'object' && value && 'id' in value ? value as StripePaymentIntent : null;
}

function asStripeCharge(value: string | StripeCharge | null | undefined) {
  return typeof value === 'object' && value && 'id' in value ? value : null;
}

function firstChargeFromPaymentIntent(paymentIntent: StripePaymentIntent | null) {
  return asStripeCharge(paymentIntent?.latest_charge) || paymentIntent?.charges?.data?.[0] || null;
}

async function loadStripePaymentIntent(paymentIntentId: string, env: StripeCheckoutEnv) {
  return stripeApiGet<StripePaymentIntent>(
    `/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge`,
    env,
  );
}

async function loadStripeInvoiceWithPaymentSource(invoiceId: string, env: StripeCheckoutEnv) {
  return stripeApiGet<StripeInvoice>(
    `/invoices/${encodeURIComponent(invoiceId)}?expand[]=payment_intent.latest_charge&expand[]=charge`,
    env,
  );
}

async function loadStripeCheckoutSessionWithPaymentSource(sessionId: string, env: StripeCheckoutEnv) {
  return stripeApiGet<StripeCheckoutSession>(
    `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=invoice.payment_intent.latest_charge&expand[]=payment_intent.latest_charge`,
    env,
  );
}

async function resolveStripeRefundPaymentSource(payment: VetoschoolStripePayment, env: StripeCheckoutEnv) {
  let paymentIntentId = payment.stripe_payment_intent_id || '';
  let charge = payment.stripe_charge_id ? ({ id: payment.stripe_charge_id } as StripeCharge) : null;

  if ((!paymentIntentId || !charge?.amount) && payment.stripe_invoice_id) {
    const invoice = await loadStripeInvoiceWithPaymentSource(payment.stripe_invoice_id, env);
    const invoicePaymentIntent = asStripePaymentIntent(invoice.payment_intent);
    paymentIntentId = paymentIntentId || invoicePaymentIntent?.id || normalizeStripeId(invoice.payment_intent as string | { id?: string } | null);
    charge = asStripeCharge(invoice.charge) || firstChargeFromPaymentIntent(invoicePaymentIntent) || charge;
  }

  if ((!paymentIntentId || !charge?.amount) && payment.checkout_session_id) {
    const session = await loadStripeCheckoutSessionWithPaymentSource(payment.checkout_session_id, env);
    const sessionPaymentIntent = asStripePaymentIntent(session.payment_intent);
    const sessionInvoice = typeof session.invoice === 'object' ? session.invoice : null;
    const invoicePaymentIntent = asStripePaymentIntent(sessionInvoice?.payment_intent);
    paymentIntentId = paymentIntentId || sessionPaymentIntent?.id || invoicePaymentIntent?.id || normalizeStripeId(session.payment_intent as string | { id?: string } | null);
    charge = firstChargeFromPaymentIntent(sessionPaymentIntent) || firstChargeFromPaymentIntent(invoicePaymentIntent) || charge;
  }

  if (paymentIntentId && !charge?.amount) {
    const paymentIntent = await loadStripePaymentIntent(paymentIntentId, env);
    paymentIntentId = paymentIntent.id || paymentIntentId;
    charge = firstChargeFromPaymentIntent(paymentIntent) || charge;
  }

  const chargeId = charge?.id || payment.stripe_charge_id || '';
  if (!paymentIntentId && charge?.payment_intent) paymentIntentId = charge.payment_intent;
  if (!paymentIntentId && !chargeId) throw new Error('stripe_refund_payment_source_not_found');

  const amount = charge?.amount ?? payment.amount_total ?? 0;
  const amountRefunded = charge?.amount_refunded ?? 0;
  const availableAmount = Math.max(0, amount - amountRefunded);
  const currency = (charge?.currency || payment.currency || '').toLowerCase();

  return {
    paymentIntentId,
    chargeId,
    amount,
    availableAmount,
    currency,
  };
}

async function saveStripeRefund(params: {
  payment: VetoschoolStripePayment;
  stripeRefund: StripeRefund;
  refundType: 'full' | 'partial';
  reason: string;
  adminUserId: string;
  idempotencyKey: string;
  paymentIntentId: string;
  chargeId: string;
}, env: StripeCheckoutEnv) {
  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(`${supabaseUrl}/rest/v1/stripe_refunds`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(env),
      prefer: 'return=representation',
    },
    body: JSON.stringify({
      user_id: params.payment.user_id,
      stripe_payment_id: params.payment.id,
      stripe_refund_id: params.stripeRefund.id,
      stripe_payment_intent_id: params.paymentIntentId || params.stripeRefund.payment_intent || null,
      stripe_charge_id: params.chargeId || params.stripeRefund.charge || null,
      idempotency_key: params.idempotencyKey,
      amount: params.stripeRefund.amount,
      currency: (params.stripeRefund.currency || params.payment.currency || '').toLowerCase(),
      refund_type: params.refundType,
      reason: params.reason,
      status: params.stripeRefund.status || 'pending',
      created_by_admin_id: params.adminUserId,
    }),
  });

  if (response.status === 409) {
    const existingRefund = await loadStripeRefundByIdempotencyKey(params.idempotencyKey, env);
    if (existingRefund) return { refund: existingRefund, duplicate: true };
  }

  if (!response.ok) throw new Error(`stripe_refund_save_failed_${response.status}`);

  const rows = await response.json() as VetoschoolStripeRefund[];
  return { refund: rows[0], duplicate: false };
}

async function updateStripePaymentSourceIds(paymentId: string, paymentIntentId: string, chargeId: string, env: StripeCheckoutEnv) {
  if (!paymentIntentId && !chargeId) return;

  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(`${supabaseUrl}/rest/v1/stripe_payments?id=eq.${encodeURIComponent(paymentId)}`, {
    method: 'PATCH',
    headers: {
      ...supabaseHeaders(env),
      prefer: 'return=minimal',
    },
    body: JSON.stringify({
      ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
      ...(chargeId ? { stripe_charge_id: chargeId } : {}),
    }),
  });

  if (!response.ok) throw new Error(`stripe_payment_source_update_failed_${response.status}`);
}

async function reserveEmailNotification(input: EmailNotificationInput, env: StripeCheckoutEnv): Promise<EmailNotificationRow | null> {
  const recipientEmail = input.recipientEmail?.trim().toLowerCase();
  if (!recipientEmail) return null;

  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(`${supabaseUrl}/rest/v1/email_notifications`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(env),
      prefer: 'return=representation',
    },
    body: JSON.stringify({
      notification_key: input.notificationKey,
      user_id: input.userId || null,
      recipient_email: recipientEmail,
      recipient_name: input.recipientName || null,
      notification_type: input.type,
      stripe_event_id: input.stripeEventId || null,
      stripe_payment_id: input.stripePaymentId || null,
      stripe_refund_id: input.stripeRefundId || null,
      subject: input.subject,
      provider: 'sendpulse',
      status: 'processing',
      payload: {
        preview: input.preview,
        title: input.title,
        rows: input.rows,
        hasCta: Boolean(input.cta?.url),
      },
    }),
  });

  if (response.status === 409) return null;
  if (!response.ok) throw new Error(`email_notification_reserve_failed_${response.status}`);

  const rows = await response.json() as EmailNotificationRow[];
  return rows[0] || null;
}

async function updateEmailNotification(notificationId: string, status: 'sent' | 'failed' | 'skipped', env: StripeCheckoutEnv, details?: {
  errorMessage?: string | null;
  providerMessageId?: string | null;
}) {
  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(`${supabaseUrl}/rest/v1/email_notifications?id=eq.${encodeURIComponent(notificationId)}`, {
    method: 'PATCH',
    headers: {
      ...supabaseHeaders(env),
      prefer: 'return=minimal',
    },
    body: JSON.stringify({
      status,
      error_message: details?.errorMessage ? sanitizeEmailDeliveryError(details.errorMessage) : null,
      provider_message_id: details?.providerMessageId || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    }),
  });

  if (!response.ok) throw new Error(`email_notification_update_failed_${response.status}`);
}

async function getSendPulseEmailToken(env: StripeCheckoutEnv) {
  if (!env.SENDPULSE_CLIENT_ID || !env.SENDPULSE_CLIENT_SECRET) {
    throw new Error('sendpulse_email_credentials_missing');
  }

  const response = await fetch('https://api.sendpulse.com/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: env.SENDPULSE_CLIENT_ID,
      client_secret: env.SENDPULSE_CLIENT_SECRET,
    }),
  });
  const payload = await response.json().catch(() => ({})) as { access_token?: string; message?: string; error_description?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.message || payload.error_description || `sendpulse_auth_failed_${response.status}`);
  return payload.access_token;
}

async function sendViaSendPulseEmail(input: EmailNotificationInput, env: StripeCheckoutEnv) {
  const fromEmail = env.SENDPULSE_FROM_EMAIL || 'vetoschool.english@gmail.com';
  const fromName = env.SENDPULSE_FROM_NAME || 'Vetoschool';
  const token = await getSendPulseEmailToken(env);
  const rendered = renderVetoschoolEmail(input);
  const endpoint = env.SENDPULSE_EMAIL_ENDPOINT || 'https://api.sendpulse.com/smtp/emails';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: {
        subject: input.subject,
        from: { name: fromName, email: fromEmail },
        to: [{ email: input.recipientEmail, name: input.recipientName || undefined }],
        html: rendered.html,
        text: rendered.text,
      },
    }),
  });

  const payload = await response.json().catch(() => ({})) as { id?: string; message_id?: string; result?: { id?: string } };
  if (!response.ok) throw new Error(`sendpulse_email_failed_${response.status}`);
  return payload.id || payload.message_id || payload.result?.id || null;
}

async function sendEmailNotificationSafe(input: EmailNotificationInput, env: StripeCheckoutEnv) {
  try {
    const reserved = await reserveEmailNotification(input, env);
    if (!reserved) return;

    try {
      const providerMessageId = await sendViaSendPulseEmail(input, env);
      await updateEmailNotification(reserved.id, 'sent', env, { providerMessageId });
    } catch (error) {
      await updateEmailNotification(reserved.id, 'failed', env, {
        errorMessage: error instanceof Error ? error.message : 'email_send_failed',
      });
    }
  } catch (error) {
    console.warn('[Stripe email notification skipped]', {
      type: input.type,
      eventId: input.stripeEventId || null,
      reason: error instanceof Error ? sanitizeEmailDeliveryError(error.message) : 'unknown',
    });
  }
}

function telegramAdminChatIds(env: StripeCheckoutEnv) {
  const raw = [
    env.TELEGRAM_ADMIN_CHAT_ID,
    ...(env.TELEGRAM_ADMIN_CHAT_IDS || '').split(','),
  ];

  return [...new Set(raw.map(value => value?.trim()).filter(Boolean) as string[])];
}

function stripeTelegramNotificationWindowSeconds(env: StripeCheckoutEnv) {
  const value = Number(env.STRIPE_TELEGRAM_NOTIFICATION_WINDOW_SECONDS);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_STRIPE_TELEGRAM_NOTIFICATION_WINDOW_SECONDS;
}

function isHistoricalStripeTelegramNotification(input: TelegramNotificationInput, env: StripeCheckoutEnv) {
  if (!input.stripeEventCreatedAt) return false;
  return Math.floor(Date.now() / 1000) - input.stripeEventCreatedAt > stripeTelegramNotificationWindowSeconds(env);
}

async function reserveTelegramNotification(input: TelegramNotificationInput, chatLabel: string, chatId: string, env: StripeCheckoutEnv): Promise<TelegramNotificationRow | null> {
  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(`${supabaseUrl}/rest/v1/telegram_notifications`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(env),
      prefer: 'return=representation',
    },
    body: JSON.stringify({
      event_key: `${input.notificationKey}:telegram:${input.type}:${chatId}`,
      notification_type: input.type,
      student_id: input.userId,
      parent_id: null,
      recipient_type: 'admin',
      recipient_label: chatLabel,
      provider: 'telegram',
      scheduled_for: new Date().toISOString(),
      status: 'pending',
      payload: {
        kind: 'stripe_admin_notification',
        stripeEventId: input.stripeEventId || null,
        stripeEventCreatedAt: input.stripeEventCreatedAt || null,
        stripePaymentId: input.stripePaymentId || null,
        stripeRefundId: input.stripeRefundId || null,
        telegramChatId: chatId,
        preview: input.text.split('\n').slice(0, 2).join(' '),
      },
    }),
  });

  if (response.status === 409) return null;
  if (!response.ok) throw new Error(`telegram_notification_reserve_failed_${response.status}`);

  const rows = await response.json() as TelegramNotificationRow[];
  return rows[0] || null;
}

async function updateTelegramNotification(notificationId: string, status: 'sent' | 'failed', env: StripeCheckoutEnv, errorMessage?: string | null) {
  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(`${supabaseUrl}/rest/v1/telegram_notifications?id=eq.${encodeURIComponent(notificationId)}`, {
    method: 'PATCH',
    headers: {
      ...supabaseHeaders(env),
      prefer: 'return=minimal',
    },
    body: JSON.stringify({
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      error: errorMessage ? sanitizeTelegramDeliveryError(errorMessage) : null,
      attempts: 1,
    }),
  });

  if (!response.ok) throw new Error(`telegram_notification_update_failed_${response.status}`);
}

async function sendDirectTelegramAdminMessage(chatId: string, text: string, env: StripeCheckoutEnv) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('telegram_bot_token_missing');

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) throw new Error(`telegram_send_failed_${response.status}`);
}

async function sendTelegramNotificationSafe(input: TelegramNotificationInput, env: StripeCheckoutEnv) {
  if (isHistoricalStripeTelegramNotification(input, env)) {
    console.warn('[Stripe Telegram notification skipped]', {
      type: input.type,
      eventId: input.stripeEventId || null,
      reason: 'historical_stripe_event',
    });
    return;
  }

  const chatIds = telegramAdminChatIds(env);
  if (!env.TELEGRAM_BOT_TOKEN || chatIds.length === 0) {
    console.warn('[Stripe Telegram notification skipped]', {
      type: input.type,
      eventId: input.stripeEventId || null,
      reason: !env.TELEGRAM_BOT_TOKEN ? 'telegram_bot_token_missing' : 'telegram_admin_chat_id_missing',
    });
    return;
  }

  await Promise.all(chatIds.map(async (chatId, index) => {
    const chatLabel = `admin_${index + 1}`;
    try {
      const reserved = await reserveTelegramNotification(input, chatLabel, chatId, env);
      if (!reserved) return;

      try {
        await sendDirectTelegramAdminMessage(chatId, input.text, env);
        await updateTelegramNotification(reserved.id, 'sent', env);
      } catch (error) {
        await updateTelegramNotification(reserved.id, 'failed', env, error instanceof Error ? error.message : 'telegram_send_failed');
      }
    } catch (error) {
      console.warn('[Stripe Telegram notification skipped]', {
        type: input.type,
        eventId: input.stripeEventId || null,
        reason: error instanceof Error ? sanitizeTelegramDeliveryError(error.message) : 'unknown',
      });
    }
  }));
}

async function loadCheckoutSessionLineItems(sessionId: string, env: StripeCheckoutEnv) {
  return stripeApiGet<StripeLineItems>(
    `/checkout/sessions/${encodeURIComponent(sessionId)}/line_items?limit=1&expand[]=data.price`,
    env,
  );
}

async function loadStripeSubscription(subscriptionId: string, env: StripeCheckoutEnv) {
  return stripeApiGet<StripeSubscription>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}?expand[]=items.data.price&expand[]=latest_invoice`,
    env,
  );
}

async function resolveCheckoutProfile(session: StripeCheckoutSession, customerEmail: string, customerId: string, env: StripeCheckoutEnv) {
  const metadataUserId = session.metadata?.user_id?.trim();
  if (metadataUserId) {
    const profile = await loadProfileById(metadataUserId, env);
    if (!profile) throw new Error('checkout_profile_not_found');
    return profile;
  }

  if (!customerEmail) throw new Error('checkout_user_id_missing');

  const profile = await loadProfileByEmail(customerEmail, env);
  if (!profile) throw new Error('checkout_profile_email_fallback_not_found');
  if (!profile.stripe_customer_id || profile.stripe_customer_id !== customerId) {
    throw new Error('checkout_email_fallback_not_verified');
  }

  return profile;
}

async function applyStripeCheckoutCompletedPayment(params: {
  userId: string;
  eventId: string;
  checkoutSessionId: string;
  stripeInvoiceId: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  subscriptionStatus: string;
  planId: PricingPlanId;
  lessonFormat: string;
  lessonsTotal: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextPaymentDate: string | null;
  customerEmail: string | null;
  amountTotal: number | null;
  currency: string | null;
}, env: StripeCheckoutEnv) {
  const supabaseUrl = requireSupabaseUrl(env);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    logStripeWebhookSupabaseDebug({
      stage: 'checkout_completed_apply',
      rpc: 'apply_stripe_subscription_payment',
      status: null,
      supabaseCode: 'missing_service_role_key',
    });
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_stripe_subscription_payment`, {
    method: 'POST',
    headers: supabaseHeaders(env),
    body: JSON.stringify({
      p_user_id: params.userId,
      p_event_type: 'checkout.session.completed',
      p_stripe_event_id: params.eventId,
      p_checkout_session_id: params.checkoutSessionId,
      p_stripe_invoice_id: params.stripeInvoiceId,
      p_stripe_customer_id: params.stripeCustomerId,
      p_stripe_subscription_id: params.stripeSubscriptionId,
      p_stripe_price_id: params.stripePriceId,
      p_subscription_status: params.subscriptionStatus,
      p_plan_id: params.planId,
      p_lesson_format: params.lessonFormat,
      p_lessons_total: params.lessonsTotal,
      p_current_period_start: params.currentPeriodStart,
      p_current_period_end: params.currentPeriodEnd,
      p_next_payment_date: params.nextPaymentDate,
      p_customer_email: params.customerEmail,
      p_amount_total: params.amountTotal,
      p_currency: params.currency,
    }),
  });

  if (!response.ok) {
    const failure = await readSupabaseRpcFailure(response);
    logStripeWebhookSupabaseDebug({
      stage: 'checkout_completed_apply',
      rpc: 'apply_stripe_subscription_payment',
      status: response.status,
      supabaseCode: failure.code,
    });
    throw new Error(`stripe_checkout_apply_failed_${response.status}: ${failure.detail}`);
  }


  return await response.json().catch(() => []) as Array<{ payment_inserted?: boolean; lessons_remaining?: number }>;
}

async function applyStripeInvoicePaidPayment(params: {
  userId: string;
  eventId: string;
  stripeInvoiceId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  subscriptionStatus: string;
  planId: PricingPlanId;
  lessonFormat: string;
  lessonsTotal: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextPaymentDate: string | null;
  customerEmail: string | null;
  amountTotal: number | null;
  currency: string | null;
}, env: StripeCheckoutEnv) {
  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_stripe_subscription_payment`, {
    method: 'POST',
    headers: supabaseHeaders(env),
    body: JSON.stringify({
      p_user_id: params.userId,
      p_event_type: 'invoice.paid',
      p_stripe_event_id: params.eventId,
      p_checkout_session_id: null,
      p_stripe_invoice_id: params.stripeInvoiceId,
      p_stripe_customer_id: params.stripeCustomerId,
      p_stripe_subscription_id: params.stripeSubscriptionId,
      p_stripe_price_id: params.stripePriceId,
      p_subscription_status: params.subscriptionStatus,
      p_plan_id: params.planId,
      p_lesson_format: params.lessonFormat,
      p_lessons_total: params.lessonsTotal,
      p_current_period_start: params.currentPeriodStart,
      p_current_period_end: params.currentPeriodEnd,
      p_next_payment_date: params.nextPaymentDate,
      p_customer_email: params.customerEmail,
      p_amount_total: params.amountTotal,
      p_currency: params.currency,
    }),
  });

  if (!response.ok) {
    const failure = await readSupabaseRpcFailure(response);
    logStripeWebhookSupabaseDebug({ stage: 'invoice_paid_apply', rpc: 'apply_stripe_subscription_payment', status: response.status, supabaseCode: failure.code });
    throw new Error(`stripe_invoice_apply_failed_${response.status}: ${failure.detail}`);
  }
  return await response.json().catch(() => []) as Array<{ payment_inserted?: boolean; lessons_remaining?: number }>;
}

async function applyStripeInvoicePaymentFailed(params: {
  userId: string;
  eventId: string;
  stripeInvoiceId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: string;
  paymentFailedAt: string;
  nextPaymentDate: string | null;
  amountDue: number | null;
  currency: string | null;
  failureReason: string | null;
}, env: StripeCheckoutEnv) {
  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_stripe_invoice_payment_failed`, {
    method: 'POST',
    headers: supabaseHeaders(env),
    body: JSON.stringify({
      p_user_id: params.userId,
      p_stripe_event_id: params.eventId,
      p_stripe_invoice_id: params.stripeInvoiceId,
      p_stripe_customer_id: params.stripeCustomerId,
      p_stripe_subscription_id: params.stripeSubscriptionId,
      p_subscription_status: params.subscriptionStatus,
      p_payment_failed_at: params.paymentFailedAt,
      p_next_payment_date: params.nextPaymentDate,
      p_amount_due: params.amountDue,
      p_currency: params.currency,
      p_failure_reason: params.failureReason,
    }),
  });

  if (!response.ok) {
    const failure = await readSupabaseRpcFailure(response);
    logStripeWebhookSupabaseDebug({ stage: 'invoice_payment_failed_apply', rpc: 'apply_stripe_invoice_payment_failed', status: response.status, supabaseCode: failure.code });
    throw new Error(`stripe_invoice_failed_apply_failed_${response.status}: ${failure.detail}`);
  }
  return await response.json().catch(() => []) as Array<{ failure_inserted?: boolean; lessons_remaining?: number }>;
}

async function applyStripeSubscriptionState(params: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextPaymentDate: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  stripePriceId: string | null;
  planId: PricingPlanId | null;
  lessonFormat: string | null;
}, env: StripeCheckoutEnv) {
  const supabaseUrl = requireSupabaseUrl(env);
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_stripe_subscription_state`, {
    method: 'POST',
    headers: supabaseHeaders(env),
    body: JSON.stringify({
      p_user_id: params.userId,
      p_stripe_customer_id: params.stripeCustomerId,
      p_stripe_subscription_id: params.stripeSubscriptionId,
      p_subscription_status: params.subscriptionStatus,
      p_current_period_start: params.currentPeriodStart,
      p_current_period_end: params.currentPeriodEnd,
      p_next_payment_date: params.nextPaymentDate,
      p_cancel_at_period_end: params.cancelAtPeriodEnd,
      p_canceled_at: params.canceledAt,
      p_stripe_price_id: params.stripePriceId,
      p_plan_id: params.planId,
      p_lesson_format: params.lessonFormat,
    }),
  });

  if (!response.ok) {
    const failure = await readSupabaseRpcFailure(response);
    logStripeWebhookSupabaseDebug({ stage: 'subscription_state_apply', rpc: 'apply_stripe_subscription_state', status: response.status, supabaseCode: failure.code });
    throw new Error(`stripe_subscription_state_apply_failed_${response.status}: ${failure.detail}`);
  }
  return await response.json().catch(() => []) as Array<{ lessons_remaining?: number }>;
}

async function reserveStripeWebhookEvent(event: StripeWebhookLogEvent, env: StripeCheckoutEnv): Promise<StripeWebhookLogReservation> {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    logStripeWebhookSupabaseDebug({
      stage: 'webhook_event_reserve',
      table: 'stripe_webhook_events',
      status: null,
      supabaseCode: !supabaseUrl ? 'missing_supabase_url' : 'missing_service_role_key',
    });
    return reserveLocalStripeWebhookEvent(event);
  }

  try {
    const headers = {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
    };
    const selectResponse = await fetch(
      `${supabaseUrl}/rest/v1/stripe_webhook_events?event_id=eq.${encodeURIComponent(event.id)}&select=event_id,status,processing_status&limit=1`,
      { headers },
    );

    if (!selectResponse.ok) {
      logStripeWebhookSupabaseDebug({
        stage: 'webhook_event_select',
        table: 'stripe_webhook_events',
        status: selectResponse.status,
        supabaseCode: null,
      });
      throw new Error(`stripe_webhook_log_select_failed_${selectResponse.status}`);
    }

    const rows = await selectResponse.json() as Array<{ status?: string; processing_status?: string }>;
    const existingStatus = normalizeStripeWebhookStatus(rows[0]?.status) || normalizeStripeWebhookStatus(rows[0]?.processing_status);

    if (existingStatus === 'processed' || existingStatus === 'processing') {
      return {
        shouldProcess: false,
        duplicate: true,
        status: existingStatus,
      };
    }

    if (existingStatus === 'failed') {
      const retryResponse = await fetch(`${supabaseUrl}/rest/v1/stripe_webhook_events?event_id=eq.${encodeURIComponent(event.id)}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status: 'processing',
          processing_status: 'processing',
          error_message: null,
          processed_at: null,
        }),
      });

      if (!retryResponse.ok) {
        logStripeWebhookSupabaseDebug({
          stage: 'webhook_event_retry',
          table: 'stripe_webhook_events',
          status: retryResponse.status,
          supabaseCode: null,
        });
        throw new Error(`stripe_webhook_log_retry_failed_${retryResponse.status}`);
      }

      return {
        shouldProcess: true,
        duplicate: true,
        status: 'processing',
      };
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/stripe_webhook_events`, {
      method: 'POST',
      headers: {
        ...headers,
        prefer: 'return=minimal',
      },
      body: JSON.stringify({
        event_id: event.id,
        event_type: event.type,
        created_at_stripe: stripeCreatedAt(event),
        stripe_created_at: new Date(event.created * 1000).toISOString(),
        livemode: event.livemode,
        status: 'processing',
        processing_status: 'processing',
        error_message: null,
      }),
    });

    if (response.status === 409) {
      const duplicateResponse = await fetch(
        `${supabaseUrl}/rest/v1/stripe_webhook_events?event_id=eq.${encodeURIComponent(event.id)}&select=event_id,status,processing_status&limit=1`,
        { headers },
      );
      const duplicateRows = duplicateResponse.ok
        ? await duplicateResponse.json() as Array<{ status?: string; processing_status?: string }>
        : [];
      const duplicateStatus = normalizeStripeWebhookStatus(duplicateRows[0]?.status)
        || normalizeStripeWebhookStatus(duplicateRows[0]?.processing_status)
        || 'processing';

      return {
        shouldProcess: false,
        duplicate: true,
        status: duplicateStatus,
      };
    }
    if (!response.ok) {
      logStripeWebhookSupabaseDebug({
        stage: 'webhook_event_insert',
        table: 'stripe_webhook_events',
        status: response.status,
        supabaseCode: null,
      });
      throw new Error(`stripe_webhook_log_insert_failed_${response.status}`);
    }

    return {
      shouldProcess: true,
      duplicate: false,
      status: 'processing',
    };
  } catch (error) {
    console.warn('Stripe webhook database log unavailable; using local fallback', {
      eventId: event.id,
      eventType: event.type,
      created: event.created,
      livemode: event.livemode,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return reserveLocalStripeWebhookEvent(event);
  }
}

async function finishStripeWebhookEvent(eventId: string, status: 'processed' | 'failed' | 'ignored', env: StripeCheckoutEnv, errorMessage?: string) {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    logStripeWebhookSupabaseDebug({
      stage: 'webhook_event_finish',
      table: 'stripe_webhook_events',
      status: null,
      supabaseCode: !supabaseUrl ? 'missing_supabase_url' : 'missing_service_role_key',
    });
    localStripeWebhookEvents.set(eventId, status);
    console.info('Stripe webhook event finished without database log', {
      eventId,
      status,
      hasError: Boolean(errorMessage),
    });
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/stripe_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify({
        status,
        processing_status: processingStatusForLegacyColumn(status),
        processed_at: new Date().toISOString(),
        error_message: errorMessage ? sanitizeStripeWebhookErrorMessage(errorMessage) : null,
      }),
    });

    if (!response.ok) {
      logStripeWebhookSupabaseDebug({
        stage: 'webhook_event_update',
        table: 'stripe_webhook_events',
        status: response.status,
        supabaseCode: null,
      });
      throw new Error(`stripe_webhook_log_update_failed_${response.status}`);
    }
  } catch (error) {
    console.warn('Stripe webhook database update failed', {
      eventId,
      status,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  }
}

async function processStripeWebhookBusinessEvent(event: StripeWebhookLogEvent, env: StripeCheckoutEnv) {
  if (env.stripeWebhookProcessor) {
    await env.stripeWebhookProcessor(event);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    await processCheckoutSessionCompleted(event, env);
    return;
  }

  if (event.type === 'invoice.paid') {
    await processInvoicePaid(event, env);
    return;
  }

  if (event.type === 'invoice.payment_failed') {
    await processInvoicePaymentFailed(event, env);
    return;
  }

  if (event.type === 'customer.subscription.updated') {
    await processSubscriptionUpdated(event, env);
    return;
  }

  if (event.type === 'customer.subscription.deleted') {
    await processSubscriptionDeleted(event, env);
  }
}

async function processCheckoutSessionCompleted(event: StripeWebhookLogEvent, env: StripeCheckoutEnv) {
  const session = asStripeCheckoutSession(event.data?.object);
  if (!session?.id) throw new Error('checkout_session_missing');

  const checkoutSessionId = session.id;
  const customerId = normalizeStripeId(session.customer);
  const subscriptionId = normalizeStripeId(session.subscription);
  if (!customerId || !subscriptionId) throw new Error('checkout_session_incomplete');
  if (session.payment_status && session.payment_status !== 'paid') throw new Error('checkout_payment_not_paid');

  const [lineItems, subscription] = await Promise.all([
    loadCheckoutSessionLineItems(checkoutSessionId, env),
    loadStripeSubscription(subscriptionId, env),
  ]);

  const stripePriceId = lineItems.data?.[0]?.price?.id
    || subscription.items?.data?.[0]?.price?.id
    || session.line_items?.data?.[0]?.price?.id
    || '';
  const planId = planIdFromStripePriceId(stripePriceId)
    || stripeMetadataPlanId(session, subscription);
  if (!planId) throw new Error('checkout_unknown_price_id');

  const planConfig = stripePlanConfig[planId];
  const customerEmail = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
  const profile = await resolveCheckoutProfile(session, customerEmail, customerId, env);
  const periodStart = subscription.current_period_start || subscription.items?.data?.[0]?.current_period_start || null;
  const periodEnd = subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end || null;
  const stripeInvoiceId = normalizeStripeId(session.invoice) || normalizeStripeId(subscription.latest_invoice) || null;

  const applyResult = await applyStripeCheckoutCompletedPayment({
    userId: profile.id,
    eventId: event.id,
    checkoutSessionId,
    stripeInvoiceId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripePriceId,
    subscriptionStatus: subscription.status || 'active',
    planId,
    lessonFormat: planConfig.lessonFormat,
    lessonsTotal: planConfig.lessonsTotal,
    currentPeriodStart: stripeTimestampToIso(periodStart),
    currentPeriodEnd: stripeTimestampToIso(periodEnd),
    nextPaymentDate: stripeTimestampToIso(periodEnd),
    customerEmail: customerEmail || null,
    amountTotal: typeof session.amount_total === 'number' ? session.amount_total : null,
    currency: session.currency || null,
  }, env);

  await sendEmailNotificationSafe({
    notificationKey: `${event.id}:email:checkout.session.completed`,
    type: 'checkout.session.completed',
    userId: profile.id,
    recipientEmail: customerEmail || profile.email,
    recipientName: profile.email.split('@')[0],
    stripeEventId: event.id,
    subject: 'Vetoschool: оплата прошла',
    preview: `Оплата тарифа ${planDisplayName(planId)} прошла успешно.`,
    title: 'Оплата прошла успешно',
    intro: 'Спасибо! Мы подтвердили оплату подписки и начислили уроки в кабинете Vetoschool.',
    rows: [
      { label: 'Тариф', value: planDisplayName(planId) },
      { label: 'Сумма', value: formatEmailMoney(session.amount_total, session.currency) },
      { label: 'Начислено уроков', value: String(planConfig.lessonsTotal) },
      { label: 'Текущий остаток', value: applyResult[0]?.lessons_remaining != null ? String(applyResult[0].lessons_remaining) : null },
      { label: 'Следующий платёж', value: formatEmailDate(stripeTimestampToIso(periodEnd)) },
    ],
    cta: { label: 'Открыть кабинет', url: `${appBaseUrl(env)}/dashboard` },
  }, env);

  await sendTelegramNotificationSafe({
    notificationKey: `${event.id}:checkout.session.completed`,
    type: 'stripe.checkout.session.completed',
    userId: profile.id,
    stripeEventId: event.id,
    stripeEventCreatedAt: event.created,
    text: [
      'Vetoschool: оплата прошла',
      telegramLines([
        ['Ученик', studentDisplayName(profile)],
        ['Тариф', planDisplayName(planId)],
        ['Формат', lessonFormatLabel(planConfig.lessonFormat)],
        ['Сумма', formatTelegramMoney(session.amount_total, session.currency)],
        ['Начислено уроков', `+${planConfig.lessonsTotal}`],
        ['Следующий платёж', formatTelegramDate(stripeTimestampToIso(periodEnd))],
      ]),
    ].filter(Boolean).join('\n'),
  }, env);
}

async function processInvoicePaid(event: StripeWebhookLogEvent, env: StripeCheckoutEnv) {
  const invoice = asStripeInvoice(event.data?.object);
  if (!invoice?.id) throw new Error('invoice_missing');
  if (invoice.paid === false || (invoice.status && invoice.status !== 'paid')) throw new Error('invoice_not_paid');

  const stripeInvoiceId = invoice.id;
  const customerId = normalizeStripeId(invoice.customer);
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!customerId || !subscriptionId) throw new Error('invoice_incomplete');

  const subscription = await loadStripeSubscription(subscriptionId, env);
  const subscriptionCustomerId = normalizeStripeId(subscription.customer);
  if (subscriptionCustomerId && subscriptionCustomerId !== customerId) throw new Error('invoice_subscription_customer_mismatch');

  const stripePriceId = subscription.items?.data?.[0]?.price?.id
    || invoice.lines?.data?.[0]?.price?.id
    || '';
  const planId = planIdFromStripePriceId(stripePriceId)
    || stripeMetadataPlanId(subscription, invoice);
  if (!planId) throw new Error('invoice_unknown_price_id');

  const profile = await loadProfileByStripeSubscription(customerId, subscriptionId, env)
    || await loadProfileByStripeCustomer(customerId, env)
    || await loadProfileFromStripeMetadata(subscription, invoice, env);
  if (!profile) throw new Error('invoice_profile_not_found');

  const planConfig = stripePlanConfig[planId];
  const invoicePeriod = invoice.lines?.data?.[0]?.period;
  const periodStart = invoicePeriod?.start || subscription.current_period_start || subscription.items?.data?.[0]?.current_period_start || invoice.period_start || null;
  const periodEnd = invoicePeriod?.end || subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end || invoice.period_end || null;

  const nextPaymentDate = stripeTimestampToIso(periodEnd);
  const applyResult = await applyStripeInvoicePaidPayment({
    userId: profile.id,
    eventId: event.id,
    stripeInvoiceId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripePriceId,
    subscriptionStatus: subscription.status || 'active',
    planId,
    lessonFormat: planConfig.lessonFormat,
    lessonsTotal: planConfig.lessonsTotal,
    currentPeriodStart: stripeTimestampToIso(periodStart),
    currentPeriodEnd: stripeTimestampToIso(periodEnd),
    nextPaymentDate,
    customerEmail: (invoice.customer_email || profile.email || '').trim().toLowerCase() || null,
    amountTotal: typeof invoice.amount_paid === 'number' ? invoice.amount_paid : typeof invoice.amount_due === 'number' ? invoice.amount_due : null,
    currency: invoice.currency || null,
  }, env);

  await sendEmailNotificationSafe({
    notificationKey: `${event.id}:email:invoice.paid`,
    type: 'invoice.paid',
    userId: profile.id,
    recipientEmail: (invoice.customer_email || profile.email || '').trim().toLowerCase(),
    recipientName: profile.email.split('@')[0],
    stripeEventId: event.id,
    subject: 'Vetoschool: подписка продлена',
    preview: `Новый пакет ${planConfig.lessonsTotal} уроков начислен.`,
    title: 'Подписка успешно продлена',
    intro: 'Платёж по подписке прошёл успешно. Новый месячный пакет уроков добавлен к вашему текущему остатку.',
    rows: [
      { label: 'Тариф', value: planDisplayName(planId) },
      { label: 'Начислено уроков', value: String(planConfig.lessonsTotal) },
      { label: 'Текущий остаток', value: applyResult[0]?.lessons_remaining != null ? String(applyResult[0].lessons_remaining) : 'Обновлён в кабинете' },
      { label: 'Следующий платёж', value: formatEmailDate(nextPaymentDate) },
    ],
    cta: { label: 'Открыть кабинет', url: `${appBaseUrl(env)}/dashboard` },
  }, env);

  await sendTelegramNotificationSafe({
    notificationKey: `${event.id}:invoice.paid`,
    type: 'stripe.invoice.paid',
    userId: profile.id,
    stripeEventId: event.id,
    stripeEventCreatedAt: event.created,
    text: [
      'Vetoschool: подписка продлена',
      telegramLines([
        ['Ученик', studentDisplayName(profile)],
        ['Тариф', planDisplayName(planId)],
        ['Начислено уроков', `+${planConfig.lessonsTotal}`],
        ['Новый остаток', applyResult[0]?.lessons_remaining != null ? String(applyResult[0].lessons_remaining) : 'обновлён'],
        ['Следующий платёж', formatTelegramDate(nextPaymentDate)],
      ]),
    ].filter(Boolean).join('\n'),
  }, env);
}

function invoiceFailureReason(invoice: StripeInvoice) {
  const paymentIntent = typeof invoice.payment_intent === 'object' ? invoice.payment_intent : null;
  const reason = paymentIntent?.last_payment_error?.message
    || paymentIntent?.last_payment_error?.decline_code
    || paymentIntent?.last_payment_error?.code
    || invoice.last_finalization_error?.message
    || invoice.status
    || null;
  return reason ? sanitizeStripeWebhookErrorMessage(reason) : null;
}

async function processInvoicePaymentFailed(event: StripeWebhookLogEvent, env: StripeCheckoutEnv) {
  const invoice = asStripeInvoice(event.data?.object);
  if (!invoice?.id) throw new Error('invoice_missing');

  const stripeInvoiceId = invoice.id;
  const customerId = normalizeStripeId(invoice.customer);
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!customerId || !subscriptionId) throw new Error('invoice_incomplete');

  const subscription = await loadStripeSubscription(subscriptionId, env);
  const subscriptionCustomerId = normalizeStripeId(subscription.customer);
  if (subscriptionCustomerId && subscriptionCustomerId !== customerId) throw new Error('invoice_subscription_customer_mismatch');

  const profile = await loadProfileByStripeSubscription(customerId, subscriptionId, env)
    || await loadProfileByStripeCustomer(customerId, env)
    || await loadProfileFromStripeMetadata(subscription, invoice, env);
  if (!profile) throw new Error('invoice_profile_not_found');

  const failedAt = stripeCreatedAt(event);
  const nextAttempt = stripeTimestampToIso(invoice.next_payment_attempt || subscription.current_period_end || null);
  await applyStripeInvoicePaymentFailed({
    userId: profile.id,
    eventId: event.id,
    stripeInvoiceId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    subscriptionStatus: subscription.status || invoice.status || 'past_due',
    paymentFailedAt: failedAt,
    nextPaymentDate: nextAttempt,
    amountDue: typeof invoice.amount_due === 'number' ? invoice.amount_due : null,
    currency: invoice.currency || null,
    failureReason: invoiceFailureReason(invoice),
  }, env);

  const portalUrl = await createStripePortalUrlForEmail(customerId, env).catch(() => `${appBaseUrl(env)}/dashboard`);
  await sendEmailNotificationSafe({
    notificationKey: `${event.id}:email:invoice.payment_failed`,
    type: 'invoice.payment_failed',
    userId: profile.id,
    recipientEmail: profile.email,
    recipientName: profile.email.split('@')[0],
    stripeEventId: event.id,
    subject: 'Vetoschool: проблема с оплатой',
    preview: 'Не удалось списать платёж по подписке.',
    title: 'Проблема с оплатой',
    intro: 'Stripe сообщил, что платёж по подписке не прошёл. Доступ не блокируется мгновенно, но способ оплаты лучше обновить.',
    rows: [
      { label: 'Сумма', value: formatEmailMoney(invoice.amount_due, invoice.currency) },
      { label: 'Дата ошибки', value: formatEmailDate(failedAt) },
      { label: 'Следующая попытка', value: formatEmailDate(nextAttempt) },
    ],
    cta: { label: 'Обновить способ оплаты', url: portalUrl },
    footer: 'Мы не показываем технические ошибки Stripe в письме. Если нужна помощь, напишите администратору Vetoschool.',
  }, env);

  const failedPlanId = planIdFromStripePriceId(subscriptionPriceId(subscription));
  await sendTelegramNotificationSafe({
    notificationKey: `${event.id}:invoice.payment_failed`,
    type: 'stripe.invoice.payment_failed',
    userId: profile.id,
    stripeEventId: event.id,
    stripeEventCreatedAt: event.created,
    text: [
      'Vetoschool: проблема с оплатой',
      telegramLines([
        ['Ученик', studentDisplayName(profile)],
        ['Тариф', planDisplayName(failedPlanId)],
        ['Сумма', formatTelegramMoney(invoice.amount_due, invoice.currency)],
        ['Дата ошибки', formatTelegramDate(failedAt)],
      ]),
    ].filter(Boolean).join('\n'),
  }, env);
}

function subscriptionPriceId(subscription: StripeSubscription) {
  return subscription.items?.data?.[0]?.price?.id || '';
}

function subscriptionPeriodStart(subscription: StripeSubscription) {
  return subscription.current_period_start || subscription.items?.data?.[0]?.current_period_start || null;
}

function subscriptionPeriodEnd(subscription: StripeSubscription) {
  return subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end || subscription.cancel_at || null;
}

async function applySubscriptionWebhookState(
  event: StripeWebhookLogEvent,
  env: StripeCheckoutEnv,
  options: { deleted: boolean },
) {
  const subscription = asStripeSubscription(event.data?.object);
  if (!subscription?.id) throw new Error('subscription_missing');

  const subscriptionId = subscription.id;
  const customerId = normalizeStripeId(subscription.customer);
  if (!customerId) throw new Error('subscription_customer_missing');

  const profile = await loadProfileByStripeSubscription(customerId, subscriptionId, env)
    || await loadProfileByStripeCustomer(customerId, env)
    || await loadProfileFromStripeMetadata(subscription, env);
  if (!profile) throw new Error('subscription_profile_not_found');

  const currentPeriodStart = stripeTimestampToIso(subscriptionPeriodStart(subscription));
  const currentPeriodEnd = stripeTimestampToIso(subscriptionPeriodEnd(subscription));
  const cancelAtPeriodEnd = options.deleted ? false : Boolean(subscription.cancel_at_period_end);
  const subscriptionStatus = options.deleted ? 'canceled' : (subscription.status || 'unknown');
  const canceledAt = stripeTimestampToIso(subscription.canceled_at) || (options.deleted ? stripeCreatedAt(event) : null);
  const nextPaymentDate = options.deleted ? null : currentPeriodEnd;
  let stripePriceId: string | null = null;
  let planId: PricingPlanId | null = null;
  let lessonFormat: string | null = null;

  if (!options.deleted) {
    stripePriceId = subscriptionPriceId(subscription) || null;
    planId = planIdFromStripePriceId(stripePriceId) || stripeMetadataPlanId(subscription);
    if (!planId) throw new Error('subscription_unknown_price_id');
    lessonFormat = stripePlanConfig[planId].lessonFormat;
  }

  const applyResult = await applyStripeSubscriptionState({
    userId: profile.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    subscriptionStatus,
    currentPeriodStart,
    currentPeriodEnd,
    nextPaymentDate,
    cancelAtPeriodEnd,
    canceledAt,
    stripePriceId,
    planId,
    lessonFormat,
  }, env);

  const isCancelAtPeriodEndEmail = !options.deleted && cancelAtPeriodEnd;
  const isRenewalRestoredEmail = !options.deleted && !cancelAtPeriodEnd && subscription.status === 'active';
  if (isCancelAtPeriodEndEmail || isRenewalRestoredEmail || options.deleted) {
    await sendEmailNotificationSafe({
      notificationKey: `${event.id}:email:${options.deleted ? 'customer.subscription.deleted' : isCancelAtPeriodEndEmail ? 'subscription.cancel_at_period_end' : 'subscription.renewal_restored'}`,
      type: options.deleted
        ? 'customer.subscription.deleted'
        : isCancelAtPeriodEndEmail
          ? 'customer.subscription.updated.cancel_at_period_end'
          : 'customer.subscription.updated.renewal_restored',
      userId: profile.id,
      recipientEmail: profile.email,
      recipientName: profile.email.split('@')[0],
      stripeEventId: event.id,
      subject: options.deleted
        ? 'Vetoschool: подписка завершена'
        : isCancelAtPeriodEndEmail
          ? 'Vetoschool: автопродление отключено'
          : 'Vetoschool: автопродление снова активно',
      preview: options.deleted
        ? 'Оставшиеся уроки и история обучения сохраняются.'
        : isCancelAtPeriodEndEmail
          ? `Доступ сохранится до ${formatEmailDate(currentPeriodEnd)}.`
          : 'Подписка продолжит продлеваться автоматически.',
      title: options.deleted
        ? 'Подписка завершена'
        : isCancelAtPeriodEndEmail
          ? 'Автопродление отключено'
          : 'Автопродление снова активно',
      intro: options.deleted
        ? 'Подписка завершена. Оставшиеся уроки сохраняются, а история обучения не удаляется.'
        : isCancelAtPeriodEndEmail
          ? 'Автопродление отключено. Доступ не отключается сразу и сохраняется до конца оплаченного периода.'
          : 'Отмена автопродления снята. Подписка вернулась в обычный активный режим.',
      rows: [
        { label: 'Статус', value: subscriptionStatus },
        { label: 'Оплаченный период до', value: formatEmailDate(currentPeriodEnd) },
      ],
      cta: { label: 'Открыть кабинет', url: `${appBaseUrl(env)}/dashboard` },
    }, env);

    await sendTelegramNotificationSafe({
      notificationKey: `${event.id}:${options.deleted ? 'customer.subscription.deleted' : isCancelAtPeriodEndEmail ? 'subscription.cancel_at_period_end' : 'subscription.renewal_restored'}`,
      type: options.deleted
        ? 'stripe.customer.subscription.deleted'
        : isCancelAtPeriodEndEmail
          ? 'stripe.customer.subscription.updated.cancel_at_period_end'
          : 'stripe.customer.subscription.updated.renewal_restored',
      userId: profile.id,
      stripeEventId: event.id,
      stripeEventCreatedAt: event.created,
      text: [
        options.deleted
          ? 'Vetoschool: подписка завершена'
          : isCancelAtPeriodEndEmail
            ? 'Vetoschool: автопродление отключено'
            : 'Vetoschool: автопродление снова активно',
        telegramLines([
          ['Ученик', studentDisplayName(profile)],
          ['Окончание периода', formatTelegramDate(currentPeriodEnd)],
          ['Оставшиеся уроки', applyResult?.[0]?.lessons_remaining != null ? String(applyResult[0].lessons_remaining) : null],
        ]),
      ].filter(Boolean).join('\n'),
    }, env);
  }
}

async function processSubscriptionUpdated(event: StripeWebhookLogEvent, env: StripeCheckoutEnv) {
  await applySubscriptionWebhookState(event, env, { deleted: false });
}

async function processSubscriptionDeleted(event: StripeWebhookLogEvent, env: StripeCheckoutEnv) {
  await applySubscriptionWebhookState(event, env, { deleted: true });
}

function stripePortalReturnUrl(env: StripeCheckoutEnv) {
  return `${appBaseUrl(env)}${DEFAULT_STRIPE_PORTAL_RETURN_PATH}`;
}

async function createStripePortalUrlForEmail(customerId: string, env: StripeCheckoutEnv) {
  const portalBody = new URLSearchParams({
    customer: customerId,
    return_url: `${appBaseUrl(env)}${DEFAULT_STRIPE_PORTAL_RETURN_PATH}`,
  });

  if (env.STRIPE_PORTAL_CONFIGURATION_ID) {
    portalBody.set('configuration', env.STRIPE_PORTAL_CONFIGURATION_ID);
  }

  const portalPayload = await stripeApiPostForm<{ id?: string; url?: string }>('/billing_portal/sessions', portalBody, env);
  if (!portalPayload.url) throw new Error('stripe_portal_session_missing_url');
  return portalPayload.url;
}

export async function handleCreateStripeCheckoutSession(request: Request, env: StripeCheckoutEnv) {
  console.log('[Stripe Checkout debug]', { stage: 'start', method: request.method });

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const secretKey = env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return jsonResponse({ code: 'stripe_config_error', error: 'Stripe secret key is not configured on the server.' }, 500);
  }

  let authUser: SupabaseAuthUser;
  try {
    authUser = await requireAuthenticatedCheckoutUser(request, env);
    console.log('[Stripe Checkout debug]', { stage: 'auth', status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'checkout_auth_required';
    const status = message === 'checkout_auth_required' || message === 'checkout_auth_invalid' ? 401 : 500;
    console.log('[Stripe Checkout debug]', { stage: 'auth', status });
    return jsonResponse({
      code: status === 401 ? 'auth_required' : 'server_configuration_error',
      error: status === 401
        ? 'Log in before paying so we can attach the subscription to your Vetoschool account.'
        : 'Checkout authentication is not configured on the server.',
    }, status);
  }

  const body = await readCheckoutBody(request);
  if (!isPricingPlanId(body.planId)) {
    console.log('[Stripe Checkout debug]', { stage: 'plan', status: 400 });
    return jsonResponse({ code: 'invalid_tariff', error: 'Unknown Vetoschool plan.' }, 400);
  }
  console.log('[Stripe Checkout debug]', { stage: 'plan', status: 200, planId: body.planId });

  const priceId = stripePriceIdsByPlan[body.planId];
  const planConfig = stripePlanConfig[body.planId];
  if (!priceId || !planConfig?.priceId) {
    return jsonResponse({ code: 'unavailable_price', error: 'Stripe price is not available for this tariff.' }, 500);
  }
  const appUrl = appBaseUrl(env);
  const successUrl = `${appUrl}/payment/success`;
  const cancelUrl = `${appUrl}/payment/cancel`;
  let profile: VetoschoolProfile | null;
  try {
    profile = await loadProfileById(authUser.id, env);
  } catch (error) {
    console.log('[Stripe Checkout debug]', {
      stage: 'profile',
      status: 500,
      error: error instanceof Error ? error.message : 'profile_lookup_failed',
    });
    return jsonResponse({ code: 'profile_lookup_failed', error: 'Vetoschool profile lookup failed.' }, 500);
  }
  if (!profile) {
    console.log('[Stripe Checkout debug]', { stage: 'profile', status: 409 });
    return jsonResponse({ code: 'profile_not_found', error: 'Vetoschool profile was not found for the authenticated user.' }, 409);
  }
  console.log('[Stripe Checkout debug]', { stage: 'profile', status: 200, hasCustomer: Boolean(profile.stripe_customer_id) });

  let customerId = profile.stripe_customer_id || '';
  if (!customerId) {
    try {
      customerId = await createStripeCustomerForProfile(profile, authUser, env);
      await saveStripeCustomerId(profile.id, customerId, env);
      profile = { ...profile, stripe_customer_id: customerId };
      console.log('[Stripe Checkout debug]', { stage: 'stripe_customer', status: 200 });
    } catch (error) {
      console.log('[Stripe Checkout debug]', {
        stage: 'stripe_customer',
        status: 502,
        error: error instanceof Error ? error.message : 'stripe_customer_creation_failed',
      });
      return jsonResponse({ code: 'stripe_api_error', error: 'Stripe customer was not created.' }, 502);
    }
  }

  const stripeBody = new URLSearchParams({
    mode: 'subscription',
    success_url: checkoutSuccessUrlWithSessionId(successUrl),
    cancel_url: cancelUrl,
    client_reference_id: authUser.id,
    customer: customerId,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'metadata[user_id]': authUser.id,
    'metadata[profile_id]': profile.id,
    'metadata[plan_id]': body.planId,
    'metadata[lesson_format]': planConfig.lessonFormat,
    'metadata[lessons_per_month]': String(planConfig.lessonsTotal),
    'metadata[currency]': 'czk',
    'metadata[source]': 'vetoschool',
    'subscription_data[metadata][user_id]': authUser.id,
    'subscription_data[metadata][profile_id]': profile.id,
    'subscription_data[metadata][plan_id]': body.planId,
    'subscription_data[metadata][lesson_format]': planConfig.lessonFormat,
    'subscription_data[metadata][lessons_per_month]': String(planConfig.lessonsTotal),
    'subscription_data[metadata][currency]': 'czk',
    'subscription_data[metadata][source]': 'vetoschool',
  });

  if (body.currency) {
    stripeBody.set('metadata[display_currency]', body.currency);
    stripeBody.set('subscription_data[metadata][display_currency]', body.currency);
  }

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: stripeBody,
  });

  const stripePayload = await stripeResponse.json() as { id?: string; url?: string; error?: { message?: string; type?: string; code?: string } };
  console.log('[Stripe Checkout debug]', {
    stage: 'stripe_checkout_session',
    status: stripeResponse.status,
    stripeErrorType: stripePayload.error?.type || null,
    stripeErrorCode: stripePayload.error?.code || null,
  });
  if (!stripeResponse.ok || !stripePayload.id) {
    return jsonResponse({ code: 'stripe_api_error', error: 'Stripe Checkout Session was not created.' }, 502);
  }

  return jsonResponse({
    sessionId: stripePayload.id,
    checkoutUrl: stripePayload.url,
    url: stripePayload.url,
  });
}

export async function handleCreateStripePortalSession(request: Request, env: StripeCheckoutEnv) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type',
      },
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse({ error: 'Stripe Customer Portal is not configured on the server.' }, 500);
  }

  let authUser: SupabaseAuthUser;
  const accessToken = authorizationBearerToken(request);
  try {
    authUser = await requireAuthenticatedCheckoutUser(request, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'checkout_auth_required';
    const status = message === 'checkout_auth_required' || message === 'checkout_auth_invalid' ? 401 : 500;
    return jsonResponse({
      error: status === 401
        ? 'Log in to manage your subscription.'
        : 'Subscription management is not configured on the server.',
    }, status);
  }

  const profile = await loadProfileById(authUser.id, env, accessToken);
  const stripeCustomerId = profile?.stripe_customer_id?.trim();
  if (!profile || !stripeCustomerId) {
    return jsonResponse({ error: 'No Stripe subscription is connected to this Vetoschool account yet.' }, 409);
  }

  const portalBody = new URLSearchParams({
    customer: stripeCustomerId,
    return_url: stripePortalReturnUrl(env),
  });

  if (env.STRIPE_PORTAL_CONFIGURATION_ID) {
    portalBody.set('configuration', env.STRIPE_PORTAL_CONFIGURATION_ID);
  }

  try {
    const portalPayload = await stripeApiPostForm<{ id?: string; url?: string }>('/billing_portal/sessions', portalBody, env);
    if (!portalPayload.url) throw new Error('stripe_portal_session_missing_url');
    return jsonResponse({ url: portalPayload.url });
  } catch {
    return jsonResponse({ error: 'Could not open subscription management. Please try again later.' }, 502);
  }
}

export async function handleCreateStripeRefund(request: Request, env: StripeCheckoutEnv) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type',
      },
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse({ error: 'Stripe refunds are not configured on the server.' }, 500);
  }

  let adminUser: SupabaseAuthUser;
  try {
    adminUser = await requireAdminUser(request, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'admin_required';
    const status = message === 'checkout_auth_required' || message === 'checkout_auth_invalid'
      ? 401
      : message === 'admin_required'
        ? 403
        : 500;
    return jsonResponse({
      error: status === 401
        ? 'Log in as an administrator to issue refunds.'
        : status === 403
          ? 'Only administrators can issue refunds.'
          : 'Refund permissions are not configured on the server.',
    }, status);
  }

  const body = await readStripeRefundBody(request);
  const stripePaymentId = body.stripePaymentId?.trim();
  const refundType = body.refundType;
  const idempotencyKey = body.idempotencyKey?.trim();
  const reason = body.reason?.trim() || '';

  if (!stripePaymentId) return jsonResponse({ error: 'Choose a payment to refund.' }, 400);
  if (refundType !== 'full' && refundType !== 'partial') return jsonResponse({ error: 'Choose full or partial refund.' }, 400);
  if (!idempotencyKey || idempotencyKey.length < 12) return jsonResponse({ error: 'Refund idempotency key is missing.' }, 400);
  if (reason.length < 6) return jsonResponse({ error: 'Refund reason is required.' }, 400);

  try {
    const existingRefund = await loadStripeRefundByIdempotencyKey(idempotencyKey, env);
    if (existingRefund) {
      return jsonResponse({
        refund: existingRefund,
        duplicate: true,
      });
    }

    const payment = await loadStripePaymentById(stripePaymentId, env);
    if (!payment) return jsonResponse({ error: 'Payment was not found.' }, 404);

    const source = await resolveStripeRefundPaymentSource(payment, env);
    if (source.availableAmount <= 0) {
      return jsonResponse({ error: 'This payment has already been fully refunded.' }, 409);
    }

    const refundAmount = refundType === 'full' ? source.availableAmount : (body.amount ?? 0);
    if (!Number.isInteger(refundAmount) || refundAmount <= 0) {
      return jsonResponse({ error: 'Enter a valid refund amount.' }, 400);
    }

    if (refundAmount > source.availableAmount) {
      return jsonResponse({ error: 'Refund amount is higher than the available amount.' }, 400);
    }

    await updateStripePaymentSourceIds(payment.id, source.paymentIntentId, source.chargeId, env);

    const refundBody = new URLSearchParams({
      amount: String(refundAmount),
      'metadata[source]': 'vetoschool_admin',
      'metadata[stripe_payment_id]': payment.id,
      'metadata[user_id]': payment.user_id,
      'metadata[refund_type]': refundType,
    });

    if (source.paymentIntentId) refundBody.set('payment_intent', source.paymentIntentId);
    else if (source.chargeId) refundBody.set('charge', source.chargeId);

    const stripeRefund = await stripeApiPostForm<StripeRefund>('/refunds', refundBody, env, idempotencyKey);
    if (!stripeRefund.id || !stripeRefund.amount) throw new Error('stripe_refund_missing_required_fields');

    const savedRefund = await saveStripeRefund({
      payment,
      stripeRefund,
      refundType,
      reason,
      adminUserId: adminUser.id || '',
      idempotencyKey,
      paymentIntentId: source.paymentIntentId,
      chargeId: source.chargeId,
    }, env);

    const [profile, adminProfile] = await Promise.all([
      loadProfileById(payment.user_id, env).catch(() => null),
      adminUser.id ? loadProfileById(adminUser.id, env).catch(() => null) : Promise.resolve(null),
    ]);
    await sendEmailNotificationSafe({
      notificationKey: `${stripeRefund.id}:email:stripe.refund`,
      type: 'stripe.refund',
      userId: payment.user_id,
      recipientEmail: profile?.email,
      recipientName: profile?.email?.split('@')[0] || null,
      stripePaymentId: payment.id,
      stripeRefundId: savedRefund.refund?.id || null,
      subject: refundType === 'full' ? 'Vetoschool: полный возврат оформлен' : 'Vetoschool: частичный возврат оформлен',
      preview: `${refundType === 'full' ? 'Полный' : 'Частичный'} возврат: ${formatEmailMoney(stripeRefund.amount, stripeRefund.currency)}.`,
      title: refundType === 'full' ? 'Полный возврат оформлен' : 'Частичный возврат оформлен',
      intro: 'Возврат платежа создан администратором Vetoschool и передан в Stripe. Уроки не списываются автоматически.',
      rows: [
        { label: 'Сумма возврата', value: formatEmailMoney(stripeRefund.amount, stripeRefund.currency) },
        { label: 'Тип возврата', value: refundType === 'full' ? 'Полный' : 'Частичный' },
        { label: 'Причина', value: reason },
        { label: 'Статус Stripe', value: stripeRefund.status || 'pending' },
      ],
      cta: { label: 'Открыть кабинет', url: `${appBaseUrl(env)}/dashboard` },
    }, env);

    await sendTelegramNotificationSafe({
      notificationKey: `${stripeRefund.id}:stripe.refund`,
      type: 'stripe.refund',
      userId: payment.user_id,
      stripePaymentId: payment.id,
      stripeRefundId: savedRefund.refund?.id || null,
      text: [
        refundType === 'full' ? 'Vetoschool: полный возврат' : 'Vetoschool: частичный возврат',
        telegramLines([
          ['Ученик', studentDisplayName(profile)],
          ['Сумма', formatTelegramMoney(stripeRefund.amount, stripeRefund.currency)],
          ['Причина', reason],
          ['Администратор', adminDisplayName(adminProfile)],
        ]),
      ].filter(Boolean).join('\n'),
    }, env);

    return jsonResponse({
      refund: savedRefund.refund,
      duplicate: savedRefund.duplicate,
      availableAmountBeforeRefund: source.availableAmount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'stripe_refund_failed';
    console.warn('[Stripe refund debug]', {
      stage: 'stripe_refund',
      status: message.match(/_(\d{3})$/)?.[1] || null,
      stripeErrorType: null,
      stripeErrorCode: null,
    });
    return jsonResponse({ error: 'Could not create Stripe refund. Please check the payment and try again.' }, 502);
  }
}

export async function handleStripeWebhook(request: Request, env: StripeCheckoutEnv) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('Stripe webhook rejected because STRIPE_WEBHOOK_SECRET is missing on the server.');
    return jsonResponse({ error: 'Stripe webhook secret is not configured on the server.' }, 500);
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get('stripe-signature');
  const verified = await verifyStripeWebhookSignature(rawBody, signatureHeader, webhookSecret);
  if (!verified) {
    return jsonResponse({ error: 'Invalid Stripe webhook signature.' }, 400);
  }

  let event: StripeWebhookEvent;
  try {
    event = JSON.parse(rawBody) as StripeWebhookEvent;
  } catch {
    return jsonResponse({ error: 'Invalid Stripe webhook payload.' }, 400);
  }

  if (!event.id || !event.type || typeof event.created !== 'number' || typeof event.livemode !== 'boolean') {
    return jsonResponse({ error: 'Invalid Stripe webhook event shape.' }, 400);
  }

  const shouldHandle = HANDLED_STRIPE_WEBHOOK_EVENTS.has(event.type);
  const normalizedEvent = {
    id: event.id,
    type: event.type,
    created: event.created,
    livemode: event.livemode,
    data: event.data,
  };

  try {
    const reservation = await reserveStripeWebhookEvent(normalizedEvent, env);

    if (!reservation.shouldProcess) {
      return jsonResponse({
        received: true,
        duplicate: true,
        status: reservation.status,
      });
    }

    if (!shouldHandle) {
      await finishStripeWebhookEvent(event.id, 'ignored', env);
      return jsonResponse({ received: true, ignored: true });
    }

    await processStripeWebhookBusinessEvent(normalizedEvent, env);
    await finishStripeWebhookEvent(event.id, 'processed', env);
    return jsonResponse({ received: true, processed: true });
  } catch (error) {
    const errorMessage = sanitizeStripeWebhookErrorMessage(
      error instanceof Error ? error.message : 'stripe_webhook_processing_failed',
    );
    try {
      await finishStripeWebhookEvent(event.id, 'failed', env, errorMessage);
    } catch {
      // Keep the webhook response focused on the original failure.
    }
    console.warn('Stripe webhook technical log failed', {
      eventId: event.id,
      eventType: event.type,
      created: event.created,
      livemode: event.livemode,
      status: 'failed',
    });
    return jsonResponse({ error: errorMessage }, 500);
  }
}

function edgeEnvFromDeno(): StripeCheckoutEnv {
  if (typeof Deno === 'undefined') return {};
  return {
    STRIPE_SECRET_KEY: Deno.env.get('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: Deno.env.get('STRIPE_WEBHOOK_SECRET'),
    STRIPE_PORTAL_CONFIGURATION_ID: Deno.env.get('STRIPE_PORTAL_CONFIGURATION_ID'),
    SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY'),
    SUPABASE_PUBLISHABLE_KEY: Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    SENDPULSE_CLIENT_ID: Deno.env.get('SENDPULSE_CLIENT_ID'),
    SENDPULSE_CLIENT_SECRET: Deno.env.get('SENDPULSE_CLIENT_SECRET'),
    SENDPULSE_FROM_EMAIL: Deno.env.get('SENDPULSE_FROM_EMAIL'),
    SENDPULSE_FROM_NAME: Deno.env.get('SENDPULSE_FROM_NAME'),
    SENDPULSE_EMAIL_ENDPOINT: Deno.env.get('SENDPULSE_EMAIL_ENDPOINT'),
    TELEGRAM_BOT_TOKEN: Deno.env.get('TELEGRAM_BOT_TOKEN'),
    TELEGRAM_ADMIN_CHAT_ID: Deno.env.get('TELEGRAM_ADMIN_CHAT_ID'),
    TELEGRAM_ADMIN_CHAT_IDS: Deno.env.get('TELEGRAM_ADMIN_CHAT_IDS'),
    APP_URL: Deno.env.get('APP_URL'),
  };
}

if (typeof Deno !== 'undefined' && (import.meta as unknown as { main?: boolean }).main) {
  Deno.serve(request => handleStripeWebhook(request, edgeEnvFromDeno()));
}
