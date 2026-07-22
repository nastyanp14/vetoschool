import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_VERSION,
  createCookieConsent,
  FUNCTIONAL_STORAGE_KEYS,
  persistFunctionalLocalStorage,
  readFunctionalLocalStorage,
  readStoredCookieConsent,
  registerCookieConsentIntegration,
  removeStoredCookieConsent,
  writeCookieConsent,
} from './cookieConsent';

describe('cookieConsent manager', () => {
  afterEach(() => {
    localStorage.clear();
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0]?.trim();
      if (name) document.cookie = `${name}=; path=/; max-age=0`;
    });
    vi.restoreAllMocks();
  });

  it('returns null when consent has not been stored', () => {
    expect(readStoredCookieConsent()).toBeNull();
  });

  it('stores accept all preferences with version and timestamp', () => {
    const consent = createCookieConsent({ functional: true, analytics: true, marketing: true });
    writeCookieConsent(consent);

    expect(readStoredCookieConsent()).toMatchObject({
      version: COOKIE_CONSENT_VERSION,
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
    });
    expect(readStoredCookieConsent()?.updatedAt).toEqual(expect.any(String));
  });

  it('stores reject optional preferences', () => {
    const consent = createCookieConsent({ functional: false, analytics: false, marketing: false });
    writeCookieConsent(consent);

    expect(readStoredCookieConsent()).toMatchObject({
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    });
  });

  it('ignores stored consent from another policy version', () => {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify({
      version: COOKIE_CONSENT_VERSION + 1,
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
      updatedAt: new Date().toISOString(),
    }));

    expect(readStoredCookieConsent()).toBeNull();
  });

  it('removes optional functional storage when functional consent is missing', () => {
    FUNCTIONAL_STORAGE_KEYS.forEach(key => localStorage.setItem(key, 'stored'));

    writeCookieConsent(createCookieConsent({ functional: false, analytics: false, marketing: false }));

    FUNCTIONAL_STORAGE_KEYS.forEach(key => expect(localStorage.getItem(key)).toBeNull());
  });

  it('only persists functional localStorage after functional consent', () => {
    persistFunctionalLocalStorage('vetoschool-elevenlabs-voice-id', 'voice-a');
    expect(readFunctionalLocalStorage('vetoschool-elevenlabs-voice-id', 'fallback')).toBe('fallback');

    writeCookieConsent(createCookieConsent({ functional: true, analytics: false, marketing: false }));
    persistFunctionalLocalStorage('vetoschool-elevenlabs-voice-id', 'voice-b');

    expect(readFunctionalLocalStorage('vetoschool-elevenlabs-voice-id', 'fallback')).toBe('voice-b');
  });

  it('does not enable analytics integrations before analytics consent', () => {
    const enable = vi.fn();
    const disable = vi.fn();
    const unregister = registerCookieConsentIntegration({ category: 'analytics', enable, disable });

    expect(enable).not.toHaveBeenCalled();
    expect(disable).toHaveBeenCalledTimes(1);

    writeCookieConsent(createCookieConsent({ functional: false, analytics: true, marketing: false }));

    expect(enable).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('can reset stored consent', () => {
    writeCookieConsent(createCookieConsent({ functional: true, analytics: true, marketing: true }));
    removeStoredCookieConsent();

    expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBeNull();
  });
});
