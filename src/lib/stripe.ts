import { supabase } from '@/integrations/supabase/client';

async function invoke<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body ?? {} });
  if (error) {
    const message = (data as { error?: string } | null)?.error || error.message;
    throw new Error(message || 'Request failed');
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

/** Starts a Stripe Checkout session for the signed-in user and redirects. */
export async function startCheckout(planId: string) {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    window.location.href = `/login?redirect=${encodeURIComponent(`/checkout/${planId}`)}`;
    return;
  }
  const { url } = await invoke<{ url: string }>('create-checkout-session', { planId });
  window.location.href = url;
}

/** Opens the Stripe customer portal for the signed-in user. */
export async function openBillingPortal() {
  const { url } = await invoke<{ url: string }>('create-portal-session');
  window.location.href = url;
}

/** Admin-only. Amount is in the smallest currency unit; omit it for a full refund. */
export async function createRefund(params: { paymentId: string; amount?: number; reason?: string }) {
  return invoke<{ refundId: string; amount: number; status: string; duplicate?: boolean }>('create-refund', {
    paymentId: params.paymentId,
    ...(params.amount !== undefined ? { amount: params.amount } : {}),
    ...(params.reason ? { reason: params.reason } : {}),
  });
}
