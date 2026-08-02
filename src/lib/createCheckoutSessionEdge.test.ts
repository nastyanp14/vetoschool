import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleCreateCheckoutSession } from '../../supabase/functions/create-checkout-session/index';

const testEnv = new Map<string, string>([
  ['APP_URL', 'https://vetoschool.eu'],
  ['STRIPE_SECRET_KEY', 'sk_test_edge_unit'],
  ['SUPABASE_URL', 'https://unit.supabase.co'],
  ['SUPABASE_ANON_KEY', 'anon_unit'],
]);

function env(overrides: Record<string, string> = {}) {
  const values = new Map(testEnv);
  for (const [key, value] of Object.entries(overrides)) values.set(key, value);
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

function checkoutRequest(body: unknown, token = 'user_access_token') {
  return new Request('https://unit.supabase.co/functions/v1/create-checkout-session', {
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

describe('create-checkout-session Edge Function', () => {
  it('requires an authenticated Bearer token before calling Supabase or Stripe', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateCheckoutSession(new Request(
      'https://unit.supabase.co/functions/v1/create-checkout-session',
      { method: 'POST', body: JSON.stringify({ planId: 'group-progress' }) },
    ), env());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain('Log in before paying');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates a subscription Checkout Session from trusted plan config and returns only the URL', async () => {
    let stripeCheckoutBody = '';
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/auth/v1/user')) {
        expect(init?.headers).toMatchObject({
          apikey: 'anon_unit',
          authorization: 'Bearer user_access_token',
        });
        return json({ id: 'user_checkout_edge_1', email: 'student@example.com' });
      }

      if (url.includes('/rest/v1/profiles?id=eq.user_checkout_edge_1')) {
        return json([{ id: 'user_checkout_edge_1', email: 'student@example.com', stripe_customer_id: 'cus_existing' }]);
      }

      if (url === 'https://api.stripe.com/v1/checkout/sessions') {
        stripeCheckoutBody = String(init?.body);
        expect(init?.headers).toMatchObject({
          authorization: 'Bearer sk_test_edge_unit',
          'content-type': 'application/x-www-form-urlencoded',
        });
        return json({ id: 'cs_test_edge', url: 'https://checkout.stripe.com/c/pay/cs_test_edge' });
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateCheckoutSession(checkoutRequest({
      planId: 'group-progress',
      priceId: 'price_attacker_supplied',
      userId: 'attacker_user_id',
    }), env());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body)).toEqual(['url']);
    expect(body.url).toBe('https://checkout.stripe.com/c/pay/cs_test_edge');

    const params = new URLSearchParams(stripeCheckoutBody);
    expect(params.get('mode')).toBe('subscription');
    expect(params.get('success_url')).toBe('https://vetoschool.eu/payment/success?session_id={CHECKOUT_SESSION_ID}');
    expect(params.get('cancel_url')).toBe('https://vetoschool.eu/payment/cancel');
    expect(params.get('line_items[0][price]')).toBe('price_1TxbAFLCIsxnginY7Mlaf63r');
    expect(params.get('line_items[0][price]')).not.toBe('price_attacker_supplied');
    expect(params.get('client_reference_id')).toBe('user_checkout_edge_1');
    expect(params.get('customer')).toBe('cus_existing');
    expect(params.get('metadata[user_id]')).toBe('user_checkout_edge_1');
    expect(params.get('metadata[plan_id]')).toBe('group-progress');
    expect(params.get('metadata[lesson_format]')).toBe('group');
    expect(params.get('subscription_data[metadata][user_id]')).toBe('user_checkout_edge_1');
    expect(params.get('subscription_data[metadata][plan_id]')).toBe('group-progress');
    expect(params.get('subscription_data[metadata][lesson_format]')).toBe('group');
    expect(stripeCheckoutBody).not.toContain('price_attacker_supplied');
    expect(stripeCheckoutBody).not.toContain('attacker_user_id');
  });

  it('rejects non-production APP_URL values before creating Checkout', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateCheckoutSession(
      checkoutRequest({ planId: 'group-progress' }),
      env({ APP_URL: 'http://127.0.0.1:5173' }),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Checkout APP_URL is not configured for production.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
