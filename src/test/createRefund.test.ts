import { describe, expect, it } from 'vitest';
import { refundType, validateRefundAmount } from '../../supabase/functions/_shared/stripeCore';

describe('create-refund amount validation', () => {
  it('accepts a partial refund within the remaining balance', () => {
    expect(validateRefundAmount({ amount: 50000, paymentAmount: 128000, alreadyRefunded: 0 })).toEqual({ ok: true, amount: 50000 });
  });

  it('rejects amounts above the refundable balance', () => {
    const result = validateRefundAmount({ amount: 100000, paymentAmount: 128000, alreadyRefunded: 80000 });
    expect(result).toEqual({ ok: false, error: 'Refund amount exceeds the refundable balance' });
  });

  it('rejects refunds on a fully refunded payment', () => {
    const result = validateRefundAmount({ amount: 1, paymentAmount: 128000, alreadyRefunded: 128000 });
    expect(result.ok).toBe(false);
  });

  it('rejects zero, negative, fractional, and non numeric amounts', () => {
    for (const amount of [0, -1, 12.5, '1000', null, undefined, NaN]) {
      expect(validateRefundAmount({ amount, paymentAmount: 128000, alreadyRefunded: 0 }).ok).toBe(false);
    }
  });

  it('classifies full versus partial refunds', () => {
    expect(refundType(128000, 128000)).toBe('full');
    expect(refundType(127999, 128000)).toBe('partial');
  });
});
