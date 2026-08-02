import { describe, expect, it } from 'vitest';
import {
  assertPortalConfigurationId,
  assertProductionAppUrl,
  checkoutUrls,
  readCheckoutRequest,
  stripePlanConfig,
} from '../../supabase/functions/_shared/stripeCore';

describe('create-checkout-session plan handling', () => {
  it('accepts every published plan id', () => {
    for (const planId of Object.keys(stripePlanConfig)) {
      const result = readCheckoutRequest({ planId });
      expect(result.ok).toBe(true);
    }
  });

  it('rejects unknown plans and malformed bodies', () => {
    expect(readCheckoutRequest({ planId: 'free-forever' })).toEqual({ ok: false, error: 'Unknown plan' });
    expect(readCheckoutRequest({}).ok).toBe(false);
    expect(readCheckoutRequest(null).ok).toBe(false);
  });

  it('ignores any price sent by the client', () => {
    const result = readCheckoutRequest({ planId: 'group-lite', amount: 1, unit_amount: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.unitAmount).toBe(stripePlanConfig['group-lite'].unitAmount);
  });

  it('builds https success and cancel urls with the session placeholder', () => {
    const origin = assertProductionAppUrl('https://vetoschool.com/');
    const urls = checkoutUrls(origin);
    expect(urls.success_url).toBe('https://vetoschool.com/payment/success?session_id={CHECKOUT_SESSION_ID}');
    expect(urls.cancel_url).toBe('https://vetoschool.com/payment/cancel');
  });

  it('refuses localhost or http APP_URL values', () => {
    expect(() => assertProductionAppUrl('http://vetoschool.com')).toThrow(/https/);
    expect(() => assertProductionAppUrl('https://localhost:8080')).toThrow(/local host/);
    expect(() => assertProductionAppUrl(undefined)).toThrow(/not configured/);
  });

  it('validates the portal configuration id', () => {
    expect(assertPortalConfigurationId('bpc_123')).toBe('bpc_123');
    expect(() => assertPortalConfigurationId('cfg_123')).toThrow(/invalid/);
    expect(() => assertPortalConfigurationId('')).toThrow(/not configured/);
  });
});
