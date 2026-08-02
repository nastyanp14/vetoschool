import type { PaymentStatus, User } from './auth';

export type SubscriptionAdminRow = {
  user: User;
  planId: string;
  lessonFormat: string;
  subscriptionStatus: string;
  paymentStatus: PaymentStatus;
  lastSuccessfulPaymentAt: string | null;
  lastFailedPaymentAt: string | null;
};

export type SubscriptionFilters = {
  query: string;
  planId: string;
  lessonFormat: string;
  subscriptionStatus: string;
  paymentStatus: string;
};

export function canAccessSubscriptionAdmin(user: Pick<User, 'role'> | null | undefined) {
  return user?.role === 'admin';
}

export function buildSubscriptionRows(
  users: User[],
  lastSuccessfulPaymentByUser: Map<string, string | null>,
  lastFailedPaymentByUser: Map<string, string | null>,
): SubscriptionAdminRow[] {
  return users.map(user => ({
    user,
    planId: user.planId || '',
    lessonFormat: user.lessonFormat || '',
    subscriptionStatus: user.subscriptionStatus || '',
    paymentStatus: user.paymentStatus,
    lastSuccessfulPaymentAt: lastSuccessfulPaymentByUser.get(user.id) || null,
    lastFailedPaymentAt: lastFailedPaymentByUser.get(user.id) || user.paymentFailedAt || null,
  }));
}

export function filterSubscriptionRows(rows: SubscriptionAdminRow[], filters: SubscriptionFilters) {
  const query = filters.query.trim().toLowerCase();

  return rows.filter(row => {
    const studentText = `${row.user.name} ${row.user.email}`.toLowerCase();
    return (
      (!query || studentText.includes(query))
      && (filters.planId === 'all' || row.planId === filters.planId)
      && (filters.lessonFormat === 'all' || row.lessonFormat === filters.lessonFormat)
      && (filters.subscriptionStatus === 'all' || row.subscriptionStatus === filters.subscriptionStatus)
      && (filters.paymentStatus === 'all' || row.paymentStatus === filters.paymentStatus)
    );
  });
}

export function validateLessonAdjustmentInput(nextValue: number, reason: string) {
  const normalizedReason = reason.trim();

  if (!Number.isInteger(nextValue)) return 'Введите целое количество уроков.';
  if (nextValue < 0) return 'Остаток уроков не может быть отрицательным.';
  if (nextValue > 1000) return 'Проверьте количество уроков: значение слишком большое.';
  if (normalizedReason.length < 6) return 'Укажите причину корректировки.';

  return null;
}
