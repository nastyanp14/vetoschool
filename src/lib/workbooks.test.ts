import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  createSignedUrl: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
    storage: {
      from: mocks.from,
    },
  },
}));

import { signedUrlFor } from './workbooks';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  mocks.getSession.mockReset();
  mocks.onAuthStateChange.mockReset();
  mocks.createSignedUrl.mockReset();
  mocks.from.mockReset();
});

describe('signedUrlFor', () => {
  it('waits for an auth session before signing private workbook assets', async () => {
    let authCallback: ((event: string, session: unknown) => void) | undefined;
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.onAuthStateChange.mockImplementation(callback => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mocks.from.mockReturnValue({ createSignedUrl: mocks.createSignedUrl });
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://ggflcriakiudnejmiuwh.supabase.co/storage/v1/object/sign/workbook-assets/asset.png?token=ok' },
      error: null,
    });

    const result = signedUrlFor('asset.png');
    await Promise.resolve();

    expect(mocks.createSignedUrl).not.toHaveBeenCalled();

    authCallback?.('SIGNED_IN', { access_token: 'user-token' });
    await expect(result).resolves.toContain('/storage/v1/object/sign/workbook-assets/asset.png');
    expect(mocks.from).toHaveBeenCalledWith('workbook-assets');
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('asset.png', 3600);
  });

  it('retries masked private-storage 404s after the auth session is ready', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'user-token' } } });
    mocks.onAuthStateChange.mockImplementation(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }));
    mocks.from.mockReturnValue({ createSignedUrl: mocks.createSignedUrl });
    mocks.createSignedUrl
      .mockResolvedValueOnce({
        data: null,
        error: { name: 'StorageApiError', statusCode: '404', message: 'Object not found' },
      })
      .mockResolvedValueOnce({
        data: { signedUrl: 'https://ggflcriakiudnejmiuwh.supabase.co/storage/v1/object/sign/workbook-assets/retried.png?token=ok' },
        error: null,
      });

    await expect(signedUrlFor('retried.png')).resolves.toContain('/storage/v1/object/sign/workbook-assets/retried.png');
    expect(mocks.createSignedUrl).toHaveBeenCalledTimes(2);
  });

  it('keeps full URLs unchanged', async () => {
    await expect(signedUrlFor('https://example.com/image.png')).resolves.toBe('https://example.com/image.png');
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
