import { corsHeaders, json, serviceClient } from '../_shared/edge.ts';
import {
  isHandledEvent,
  safeErrorMessage,
  stripePlanConfig,
  toIso,
  verifyStripeSignature,
} from '../_shared/stripeCore.ts';

type Json = Record<string, unknown>;

function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc as Json | undefined)?.[key], obj);
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function planFor(planId: string | null) {
  return planId ? stripePlanConfig[planId] ?? null : null;
}

async function resolveUserId(admin: ReturnType<typeof serviceClient>, opts: { metadataUserId: string | null; customerId: string | null; email: string | null }) {
  if (opts.metadataUserId) return opts.metadataUserId;
  if (opts.customerId) {
    const { data } = await admin.from('profiles').select('id').eq('stripe_customer_id', opts.customerId).maybeSingle();
    if (data?.id) return data.id as string;
  }
  if (opts.email) {
    const { data } = await admin.from('profiles').select('id').eq('email', opts.email).maybeSingle();
    if (data?.id) return data.id as string;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) {
    console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET is not configured');
    return json({ error: 'Webhook is not configured' }, 500);
  }

  // Signature is verified against the raw body before any parsing.
  const rawBody = await req.text();
  const valid = await verifyStripeSignature(rawBody, req.headers.get('stripe-signature'), secret);
  if (!valid) return json({ error: 'Invalid signature' }, 400);

  let event: Json;
  try {
    event = JSON.parse(rawBody) as Json;
  } catch {
    return json({ error: 'Invalid payload' }, 400);
  }

  const eventId = str(event.id);
  const eventType = str(event.type);
  if (!eventId || !eventType) return json({ error: 'Invalid payload' }, 400);

  const admin = serviceClient();
  const createdIso = toIso(event.created as number) || new Date().toISOString();

  // Idempotency gate: a duplicate delivery never reaches the business logic.
  const { error: insertError } = await admin.from('stripe_webhook_events').insert({
    event_id: eventId,
    event_type: eventType,
    stripe_created_at: createdIso,
    created_at_stripe: createdIso,
    livemode: Boolean(event.livemode),
    processing_status: 'processing',
    status: 'processing',
  });

  if (insertError) {
    if ((insertError as { code?: string }).code === '23505') {
      console.log('stripe-webhook duplicate event ignored', eventId, eventType);
      return json({ received: true, duplicate: true });
    }
    console.error('stripe-webhook could not record event', safeErrorMessage(insertError));
    return json({ error: 'Could not record event' }, 500);
  }

  if (!isHandledEvent(eventType)) {
    await admin
      .from('stripe_webhook_events')
      .update({ processing_status: 'ignored', status: 'ignored', processed_at: new Date().toISOString() })
      .eq('event_id', eventId);
    return json({ received: true, ignored: true });
  }

  try {
    const object = get(event, 'data.object');

    if (eventType === 'checkout.session.completed') {
      const customerId = str(get(object, 'customer'));
      const metadataUserId = str(get(object, 'metadata.user_id')) || str(get(object, 'client_reference_id'));
      const email = str(get(object, 'customer_details.email')) || str(get(object, 'customer_email'));
      const userId = await resolveUserId(admin, { metadataUserId, customerId, email });
      const planId = str(get(object, 'metadata.plan_id'));
      const plan = planFor(planId);
      if (!userId || !plan) throw new Error('Could not map checkout session to a user or plan');

      const subscriptionId = str(get(object, 'subscription'));
      await admin.rpc('apply_stripe_checkout_completed', {
        p_user_id: userId,
        p_stripe_event_id: eventId,
        p_checkout_session_id: str(get(object, 'id')),
        p_stripe_customer_id: customerId,
        p_stripe_subscription_id: subscriptionId,
        p_stripe_price_id: str(get(object, 'metadata.price_id')) || '',
        p_subscription_status: 'active',
        p_plan_id: plan.planId,
        p_lesson_format: plan.lessonFormat,
        p_lessons_total: plan.lessonsTotal,
        p_current_period_start: null,
        p_current_period_end: null,
        p_next_payment_date: null,
        p_customer_email: email,
        p_amount_total: (get(object, 'amount_total') as number) ?? null,
        p_currency: str(get(object, 'currency')),
      }).throwOnError();
    }

    if (eventType === 'invoice.paid') {
      const customerId = str(get(object, 'customer'));
      const lineMeta = get(object, 'lines.data.0.metadata');
      const planId = str(get(lineMeta, 'plan_id')) || str(get(object, 'subscription_details.metadata.plan_id'));
      const plan = planFor(planId);
      const email = str(get(object, 'customer_email'));
      const userId = await resolveUserId(admin, {
        metadataUserId: str(get(lineMeta, 'user_id')) || str(get(object, 'subscription_details.metadata.user_id')),
        customerId,
        email,
      });
      if (!userId) throw new Error('Could not map invoice to a user');

      await admin.rpc('apply_stripe_subscription_payment', {
        p_user_id: userId,
        p_event_type: eventType,
        p_stripe_event_id: eventId,
        p_checkout_session_id: null,
        p_stripe_invoice_id: str(get(object, 'id')),
        p_stripe_customer_id: customerId,
        p_stripe_subscription_id: str(get(object, 'subscription')),
        p_stripe_price_id: str(get(object, 'lines.data.0.price.id')) || '',
        p_subscription_status: 'active',
        p_plan_id: plan?.planId ?? planId ?? '',
        p_lesson_format: plan?.lessonFormat ?? '',
        p_lessons_total: plan?.lessonsTotal ?? 0,
        p_current_period_start: toIso(get(object, 'lines.data.0.period.start') as number),
        p_current_period_end: toIso(get(object, 'lines.data.0.period.end') as number),
        p_next_payment_date: toIso(get(object, 'next_payment_attempt') as number) || toIso(get(object, 'lines.data.0.period.end') as number),
        p_customer_email: email,
        p_amount_total: (get(object, 'amount_paid') as number) ?? null,
        p_currency: str(get(object, 'currency')),
      }).throwOnError();
    }

    if (eventType === 'invoice.payment_failed') {
      const customerId = str(get(object, 'customer'));
      const userId = await resolveUserId(admin, {
        metadataUserId: str(get(object, 'subscription_details.metadata.user_id')),
        customerId,
        email: str(get(object, 'customer_email')),
      });
      if (!userId) throw new Error('Could not map failed invoice to a user');

      await admin.rpc('apply_stripe_invoice_payment_failed', {
        p_user_id: userId,
        p_stripe_event_id: eventId,
        p_stripe_invoice_id: str(get(object, 'id')) || '',
        p_stripe_customer_id: customerId || '',
        p_stripe_subscription_id: str(get(object, 'subscription')) || '',
        p_subscription_status: 'past_due',
        p_payment_failed_at: new Date().toISOString(),
        p_next_payment_date: toIso(get(object, 'next_payment_attempt') as number),
        p_amount_due: (get(object, 'amount_due') as number) ?? null,
        p_currency: str(get(object, 'currency')),
        p_failure_reason: str(get(object, 'last_finalization_error.message')) || 'payment_failed',
      }).throwOnError();
    }

    if (eventType === 'customer.subscription.updated' || eventType === 'customer.subscription.deleted') {
      const customerId = str(get(object, 'customer'));
      const planId = str(get(object, 'metadata.plan_id'));
      const plan = planFor(planId);
      const userId = await resolveUserId(admin, {
        metadataUserId: str(get(object, 'metadata.user_id')),
        customerId,
        email: null,
      });
      if (!userId) throw new Error('Could not map subscription to a user');

      const canceled = eventType === 'customer.subscription.deleted';
      await admin.rpc('apply_stripe_subscription_state', {
        p_user_id: userId,
        p_stripe_customer_id: customerId,
        p_stripe_subscription_id: str(get(object, 'id')),
        p_subscription_status: canceled ? 'canceled' : str(get(object, 'status')) || 'active',
        p_current_period_start: toIso(get(object, 'current_period_start') as number),
        p_current_period_end: toIso(get(object, 'current_period_end') as number),
        p_next_payment_date: canceled ? null : toIso(get(object, 'current_period_end') as number),
        p_cancel_at_period_end: Boolean(get(object, 'cancel_at_period_end')),
        p_canceled_at: toIso(get(object, 'canceled_at') as number),
        p_stripe_price_id: str(get(object, 'items.data.0.price.id')),
        p_plan_id: plan?.planId ?? planId,
        p_lesson_format: plan?.lessonFormat ?? null,
      }).throwOnError();
    }

    await admin
      .from('stripe_webhook_events')
      .update({ processing_status: 'processed', status: 'processed', processed_at: new Date().toISOString() })
      .eq('event_id', eventId);

    return json({ received: true });
  } catch (error) {
    const message = safeErrorMessage(error, 'Processing failed');
    console.error('stripe-webhook processing failed', eventType, message);
    await admin
      .from('stripe_webhook_events')
      .update({ processing_status: 'failed', status: 'failed', error_message: message, processed_at: new Date().toISOString() })
      .eq('event_id', eventId);
    return json({ error: 'Processing failed' }, 500);
  }
});
