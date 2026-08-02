import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  isHandledEvent,
  parseStripeSignatureHeader,
  toIso,
  verifyStripeSignature,
} from '../../supabase/functions/_shared/stripeCore';

const SECRET = 'whsec_test_secret';
const BODY = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });

function sign(body: string, timestamp: number, secret = SECRET) {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('stripe-webhook signature verification', () => {
  const now = 1_770_000_000_000;
  const ts = Math.floor(now / 1000);

  it('accepts a correctly signed payload', async () => {
    await expect(verifyStripeSignature(BODY, sign(BODY, ts), SECRET, { nowMs: now })).resolves.toBe(true);
  });

  it('rejects a tampered payload', async () => {
    const header = sign(BODY, ts);
    await expect(verifyStripeSignature(`${BODY} `, header, SECRET, { nowMs: now })).resolves.toBe(false);
  });

  it('rejects a signature made with a different secret', async () => {
    const header = sign(BODY, ts, 'whsec_other');
    await expect(verifyStripeSignature(BODY, header, SECRET, { nowMs: now })).resolves.toBe(false);
  });

  it('rejects timestamps outside the tolerance window', async () => {
    const header = sign(BODY, ts - 400);
    await expect(verifyStripeSignature(BODY, header, SECRET, { nowMs: now })).resolves.toBe(false);
  });

  it('fails closed without a secret or header', async () => {
    await expect(verifyStripeSignature(BODY, sign(BODY, ts), undefined, { nowMs: now })).resolves.toBe(false);
    await expect(verifyStripeSignature(BODY, null, SECRET, { nowMs: now })).resolves.toBe(false);
    await expect(verifyStripeSignature(BODY, 'garbage', SECRET, { nowMs: now })).resolves.toBe(false);
  });

  it('parses signature headers', () => {
    expect(parseStripeSignatureHeader('t=123,v1=abc,v0=zzz')).toEqual({ timestamp: 123, signatures: ['abc'] });
    expect(parseStripeSignatureHeader('v1=abc')).toBeNull();
  });
});

describe('stripe-webhook event routing', () => {
  it('handles only the supported subscription lifecycle events', () => {
    for (const type of [
      'checkout.session.completed',
      'invoice.paid',
      'invoice.payment_failed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ]) {
      expect(isHandledEvent(type)).toBe(true);
    }
    expect(isHandledEvent('payment_intent.succeeded')).toBe(false);
    expect(isHandledEvent('charge.refunded')).toBe(false);
  });

  it('converts Stripe unix timestamps to ISO strings', () => {
    expect(toIso(1_770_000_000)).toBe(new Date(1_770_000_000_000).toISOString());
    expect(toIso(0)).toBeNull();
    expect(toIso(null)).toBeNull();
  });
});
