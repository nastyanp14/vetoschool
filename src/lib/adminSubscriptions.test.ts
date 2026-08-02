import { describe, expect, it } from 'vitest';
import type { User } from './auth';
import {
  buildSubscriptionRows,
  canAccessSubscriptionAdmin,
  filterSubscriptionRows,
  validateLessonAdjustmentInput,
} from './adminSubscriptions';

function student(overrides: Partial<User>): User {
  return {
    id: 'student-1',
    name: 'Anna Student',
    email: 'anna@example.com',
    role: 'student',
    hasAccess: true,
    paymentStatus: 'paid',
    accessStatus: 'active',
    emailConfirmed: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    joinedAt: '2026-07-01T00:00:00.000Z',
    lessonsRemaining: 8,
    lessonsTotal: 8,
    planId: 'group-progress',
    lessonFormat: 'group',
    subscriptionStatus: 'active',
    ...overrides,
  };
}

describe('admin subscription helpers', () => {
  it('allows subscription management only for admins', () => {
    expect(canAccessSubscriptionAdmin(student({ role: 'admin' }))).toBe(true);
    expect(canAccessSubscriptionAdmin(student({ role: 'teacher' }))).toBe(false);
    expect(canAccessSubscriptionAdmin(student({ role: 'student' }))).toBe(false);
    expect(canAccessSubscriptionAdmin(null)).toBe(false);
  });

  it('filters subscriptions by search, plan, format and statuses', () => {
    const rows = buildSubscriptionRows(
      [
        student({ id: 'student-1', name: 'Anna Progress', email: 'anna@example.com', planId: 'group-progress', lessonFormat: 'group', subscriptionStatus: 'active', paymentStatus: 'paid' }),
        student({ id: 'student-2', name: 'Boris Intensive', email: 'boris@example.com', planId: 'individual-intensive', lessonFormat: 'individual', subscriptionStatus: 'past_due', paymentStatus: 'failed' }),
      ],
      new Map([['student-1', '2026-07-10T00:00:00.000Z']]),
      new Map([['student-2', '2026-07-12T00:00:00.000Z']]),
    );

    expect(filterSubscriptionRows(rows, {
      query: 'boris',
      planId: 'individual-intensive',
      lessonFormat: 'individual',
      subscriptionStatus: 'past_due',
      paymentStatus: 'failed',
    }).map(row => row.user.id)).toEqual(['student-2']);

    expect(filterSubscriptionRows(rows, {
      query: 'anna@example',
      planId: 'all',
      lessonFormat: 'group',
      subscriptionStatus: 'all',
      paymentStatus: 'paid',
    }).map(row => row.user.id)).toEqual(['student-1']);
  });

  it('validates manual lesson adjustments before RPC call', () => {
    expect(validateLessonAdjustmentInput(12, 'Webhook repair')).toBeNull();
    expect(validateLessonAdjustmentInput(-1, 'Webhook repair')).toContain('не может быть отрицательным');
    expect(validateLessonAdjustmentInput(1.5, 'Webhook repair')).toContain('целое');
    expect(validateLessonAdjustmentInput(12, '')).toContain('причину');
  });
});
