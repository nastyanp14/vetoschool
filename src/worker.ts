import { handleCreateStripeCheckoutSession, handleCreateStripePortalSession, handleCreateStripeRefund, handleStripeWebhook } from './lib/stripeCheckoutServer';

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

async function serveIndex(request: Request, env: Env, status = 200) {
  const indexUrl = new URL(request.url);
  indexUrl.pathname = '/index.html';
  indexUrl.search = '';

  const indexResponse = await env.ASSETS.fetch(new Request(indexUrl, request));
  const headers = new Headers(indexResponse.headers);

  return new Response(indexResponse.body, {
    status,
    statusText: status === 404 ? 'Not Found' : indexResponse.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = normalizePathname(url.pathname);

    if (pathname === '/api/stripe/create-checkout-session' || pathname === '/api/create-checkout-session') {
      return handleCreateStripeCheckoutSession(request, env);
    }

    if (pathname === '/api/stripe/create-portal-session') {
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
