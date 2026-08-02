import Stripe from 'npm:stripe@17.7.0';
import { corsHeaders, json, requireAdmin, serviceClient } from '../_shared/edge.ts';
import { refundType, safeErrorMessage, validateRefundAmount } from '../_shared/stripeCore.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Role is verified server-side against user_roles. No admin flag from the client.
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return json({ error: 'Payments are not configured' }, 500);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return json({ error: 'Invalid request body' }, 400);

    const paymentId = body.paymentId;
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 300) : 'requested_by_customer';
    if (typeof paymentId !== 'string' || !/^[0-9a-f-]{36}$/i.test(paymentId)) {
      return json({ error: 'Invalid payment id' }, 400);
    }

    const admin = serviceClient();
    const { data: payment, error: paymentError } = await admin
      .from('stripe_payments')
      .select('id, user_id, amount_total, currency, stripe_payment_intent_id, stripe_charge_id')
      .eq('id', paymentId)
      .maybeSingle();
    if (paymentError || !payment) return json({ error: 'Payment not found' }, 404);
    if (!payment.stripe_payment_intent_id && !payment.stripe_charge_id) {
      return json({ error: 'This payment cannot be refunded' }, 400);
    }

    const { data: existingRefunds } = await admin
      .from('stripe_refunds')
      .select('amount, status')
      .eq('stripe_payment_id', payment.id);
    const alreadyRefunded = (existingRefunds || [])
      .filter((row) => row.status !== 'failed' && row.status !== 'canceled')
      .reduce((sum, row) => sum + (row.amount || 0), 0);

    const requestedAmount = body.amount === undefined || body.amount === null ? (payment.amount_total || 0) - alreadyRefunded : body.amount;
    const validated = validateRefundAmount({
      amount: requestedAmount,
      paymentAmount: payment.amount_total || 0,
      alreadyRefunded,
    });
    if (!validated.ok) return json({ error: validated.error }, 400);

    // Protects against double clicks and duplicate refunds for the same amount.
    const idempotencyKey =
      typeof body.idempotencyKey === 'string' && body.idempotencyKey.length >= 8
        ? body.idempotencyKey.slice(0, 120)
        : `refund:${payment.id}:${validated.amount}`;

    const { data: duplicate } = await admin
      .from('stripe_refunds')
      .select('id, stripe_refund_id, amount, status')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (duplicate) {
      return json({ refundId: duplicate.stripe_refund_id, amount: duplicate.amount, status: duplicate.status, duplicate: true });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' as never });
    const refund = await stripe.refunds.create(
      {
        ...(payment.stripe_payment_intent_id
          ? { payment_intent: payment.stripe_payment_intent_id }
          : { charge: payment.stripe_charge_id! }),
        amount: validated.amount,
        metadata: { payment_id: payment.id, admin_user_id: auth.userId, reason },
      },
      { idempotencyKey },
    );

    // A bookkeeping or notification failure must never undo a successful Stripe refund.
    try {
      await admin.from('stripe_refunds').insert({
        user_id: payment.user_id,
        stripe_payment_id: payment.id,
        stripe_refund_id: refund.id,
        stripe_payment_intent_id: payment.stripe_payment_intent_id,
        stripe_charge_id: payment.stripe_charge_id,
        idempotency_key: idempotencyKey,
        amount: validated.amount,
        currency: payment.currency || 'czk',
        refund_type: refundType(validated.amount + alreadyRefunded, payment.amount_total || 0),
        reason,
        status: refund.status || 'pending',
        created_by_admin_id: auth.userId,
      });
    } catch (bookkeepingError) {
      console.error('refund recorded in Stripe but not in the database', safeErrorMessage(bookkeepingError));
    }

    return json({ refundId: refund.id, amount: validated.amount, status: refund.status });
  } catch (error) {
    console.error('create-refund failed', safeErrorMessage(error));
    return json({ error: safeErrorMessage(error, 'Refund failed') }, 500);
  }
});
