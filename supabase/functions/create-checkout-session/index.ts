type RuntimeEnv = {
  get(name: string): string | undefined;
};

declare const Deno: {
  env: RuntimeEnv;
  serve(handler: (request: Request) => Response | Promise<Response>): void;
} | undefined;

type PlanId =
  | 'group-lite'
  | 'group-progress'
  | 'group-intensive'
  | 'individual-lite'
  | 'individual-progress'
  | 'individual-intensive';

type LessonFormat = 'group' | 'individual';

type PlanConfig = {
  priceId: string;
  lessonFormat: LessonFormat;
};

type CheckoutRequestBody = {
  planId?: string;
};

type SupabaseAuthUser = {
  id?: string;
  email?: string | null;
};

type VetoschoolProfile = {
  id: string;
  email?: string | null;
  stripe_customer_id?: string | null;
};

type StripeCheckoutSessionResponse = {
  id?: string;
  url?: string;
  error?: {
    type?: string;
    code?: string;
    message?: string;
  };
};

const stripePlanConfig: Record<PlanId, PlanConfig> = {
  'group-lite': { priceId: 'price_1Txb9HLCIsxnginYf4mX2Uwg', lessonFormat: 'group' },
  'group-progress': { priceId: 'price_1TxbAFLCIsxnginY7Mlaf63r', lessonFormat: 'group' },
  'group-intensive': { priceId: 'price_1TxbAnLCIsxnginYE3at3vOH', lessonFormat: 'group' },
  'individual-lite': { priceId: 'price_1TxbBMLCIsxnginYHI1sficF', lessonFormat: 'individual' },
  'individual-progress': { priceId: 'price_1TxbBqLCIsxnginYkBwPHgg8', lessonFormat: 'individual' },
  'individual-intensive': { priceId: 'price_1TxbCJLCIsxnginYq2t7tAIs', lessonFormat: 'individual' },
};

function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && value in stripePlanConfig;
}

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

function normalizedAppUrl(env: RuntimeEnv) {
  const value = requireEnv(env, ['APP_URL'], 'app_url_missing').replace(/\/+$/, '');
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();

  if (
    url.protocol !== 'https:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]'
  ) {
    throw new Error('app_url_must_be_production_https');
  }

  return value;
}

