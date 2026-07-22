import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import CookieConsentBanner from './CookieConsentBanner';
import CookiePreferencesModal from './CookiePreferencesModal';
import { CookieConsentProvider, useCookieConsent } from '../contexts/CookieConsentContext';
import { COOKIE_CONSENT_STORAGE_KEY, CookieConsent } from '../lib/cookieConsent';

function TestResetButton() {
  const { resetConsent, openPreferences } = useCookieConsent();
  return (
    <>
      <button type="button" onClick={resetConsent}>Reset consent</button>
      <button type="button" onClick={openPreferences}>Open settings</button>
    </>
  );
}

function renderCookieUi(lang: 'ru' | 'en' | 'ua' = 'en') {
  return render(
    <MemoryRouter>
      <CookieConsentProvider>
        <TestResetButton />
        <CookieConsentBanner lang={lang} />
        <CookiePreferencesModal lang={lang} />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

function storedConsent() {
  return JSON.parse(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) || 'null') as CookieConsent | null;
}

describe('Cookie consent UI', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('shows the banner on the first visit', () => {
    renderCookieUi();

    expect(screen.getByRole('complementary', { name: /vetoschool cookie settings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject optional/i })).toBeInTheDocument();
  });

  it('accepts all categories from the banner', async () => {
    renderCookieUi();

    fireEvent.click(screen.getByRole('button', { name: /accept all/i }));

    expect(storedConsent()).toMatchObject({
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
    });
    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: /vetoschool cookie settings/i })).not.toBeInTheDocument();
    });
  });

  it('rejects optional categories from the banner', () => {
    renderCookieUi();

    fireEvent.click(screen.getByRole('button', { name: /reject optional/i }));

    expect(storedConsent()).toMatchObject({
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    });
  });

  it('saves granular preferences from the modal', () => {
    renderCookieUi();

    fireEvent.click(screen.getByRole('button', { name: /customize/i }));
    fireEvent.click(screen.getByRole('switch', { name: /functional/i }));
    fireEvent.click(screen.getByRole('switch', { name: /analytics/i }));
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }));

    expect(storedConsent()).toMatchObject({
      functional: true,
      analytics: true,
      marketing: false,
    });
  });

  it('does not save consent when preferences are closed without saving', () => {
    renderCookieUi();

    fireEvent.click(screen.getByRole('button', { name: /customize/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /close/i })[0]);

    expect(storedConsent()).toBeNull();
  });

  it('can reopen settings and change an existing choice', () => {
    renderCookieUi();

    fireEvent.click(screen.getByRole('button', { name: /reject optional/i }));
    fireEvent.click(screen.getByRole('button', { name: /open settings/i }));
    fireEvent.click(screen.getByRole('switch', { name: /marketing/i }));
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }));

    expect(storedConsent()).toMatchObject({
      functional: false,
      analytics: false,
      marketing: true,
    });
  });

  it('shows the banner again after reset', () => {
    renderCookieUi();

    fireEvent.click(screen.getByRole('button', { name: /accept all/i }));
    fireEvent.click(screen.getByRole('button', { name: /reset consent/i }));

    expect(storedConsent()).toBeNull();
    expect(screen.getByRole('complementary', { name: /vetoschool cookie settings/i })).toBeInTheDocument();
  });
});
