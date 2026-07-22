export type CookieConsent = {
  version: number;
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

export type CookieConsentPreferences = Pick<CookieConsent, 'functional' | 'analytics' | 'marketing'>;

export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_STORAGE_KEY = 'vetoschool_cookie_consent';

export const FUNCTIONAL_STORAGE_KEYS = [
  'vetoschool-elevenlabs-voice-id',
  'vetoschool-elevenlabs-model-id',
] as const;

const FUNCTIONAL_COOKIE_NAMES = ['sidebar:state'];
const ANALYTICS_COOKIE_NAMES = ['_ga', '_gid', '_gat'];
const ANALYTICS_COOKIE_PREFIXES = ['_ga_', '_gat_', '_hj', '_clck', '_clsk'];
const MARKETING_COOKIE_NAMES = ['_gcl_au', '_fbp', '_fbc'];
const MARKETING_COOKIE_PREFIXES = ['_gcl_', '_fbp', '_fbc'];

type ConsentIntegration = {
  category: keyof CookieConsentPreferences;
  enable: (consent: CookieConsent) => void;
  disable?: () => void;
};

const integrations = new Set<ConsentIntegration>();

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isConsentShape(value: unknown): value is CookieConsent {
  if (!value || typeof value !== 'object') return false;
  const consent = value as Partial<CookieConsent>;
  return (
    consent.version === COOKIE_CONSENT_VERSION &&
    consent.necessary === true &&
    typeof consent.functional === 'boolean' &&
    typeof consent.analytics === 'boolean' &&
    typeof consent.marketing === 'boolean' &&
    typeof consent.updatedAt === 'string'
  );
}

export function createCookieConsent(preferences: CookieConsentPreferences): CookieConsent {
  return {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    functional: preferences.functional,
    analytics: preferences.analytics,
    marketing: preferences.marketing,
    updatedAt: new Date().toISOString(),
  };
}

export function readStoredCookieConsent(): CookieConsent | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return isConsentShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCookieConsent(consent: CookieConsent) {
  if (!isBrowser()) return;
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent));
  applyCookieConsent(consent);
}

export function removeStoredCookieConsent() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
}

export function hasFunctionalConsent() {
  return readStoredCookieConsent()?.functional === true;
}

export function persistFunctionalLocalStorage(key: string, value: string) {
  if (!isBrowser()) return;

  if (hasFunctionalConsent()) {
    window.localStorage.setItem(key, value);
  } else {
    window.localStorage.removeItem(key);
  }
}

export function readFunctionalLocalStorage(key: string, fallback = '') {
  if (!isBrowser() || !hasFunctionalConsent()) return fallback;
  return window.localStorage.getItem(key) || fallback;
}

function cookieDomainCandidates() {
  if (typeof window === 'undefined') return [''];

  const hostname = window.location.hostname;
  const parts = hostname.split('.').filter(Boolean);
  const candidates = [''];

  if (parts.length > 1) {
    candidates.push(hostname, `.${hostname}`);
    candidates.push(`.${parts.slice(-2).join('.')}`);
  }

  return Array.from(new Set(candidates));
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;

  const pathCandidates = ['/', window.location.pathname || '/'];

  cookieDomainCandidates().forEach(domain => {
    pathCandidates.forEach(path => {
      const domainPart = domain ? `; domain=${domain}` : '';
      document.cookie = `${name}=; path=${path}; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT${domainPart}; SameSite=Lax`;
    });
  });
}

function deleteCookies(names: string[], prefixes: string[] = []) {
  if (typeof document === 'undefined') return;

  const currentCookieNames = document.cookie
    .split(';')
    .map(cookie => decodeURIComponent(cookie.split('=')[0]?.trim() || ''))
    .filter(Boolean);

  const targets = new Set([
    ...names,
    ...currentCookieNames.filter(name => prefixes.some(prefix => name.startsWith(prefix))),
  ]);

  targets.forEach(deleteCookie);
}

function deleteFunctionalStorage() {
  if (!isBrowser()) return;
  FUNCTIONAL_STORAGE_KEYS.forEach(key => window.localStorage.removeItem(key));
}

export function cleanupOptionalStorage(consent: CookieConsent | null) {
  if (!consent?.functional) {
    deleteFunctionalStorage();
    deleteCookies(FUNCTIONAL_COOKIE_NAMES);
  }

  if (!consent?.analytics) {
    deleteCookies(ANALYTICS_COOKIE_NAMES, ANALYTICS_COOKIE_PREFIXES);
  }

  if (!consent?.marketing) {
    deleteCookies(MARKETING_COOKIE_NAMES, MARKETING_COOKIE_PREFIXES);
  }
}

export function applyCookieConsent(consent: CookieConsent | null) {
  cleanupOptionalStorage(consent);

  integrations.forEach(integration => {
    if (consent?.[integration.category]) {
      integration.enable(consent);
    } else {
      integration.disable?.();
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vetoschool:cookie-consent-changed', { detail: consent }));
  }
}

export function registerCookieConsentIntegration(integration: ConsentIntegration) {
  // Future analytics or marketing loaders should register here and only enable after consent.
  integrations.add(integration);
  applyCookieConsent(readStoredCookieConsent());

  return () => {
    integrations.delete(integration);
    integration.disable?.();
  };
}
