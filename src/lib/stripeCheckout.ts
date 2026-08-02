import type { DisplayCurrency, PricingPlanId } from './pricingCurrency';
import { supabase } from '@/integrations/supabase/client';

type StripeSessionResponse = {
  url?: string;
  error?: string;
};

export async function redirectToStripeCheckout(planId: PricingPlanId, _currency: DisplayCurrency) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error('Log in before paying so we can attach the subscription to your Vetoschool account.');
  }

  const { data: payload, error } = await supabase.functions.invoke<StripeSessionResponse>('create-checkout-session', {
    body: { planId },
  });

  if (error || !payload?.url) {
    throw new Error(payload?.error || error?.message || 'Could not create Stripe Checkout Session.');
  }

  window.location.assign(payload.url);
}

export async function redirectToStripeCustomerPortal() {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error('Log in to manage your subscription.');
  }

  const { data: payload, error } = await supabase.functions.invoke<StripeSessionResponse>('create-portal-session', {
    body: {},
  });

  if (error || !payload?.url) {
    throw new Error(payload?.error || error?.message || 'Could not open subscription management.');
  }

  window.location.assign(payload.url);
}
