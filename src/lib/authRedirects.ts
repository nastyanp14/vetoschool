const INTERNAL_REDIRECTS = new Set([
  '/',
  '/dashboard',
  '/admin',
  '/login',
  '/auth/confirmed',
  '/auth/check-email',
  '/auth/link-expired',
  '/pending-activation',
  '/reset-password',
]);

export function safeRedirectPath(path?: string | null, fallback = '/dashboard') {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback;
  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return INTERNAL_REDIRECTS.has(url.pathname) ? `${url.pathname}${url.search}` : fallback;
  } catch {
    return fallback;
  }
}
