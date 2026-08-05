// Temporary one-off: create a live billing portal configuration if none exists.
declare const Deno: { env: { get(name: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };

Deno.serve(async () => {
  const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
  const body = new URLSearchParams();
  body.set('business_profile[headline]', 'Vetoschool subscription management');
  body.set('business_profile[privacy_policy_url]', 'https://vetoschool.eu/privacy-policy');
  body.set('business_profile[terms_of_service_url]', 'https://vetoschool.eu/privacy-policy');
  body.set('features[customer_update][enabled]', 'true');
  body.set('features[customer_update][allowed_updates][]', 'email');
  body.set('features[customer_update][allowed_updates][]', 'address');
  body.set('features[customer_update][allowed_updates][]', 'name');
  body.set('features[invoice_history][enabled]', 'true');
  body.set('features[payment_method_update][enabled]', 'true');
  body.set('features[subscription_cancel][enabled]', 'true');
  body.set('features[subscription_cancel][mode]', 'at_period_end');
  body.set('default_return_url', 'https://vetoschool.eu/dashboard');

  const res = await fetch('https://api.stripe.com/v1/billing_portal/configurations', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await res.json() as Record<string, unknown>;
  return new Response(JSON.stringify({
    status: res.status,
    id: payload.id ?? null,
    livemode: payload.livemode ?? null,
    active: payload.active ?? null,
    error: (payload as { error?: { message?: string } }).error?.message ?? null,
  }, null, 2), { headers: { 'content-type': 'application/json' } });
});
