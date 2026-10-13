import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './worker';

const env = {
  ASSETS: {
    fetch: vi.fn(),
  },
  VITE_SUPABASE_URL: 'https://ggflcriakiudnejmiuwh.supabase.co',
} as Parameters<typeof worker.fetch>[1];

const spaHtml = `<!doctype html><html><head>
  <title>Vetoschool</title>
  <meta name="description" content="Default description" />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="https://vetoschool.eu/" />
  <meta property="og:title" content="Vetoschool" />
  <meta property="og:description" content="Default description" />
  <meta property="og:url" content="https://vetoschool.eu/" />
  <meta name="twitter:title" content="Vetoschool" />
  <meta name="twitter:description" content="Default description" />
</head><body><div id="root"></div></body></html>`;

function createSpaEnv() {
  return {
    ...env,
    ASSETS: {
      fetch: vi.fn().mockResolvedValue(new Response(spaHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })),
    },
  };
}

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

describe('worker error pages', () => {
  it('serves the 500 route with matching metadata and HTTP status', async () => {
    const response = await worker.fetch(new Request('https://vetoschool.eu/500', {
      headers: { accept: 'text/html' },
    }), createSpaEnv());

    expect(response.status).toBe(500);
    expect(response.statusText).toBe('Internal Server Error');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBeNull();

    const body = await response.text();
    expect(body).toContain('<title>Internal Server Error | Vetoschool</title>');
    expect(body).toContain('<meta name="robots" content="noindex,nofollow" />');
    expect(body).toContain('<link rel="canonical" href="https://vetoschool.eu/500" />');
  });

  it('serves the 503 route with matching metadata and HTTP status', async () => {
    const response = await worker.fetch(new Request('https://vetoschool.eu/503', {
      headers: { accept: 'text/html' },
    }), createSpaEnv());

    expect(response.status).toBe(503);
    expect(response.statusText).toBe('Service Unavailable');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('300');

    const body = await response.text();
    expect(body).toContain('<title>Service Temporarily Unavailable | Vetoschool</title>');
    expect(body).toContain('<meta name="robots" content="noindex,nofollow" />');
    expect(body).toContain('<link rel="canonical" href="https://vetoschool.eu/503" />');
  });
});

describe('worker Meet routes', () => {
  it.each([
    ['/preview/conferences', 'Vetoschool Meet Preview'],
    ['/classroom/design-preview', 'Vetoschool Meet'],
  ])('serves the SPA shell for %s', async (pathname, title) => {
    const response = await worker.fetch(new Request(`https://vetoschool.eu${pathname}`, {
      headers: { accept: 'text/html' },
    }), createSpaEnv());

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain(`<title>${title}</title>`);
    expect(body).toContain('<meta name="robots" content="noindex,nofollow" />');
  });
});
