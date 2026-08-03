import type { DisplayCurrency, PricingPlanId } from './pricingCurrency';
import { supabase } from '@/integrations/supabase/client';

type StripeSessionResponse = {
  url?: string;
  checkoutUrl?: string;
  error?: string | { message?: string; code?: string };
  code?: string;
};

function stripeErrorMessage(payload: StripeSessionResponse | null | undefined, fallback?: string) {
  if (typeof payload?.error === 'string') return payload.error;
  if (payload?.error?.message) return payload.error.message;
  return fallback || 'Could not create Stripe Checkout Session.';
}

export async function redirectToStripeCheckout(planId: PricingPlanId, currency: DisplayCurrency) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error('Log in before paying so we can attach the subscription to your Vetoschool account.');
  }

  const { data: payload, error } = await supabase.functions.invoke<StripeSessionResponse>('create-checkout-session', {
    body: { planId, currency },
  });

  const checkoutUrl = payload?.url || payload?.checkoutUrl;
  if (error || !checkoutUrl) {
    throw new Error(stripeErrorMessage(payload, error?.message));
  }

  window.location.assign(checkoutUrl);
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
