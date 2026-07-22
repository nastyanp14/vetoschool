/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyCookieConsent,
  CookieConsent,
  CookieConsentPreferences,
  createCookieConsent,
  readStoredCookieConsent,
  removeStoredCookieConsent,
  writeCookieConsent,
} from '../lib/cookieConsent';

type CookieConsentContextValue = {
  consent: CookieConsent | null;
  hasDecision: boolean;
  preferencesOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
  acceptAll: () => void;
  rejectOptional: () => void;
  savePreferences: (preferences: CookieConsentPreferences) => void;
  resetConsent: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | undefined>(undefined);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<CookieConsent | null>(() => readStoredCookieConsent());
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const stored = readStoredCookieConsent();
    setConsent(stored);
    applyCookieConsent(stored);
  }, []);

  const commitConsent = useCallback((preferences: CookieConsentPreferences) => {
    const nextConsent = createCookieConsent(preferences);
    writeCookieConsent(nextConsent);
    setConsent(nextConsent);
    setPreferencesOpen(false);
  }, []);

  const acceptAll = useCallback(() => {
    commitConsent({ functional: true, analytics: true, marketing: true });
  }, [commitConsent]);

  const rejectOptional = useCallback(() => {
    commitConsent({ functional: false, analytics: false, marketing: false });
  }, [commitConsent]);

  const savePreferences = useCallback((preferences: CookieConsentPreferences) => {
    commitConsent(preferences);
  }, [commitConsent]);

  const resetConsent = useCallback(() => {
    removeStoredCookieConsent();
    applyCookieConsent(null);
    setConsent(null);
    setPreferencesOpen(false);
  }, []);

  const value = useMemo<CookieConsentContextValue>(() => ({
    consent,
    hasDecision: Boolean(consent),
    preferencesOpen,
    openPreferences: () => setPreferencesOpen(true),
    closePreferences: () => setPreferencesOpen(false),
    acceptAll,
    rejectOptional,
    savePreferences,
    resetConsent,
  }), [acceptAll, consent, preferencesOpen, rejectOptional, resetConsent, savePreferences]);

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (!context) throw new Error('useCookieConsent must be used within CookieConsentProvider');
  return context;
}
