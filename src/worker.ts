type AssetsBinding = {
  fetch(input: Request | string | URL): Promise<Response>;
};

interface Env {
  ASSETS: AssetsBinding;
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
]);

function normalizePathname(pathname: string) {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '');
}

function isValidSpaRoute(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);
  return VALID_SPA_ROUTES.has(normalizedPathname) || /^\/analytics\/[^/]+$/.test(normalizedPathname);
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
