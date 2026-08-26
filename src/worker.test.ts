import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './worker';

const env = {
  ASSETS: {
    fetch: vi.fn(),
  },
  VITE_SUPABASE_URL: 'https://ggflcriakiudnejmiuwh.supabase.co',
} as Parameters<typeof worker.fetch>[1];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('worker workbook asset proxy', () => {
  it('rejects non-workbook signed URLs', async () => {
    const response = await worker.fetch(new Request('https://vetoschool.eu/api/workbook-asset-proxy', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://example.com/storage/v1/object/sign/workbook-assets/file.png?token=bad',
      }),
    }), env);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_workbook_asset_url' });
  });

  it('proxies signed workbook asset URLs through the worker', async () => {
    const signedUrl = 'https://ggflcriakiudnejmiuwh.supabase.co/storage/v1/object/sign/workbook-assets/1785387148381-77xpfb.png?token=signed';
    const upstream = new Response('image-bytes', {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'set-cookie': 'secret=1',
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(upstream);
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://vetoschool.eu/api/workbook-asset-proxy', {
      method: 'POST',
      headers: { accept: 'image/png' },
      body: JSON.stringify({ url: signedUrl }),
    }), env);

    expect(fetchMock).toHaveBeenCalledWith(signedUrl, {
      method: 'GET',
      headers: { accept: 'image/png' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('set-cookie')).toBeNull();
    await expect(response.text()).resolves.toBe('image-bytes');
  });
});