function allowedOrigins(env: RuntimeEnv) {
  const configuredOrigins = envValue(env, ['CHECKOUT_ALLOWED_ORIGINS', 'CORS_ALLOWED_ORIGINS'])
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  try {
    return Array.from(new Set([new URL(normalizedAppUrl(env)).origin, ...configuredOrigins]));
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

function supabaseUserHeaders(env: RuntimeEnv, accessToken: string) {
  return {
    apikey: supabasePublishableKey(env),
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
  };
}

async function readCheckoutBody(request: Request): Promise<CheckoutRequestBody> {
  try {
    return await request.json() as CheckoutRequestBody;
  } catch {
    return {};
  }
}

async function requireAuthenticatedUser(request: Request, env: RuntimeEnv): Promise<SupabaseAuthUser> {
  const accessToken = authorizationBearerToken(request);
  if (!accessToken) throw new Error('checkout_auth_required');

  const response = await fetch(`${supabaseUrl(env)}/auth/v1/user`, {
    headers: supabaseUserHeaders(env, accessToken),
  });

  if (!response.ok) throw new Error('checkout_auth_invalid');

  const user = await response.json() as SupabaseAuthUser;
  if (!user.id) throw new Error('checkout_auth_invalid');

  return user;
}

async function loadProfileById(userId: string, request: Request, env: RuntimeEnv) {
  const accessToken = authorizationBearerToken(request);
  const response = await fetch(
    `${supabaseUrl(env)}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,stripe_customer_id&limit=1`,
    { headers: supabaseUserHeaders(env, accessToken) },
  );

  if (!response.ok) throw new Error(`profile_lookup_failed_${response.status}`);

  const rows = await response.json() as VetoschoolProfile[];
  return rows[0] || null;
}

function checkoutSuccessUrl(appUrl: string) {
  return `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
}

function checkoutCancelUrl(appUrl: string) {
  return `${appUrl}/payment/cancel`;
}

async function createStripeCheckoutUrl(input: {
  env: RuntimeEnv;
  user: Required<Pick<SupabaseAuthUser, 'id'>> & SupabaseAuthUser;
  profile: VetoschoolProfile;
  planId: PlanId;
  appUrl: string;
}) {
  const secretKey = requireEnv(input.env, ['STRIPE_SECRET_KEY'], 'stripe_secret_key_missing');
  const planConfig = stripePlanConfig[input.planId];
  const stripeBody = new URLSearchParams({
    mode: 'subscription',
    success_url: checkoutSuccessUrl(input.appUrl),
    cancel_url: checkoutCancelUrl(input.appUrl),
    client_reference_id: input.user.id,
    'line_items[0][price]': planConfig.priceId,
    'line_items[0][quantity]': '1',
    'metadata[user_id]': input.user.id,
    'metadata[plan_id]': input.planId,
    'metadata[lesson_format]': planConfig.lessonFormat,
    'subscription_data[metadata][user_id]': input.user.id,
    'subscription_data[metadata][plan_id]': input.planId,
    'subscription_data[metadata][lesson_format]': planConfig.lessonFormat,
  });

  if (input.profile.stripe_customer_id) {
    stripeBody.set('customer', input.profile.stripe_customer_id);
  } else if (input.user.email) {
    stripeBody.set('customer_email', input.user.email);
  }

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: stripeBody,
  });

  const stripePayload = await stripeResponse.json() as StripeCheckoutSessionResponse;
  if (!stripeResponse.ok || !stripePayload.url) {
    console.warn('[create-checkout-session]', {
      stage: 'stripe_checkout_session',
      status: stripeResponse.status,
      stripeErrorType: stripePayload.error?.type || null,
      stripeErrorCode: stripePayload.error?.code || null,
    });
    throw new Error('stripe_checkout_session_failed');
  }

  return stripePayload.url;
}

function runtimeEnv() {
  if (typeof Deno === 'undefined') throw new Error('deno_runtime_required');
  return Deno.env;
}

export async function handleCreateCheckoutSession(request: Request, env: RuntimeEnv = runtimeEnv()) {
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

  let appUrl = '';
  try {
    appUrl = normalizedAppUrl(env);
  } catch {
    return jsonResponse({ error: 'Checkout APP_URL is not configured for production.' }, 500, origin, env);
  }

  let user: SupabaseAuthUser;
  try {
    user = await requireAuthenticatedUser(request, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'checkout_auth_required';
    const status = message === 'checkout_auth_required' || message === 'checkout_auth_invalid' ? 401 : 500;
    return jsonResponse({
      error: status === 401
        ? 'Log in before paying so we can attach the subscription to your Vetoschool account.'
        : 'Checkout authentication is not configured on the server.',
    }, status, origin, env);
  }

  const body = await readCheckoutBody(request);
  if (!isPlanId(body.planId)) {
    return jsonResponse({ error: 'Unknown Vetoschool plan.' }, 400, origin, env);
  }

  let profile: VetoschoolProfile | null = null;
  try {
    profile = await loadProfileById(user.id || '', request, env);
  } catch {
    return jsonResponse({ error: 'Vetoschool profile lookup failed.' }, 500, origin, env);
  }

  if (!profile) {
    return jsonResponse({ error: 'Vetoschool profile was not found for the authenticated user.' }, 409, origin, env);
  }

  try {
    const url = await createStripeCheckoutUrl({
      env,
      user: user as Required<Pick<SupabaseAuthUser, 'id'>> & SupabaseAuthUser,
      profile,
      planId: body.planId,
      appUrl,
    });

    return jsonResponse({ url }, 200, origin, env);
  } catch {
    return jsonResponse({ error: 'Stripe Checkout Session was not created.' }, 502, origin, env);
  }
}

if (typeof Deno !== 'undefined' && (import.meta as unknown as { main?: boolean }).main) {
  Deno.serve(request => handleCreateCheckoutSession(request, Deno.env));
}
