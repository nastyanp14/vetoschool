import { handleCreateStripeCheckoutSession, handleCreateStripePortalSession, handleCreateStripeRefund, handleStripeWebhook } from './lib/stripeCheckoutServer';
import { resolveRouteMeta, SITE_URL } from './lib/routeMeta';

type AssetsBinding = {
  fetch(input: Request | string | URL): Promise<Response>;
};

interface Env {
  ASSETS: AssetsBinding;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PORTAL_CONFIGURATION_ID?: string;
  SUCCESS_URL?: string;
  CANCEL_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SENDPULSE_CLIENT_ID?: string;
  SENDPULSE_CLIENT_SECRET?: string;
  SENDPULSE_FROM_EMAIL?: string;
  SENDPULSE_FROM_NAME?: string;
  SENDPULSE_EMAIL_ENDPOINT?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ADMIN_CHAT_ID?: string;
  TELEGRAM_ADMIN_CHAT_IDS?: string;
  APP_URL?: string;
  PUBLIC_APP_URL?: string;
}

const VALID_SPA_ROUTES = new Set([
  '/',
  '/login',
  '/register',
  '/auth/check-email',
  '/auth/callback',
  '/auth/confirmed',
  '/auth/link-expired',
  '/forgot-password',
  '/reset-password',
  '/pending-activation',
  '/account/security',
  '/dashboard',
  '/admin',
  '/teacher',
  '/cookie-policy',
  '/privacy-policy',
  '/trial-booking',
  '/pricing',
  '/payment/success',
  '/payment/cancel',
]);

const WORKBOOK_ASSET_PROXY_PATH = '/api/workbook-asset-proxy';
const WORKBOOK_ASSET_SIGNED_PATH_PREFIX = '/storage/v1/object/sign/workbook-assets/';

function normalizePathname(pathname: string) {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '');
}

function isValidSpaRoute(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);
  return (
    VALID_SPA_ROUTES.has(normalizedPathname) ||
    /^\/analytics\/[^/]+$/.test(normalizedPathname) ||
    /^\/checkout\/[^/]+$/.test(normalizedPathname) ||
    /^\/teacher\/groups\/[^/]+$/.test(normalizedPathname) ||
    /^\/teacher\/students\/[^/]+$/.test(normalizedPathname)
  );
}

function looksLikeStaticAsset(pathname: string) {
  const lastSegment = pathname.split('/').pop() || '';
  return lastSegment.includes('.');
}

function shouldServeSpaShell(request: Request, pathname: string) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;

  const acceptsHtml = request.headers.get('accept')?.includes('text/html') ?? false;
  const isNavigation = request.headers.get('sec-fetch-mode') === 'navigate';

  return isNavigation || acceptsHtml || !looksLikeStaticAsset(pathname);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Injects per-route title/description/canonical/og tags into the static SPA shell. */
function applyRouteMeta(html: string, pathname: string) {
  const meta = resolveRouteMeta(pathname);
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const canonical = escapeHtml(new URL(meta.path, SITE_URL).toString());
  const robots = meta.noindex ? 'noindex,nofollow' : 'index,follow';

  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta name="robots" content="[^"]*" \/>/, `<meta name="robots" content="${robots}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`)
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${description}" />`,
    )
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(
      /<meta name="twitter:description" content="[^"]*" \/>/,
      `<meta name="twitter:description" content="${description}" />`,
    );
}

async function serveIndex(request: Request, env: Env, status = 200) {
  const requestUrl = new URL(request.url);
  const indexUrl = new URL(request.url);
  indexUrl.pathname = '/index.html';
  indexUrl.search = '';

  const indexResponse = await env.ASSETS.fetch(new Request(indexUrl, request));
  const headers = new Headers(indexResponse.headers);
  headers.set('content-type', 'text/html; charset=UTF-8');

  const html = applyRouteMeta(await indexResponse.text(), normalizePathname(requestUrl.pathname));

  return new Response(html, {
    status,
    statusText: status === 404 ? 'Not Found' : indexResponse.statusText,
    headers,
  });
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
    },
  });
}

function allowedSupabaseOrigins(env: Env) {
  return [env.SUPABASE_URL, env.VITE_SUPABASE_URL]
    .filter((value): value is string => Boolean(value))
    .map(value => {
      try {
        return new URL(value).origin;
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value));
}

function resolveWorkbookAssetProxyTarget(value: unknown, env: Env) {
  if (typeof value !== 'string' || value.length > 4096) return null;

  try {
    const url = new URL(value);
    const allowedOrigins = allowedSupabaseOrigins(env);
    const allowedHost = allowedOrigins.length > 0
      ? allowedOrigins.includes(url.origin)
      : url.hostname.endsWith('.supabase.co');

    if (
      url.protocol !== 'https:' ||
      !allowedHost ||
      !url.pathname.startsWith(WORKBOOK_ASSET_SIGNED_PATH_PREFIX) ||
      !url.searchParams.has('token')
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

async function handleWorkbookAssetProxy(request: Request, env: Env) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  let payload: { url?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const targetUrl = resolveWorkbookAssetProxyTarget(payload.url, env);
  if (!targetUrl) {
    return jsonResponse({ error: 'invalid_workbook_asset_url' }, 400);
  }

  const upstreamResponse = await fetch(targetUrl.toString(), {
    method: 'GET',
    headers: {
      accept: request.headers.get('accept') || 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  });
  const headers = new Headers(upstreamResponse.headers);
  headers.delete('set-cookie');
  headers.set('cache-control', 'private, max-age=300');
  headers.set('x-content-type-options', 'nosniff');

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}


export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = normalizePathname(url.pathname);

    if (pathname === WORKBOOK_ASSET_PROXY_PATH) {
      return handleWorkbookAssetProxy(request, env);
    }

    if (pathname === '/api/stripe/create-checkout-session' || pathname === '/api/create-checkout-session') {
      return handleCreateStripeCheckoutSession(request, env);
    }

    if (pathname === '/api/stripe/create-portal-session' || pathname === '/api/stripe/portal') {
      return handleCreateStripePortalSession(request, env);
    }

    if (pathname === '/api/stripe/create-refund') {
      return handleCreateStripeRefund(request, env);
    }

    if (pathname === '/api/stripe/webhook') {
      return handleStripeWebhook(request, env);
    }

    if (pathname === '/sitemap.xml' || pathname === '/robots.txt') {
      const assetUrl = new URL(request.url);
      assetUrl.search = '';
      const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
      const headers = new Headers(assetResponse.headers);
      headers.set(
        'content-type',
        pathname === '/sitemap.xml' ? 'application/xml; charset=UTF-8' : 'text/plain; charset=UTF-8',
      );
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers,
      });
    }

    if (looksLikeStaticAsset(pathname)) {
      return env.ASSETS.fetch(request);
    }


    if (isValidSpaRoute(pathname)) {
      return serveIndex(request, env);
    }

    if (shouldServeSpaShell(request, pathname)) {
      return serveIndex(request, env, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
