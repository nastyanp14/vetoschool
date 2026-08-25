import type { DisplayCurrency, PricingPlanId } from './pricingCurrency';
import { supabase } from '@/integrations/supabase/client';

type StripeSessionResponse = {
  url?: string;
  checkoutUrl?: string;
  error?: string | { message?: string; code?: string };
  code?: string;
};

export class StripeCheckoutError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'StripeCheckoutError';
    this.code = code;
  }
}

function stripeErrorMessage(payload: StripeSessionResponse | null | undefined, fallback?: string) {
  if (typeof payload?.error === 'string') return payload.error;
  if (payload?.error?.message) return payload.error.message;
  return fallback || 'Could not create Stripe Checkout Session.';
}

function stripeErrorCode(payload: StripeSessionResponse | null | undefined) {
  if (payload?.code) return payload.code;
  if (typeof payload?.error === 'object' && payload.error?.code) return payload.error.code;
  return '';
}

// supabase.functions.invoke only reports "non-2xx status code"; the real JSON
// body (with the checkout error `code`) lives on the FunctionsHttpError context.
async function readErrorPayload(error: unknown): Promise<StripeSessionResponse | null> {
  const context = (error as { context?: Response })?.context;
  if (!context || typeof context.clone !== 'function') return null;
  try {
    return await context.clone().json() as StripeSessionResponse;
  } catch {
    return null;
  }
}

export async function redirectToStripeCheckout(planId: PricingPlanId, currency: DisplayCurrency) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new StripeCheckoutError(
      'Log in before paying so we can attach the subscription to your Vetoschool account.',
      'authentication_required',
    );
  }

  const { data: payload, error } = await supabase.functions.invoke<StripeSessionResponse>('create-checkout-session', {
    body: { planId, currency },
  });

  const errorPayload = payload || (error ? await readErrorPayload(error) : null);
  const checkoutUrl = errorPayload?.url || errorPayload?.checkoutUrl;
  if (error || !checkoutUrl) {
    throw new StripeCheckoutError(
      stripeErrorMessage(errorPayload, error?.message),
      stripeErrorCode(errorPayload) || 'stripe_api_error',
    );
  }

  window.location.assign(checkoutUrl);
}


export async function redirectToStripeCustomerPortal() {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error('Log in to manage your subscription.');
  }

  const response = await fetch('/api/stripe/create-portal-session', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const payload = await response.json().catch(() => null) as StripeSessionResponse | null;

  if (!response.ok || !payload?.url) {
    throw new Error(stripeErrorMessage(payload, 'Could not open subscription management.'));
  }

  window.location.assign(payload.url);
}
