// Temporary read-only diagnostic: reports Stripe key mode and active product/price IDs.
// Returns no secret material.
declare const Deno: { env: { get(name: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };

async function stripeGet(path: string, key: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { authorization: `Bearer ${key}` },
  });
  return await res.json();
}

Deno.serve(async () => {
  const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
  const mode = key.startsWith('sk_live_') ? 'live' : key.startsWith('sk_test_') ? 'test' : 'unknown';
  const pk = Deno.env.get('STRIPE_PUBLISHABLE_KEY') || '';
  const pkMode = pk.startsWith('pk_live_') ? 'live' : pk.startsWith('pk_test_') ? 'test' : 'unknown';
  const whSet = Boolean(Deno.env.get('STRIPE_WEBHOOK_SECRET'));

  const prices = await stripeGet('prices?limit=100&active=true&expand[]=data.product', key) as {
    data?: Array<Record<string, unknown>>; error?: { message?: string };
  };
  const portalCfgId = Deno.env.get('STRIPE_PORTAL_CONFIGURATION_ID') || '';
  const portal = portalCfgId ? await stripeGet(`billing_portal/configurations/${portalCfgId}`, key) : null;
  const portalList = await stripeGet('billing_portal/configurations?limit=10', key);

  return new Response(JSON.stringify({
    secretKeyMode: mode,
    publishableKeyMode: pkMode,
    webhookSecretConfigured: whSet,
    pricesError: prices.error?.message || null,
    prices: (prices.data || []).map((p) => {
      const product = p.product as { id?: string; name?: string } | string | null;
      return {
        id: p.id,
        livemode: p.livemode,
        currency: p.currency,
        unit_amount: p.unit_amount,
        recurring: (p.recurring as { interval?: string } | null)?.interval || null,
        lookup_key: p.lookup_key,
        nickname: p.nickname,
        product_id: typeof product === 'string' ? product : product?.id,
        product_name: typeof product === 'string' ? null : product?.name,
      };
    }),
    portalConfigured: Boolean(portalCfgId),
    portal: portal && !(portal as { error?: unknown }).error
      ? { id: (portal as { id?: string }).id, livemode: (portal as { livemode?: boolean }).livemode, active: (portal as { active?: boolean }).active }
      : { error: (portal as { error?: { message?: string } } | null)?.error?.message || null },
    portalConfigurations: ((portalList as { data?: Array<Record<string, unknown>> }).data || []).map((c) => ({
      id: c.id, livemode: c.livemode, active: c.active, is_default: c.is_default,
    })),
  }, null, 2), { headers: { 'content-type': 'application/json' } });
});
