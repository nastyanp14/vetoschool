type RuntimeEnv = {
  get(name: string): string | undefined;
};

declare const Deno: {
  env: RuntimeEnv;
  serve(handler: (request: Request) => Response | Promise<Response>): void;
} | undefined;

type SupabaseAuthUser = {
  id?: string;
  email?: string | null;
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
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  idempotency_key?: string;
  amount: number;
  currency: string;
  refund_type: string;
  reason: string;
  status: string;
  created_by_admin_id: string;
  created_at: string;
  updated_at: string;
};

type StripeRefundRequestBody = {
  stripePaymentId?: string;
  refundType?: 'full' | 'partial';
  amount?: number;
  reason?: string;
  idempotencyKey?: string;
};

type StripePaymentIntent = {
  id?: string;
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

type StripeInvoice = {
  id?: string;
  charge?: string | StripeCharge | null;
  payment_intent?: string | StripePaymentIntent | null;
};

type StripeCheckoutSession = {
  id?: string;
  payment_intent?: string | StripePaymentIntent | null;
  invoice?: string | (StripeInvoice & { id?: string }) | null;
};

type StripeRefund = {
  id?: string;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  payment_intent?: string | null;
  charge?: string | null;
  error?: {
    type?: string;
    code?: string;
    message?: string;
  };
};

function envValue(env: RuntimeEnv, names: string[]) {
  for (const name of names) {
    const value = env.get(name)?.trim();
    if (value) return value;
  }
  return '';
}

function requireEnv(env: RuntimeEnv, names: string[], errorCode: string) {
  const value = envValue(env, names);
  if (!value) throw new Error(errorCode);
  return value;
}

function allowedOrigins(env: RuntimeEnv) {
  const appUrl = envValue(env, ['APP_URL']);
  const configuredOrigins = envValue(env, ['REFUND_ALLOWED_ORIGINS', 'CORS_ALLOWED_ORIGINS'])
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  try {
    return Array.from(new Set([new URL(appUrl).origin, ...configuredOrigins]));
  } catch {
    return configuredOrigins;
  }
}

function corsHeaders(origin: string | null, env: RuntimeEnv) {
  const allowed = allowedOrigins(env);
  const resolvedOrigin = origin && allowed.includes(origin.replace(/\/+$/, ''))
    ? origin
    : allowed[0] || 'https://vetoschool.eu';

  return {
    'Access-Control-Allow-Origin': resolvedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function jsonResponse(body: unknown, status: number, origin: string | null, env: RuntimeEnv) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin, env),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function authorizationBearerToken(request: Request) {
  return request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
}

function supabaseUrl(env: RuntimeEnv) {
  return requireEnv(env, ['SUPABASE_URL'], 'supabase_url_missing').replace(/\/+$/, '');
}

function supabasePublishableKey(env: RuntimeEnv) {
  return requireEnv(
    env,
    ['SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY'],
    'supabase_publishable_key_missing',
  );
}

function supabaseServiceRoleKey(env: RuntimeEnv) {
  return requireEnv(env, ['SUPABASE_SERVICE_ROLE_KEY'], 'supabase_service_role_key_missing');
}

function supabaseUserHeaders(env: RuntimeEnv, accessToken: string) {
  return {
    apikey: supabasePublishableKey(env),
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
  };
}

function supabaseServiceHeaders(env: RuntimeEnv) {
  const serviceRoleKey = supabaseServiceRoleKey(env);
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    'content-type': 'application/json',
  };
}

async function readRefundBody(request: Request): Promise<StripeRefundRequestBody> {
  try {
    return await request.json() as StripeRefundRequestBody;
  } catch {
    return {};
  }
}

async function requireAuthenticatedUser(request: Request, env: RuntimeEnv): Promise<SupabaseAuthUser> {
  const accessToken = authorizationBearerToken(request);
  if (!accessToken) throw new Error('refund_auth_required');

  const response = await fetch(`${supabaseUrl(env)}/auth/v1/user`, {
    headers: supabaseUserHeaders(env, accessToken),
  });

  if (!response.ok) throw new Error('refund_auth_invalid');

  const user = await response.json() as SupabaseAuthUser;
  if (!user.id) throw new Error('refund_auth_invalid');

  return user;
}

async function requireAdminUser(request: Request, env: RuntimeEnv): Promise<SupabaseAuthUser> {
  const authUser = await requireAuthenticatedUser(request, env);
  const response = await fetch(
    `${supabaseUrl(env)}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(authUser.id || '')}&role=eq.admin&select=user_id,role&limit=1`,
    { headers: supabaseServiceHeaders(env) },
  );

  if (!response.ok) throw new Error(`admin_role_lookup_failed_${response.status}`);

  const rows = await response.json() as VetoschoolRoleRow[];
  if (!rows.length) throw new Error('admin_required');
  return authUser;
}

async function loadStripePaymentById(stripePaymentId: string, env: RuntimeEnv) {
  const response = await fetch(
    `${supabaseUrl(env)}/rest/v1/stripe_payments?id=eq.${encodeURIComponent(stripePaymentId)}&select=id,user_id,checkout_session_id,stripe_invoice_id,stripe_customer_id,stripe_subscription_id,stripe_payment_intent_id,stripe_charge_id,plan_id,lesson_format,amount_total,currency,paid_at,created_at&limit=1`,
    { headers: supabaseServiceHeaders(env) },
  );

  if (!response.ok) throw new Error(`stripe_payment_lookup_failed_${response.status}`);

  const rows = await response.json() as VetoschoolStripePayment[];
  return rows[0] || null;
}

function stripePaymentLookupFilter(identifier: string) {
  if (identifier.startsWith('in_')) return `stripe_invoice_id=eq.${encodeURIComponent(identifier)}`;
  if (identifier.startsWith('pi_')) return `stripe_payment_intent_id=eq.${encodeURIComponent(identifier)}`;
  if (identifier.startsWith('ch_')) return `stripe_charge_id=eq.${encodeURIComponent(identifier)}`;
  if (identifier.startsWith('cs_')) return `checkout_session_id=eq.${encodeURIComponent(identifier)}`;
  return '';
}

async function loadStripePaymentByStripeIdentifier(identifier: string, env: RuntimeEnv) {
  const filter = stripePaymentLookupFilter(identifier);
  if (!filter) return null;
  const response = await fetch(
    `${supabaseUrl(env)}/rest/v1/stripe_payments?${filter}&select=id,user_id,checkout_session_id,stripe_invoice_id,stripe_customer_id,stripe_subscription_id,stripe_payment_intent_id,stripe_charge_id,plan_id,lesson_format,amount_total,currency,paid_at,created_at&order=created_at.desc&limit=1`,
    { headers: supabaseServiceHeaders(env) },
  );

  if (!response.ok) throw new Error(`stripe_payment_lookup_failed_${response.status}`);

  const rows = await response.json() as VetoschoolStripePayment[];
  return rows[0] || null;
}

async function loadStripePaymentForRefund(identifier: string, env: RuntimeEnv) {
  return await loadStripePaymentById(identifier, env)
    || await loadStripePaymentByStripeIdentifier(identifier, env);
}

async function loadStripeRefundByIdempotencyKey(idempotencyKey: string, env: RuntimeEnv) {
  const response = await fetch(
    `${supabaseUrl(env)}/rest/v1/stripe_refunds?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,user_id,stripe_payment_id,stripe_refund_id,stripe_payment_intent_id,stripe_charge_id,idempotency_key,amount,currency,refund_type,reason,status,created_by_admin_id,created_at,updated_at&limit=1`,
    { headers: supabaseServiceHeaders(env) },
  );

  if (!response.ok) throw new Error(`stripe_refund_lookup_failed_${response.status}`);

  const rows = await response.json() as VetoschoolStripeRefund[];
  return rows[0] || null;
}

// Invoice.payment_intent / Invoice.charge were removed from the Stripe API in
// 2025-xx versions. Pin the retrieval calls to a version that still exposes
// them so `in_...` identifiers can be traced to a refundable charge.
const STRIPE_LEGACY_API_VERSION = '2024-06-20';

async function stripeApiGet<T>(path: string, env: RuntimeEnv, apiVersion?: string): Promise<T> {
  const secretKey = requireEnv(env, ['STRIPE_SECRET_KEY'], 'stripe_secret_key_missing');
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: {
      authorization: `Bearer ${secretKey}`,
      ...(apiVersion ? { 'stripe-version': apiVersion } : {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.warn('[create-refund]', { stage: 'stripe_api_get', path, status: response.status, body: body.slice(0, 500) });
    throw new Error(`stripe_api_get_failed_${response.status}`);
  }
  return await response.json() as T;
}


async function stripeApiPostForm<T>(path: string, body: URLSearchParams, env: RuntimeEnv, idempotencyKey?: string): Promise<T> {
  const secretKey = requireEnv(env, ['STRIPE_SECRET_KEY'], 'stripe_secret_key_missing');
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
    body,
  });

  if (!response.ok) throw new Error(`stripe_api_post_failed_${response.status}`);
  return await response.json() as T;
}

function normalizeStripeId(value: string | { id?: string } | null | undefined) {
  if (typeof value === 'string') return value;
  return value?.id || '';
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

async function stripeApiGetWithFallback<T>(expandedPath: string, plainPath: string, env: RuntimeEnv): Promise<T> {
  try {
    return await stripeApiGet<T>(expandedPath, env, STRIPE_LEGACY_API_VERSION);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    // Unsupported expand on the account's API version -> retry without expands.
    if (!message.includes('stripe_api_get_failed_400')) throw error;
    return await stripeApiGet<T>(plainPath, env, STRIPE_LEGACY_API_VERSION);
  }
}

async function loadStripePaymentIntent(paymentIntentId: string, env: RuntimeEnv) {
  const id = encodeURIComponent(paymentIntentId);
  return stripeApiGetWithFallback<StripePaymentIntent>(
    `/payment_intents/${id}?expand[]=latest_charge`,
    `/payment_intents/${id}`,
    env,
  );
}

async function loadStripeInvoiceWithPaymentSource(invoiceId: string, env: RuntimeEnv) {
  const id = encodeURIComponent(invoiceId);
  return stripeApiGetWithFallback<StripeInvoice>(
    `/invoices/${id}?expand[]=payment_intent.latest_charge&expand[]=charge`,
    `/invoices/${id}`,
    env,
  );
}

async function loadStripeCheckoutSessionWithPaymentSource(sessionId: string, env: RuntimeEnv) {
  const id = encodeURIComponent(sessionId);
  return stripeApiGetWithFallback<StripeCheckoutSession>(
    `/checkout/sessions/${id}?expand[]=invoice.payment_intent.latest_charge&expand[]=payment_intent.latest_charge`,
    `/checkout/sessions/${id}`,
    env,
  );
}


async function resolveStripeRefundPaymentSource(payment: VetoschoolStripePayment, env: RuntimeEnv) {
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
    const invoicePaymentIntent = asStripePaymentIntent(sessionInvoice?.payment_intent || null);
    paymentIntentId = paymentIntentId || sessionPaymentIntent?.id || invoicePaymentIntent?.id || normalizeStripeId(session.payment_intent as string | { id?: string } | null);
    charge = firstChargeFromPaymentIntent(sessionPaymentIntent) || firstChargeFromPaymentIntent(invoicePaymentIntent) || charge;
  }

  if (paymentIntentId && !charge?.amount) {
    const paymentIntent = await loadStripePaymentIntent(paymentIntentId, env);
    paymentIntentId = paymentIntent.id || paymentIntentId;
    charge = firstChargeFromPaymentIntent(paymentIntent) || charge;
  }

  // Sandbox subscription invoices frequently expose only a charge id (or only a
  // payment intent). Retrieve the charge itself so amount/currency/refunded are
  // real values instead of falling back to the stored invoice total.
  if (charge?.id && !charge.amount) {
    charge = await stripeApiGet<StripeCharge>(`/charges/${encodeURIComponent(charge.id)}`, env, STRIPE_LEGACY_API_VERSION)
      .catch(() => charge);
  }

  if (!charge?.amount && paymentIntentId) {
    const list = await stripeApiGet<{ data?: StripeCharge[] }>(
      `/charges?payment_intent=${encodeURIComponent(paymentIntentId)}&limit=1`,
      env,
      STRIPE_LEGACY_API_VERSION,
    ).catch(() => ({ data: [] as StripeCharge[] }));
    charge = list.data?.[0] || charge;
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

async function updateStripePaymentSourceIds(paymentId: string, paymentIntentId: string, chargeId: string, env: RuntimeEnv) {
  if (!paymentIntentId && !chargeId) return;

  const response = await fetch(`${supabaseUrl(env)}/rest/v1/stripe_payments?id=eq.${encodeURIComponent(paymentId)}`, {
    method: 'PATCH',
    headers: {
      ...supabaseServiceHeaders(env),
      prefer: 'return=minimal',
    },
    body: JSON.stringify({
      ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
      ...(chargeId ? { stripe_charge_id: chargeId } : {}),
    }),
  });

  if (!response.ok) throw new Error(`stripe_payment_source_update_failed_${response.status}`);
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
}, env: RuntimeEnv) {
  const response = await fetch(`${supabaseUrl(env)}/rest/v1/stripe_refunds`, {
    method: 'POST',
    headers: {
      ...supabaseServiceHeaders(env),
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
  return { refund: rows[0] || null, duplicate: false };
}

function runtimeEnv() {
  if (typeof Deno === 'undefined') throw new Error('deno_runtime_required');
  return Deno.env;
}

export async function handleCreateRefund(request: Request, env: RuntimeEnv = runtimeEnv()) {
  const origin = request.headers.get('origin');

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin, env),
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin, env);
  }

  if (!envValue(env, ['STRIPE_SECRET_KEY'])) {
    return jsonResponse({ error: 'Stripe refunds are not configured on the server.' }, 500, origin, env);
  }

  let adminUser: SupabaseAuthUser;
  try {
    adminUser = await requireAdminUser(request, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'admin_required';
    const status = message === 'refund_auth_required' || message === 'refund_auth_invalid'
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
    }, status, origin, env);
  }

  const body = await readRefundBody(request);
  const stripePaymentId = body.stripePaymentId?.trim();
  const refundType = body.refundType;
  const idempotencyKey = body.idempotencyKey?.trim();
  const reason = body.reason?.trim() || '';

  if (!stripePaymentId) return jsonResponse({ error: 'Choose a payment to refund.' }, 400, origin, env);
  if (refundType !== 'full' && refundType !== 'partial') return jsonResponse({ error: 'Choose full or partial refund.' }, 400, origin, env);
  if (!idempotencyKey || idempotencyKey.length < 12) return jsonResponse({ error: 'Refund idempotency key is missing.' }, 400, origin, env);
  if (reason.length < 6) return jsonResponse({ error: 'Refund reason is required.' }, 400, origin, env);

  try {
    const existingRefund = await loadStripeRefundByIdempotencyKey(idempotencyKey, env);
    if (existingRefund) {
      return jsonResponse({
        refund: existingRefund,
        duplicate: true,
      }, 200, origin, env);
    }

    const payment = await loadStripePaymentForRefund(stripePaymentId, env);
    if (!payment) {
      return jsonResponse({
        error: stripePaymentId.startsWith('in_')
          ? 'Invoice was not found in Vetoschool payment history.'
          : 'Payment was not found.',
      }, 404, origin, env);
    }

    const source = await resolveStripeRefundPaymentSource(payment, env);
    if (source.availableAmount <= 0) {
      return jsonResponse({ error: 'This payment has already been fully refunded.' }, 409, origin, env);
    }

    const refundAmount = refundType === 'full' ? source.availableAmount : body.amount;
    if (!Number.isInteger(refundAmount) || refundAmount <= 0) {
      return jsonResponse({ error: 'Enter a valid refund amount.' }, 400, origin, env);
    }

    if (refundAmount > source.availableAmount) {
      return jsonResponse({ error: 'Refund amount is higher than the available amount.' }, 400, origin, env);
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

    return jsonResponse({
      refund: savedRefund.refund,
      duplicate: savedRefund.duplicate,
      availableAmountBeforeRefund: source.availableAmount,
    }, 200, origin, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'stripe_refund_failed';
    console.warn('[create-refund]', {
      stage: 'stripe_refund',
      status: message.match(/_(\d{3})$/)?.[1] || null,
      stripeErrorType: null,
      stripeErrorCode: null,
    });
    if (message === 'stripe_refund_payment_source_not_found') {
      return jsonResponse({ error: 'Stripe invoice does not contain a refundable PaymentIntent or Charge.' }, 422, origin, env);
    }
    if (message.includes('stripe_api_post_failed_400')) {
      return jsonResponse({ error: 'Stripe rejected this refund. Check whether this payment is already refunded or belongs to a different Stripe mode.' }, 400, origin, env);
    }
    if (message.includes('stripe_api_get_failed_404')) {
      return jsonResponse({ error: 'Stripe payment source was not found for this invoice.' }, 404, origin, env);
    }
    return jsonResponse({ error: 'Could not create Stripe refund. Please check the payment and try again.' }, 502, origin, env);
  }
}

if (typeof Deno !== 'undefined' && (import.meta as unknown as { main?: boolean }).main) {
  Deno.serve(request => handleCreateRefund(request, Deno.env));
}
