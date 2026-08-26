import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleCreatePortalSession } from '../../supabase/functions/create-portal-session/index';

const testEnv = new Map<string, string>([
  ['APP_URL', 'https://vetoschool.eu'],
  ['STRIPE_SECRET_KEY', 'sk_test_portal_unit'],
  ['STRIPE_PORTAL_CONFIGURATION_ID', 'bpc_unit_portal'],
  ['SUPABASE_URL', 'https://unit.supabase.co'],
  ['SUPABASE_ANON_KEY', 'anon_unit'],
]);

function env(overrides: Record<string, string | undefined> = {}) {
  const values = new Map(testEnv);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) values.delete(key);
    else values.set(key, value);
  }
  return {
    get(name: string) {
      return values.get(name);
    },
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function portalRequest(body: unknown = {}, token = 'user_access_token') {
  return new Request('https://unit.supabase.co/functions/v1/create-portal-session', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://vetoschool.eu',
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('create-portal-session Edge Function', () => {
  it('requires an authenticated Bearer token before calling Supabase or Stripe', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreatePortalSession(new Request(
      'https://unit.supabase.co/functions/v1/create-portal-session',
      { method: 'POST', body: JSON.stringify({}) },
    ), env());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Log in to manage your subscription.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates a Portal Session only for the authenticated profile customer and returns only the URL', async () => {
    let portalBody = '';
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/auth/v1/user')) {
        expect(init?.headers).toMatchObject({
          apikey: 'anon_unit',
          authorization: 'Bearer user_access_token',
        });
        return json({ id: 'user_portal_edge_1', email: 'student@example.com' });
      }

      if (url.includes('/rest/v1/profiles?id=eq.user_portal_edge_1')) {
        return json([{ id: 'user_portal_edge_1', email: 'student@example.com', stripe_customer_id: 'cus_profile_owner' }]);
      }

      if (url === 'https://api.stripe.com/v1/billing_portal/sessions') {
        portalBody = String(init?.body);
        expect(init?.headers).toMatchObject({
          authorization: 'Bearer sk_test_portal_unit',
          'content-type': 'application/x-www-form-urlencoded',
        });
        return json({ id: 'bps_test_portal', url: 'https://billing.stripe.com/p/session/test' });
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreatePortalSession(portalRequest({
      customer: 'cus_attacker',
    }), env());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body)).toEqual(['url']);
    expect(body.url).toBe('https://billing.stripe.com/p/session/test');

    const params = new URLSearchParams(portalBody);
    expect(params.get('customer')).toBe('cus_profile_owner');
    expect(params.get('customer')).not.toBe('cus_attacker');
    expect(params.get('configuration')).toBe('bpc_unit_portal');
    expect(params.get('return_url')).toBe('https://vetoschool.eu/dashboard');
    expect(portalBody).not.toContain('cus_attacker');
  });

  it('does not create a Portal Session without a profile stripe_customer_id', async () => {
    let portalCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/auth/v1/user')) {
        return json({ id: 'user_without_customer', email: 'student@example.com' });
      }

      if (url.includes('/rest/v1/profiles?id=eq.user_without_customer')) {
        return json([{ id: 'user_without_customer', email: 'student@example.com', stripe_customer_id: null }]);
      }

      if (url === 'https://api.stripe.com/v1/billing_portal/sessions') portalCalls += 1;

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreatePortalSession(portalRequest(), env());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('No Stripe subscription is connected to this Vetoschool account yet.');
    expect(portalCalls).toBe(0);
  });

  it('rejects non-production APP_URL values before creating Portal Session', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreatePortalSession(
      portalRequest(),
      env({ APP_URL: 'http://localhost:5173' }),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Portal APP_URL is not configured for production.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires STRIPE_PORTAL_CONFIGURATION_ID', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/auth/v1/user')) {
        return json({ id: 'user_portal_edge_1', email: 'student@example.com' });
      }

      if (url.includes('/rest/v1/profiles?id=eq.user_portal_edge_1')) {
        return json([{ id: 'user_portal_edge_1', email: 'student@example.com', stripe_customer_id: 'cus_profile_owner' }]);
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreatePortalSession(portalRequest(), env({
      STRIPE_PORTAL_CONFIGURATION_ID: undefined,
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Stripe Customer Portal is not configured on the server.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns sanitized Stripe diagnostics when Portal creation fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/auth/v1/user')) {
        return json({ id: 'user_portal_edge_1', email: 'student@example.com' });
      }

      if (url.includes('/rest/v1/profiles?id=eq.user_portal_edge_1')) {
        return json([{ id: 'user_portal_edge_1', email: 'student@example.com', stripe_customer_id: 'cus_profile_owner' }]);
      }

      if (url === 'https://api.stripe.com/v1/billing_portal/sessions') {
        return json({
          error: {
            type: 'invalid_request_error',
            code: 'resource_missing',
            message: "No such customer: 'cus_profile_owner'",
          },
        }, 400);
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreatePortalSession(portalRequest(), env());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: 'stripe_portal_error',
      error: "Stripe portal error: No such customer: 'cus_...'",
      diagnostic: {
        status: 400,
        type: 'invalid_request_error',
        code: 'resource_missing',
        message: "No such customer: 'cus_...'",
      },
    });
  });
});
