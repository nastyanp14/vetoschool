import { describe, expect, it } from 'vitest';
import { activeSubscriptionStatus, hasConfirmedStripePayment, shouldShowActiveTariff } from './subscriptionStatus';

describe('subscription status helpers', () => {
  it('does not treat paid profile status as confirmed without Stripe linkage', () => {
    const input = {
      paymentStatus: 'paid',
      subscriptionStatus: 'active',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    };

    expect(hasConfirmedStripePayment(input)).toBe(false);
    expect(activeSubscriptionStatus(input)).toBe('pending_payment');
    expect(shouldShowActiveTariff(input)).toBe(false);
  });

  it('shows active tariff for confirmed Stripe subscriptions', () => {
    const input = {
      paymentStatus: 'paid',
      subscriptionStatus: 'active',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
    };

    expect(hasConfirmedStripePayment(input)).toBe(true);
    expect(activeSubscriptionStatus(input)).toBe('active');
    expect(shouldShowActiveTariff(input)).toBe(true);
  });

  it('shows active tariff when Stripe subscription is active but payment status is stale', () => {
    const input = {
      paymentStatus: 'unpaid',
      subscriptionStatus: 'active',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
    };

    expect(hasConfirmedStripePayment(input)).toBe(false);
    expect(activeSubscriptionStatus(input)).toBe('active');
    expect(shouldShowActiveTariff(input)).toBe(true);
  });

  it('keeps explicit Stripe payment failures as payment problems', () => {
    const input = {
      paymentStatus: 'failed',
      subscriptionStatus: 'active',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
    };

    expect(activeSubscriptionStatus(input)).toBe('payment_failed');
    expect(shouldShowActiveTariff(input)).toBe(false);
  });

  it('keeps manual access distinct from Stripe payment status', () => {
    const input = {
      paymentStatus: 'unpaid',
      accessStatus: 'active',
      manualAccessOverride: true,
    };

    expect(activeSubscriptionStatus(input)).toBe('manual_access');
    expect(shouldShowActiveTariff(input)).toBe(true);
  });
});
