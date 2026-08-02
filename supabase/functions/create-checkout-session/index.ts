import Stripe from 'npm:stripe@17.7.0';
import { corsHeaders, json, requireUser, serviceClient } from '../_shared/edge.ts';
import {
  assertProductionAppUrl,
  checkoutUrls,
  readCheckoutRequest,
  safeErrorMessage,
  type StripePlan,
} from '../_shared/stripeCore.ts';

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

/**
 * Resolves the trusted Stripe Price for a plan.
 * Priority: explicit STRIPE_PRICE_<PLAN> secret -> lookup_key on Stripe -> created from the
 * server-side plan config (idempotent thanks to the lookup key).
 */
async function resolvePrice(stripe: Stripe, plan: StripePlan): Promise<string> {
  const override = Deno.env.get(`STRIPE_PRICE_${plan.planId.toUpperCase().replace(/-/g, '_')}`);
  if (override) {
    const price = await stripe.prices.retrieve(override);
    if (!price.active || price.type !== 'recurring') throw new Error('Configured price is not an active subscription price');
    return price.id;
  }

  const found = await stripe.prices.list({ lookup_keys: [plan.lookupKey], active: true, limit: 1 });
  if (found.data.length > 0) return found.data[0].id;

  const product = await stripe.products.create({
    name: plan.productName,
    metadata: { plan_id: plan.planId, lesson_format: plan.lessonFormat, lessons_total: String(plan.lessonsTotal) },
  });
  const created = await stripe.prices.create({
    product: product.id,
    currency: plan.currency,
    unit_amount: plan.unitAmount,
    recurring: { interval: 'month' },
    lookup_key: plan.lookupKey,
    metadata: { plan_id: plan.planId },
  });
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = await requireUser(req);
    if ('error' in auth) return auth.error;

    if (!stripeKey) return json({ error: 'Payments are not configured' }, 500);
    const appOrigin = assertProductionAppUrl(Deno.env.get('APP_URL'));

    const body = await req.json().catch(() => null);
    const parsed = readCheckoutRequest(body);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const plan = parsed.plan;

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' as never });
    const priceId = await resolvePrice(stripe, plan);

    const admin = serviceClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('email, stripe_customer_id')
      .eq('id', auth.userId)
      .maybeSingle();

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        ...(profile?.stripe_customer_id
          ? { customer: profile.stripe_customer_id }
          : profile?.email
            ? { customer_email: profile.email }
            : {}),
        client_reference_id: auth.userId,
        metadata: { user_id: auth.userId, plan_id: plan.planId, lesson_format: plan.lessonFormat },
        subscription_data: {
          metadata: {
            user_id: auth.userId,
            plan_id: plan.planId,
            lesson_format: plan.lessonFormat,
            lessons_total: String(plan.lessonsTotal),
          },
        },
        ...checkoutUrls(appOrigin),
      },
      { idempotencyKey: `checkout:${auth.userId}:${plan.planId}:${Math.floor(Date.now() / 60000)}` },
    );

    if (!session.url) return json({ error: 'Could not create checkout session' }, 502);
    return json({ url: session.url });
  } catch (error) {
    console.error('create-checkout-session failed', safeErrorMessage(error));
    return json({ error: safeErrorMessage(error, 'Could not create checkout session') }, 500);
  }
});
