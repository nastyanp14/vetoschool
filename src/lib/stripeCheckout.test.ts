import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from '@/integrations/supabase/client';
import { redirectToStripeCustomerPortal } from './stripeCheckout';

const mockedSupabase = supabase as unknown as {
  auth: { getSession: ReturnType<typeof vi.fn> };
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('redirectToStripeCustomerPortal', () => {
  it('posts the authenticated session to the Worker portal endpoint', async () => {
    const assign = vi.fn();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      url: 'https://billing.stripe.com/p/session/test',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    mockedSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'user_access_token' } },
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { location: { assign } });

    await redirectToStripeCustomerPortal();

    expect(fetchMock).toHaveBeenCalledWith('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: {
        authorization: 'Bearer user_access_token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(assign).toHaveBeenCalledWith('https://billing.stripe.com/p/session/test');
  });

  it('fails before the endpoint call when there is no auth session', async () => {
    const fetchMock = vi.fn();
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    vi.stubGlobal('fetch', fetchMock);

    await expect(redirectToStripeCustomerPortal()).rejects.toThrow('Log in to manage your subscription.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
