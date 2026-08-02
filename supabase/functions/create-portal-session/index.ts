import Stripe from 'npm:stripe@17.7.0';
import { corsHeaders, json, requireUser, serviceClient } from '../_shared/edge.ts';
import { assertPortalConfigurationId, assertProductionAppUrl, safeErrorMessage } from '../_shared/stripeCore.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = await requireUser(req);
    if ('error' in auth) return auth.error;

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return json({ error: 'Payments are not configured' }, 500);

    const appOrigin = assertProductionAppUrl(Deno.env.get('APP_URL'));
    const configuration = assertPortalConfigurationId(Deno.env.get('STRIPE_PORTAL_CONFIGURATION_ID'));

    // The customer is read from the authenticated profile only; the frontend cannot supply it.
    const admin = serviceClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', auth.userId)
      .maybeSingle();

    if (!profile?.stripe_customer_id) return json({ error: 'No active subscription found' }, 404);

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' as never });
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      configuration,
      return_url: `${appOrigin}/dashboard`,
    });

    if (!session.url) return json({ error: 'Could not open subscription management' }, 502);
    return json({ url: session.url });
  } catch (error) {
    console.error('create-portal-session failed', safeErrorMessage(error));
    return json({ error: safeErrorMessage(error, 'Could not open subscription management') }, 500);
  }
});
