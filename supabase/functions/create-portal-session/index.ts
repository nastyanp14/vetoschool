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

type VetoschoolProfile = {
  id: string;
  email?: string | null;
  stripe_customer_id?: string | null;
};

type StripePortalSessionResponse = {
  id?: string;
  url?: string;
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
  const configuredOrigins = envValue(env, ['PORTAL_ALLOWED_ORIGINS', 'CORS_ALLOWED_ORIGINS'])
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

async function requireAuthenticatedUser(request: Request, env: RuntimeEnv): Promise<SupabaseAuthUser> {
  const accessToken = authorizationBearerToken(request);
  if (!accessToken) throw new Error('portal_auth_required');

  const response = await fetch(`${supabaseUrl(env)}/auth/v1/user`, {
    headers: supabaseUserHeaders(env, accessToken),
  });

  if (!response.ok) throw new Error('portal_auth_invalid');

  const user = await response.json() as SupabaseAuthUser;
  if (!user.id) throw new Error('portal_auth_invalid');

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

function dashboardReturnUrl(appUrl: string) {
  return `${appUrl}/dashboard`;
}

async function createStripePortalUrl(input: {
  env: RuntimeEnv;
  stripeCustomerId: string;
  appUrl: string;
}) {
  const secretKey = requireEnv(input.env, ['STRIPE_SECRET_KEY'], 'stripe_secret_key_missing');
  const configurationId = requireEnv(
    input.env,
    ['STRIPE_PORTAL_CONFIGURATION_ID'],
    'stripe_portal_configuration_id_missing',
  );

  const portalBody = new URLSearchParams({
    customer: input.stripeCustomerId,
    return_url: dashboardReturnUrl(input.appUrl),
    configuration: configurationId,
  });

  const stripeResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: portalBody,
  });

  const stripePayload = await stripeResponse.json() as StripePortalSessionResponse;
  if (!stripeResponse.ok || !stripePayload.url) {
    console.warn('[create-portal-session]', {
      stage: 'stripe_portal_session',
      status: stripeResponse.status,
      stripeErrorType: stripePayload.error?.type || null,
      stripeErrorCode: stripePayload.error?.code || null,
    });
    throw new Error('stripe_portal_session_failed');
  }

  return stripePayload.url;
}

function runtimeEnv() {
  if (typeof Deno === 'undefined') throw new Error('deno_runtime_required');
  return Deno.env;
}

export async function handleCreatePortalSession(request: Request, env: RuntimeEnv = runtimeEnv()) {
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
    return jsonResponse({ error: 'Portal APP_URL is not configured for production.' }, 500, origin, env);
  }

  let user: SupabaseAuthUser;
  try {
    user = await requireAuthenticatedUser(request, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'portal_auth_required';
    const status = message === 'portal_auth_required' || message === 'portal_auth_invalid' ? 401 : 500;
    return jsonResponse({
      error: status === 401
        ? 'Log in to manage your subscription.'
        : 'Subscription management is not configured on the server.',
    }, status, origin, env);
  }

  let profile: VetoschoolProfile | null = null;
  try {
    profile = await loadProfileById(user.id || '', request, env);
  } catch {
    return jsonResponse({ error: 'Vetoschool profile lookup failed.' }, 500, origin, env);
  }

  const stripeCustomerId = profile?.stripe_customer_id?.trim();
  if (!profile || !stripeCustomerId) {
    return jsonResponse({ error: 'No Stripe subscription is connected to this Vetoschool account yet.' }, 409, origin, env);
  }

  try {
    const url = await createStripePortalUrl({
      env,
      stripeCustomerId,
      appUrl,
    });

    return jsonResponse({ url }, 200, origin, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'stripe_secret_key_missing' || message === 'stripe_portal_configuration_id_missing' ? 500 : 502;
    const responseMessage = status === 500
      ? 'Stripe Customer Portal is not configured on the server.'
      : 'Could not open subscription management. Please try again later.';
    return jsonResponse({ error: responseMessage }, status, origin, env);
  }
}

if (typeof Deno !== 'undefined' && import.meta.main) {
  Deno.serve(request => handleCreatePortalSession(request, Deno.env));
}
