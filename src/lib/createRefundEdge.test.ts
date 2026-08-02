import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleCreateRefund } from '../../supabase/functions/create-refund/index';

const testEnv = new Map<string, string>([
  ['APP_URL', 'https://vetoschool.eu'],
  ['STRIPE_SECRET_KEY', 'sk_test_refund_unit'],
  ['SUPABASE_URL', 'https://unit.supabase.co'],
  ['SUPABASE_ANON_KEY', 'anon_unit'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'service_role_unit'],
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

function refundRequest(body: unknown, token = 'admin_access_token') {
  return new Request('https://unit.supabase.co/functions/v1/create-refund', {
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

describe('create-refund Edge Function', () => {
  it('rejects non-admin users before reading payments or calling Stripe', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/auth/v1/user')) return json({ id: 'teacher_1', email: 'teacher@example.com' });
      if (url.includes('/rest/v1/user_roles')) return json([]);

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateRefund(refundRequest({
      stripePaymentId: 'payment_1',
      refundType: 'full',
      reason: 'Parent request',
      idempotencyKey: 'refund-admin-only-key',
    }), env());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Only administrators can issue refunds.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('creates a full refund for the trusted available amount and ignores frontend amount', async () => {
    let stripeRefundBody = '';
    let stripeRefundCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/auth/v1/user')) {
        expect(init?.headers).toMatchObject({
          apikey: 'anon_unit',
          authorization: 'Bearer admin_access_token',
        });
        return json({ id: 'admin_1', email: 'admin@example.com' });
      }
      if (url.includes('/rest/v1/user_roles')) {
        expect(init?.headers).toMatchObject({
          apikey: 'service_role_unit',
          authorization: 'Bearer service_role_unit',
        });
        return json([{ user_id: 'admin_1', role: 'admin' }]);
      }
      if (url.includes('/rest/v1/stripe_refunds?idempotency_key=eq.refund-full-key')) return json([]);
      if (url.includes('/rest/v1/stripe_payments?id=eq.payment_1') && init?.method !== 'PATCH') {
        return json([{
          id: 'payment_1',
          user_id: 'student_1',
          checkout_session_id: 'cs_test_1',
          stripe_invoice_id: 'in_test_1',
          stripe_customer_id: 'cus_test_1',
          stripe_subscription_id: 'sub_test_1',
          stripe_payment_intent_id: null,
          stripe_charge_id: null,
          plan_id: 'individual-intensive',
          lesson_format: 'individual',
          amount_total: 480000,
          currency: 'czk',
          paid_at: '2026-07-29T10:00:00.000Z',
          created_at: '2026-07-29T10:00:00.000Z',
        }]);
      }
      if (url === 'https://api.stripe.com/v1/invoices/in_test_1?expand[]=payment_intent.latest_charge&expand[]=charge') {
        return json({
          id: 'in_test_1',
          payment_intent: {
            id: 'pi_test_1',
            latest_charge: { id: 'ch_test_1', amount: 480000, amount_refunded: 30000, currency: 'czk', payment_intent: 'pi_test_1' },
          },
        });
      }
      if (url.includes('/rest/v1/stripe_payments?id=eq.payment_1') && init?.method === 'PATCH') return json({});
      if (url === 'https://api.stripe.com/v1/refunds') {
        stripeRefundCalls += 1;
        stripeRefundBody = String(init?.body);
        expect((init?.headers as Record<string, string>)['idempotency-key']).toBe('refund-full-key');
        return json({ id: 're_full_1', amount: 450000, currency: 'czk', status: 'succeeded', payment_intent: 'pi_test_1', charge: 'ch_test_1' });
      }
      if (url.endsWith('/rest/v1/stripe_refunds') && init?.method === 'POST') {
        return json([{ id: 'refund_row_1', user_id: 'student_1', stripe_payment_id: 'payment_1', stripe_refund_id: 're_full_1', stripe_payment_intent_id: 'pi_test_1', stripe_charge_id: 'ch_test_1', idempotency_key: 'refund-full-key', amount: 450000, currency: 'czk', refund_type: 'full', reason: 'Parent request', status: 'succeeded', created_by_admin_id: 'admin_1', created_at: '2026-07-29T10:05:00.000Z', updated_at: '2026-07-29T10:05:00.000Z' }]);
      }
      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateRefund(refundRequest({
      stripePaymentId: 'payment_1',
      refundType: 'full',
      amount: 1,
      reason: 'Parent request',
      idempotencyKey: 'refund-full-key',
    }), env());
    const body = await response.json();
    const params = new URLSearchParams(stripeRefundBody);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ duplicate: false, availableAmountBeforeRefund: 450000 });
    expect(params.get('amount')).toBe('450000');
    expect(params.get('payment_intent')).toBe('pi_test_1');
    expect(params.get('metadata[source]')).toBe('vetoschool_admin');
    expect(params.get('metadata[stripe_payment_id]')).toBe('payment_1');
    expect(params.get('metadata[user_id]')).toBe('student_1');
    expect(params.get('metadata[refund_type]')).toBe('full');
    expect(stripeRefundCalls).toBe(1);
  });

  it('returns an existing refund for a repeated idempotency key without calling Stripe', async () => {
    let stripeRefundCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/auth/v1/user')) return json({ id: 'admin_1', email: 'admin@example.com' });
      if (url.includes('/rest/v1/user_roles')) return json([{ user_id: 'admin_1', role: 'admin' }]);
      if (url.includes('/rest/v1/stripe_refunds?idempotency_key=eq.refund-repeat-key')) {
        return json([{ id: 'refund_existing_1', user_id: 'student_1', stripe_payment_id: 'payment_1', stripe_refund_id: 're_existing_1', amount: 10000, currency: 'czk', refund_type: 'partial', reason: 'Duplicate request', status: 'succeeded', created_by_admin_id: 'admin_1', created_at: '2026-07-29T10:05:00.000Z', updated_at: '2026-07-29T10:05:00.000Z' }]);
      }
      if (url === 'https://api.stripe.com/v1/refunds') stripeRefundCalls += 1;
      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateRefund(refundRequest({
      stripePaymentId: 'payment_1',
      refundType: 'partial',
      amount: 10000,
      reason: 'Duplicate request',
      idempotencyKey: 'refund-repeat-key',
    }), env());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ duplicate: true, refund: { stripe_refund_id: 're_existing_1' } });
    expect(stripeRefundCalls).toBe(0);
  });
});
