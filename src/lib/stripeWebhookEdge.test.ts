import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleStripeWebhook } from '../../supabase/functions/stripe-webhook/index';

const webhookSecret = 'whsec_edge_webhook_unit';

const testEnv = {
  STRIPE_SECRET_KEY: 'sk_test_edge_webhook',
  STRIPE_WEBHOOK_SECRET: webhookSecret,
  SUPABASE_URL: 'https://unit.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service_role_unit',
  APP_URL: 'https://vetoschool.eu',
};

function signedStripeRequest(event: unknown) {
  const rawBody = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return new Request('https://unit.supabase.co/functions/v1/stripe-webhook', {
    method: 'POST',
    headers: {
      'stripe-signature': `t=${timestamp},v1=${signature}`,
      'content-type': 'application/json',
    },
    body: rawBody,
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('stripe-webhook Edge Function', () => {
  it('verifies Stripe-Signature before processing the event', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleStripeWebhook(new Request('https://unit.supabase.co/functions/v1/stripe-webhook', {
      method: 'POST',
      headers: {
        'stripe-signature': 't=123,v1=invalid',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ id: 'evt_bad_signature', type: 'checkout.session.completed', created: 1785347000, livemode: false }),
    }), testEnv);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid Stripe webhook signature.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 200 for duplicate processed events and does not run business processing again', async () => {
    const stripeWebhookProcessor = vi.fn();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/rest/v1/stripe_webhook_events?event_id=eq.evt_duplicate_edge')) {
        return json([{ event_id: 'evt_duplicate_edge', status: 'processed', processing_status: 'processed' }]);
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleStripeWebhook(signedStripeRequest({
      id: 'evt_duplicate_edge',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: { object: { id: 'cs_duplicate_edge' } },
    }), { ...testEnv, stripeWebhookProcessor });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      received: true,
      duplicate: true,
      status: 'processed',
    });
    expect(stripeWebhookProcessor).not.toHaveBeenCalled();
  });

  it('processes checkout completion idempotently and skips email or Telegram failures without failing webhook', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/rest/v1/stripe_webhook_events?event_id=eq.evt_checkout_edge') && init?.method !== 'PATCH') {
        return json([]);
      }

      if (url.endsWith('/rest/v1/stripe_webhook_events') && init?.method === 'POST') {
        return json({}, 201);
      }

      if (url === 'https://api.stripe.com/v1/checkout/sessions/cs_edge_1/line_items?limit=1&expand[]=data.price') {
        return json({ data: [{ price: { id: 'price_1U0xKDLixIIR8RHzQan57liX' } }] });
      }

      if (url === 'https://api.stripe.com/v1/subscriptions/sub_edge_1?expand[]=items.data.price&expand[]=latest_invoice') {
        return json({
          id: 'sub_edge_1',
          status: 'active',
          current_period_start: 1785347000,
          current_period_end: 1787939000,
          latest_invoice: 'in_edge_1',
          items: {
            data: [{
              current_period_start: 1785347000,
              current_period_end: 1787939000,
              price: { id: 'price_1U0xKDLixIIR8RHzQan57liX' },
            }],
          },
        });
      }

      if (url.includes('/rest/v1/profiles?id=eq.student_edge_1')) {
        return json([{ id: 'student_edge_1', email: 'student@example.com', name: 'Student Edge', stripe_customer_id: 'cus_edge_1' }]);
      }

      if (url.endsWith('/rest/v1/rpc/apply_stripe_subscription_payment')) {
        return json([{ payment_inserted: true, lessons_remaining: 8 }]);
      }

      if (url.endsWith('/rest/v1/email_notifications') && init?.method === 'POST') {
        return json({ error: 'notification table unavailable in test' }, 404);
      }

      if (url.includes('/rest/v1/stripe_webhook_events?event_id=eq.evt_checkout_edge') && init?.method === 'PATCH') {
        return json({});
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleStripeWebhook(signedStripeRequest({
      id: 'evt_checkout_edge',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'cs_edge_1',
          customer: 'cus_edge_1',
          subscription: 'sub_edge_1',
          customer_email: 'student@example.com',
          payment_status: 'paid',
          invoice: 'in_edge_1',
          amount_total: 240000,
          currency: 'czk',
          metadata: { user_id: 'student_edge_1' },
        },
      },
    }), testEnv);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ received: true, processed: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://unit.supabase.co/rest/v1/rpc/apply_stripe_subscription_payment',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://unit.supabase.co/rest/v1/email_notifications',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
