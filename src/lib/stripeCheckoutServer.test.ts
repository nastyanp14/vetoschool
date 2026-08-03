import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleCreateStripeCheckoutSession, handleCreateStripePortalSession, handleCreateStripeRefund, handleStripeWebhook } from './stripeCheckoutServer';
import { STRIPE_PRICE_GROUP_PROGRESS, STRIPE_PRICE_INDIVIDUAL_PROGRESS } from './stripePrices';

const webhookSecret = 'whsec_test_local_idempotency';
const testEnv = {
  STRIPE_SECRET_KEY: 'sk_test_unit',
  STRIPE_WEBHOOK_SECRET: webhookSecret,
  VITE_SUPABASE_URL: 'https://unit.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service_role_unit',
};

function signedStripeRequest(event: unknown) {
  const rawBody = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return new Request('http://127.0.0.1:8080/api/stripe/webhook', {
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

function refundRequest(body: unknown) {
  return new Request('http://127.0.0.1:8080/api/stripe/create-refund', {
    method: 'POST',
    headers: {
      authorization: 'Bearer admin_access_token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('handleStripeWebhook', () => {
  it('returns 200 without reprocessing an already processed event id', async () => {
    const event = {
      id: `evt_test_idempotency_${Date.now()}`,
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
    };
    const stripeWebhookProcessor = vi.fn();
    const env = { STRIPE_WEBHOOK_SECRET: webhookSecret, stripeWebhookProcessor };

    const firstResponse = await handleStripeWebhook(signedStripeRequest(event), env);
    const firstBody = await firstResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstBody).toMatchObject({
      received: true,
      processed: true,
    });
    expect(stripeWebhookProcessor).toHaveBeenCalledTimes(1);

    const secondResponse = await handleStripeWebhook(signedStripeRequest(event), env);
    const secondBody = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(secondBody).toMatchObject({
      received: true,
      duplicate: true,
      status: 'processed',
    });
    expect(stripeWebhookProcessor).toHaveBeenCalledTimes(1);
  });

  it('creates Checkout Session only for authenticated users and sends safe metadata', async () => {
    let stripeCheckoutBody = '';
    let stripeCustomerBody = '';
    let profilePatchBody = '';
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/auth/v1/user')) {
        return json({ id: 'user_checkout_1', email: 'student@example.com' });
      }

      if (url.includes('/rest/v1/profiles?id=eq.user_checkout_1') && init?.method === 'PATCH') {
        profilePatchBody = String(init?.body);
        return new Response(null, { status: 204 });
      }

      if (url.includes('/rest/v1/profiles')) {
        return json([{ id: 'user_checkout_1', email: 'student@example.com', name: 'Student Test', stripe_customer_id: null }]);
      }

      if (url === 'https://api.stripe.com/v1/customers') {
        stripeCustomerBody = String(init?.body);
        return json({ id: 'cus_created_checkout' });
      }

      if (url === 'https://api.stripe.com/v1/checkout/sessions') {
        stripeCheckoutBody = String(init?.body);
        return json({ id: 'cs_test_checkout', url: 'https://checkout.stripe.test/session' });
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateStripeCheckoutSession(new Request('http://127.0.0.1:8080/api/create-checkout-session', {
      method: 'POST',
      headers: {
        authorization: 'Bearer user_access_token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ planId: 'group-progress', currency: 'CZK' }),
    }), testEnv);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      sessionId: 'cs_test_checkout',
      checkoutUrl: 'https://checkout.stripe.test/session',
      url: 'https://checkout.stripe.test/session',
    });
    expect(JSON.parse(profilePatchBody)).toEqual({ stripe_customer_id: 'cus_created_checkout' });

    const customerParams = new URLSearchParams(stripeCustomerBody);
    expect(customerParams.get('email')).toBe('student@example.com');
    expect(customerParams.get('name')).toBe('Student Test');
    expect(customerParams.get('metadata[user_id]')).toBe('user_checkout_1');
    expect(customerParams.get('metadata[profile_id]')).toBe('user_checkout_1');

    const params = new URLSearchParams(stripeCheckoutBody);
    expect(params.get('customer')).toBe('cus_created_checkout');
    expect(params.get('metadata[user_id]')).toBe('user_checkout_1');
    expect(params.get('metadata[profile_id]')).toBe('user_checkout_1');
    expect(params.get('metadata[plan_id]')).toBe('group-progress');
    expect(params.get('metadata[lesson_format]')).toBe('group');
    expect(params.get('metadata[lessons_per_month]')).toBe('8');
    expect(params.get('metadata[currency]')).toBe('czk');
    expect(params.get('subscription_data[metadata][user_id]')).toBe('user_checkout_1');
    expect(params.get('subscription_data[metadata][profile_id]')).toBe('user_checkout_1');
    expect(params.get('subscription_data[metadata][lessons_per_month]')).toBe('8');
    expect(params.get('subscription_data[metadata][currency]')).toBe('czk');
    expect(params.get('line_items[0][price]')).toBe(STRIPE_PRICE_GROUP_PROGRESS);
    expect(stripeCheckoutBody).not.toContain('customer_email');
  });

  it('rejects unauthenticated Customer Portal requests', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateStripePortalSession(new Request('http://127.0.0.1:8080/api/stripe/create-portal-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }), testEnv);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Log in to manage your subscription.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not create a Customer Portal session without profile stripe_customer_id', async () => {
    let portalCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/auth/v1/user')) {
        return json({ id: 'user_without_customer', email: 'student@example.com' });
      }

      if (url.includes('/rest/v1/profiles?id=eq.user_without_customer')) {
        return json([{ id: 'user_without_customer', email: 'student@example.com', stripe_customer_id: null }]);
      }

      if (url === 'https://api.stripe.com/v1/billing_portal/sessions') {
        portalCalls += 1;
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateStripePortalSession(new Request('http://127.0.0.1:8080/api/stripe/create-portal-session', {
      method: 'POST',
      headers: {
        authorization: 'Bearer user_access_token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    }), testEnv);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('No Stripe subscription is connected to this Vetoschool account yet.');
    expect(portalCalls).toBe(0);
  });

  it('creates a Customer Portal session only for the authenticated profile customer', async () => {
    let portalBody = '';
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/auth/v1/user')) {
        return json({ id: 'user_portal_1', email: 'student@example.com' });
      }

      if (url.includes('/rest/v1/profiles?id=eq.user_portal_1')) {
        return json([{ id: 'user_portal_1', email: 'student@example.com', stripe_customer_id: 'cus_profile_owner' }]);
      }

      if (url === 'https://api.stripe.com/v1/billing_portal/sessions') {
        portalBody = String(init?.body);
        return json({ id: 'bps_test_portal', url: 'https://billing.stripe.test/session' });
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateStripePortalSession(new Request('http://127.0.0.1:8080/api/stripe/create-portal-session', {
      method: 'POST',
      headers: {
        authorization: 'Bearer user_access_token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ customer: 'cus_attacker' }),
    }), { ...testEnv, STRIPE_PORTAL_CONFIGURATION_ID: 'bpc_at_period_end' });
    const body = await response.json();
    const params = new URLSearchParams(portalBody);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ url: 'https://billing.stripe.test/session' });
    expect(params.get('customer')).toBe('cus_profile_owner');
    expect(params.get('customer')).not.toBe('cus_attacker');
    expect(params.get('return_url')).toBe('http://127.0.0.1:8080/dashboard');
    expect(params.get('configuration')).toBe('bpc_at_period_end');
  });

  it('rejects Stripe refunds for non-admin users', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/auth/v1/user')) {
        return json({ id: 'teacher_1', email: 'teacher@example.com' });
      }

      if (url.includes('/rest/v1/user_roles')) {
        return json([]);
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateStripeRefund(refundRequest({
      stripePaymentId: 'payment_1',
      refundType: 'full',
      reason: 'Parent request',
      idempotencyKey: 'refund-admin-only-key',
    }), testEnv);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Only administrators can issue refunds.');
  });

  it('creates a full Stripe refund for the trusted available amount', async () => {
    let stripeRefundBody = '';
    let stripeRefundCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/auth/v1/user')) return json({ id: 'admin_1', email: 'admin@example.com' });
      if (url.includes('/rest/v1/user_roles')) return json([{ user_id: 'admin_1', role: 'admin' }]);
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
            latest_charge: { id: 'ch_test_1', amount: 480000, amount_refunded: 0, currency: 'czk', payment_intent: 'pi_test_1' },
          },
        });
      }
      if (url.includes('/rest/v1/stripe_payments?id=eq.payment_1') && init?.method === 'PATCH') return json({});
      if (url === 'https://api.stripe.com/v1/refunds') {
        stripeRefundCalls += 1;
        stripeRefundBody = String(init?.body);
        expect((init?.headers as Record<string, string>)['idempotency-key']).toBe('refund-full-key');
        return json({ id: 're_full_1', amount: 480000, currency: 'czk', status: 'succeeded', payment_intent: 'pi_test_1', charge: 'ch_test_1' });
      }
      if (url.endsWith('/rest/v1/stripe_refunds') && init?.method === 'POST') {
        return json([{ id: 'refund_row_1', user_id: 'student_1', stripe_payment_id: 'payment_1', stripe_refund_id: 're_full_1', amount: 480000, currency: 'czk', refund_type: 'full', reason: 'Parent request', status: 'succeeded', created_by_admin_id: 'admin_1', created_at: '2026-07-29T10:05:00.000Z', updated_at: '2026-07-29T10:05:00.000Z' }]);
      }
      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateStripeRefund(refundRequest({
      stripePaymentId: 'payment_1',
      refundType: 'full',
      reason: 'Parent request',
      idempotencyKey: 'refund-full-key',
    }), testEnv);
    const body = await response.json();
    const params = new URLSearchParams(stripeRefundBody);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ duplicate: false, availableAmountBeforeRefund: 480000 });
    expect(params.get('amount')).toBe('480000');
    expect(params.get('payment_intent')).toBe('pi_test_1');
    expect(stripeRefundCalls).toBe(1);
  });

  it('creates a partial Stripe refund for the requested amount', async () => {
    let stripeRefundBody = '';
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/auth/v1/user')) return json({ id: 'admin_1', email: 'admin@example.com' });
      if (url.includes('/rest/v1/user_roles')) return json([{ user_id: 'admin_1', role: 'admin' }]);
      if (url.includes('/rest/v1/stripe_refunds?idempotency_key=eq.refund-partial-key')) return json([]);
      if (url.includes('/rest/v1/stripe_payments?id=eq.payment_2') && init?.method !== 'PATCH') {
        return json([{ id: 'payment_2', user_id: 'student_2', checkout_session_id: null, stripe_invoice_id: 'in_test_2', stripe_customer_id: 'cus_test_2', stripe_subscription_id: 'sub_test_2', stripe_payment_intent_id: null, stripe_charge_id: null, plan_id: 'group-progress', lesson_format: 'group', amount_total: 240000, currency: 'czk', paid_at: '2026-07-29T10:00:00.000Z', created_at: '2026-07-29T10:00:00.000Z' }]);
      }
      if (url === 'https://api.stripe.com/v1/invoices/in_test_2?expand[]=payment_intent.latest_charge&expand[]=charge') {
        return json({ id: 'in_test_2', payment_intent: { id: 'pi_test_2', latest_charge: { id: 'ch_test_2', amount: 240000, amount_refunded: 40000, currency: 'czk', payment_intent: 'pi_test_2' } } });
      }
      if (url.includes('/rest/v1/stripe_payments?id=eq.payment_2') && init?.method === 'PATCH') return json({});
      if (url === 'https://api.stripe.com/v1/refunds') {
        stripeRefundBody = String(init?.body);
        return json({ id: 're_partial_1', amount: 50000, currency: 'czk', status: 'succeeded', payment_intent: 'pi_test_2', charge: 'ch_test_2' });
      }
      if (url.endsWith('/rest/v1/stripe_refunds') && init?.method === 'POST') {
        return json([{ id: 'refund_row_2', user_id: 'student_2', stripe_payment_id: 'payment_2', stripe_refund_id: 're_partial_1', amount: 50000, currency: 'czk', refund_type: 'partial', reason: 'Schedule conflict', status: 'succeeded', created_by_admin_id: 'admin_1', created_at: '2026-07-29T10:05:00.000Z', updated_at: '2026-07-29T10:05:00.000Z' }]);
      }
      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateStripeRefund(refundRequest({
      stripePaymentId: 'payment_2',
      refundType: 'partial',
      amount: 50000,
      reason: 'Schedule conflict',
      idempotencyKey: 'refund-partial-key',
    }), testEnv);
    const params = new URLSearchParams(stripeRefundBody);

    expect(response.status).toBe(200);
    expect(params.get('amount')).toBe('50000');
    expect(params.get('payment_intent')).toBe('pi_test_2');
  });

  it('returns an existing refund for a repeated idempotency key without calling Stripe again', async () => {
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

    const response = await handleCreateStripeRefund(refundRequest({
      stripePaymentId: 'payment_1',
      refundType: 'partial',
      amount: 10000,
      reason: 'Duplicate request',
      idempotencyKey: 'refund-repeat-key',
    }), testEnv);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ duplicate: true, refund: { stripe_refund_id: 're_existing_1' } });
    expect(stripeRefundCalls).toBe(0);
  });

  it('applies checkout.session.completed once for a repeated webhook event id', async () => {
    let webhookStatus: 'none' | 'processing' | 'processed' = 'none';
    let paymentApplyCalls = 0;
    let emailReserveCalls = 0;
    let sendPulseEmailCalls = 0;
    let telegramReserveCalls = 0;
    let telegramSendCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method !== 'POST' && init?.method !== 'PATCH') {
        return json(webhookStatus === 'none' ? [] : [{ event_id: 'evt_checkout_once', status: webhookStatus }]);
      }

      if (url.endsWith('/rest/v1/stripe_webhook_events') && init?.method === 'POST') {
        webhookStatus = 'processing';
        return new Response(null, { status: 201 });
      }

      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method === 'PATCH') {
        const payload = JSON.parse(String(init.body)) as { status?: 'processed' | 'failed' | 'ignored' };
        if (payload.status === 'processed') webhookStatus = 'processed';
        return new Response(null, { status: 204 });
      }

      if (url.includes('/checkout/sessions/cs_test_once/line_items')) {
        return json({ data: [{ price: { id: STRIPE_PRICE_GROUP_PROGRESS } }] });
      }

      if (url.includes('/subscriptions/sub_test_once')) {
        return json({
          id: 'sub_test_once',
          status: 'active',
          latest_invoice: 'in_test_once',
          current_period_start: 1785115600,
          current_period_end: 1787707600,
          items: { data: [{ price: { id: STRIPE_PRICE_GROUP_PROGRESS } }] },
        });
      }

      if (url.includes('/rest/v1/profiles')) {
        return json([{ id: 'user_webhook_1', email: 'student@example.com', stripe_customer_id: null }]);
      }

      if (url.endsWith('/rest/v1/rpc/apply_stripe_subscription_payment')) {
        paymentApplyCalls += 1;
        const payload = JSON.parse(String(init?.body));
        expect(payload).toMatchObject({
          p_user_id: 'user_webhook_1',
          p_event_type: 'checkout.session.completed',
          p_stripe_event_id: 'evt_checkout_once',
          p_checkout_session_id: 'cs_test_once',
          p_stripe_invoice_id: 'in_test_once',
          p_stripe_customer_id: 'cus_test_once',
          p_stripe_subscription_id: 'sub_test_once',
          p_stripe_price_id: STRIPE_PRICE_GROUP_PROGRESS,
          p_plan_id: 'group-progress',
          p_lesson_format: 'group',
          p_lessons_total: 8,
        });
        return json([{ payment_inserted: true, lessons_remaining: 8 }]);
      }

      if (url.endsWith('/rest/v1/email_notifications') && init?.method === 'POST') {
        emailReserveCalls += 1;
        const payload = JSON.parse(String(init?.body));
        expect(payload.notification_key).toBe('evt_checkout_once:email:checkout.session.completed');
        return json([{ id: 'email_checkout_once', notification_key: payload.notification_key, status: 'processing' }]);
      }

      if (url.includes('/rest/v1/email_notifications?id=eq.email_checkout_once') && init?.method === 'PATCH') {
        return json({});
      }

      if (url.endsWith('/rest/v1/telegram_notifications') && init?.method === 'POST') {
        telegramReserveCalls += 1;
        const payload = JSON.parse(String(init?.body));
        expect(payload.event_key).toBe(
          'evt_checkout_once:checkout.session.completed:telegram:stripe.checkout.session.completed:admin_chat_unit'
        );
        expect(payload.notification_type).toBe('stripe.checkout.session.completed');
        expect(payload.recipient_type).toBe('admin');
        expect(JSON.stringify(payload)).not.toContain('cus_test_once');
        expect(JSON.stringify(payload)).not.toContain('sub_test_once');
        return json([{ id: 'telegram_checkout_once', event_key: payload.event_key, status: 'pending' }]);
      }

      if (url.includes('/rest/v1/telegram_notifications?id=eq.telegram_checkout_once') && init?.method === 'PATCH') {
        const payload = JSON.parse(String(init?.body));
        expect(payload.status).toBe('sent');
        return json({});
      }

      if (url === 'https://api.sendpulse.com/oauth/access_token') {
        return json({ access_token: 'sp_unit_token' });
      }

      if (url === 'https://api.sendpulse.com/smtp/emails') {
        sendPulseEmailCalls += 1;
        return json({ id: 'sendpulse_email_1' });
      }

      if (url === 'https://api.telegram.org/bottelegram_unit_token/sendMessage') {
        telegramSendCalls += 1;
        const payload = JSON.parse(String(init?.body));
        expect(payload.chat_id).toBe('admin_chat_unit');
        expect(payload.text).toContain('Vetoschool: оплата прошла');
        expect(payload.text).not.toContain('cus_test_once');
        expect(payload.text).not.toContain('sub_test_once');
        return json({ ok: true, result: { message_id: 1 } });
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const event = {
      id: 'evt_checkout_once',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'cs_test_once',
          customer: 'cus_test_once',
          subscription: 'sub_test_once',
          invoice: 'in_test_once',
          customer_details: { email: 'student@example.com' },
          metadata: { user_id: 'user_webhook_1' },
          amount_total: 240000,
          currency: 'czk',
        },
      },
    };

    const emailEnv = {
      ...testEnv,
      SENDPULSE_CLIENT_ID: 'sendpulse_client',
      SENDPULSE_CLIENT_SECRET: 'sendpulse_secret',
      TELEGRAM_BOT_TOKEN: 'telegram_unit_token',
      TELEGRAM_ADMIN_CHAT_ID: 'admin_chat_unit',
    };
    const firstResponse = await handleStripeWebhook(signedStripeRequest(event), emailEnv);
    const firstBody = await firstResponse.json();
    const secondResponse = await handleStripeWebhook(signedStripeRequest(event), emailEnv);
    const secondBody = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstBody).toMatchObject({ received: true, processed: true });
    expect(secondResponse.status).toBe(200);
    expect(secondBody).toMatchObject({ received: true, duplicate: true, status: 'processed' });
    expect(paymentApplyCalls).toBe(1);
    expect(emailReserveCalls).toBe(1);
    expect(sendPulseEmailCalls).toBe(1);
    expect(telegramReserveCalls).toBe(1);
    expect(telegramSendCalls).toBe(1);
  });

  it('does not fail a confirmed checkout webhook when email and Telegram providers fail', async () => {
    let webhookStatus: 'none' | 'processing' | 'processed' = 'none';
    let paymentApplyCalls = 0;
    let failedEmailLogged = false;
    let failedTelegramLogged = false;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method !== 'POST' && init?.method !== 'PATCH') {
        return json(webhookStatus === 'none' ? [] : [{ event_id: 'evt_checkout_email_failed', status: webhookStatus }]);
      }
      if (url.endsWith('/rest/v1/stripe_webhook_events') && init?.method === 'POST') {
        webhookStatus = 'processing';
        return new Response(null, { status: 201 });
      }
      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method === 'PATCH') {
        const payload = JSON.parse(String(init.body)) as { status?: 'processed' | 'failed' | 'ignored' };
        if (payload.status === 'processed') webhookStatus = 'processed';
        return new Response(null, { status: 204 });
      }
      if (url.includes('/checkout/sessions/cs_test_email_failed/line_items')) {
        return json({ data: [{ price: { id: STRIPE_PRICE_GROUP_PROGRESS } }] });
      }
      if (url.includes('/subscriptions/sub_test_email_failed')) {
        return json({
          id: 'sub_test_email_failed',
          status: 'active',
          latest_invoice: 'in_test_email_failed',
          current_period_start: 1785115600,
          current_period_end: 1787707600,
          items: { data: [{ price: { id: STRIPE_PRICE_GROUP_PROGRESS } }] },
        });
      }
      if (url.includes('/rest/v1/profiles')) {
        return json([{ id: 'user_email_failed', email: 'student@example.com', stripe_customer_id: null }]);
      }
      if (url.endsWith('/rest/v1/rpc/apply_stripe_subscription_payment')) {
        paymentApplyCalls += 1;
        return json([{ payment_inserted: true, lessons_remaining: 8 }]);
      }
      if (url.endsWith('/rest/v1/email_notifications') && init?.method === 'POST') {
        return json([{ id: 'email_failed_row', notification_key: 'evt_checkout_email_failed:email:checkout.session.completed', status: 'processing' }]);
      }
      if (url === 'https://api.sendpulse.com/oauth/access_token') {
        return json({ access_token: 'sp_unit_token' });
      }
      if (url === 'https://api.sendpulse.com/smtp/emails') {
        return json({ message: 'temporary email provider failure' }, 500);
      }
      if (url.includes('/rest/v1/email_notifications?id=eq.email_failed_row') && init?.method === 'PATCH') {
        const payload = JSON.parse(String(init.body)) as { status?: string; error_message?: string };
        failedEmailLogged = payload.status === 'failed' && Boolean(payload.error_message);
        return json({});
      }

      if (url.endsWith('/rest/v1/telegram_notifications') && init?.method === 'POST') {
        return json([{ id: 'telegram_failed_row', event_key: 'evt_checkout_email_failed:checkout.session.completed:telegram:admin_1', status: 'pending' }]);
      }

      if (url === 'https://api.telegram.org/bottelegram_unit_token/sendMessage') {
        return json({ ok: false, description: 'temporary telegram provider failure' }, 500);
      }

      if (url.includes('/rest/v1/telegram_notifications?id=eq.telegram_failed_row') && init?.method === 'PATCH') {
        const payload = JSON.parse(String(init.body)) as { status?: string; error?: string };
        failedTelegramLogged = payload.status === 'failed' && Boolean(payload.error);
        return json({});
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const event = {
      id: 'evt_checkout_email_failed',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'cs_test_email_failed',
          customer: 'cus_test_email_failed',
          subscription: 'sub_test_email_failed',
          invoice: 'in_test_email_failed',
          customer_details: { email: 'student@example.com' },
          metadata: { user_id: 'user_email_failed' },
          amount_total: 240000,
          currency: 'czk',
        },
      },
    };

    const response = await handleStripeWebhook(signedStripeRequest(event), {
      ...testEnv,
      SENDPULSE_CLIENT_ID: 'sendpulse_client',
      SENDPULSE_CLIENT_SECRET: 'sendpulse_secret',
      TELEGRAM_BOT_TOKEN: 'telegram_unit_token',
      TELEGRAM_ADMIN_CHAT_ID: 'admin_chat_unit',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ received: true, processed: true });
    expect(paymentApplyCalls).toBe(1);
    expect(failedEmailLogged).toBe(true);
    expect(failedTelegramLogged).toBe(true);
  });

  it('does not double-credit the first subscription invoice after checkout.session.completed', async () => {
    const webhookStatuses = new Map<string, 'processing' | 'processed'>();
    const creditedInvoiceIds = new Set<string>();
    let lessonsCredited = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method !== 'POST' && init?.method !== 'PATCH') {
        const eventId = decodeURIComponent(new URL(url).searchParams.get('event_id')?.replace('eq.', '') || '');
        const status = webhookStatuses.get(eventId);
        return json(status ? [{ event_id: eventId, status }] : []);
      }

      if (url.endsWith('/rest/v1/stripe_webhook_events') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as { event_id: string };
        webhookStatuses.set(payload.event_id, 'processing');
        return new Response(null, { status: 201 });
      }

      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method === 'PATCH') {
        const eventId = decodeURIComponent(new URL(url).searchParams.get('event_id')?.replace('eq.', '') || '');
        const payload = JSON.parse(String(init.body)) as { status?: 'processed' | 'failed' | 'ignored' };
        if (payload.status === 'processed') webhookStatuses.set(eventId, 'processed');
        return new Response(null, { status: 204 });
      }

      if (url.includes('/checkout/sessions/cs_first_payment/line_items')) {
        return json({ data: [{ price: { id: STRIPE_PRICE_GROUP_PROGRESS } }] });
      }

      if (url.includes('/subscriptions/sub_first_payment')) {
        return json({
          id: 'sub_first_payment',
          customer: 'cus_first_payment',
          status: 'active',
          latest_invoice: 'in_first_payment',
          current_period_start: 1785115600,
          current_period_end: 1787707600,
          items: { data: [{ price: { id: STRIPE_PRICE_GROUP_PROGRESS } }] },
        });
      }

      if (url.includes('/rest/v1/profiles?id=eq.user_first_payment')) {
        return json([{ id: 'user_first_payment', email: 'student@example.com', stripe_customer_id: null }]);
      }

      if (url.includes('/rest/v1/profiles?stripe_customer_id=eq.cus_first_payment')) {
        return json([{ id: 'user_first_payment', email: 'student@example.com', stripe_customer_id: 'cus_first_payment', stripe_subscription_id: 'sub_first_payment' }]);
      }

      if (url.endsWith('/rest/v1/rpc/apply_stripe_subscription_payment')) {
        const payload = JSON.parse(String(init?.body));
        const invoiceId = payload.p_stripe_invoice_id as string;
        const inserted = !creditedInvoiceIds.has(invoiceId);
        if (inserted) {
          creditedInvoiceIds.add(invoiceId);
          lessonsCredited += payload.p_lessons_total;
        }
        return json([{ payment_inserted: inserted, lessons_remaining: lessonsCredited }]);
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const checkoutEvent = {
      id: 'evt_checkout_first_payment',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'cs_first_payment',
          customer: 'cus_first_payment',
          subscription: 'sub_first_payment',
          invoice: 'in_first_payment',
          customer_details: { email: 'student@example.com' },
          metadata: { user_id: 'user_first_payment' },
          amount_total: 240000,
          currency: 'czk',
        },
      },
    };
    const invoiceEvent = {
      id: 'evt_invoice_first_payment',
      type: 'invoice.paid',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'in_first_payment',
          customer: 'cus_first_payment',
          subscription: 'sub_first_payment',
          status: 'paid',
          paid: true,
          amount_paid: 240000,
          currency: 'czk',
          customer_email: 'student@example.com',
          lines: { data: [{ period: { start: 1785115600, end: 1787707600 }, price: { id: STRIPE_PRICE_GROUP_PROGRESS } }] },
        },
      },
    };

    const checkoutResponse = await handleStripeWebhook(signedStripeRequest(checkoutEvent), testEnv);
    const invoiceResponse = await handleStripeWebhook(signedStripeRequest(invoiceEvent), testEnv);

    expect(checkoutResponse.status).toBe(200);
    expect(invoiceResponse.status).toBe(200);
    expect(lessonsCredited).toBe(8);
  });

  it('does not reprocess or re-credit a repeated invoice.paid event id', async () => {
    const webhookStatuses = new Map<string, 'processing' | 'processed'>();
    let invoiceApplyCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method !== 'POST' && init?.method !== 'PATCH') {
        const eventId = decodeURIComponent(new URL(url).searchParams.get('event_id')?.replace('eq.', '') || '');
        const status = webhookStatuses.get(eventId);
        return json(status ? [{ event_id: eventId, status }] : []);
      }

      if (url.endsWith('/rest/v1/stripe_webhook_events') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as { event_id: string };
        webhookStatuses.set(payload.event_id, 'processing');
        return new Response(null, { status: 201 });
      }

      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method === 'PATCH') {
        const eventId = decodeURIComponent(new URL(url).searchParams.get('event_id')?.replace('eq.', '') || '');
        const payload = JSON.parse(String(init.body)) as { status?: 'processed' | 'failed' | 'ignored' };
        if (payload.status === 'processed') webhookStatuses.set(eventId, 'processed');
        return new Response(null, { status: 204 });
      }

      if (url.includes('/subscriptions/sub_repeat_invoice')) {
        return json({
          id: 'sub_repeat_invoice',
          customer: 'cus_repeat_invoice',
          status: 'active',
          current_period_start: 1787707600,
          current_period_end: 1790386000,
          items: { data: [{ price: { id: STRIPE_PRICE_GROUP_PROGRESS } }] },
        });
      }

      if (url.includes('/rest/v1/profiles?stripe_customer_id=eq.cus_repeat_invoice')) {
        return json([{ id: 'user_repeat_invoice', email: 'student@example.com', stripe_customer_id: 'cus_repeat_invoice', stripe_subscription_id: 'sub_repeat_invoice' }]);
      }

      if (url.endsWith('/rest/v1/rpc/apply_stripe_subscription_payment')) {
        invoiceApplyCalls += 1;
        const payload = JSON.parse(String(init?.body));
        expect(payload).toMatchObject({
          p_event_type: 'invoice.paid',
          p_stripe_event_id: 'evt_invoice_repeat',
          p_stripe_invoice_id: 'in_repeat_invoice',
          p_stripe_customer_id: 'cus_repeat_invoice',
          p_stripe_subscription_id: 'sub_repeat_invoice',
          p_stripe_price_id: STRIPE_PRICE_GROUP_PROGRESS,
          p_plan_id: 'group-progress',
          p_lessons_total: 8,
        });
        return json([{ payment_inserted: true, lessons_remaining: 16 }]);
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const event = {
      id: 'evt_invoice_repeat',
      type: 'invoice.paid',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'in_repeat_invoice',
          customer: 'cus_repeat_invoice',
          subscription: 'sub_repeat_invoice',
          status: 'paid',
          paid: true,
          amount_paid: 240000,
          currency: 'czk',
          customer_email: 'student@example.com',
          lines: { data: [{ period: { start: 1787707600, end: 1790386000 }, price: { id: STRIPE_PRICE_GROUP_PROGRESS } }] },
        },
      },
    };

    const firstResponse = await handleStripeWebhook(signedStripeRequest(event), testEnv);
    const firstBody = await firstResponse.json();
    const secondResponse = await handleStripeWebhook(signedStripeRequest(event), testEnv);
    const secondBody = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstBody).toMatchObject({ received: true, processed: true });
    expect(secondResponse.status).toBe(200);
    expect(secondBody).toMatchObject({ received: true, duplicate: true, status: 'processed' });
    expect(invoiceApplyCalls).toBe(1);
  });

  it('records a repeated invoice.payment_failed once without changing lesson balance', async () => {
    const webhookStatuses = new Map<string, 'processing' | 'processed'>();
    let failureApplyCalls = 0;
    let lessonsRemaining = 8;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method !== 'POST' && init?.method !== 'PATCH') {
        const eventId = decodeURIComponent(new URL(url).searchParams.get('event_id')?.replace('eq.', '') || '');
        const status = webhookStatuses.get(eventId);
        return json(status ? [{ event_id: eventId, status }] : []);
      }

      if (url.endsWith('/rest/v1/stripe_webhook_events') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as { event_id: string };
        webhookStatuses.set(payload.event_id, 'processing');
        return new Response(null, { status: 201 });
      }

      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method === 'PATCH') {
        const eventId = decodeURIComponent(new URL(url).searchParams.get('event_id')?.replace('eq.', '') || '');
        const payload = JSON.parse(String(init.body)) as { status?: 'processed' | 'failed' | 'ignored' };
        if (payload.status === 'processed') webhookStatuses.set(eventId, 'processed');
        return new Response(null, { status: 204 });
      }

      if (url.includes('/subscriptions/sub_failed_invoice')) {
        return json({
          id: 'sub_failed_invoice',
          customer: 'cus_failed_invoice',
          status: 'past_due',
          current_period_end: 1790386000,
          items: { data: [{ price: { id: STRIPE_PRICE_GROUP_PROGRESS } }] },
        });
      }

      if (url.includes('/rest/v1/profiles?stripe_customer_id=eq.cus_failed_invoice')) {
        return json([{ id: 'user_failed_invoice', email: 'student@example.com', stripe_customer_id: 'cus_failed_invoice', stripe_subscription_id: 'sub_failed_invoice' }]);
      }

      if (url.endsWith('/rest/v1/rpc/apply_stripe_invoice_payment_failed')) {
        failureApplyCalls += 1;
        const payload = JSON.parse(String(init?.body));
        expect(payload).toMatchObject({
          p_user_id: 'user_failed_invoice',
          p_stripe_event_id: 'evt_invoice_failed_repeat',
          p_stripe_invoice_id: 'in_failed_repeat',
          p_stripe_customer_id: 'cus_failed_invoice',
          p_stripe_subscription_id: 'sub_failed_invoice',
          p_subscription_status: 'past_due',
          p_amount_due: 240000,
          p_currency: 'czk',
        });
        expect(payload.p_lessons_total).toBeUndefined();
        return json([{ failure_inserted: true, lessons_remaining: lessonsRemaining }]);
      }

      if (url.endsWith('/rest/v1/rpc/apply_stripe_subscription_payment')) {
        throw new Error('invoice.payment_failed must not use the lesson-crediting payment RPC');
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const event = {
      id: 'evt_invoice_failed_repeat',
      type: 'invoice.payment_failed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'in_failed_repeat',
          customer: 'cus_failed_invoice',
          subscription: 'sub_failed_invoice',
          status: 'open',
          paid: false,
          amount_due: 240000,
          currency: 'czk',
          next_payment_attempt: 1790386000,
          payment_intent: {
            last_payment_error: {
              code: 'card_declined',
              message: 'Your card was declined.',
            },
          },
        },
      },
    };

    const firstResponse = await handleStripeWebhook(signedStripeRequest(event), testEnv);
    const firstBody = await firstResponse.json();
    lessonsRemaining = 8;
    const secondResponse = await handleStripeWebhook(signedStripeRequest(event), testEnv);
    const secondBody = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstBody).toMatchObject({ received: true, processed: true });
    expect(secondResponse.status).toBe(200);
    expect(secondBody).toMatchObject({ received: true, duplicate: true, status: 'processed' });
    expect(failureApplyCalls).toBe(1);
    expect(lessonsRemaining).toBe(8);
  });

  it('updates subscription state from customer.subscription.updated without crediting lessons', async () => {
    const webhookStatuses = new Map<string, 'processing' | 'processed'>();
    let subscriptionStateCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method !== 'POST' && init?.method !== 'PATCH') {
        const eventId = decodeURIComponent(new URL(url).searchParams.get('event_id')?.replace('eq.', '') || '');
        const status = webhookStatuses.get(eventId);
        return json(status ? [{ event_id: eventId, status }] : []);
      }

      if (url.endsWith('/rest/v1/stripe_webhook_events') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as { event_id: string };
        webhookStatuses.set(payload.event_id, 'processing');
        return new Response(null, { status: 201 });
      }

      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method === 'PATCH') {
        const eventId = decodeURIComponent(new URL(url).searchParams.get('event_id')?.replace('eq.', '') || '');
        const payload = JSON.parse(String(init.body)) as { status?: 'processed' | 'failed' | 'ignored' };
        if (payload.status === 'processed') webhookStatuses.set(eventId, 'processed');
        return new Response(null, { status: 204 });
      }

      if (url.includes('/rest/v1/profiles?stripe_customer_id=eq.cus_subscription_update')) {
        return json([{ id: 'user_subscription_update', email: 'student@example.com', stripe_customer_id: 'cus_subscription_update', stripe_subscription_id: 'sub_subscription_update' }]);
      }

      if (url.includes('/rest/v1/profiles?email=')) {
        throw new Error('subscription.updated must not look up profiles by email');
      }

      if (url.endsWith('/rest/v1/rpc/apply_stripe_subscription_state')) {
        subscriptionStateCalls += 1;
        const payload = JSON.parse(String(init?.body));
        expect(payload).toMatchObject({
          p_user_id: 'user_subscription_update',
          p_stripe_customer_id: 'cus_subscription_update',
          p_stripe_subscription_id: 'sub_subscription_update',
          p_subscription_status: 'active',
          p_current_period_start: '2026-08-26T19:13:20.000Z',
          p_current_period_end: '2026-09-26T19:13:20.000Z',
          p_next_payment_date: '2026-09-26T19:13:20.000Z',
          p_cancel_at_period_end: false,
          p_canceled_at: null,
          p_stripe_price_id: STRIPE_PRICE_INDIVIDUAL_PROGRESS,
          p_plan_id: 'individual-progress',
          p_lesson_format: 'individual',
        });
        expect(payload.p_lessons_total).toBeUndefined();
        return json([{ lessons_remaining: 8 }]);
      }

      if (url.endsWith('/rest/v1/rpc/apply_stripe_subscription_payment')) {
        throw new Error('subscription.updated must not use the lesson-crediting payment RPC');
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const event = {
      id: 'evt_subscription_update',
      type: 'customer.subscription.updated',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'sub_subscription_update',
          customer: 'cus_subscription_update',
          status: 'active',
          current_period_start: 1787771600,
          current_period_end: 1790450000,
          cancel_at_period_end: false,
          canceled_at: null,
          items: { data: [{ price: { id: STRIPE_PRICE_INDIVIDUAL_PROGRESS } }] },
        },
      },
    };

    const response = await handleStripeWebhook(signedStripeRequest(event), testEnv);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ received: true, processed: true });
    expect(subscriptionStateCalls).toBe(1);
  });

  it('keeps access state untouched when subscription is set to cancel at period end', async () => {
    const webhookStatuses = new Map<string, 'processing' | 'processed'>();
    let subscriptionStateCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method !== 'POST' && init?.method !== 'PATCH') {
        const eventId = decodeURIComponent(new URL(url).searchParams.get('event_id')?.replace('eq.', '') || '');
        const status = webhookStatuses.get(eventId);
        return json(status ? [{ event_id: eventId, status }] : []);
      }

      if (url.endsWith('/rest/v1/stripe_webhook_events') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as { event_id: string };
        webhookStatuses.set(payload.event_id, 'processing');
        return new Response(null, { status: 201 });
      }

      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method === 'PATCH') {
        const eventId = decodeURIComponent(new URL(url).searchParams.get('event_id')?.replace('eq.', '') || '');
        const payload = JSON.parse(String(init.body)) as { status?: 'processed' | 'failed' | 'ignored' };
        if (payload.status === 'processed') webhookStatuses.set(eventId, 'processed');
        return new Response(null, { status: 204 });
      }

      if (url.includes('/rest/v1/profiles?stripe_customer_id=eq.cus_cancel_period')) {
        return json([{ id: 'user_cancel_period', email: 'student@example.com', stripe_customer_id: 'cus_cancel_period', stripe_subscription_id: 'sub_cancel_period' }]);
      }

      if (url.endsWith('/rest/v1/rpc/apply_stripe_subscription_state')) {
        subscriptionStateCalls += 1;
        const payload = JSON.parse(String(init?.body));
        expect(payload).toMatchObject({
          p_user_id: 'user_cancel_period',
          p_stripe_customer_id: 'cus_cancel_period',
          p_stripe_subscription_id: 'sub_cancel_period',
          p_subscription_status: 'active',
          p_current_period_end: '2026-09-26T19:13:20.000Z',
          p_next_payment_date: '2026-09-26T19:13:20.000Z',
          p_cancel_at_period_end: true,
          p_canceled_at: null,
          p_stripe_price_id: STRIPE_PRICE_GROUP_PROGRESS,
          p_plan_id: 'group-progress',
          p_lesson_format: 'group',
        });
        expect(payload.p_lessons_remaining).toBeUndefined();
        expect(payload.p_access_status).toBeUndefined();
        return json([{ lessons_remaining: 8 }]);
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const event = {
      id: 'evt_subscription_cancel_period',
      type: 'customer.subscription.updated',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'sub_cancel_period',
          customer: 'cus_cancel_period',
          status: 'active',
          current_period_start: 1787771600,
          current_period_end: 1790450000,
          cancel_at_period_end: true,
          canceled_at: null,
          items: { data: [{ price: { id: STRIPE_PRICE_GROUP_PROGRESS } }] },
        },
      },
    };

    const response = await handleStripeWebhook(signedStripeRequest(event), testEnv);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ received: true, processed: true });
    expect(subscriptionStateCalls).toBe(1);
  });

  it('marks a deleted subscription as canceled once for repeated event delivery', async () => {
    const webhookStatuses = new Map<string, 'processing' | 'processed'>();
    let subscriptionStateCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method !== 'POST' && init?.method !== 'PATCH') {
        const eventId = decodeURIComponent(new URL(url).searchParams.get('event_id')?.replace('eq.', '') || '');
        const status = webhookStatuses.get(eventId);
        return json(status ? [{ event_id: eventId, status }] : []);
      }

      if (url.endsWith('/rest/v1/stripe_webhook_events') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as { event_id: string };
        webhookStatuses.set(payload.event_id, 'processing');
        return new Response(null, { status: 201 });
      }

      if (url.includes('/rest/v1/stripe_webhook_events') && init?.method === 'PATCH') {
        const eventId = decodeURIComponent(new URL(url).searchParams.get('event_id')?.replace('eq.', '') || '');
        const payload = JSON.parse(String(init.body)) as { status?: 'processed' | 'failed' | 'ignored' };
        if (payload.status === 'processed') webhookStatuses.set(eventId, 'processed');
        return new Response(null, { status: 204 });
      }

      if (url.includes('/rest/v1/profiles?stripe_customer_id=eq.cus_deleted_subscription')) {
        return json([{ id: 'user_deleted_subscription', email: 'student@example.com', stripe_customer_id: 'cus_deleted_subscription', stripe_subscription_id: 'sub_deleted_subscription' }]);
      }

      if (url.endsWith('/rest/v1/rpc/apply_stripe_subscription_state')) {
        subscriptionStateCalls += 1;
        const payload = JSON.parse(String(init?.body));
        expect(payload).toMatchObject({
          p_user_id: 'user_deleted_subscription',
          p_stripe_customer_id: 'cus_deleted_subscription',
          p_stripe_subscription_id: 'sub_deleted_subscription',
          p_subscription_status: 'canceled',
          p_current_period_end: '2026-09-26T19:13:20.000Z',
          p_next_payment_date: null,
          p_cancel_at_period_end: false,
          p_canceled_at: '2026-09-26T19:13:20.000Z',
          p_stripe_price_id: null,
          p_plan_id: null,
          p_lesson_format: null,
        });
        expect(payload.p_lessons_total).toBeUndefined();
        return json([{ lessons_remaining: 8 }]);
      }

      if (url.endsWith('/rest/v1/rpc/apply_stripe_subscription_payment')) {
        throw new Error('subscription.deleted must not use the lesson-crediting payment RPC');
      }

      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const event = {
      id: 'evt_subscription_deleted_repeat',
      type: 'customer.subscription.deleted',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'sub_deleted_subscription',
          customer: 'cus_deleted_subscription',
          status: 'canceled',
          current_period_start: 1787771600,
          current_period_end: 1790450000,
          cancel_at_period_end: false,
          canceled_at: 1790450000,
          items: { data: [{ price: { id: STRIPE_PRICE_GROUP_PROGRESS } }] },
        },
      },
    };

    const firstResponse = await handleStripeWebhook(signedStripeRequest(event), testEnv);
    const firstBody = await firstResponse.json();
    const secondResponse = await handleStripeWebhook(signedStripeRequest(event), testEnv);
    const secondBody = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstBody).toMatchObject({ received: true, processed: true });
    expect(secondResponse.status).toBe(200);
    expect(secondBody).toMatchObject({ received: true, duplicate: true, status: 'processed' });
    expect(subscriptionStateCalls).toBe(1);
  });
});
