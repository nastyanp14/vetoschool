import { describe, expect, it } from 'vitest';
import {
  BUTTON_LABELS,
  NOTIFICATION_TEMPLATES,
  formatDate,
  formatTime,
  formatWhen,
  idempotencyKey,
  isCritical,
  pickLang,
  renderNotification,
  scoreNote,
  type NotifyLang,
} from '../../supabase/functions/_shared/notificationTemplates';

const LANGS: NotifyLang[] = ['ru', 'ua', 'en'];

describe('language selection', () => {
  it('maps locale codes to supported languages', () => {
    expect(pickLang('uk-UA')).toBe('ua');
    expect(pickLang('ua')).toBe('ua');
    expect(pickLang('en-GB')).toBe('en');
    expect(pickLang(null)).toBe('ru');
  });
});

describe('date and time formatting (Europe/Prague)', () => {
  const iso = '2026-08-05T12:00:00Z'; // 14:00 в Праге

  it('formats human dates, not ISO', () => {
    expect(formatDate(iso, 'ru')).toBe('5 августа 2026');
    expect(formatTime(iso, 'ru')).toBe('14:00');
    expect(formatTime(iso, 'en')).toBe('14:00');
  });

  it('uses grammatically correct relative wording', () => {
    const now = new Date('2026-08-05T09:00:00Z');
    expect(formatWhen(iso, 'ru', now)).toBe('Сегодня, 5 августа, в 14:00');
    expect(formatWhen(iso, 'ua', now)).toBe('Сьогодні, 5 серпня, о 14:00');
    expect(formatWhen(iso, 'en', now)).toBe('Today, 5 August, at 14:00');
  });

  it('handles tomorrow and far dates', () => {
    const now = new Date('2026-08-04T09:00:00Z');
    expect(formatWhen(iso, 'ru', now)).toBe('Завтра, 5 августа, в 14:00');
    expect(formatWhen(iso, 'ru', new Date('2026-08-01T09:00:00Z'))).toContain('5 августа 2026');
  });
});

describe('template registry', () => {
  it('renders every template in all three languages with a button', () => {
    for (const [event, roles] of Object.entries(NOTIFICATION_TEMPLATES)) {
      for (const role of Object.keys(roles!)) {
        for (const lang of LANGS) {
          const rendered = renderNotification(event as never, role as never, lang, {
            student_name: 'Аня', child_name: 'Аня', parent_name: 'Ольга', teacher_name: 'Kate',
            lesson_date: '5 августа 2026', lesson_time: '14:00', request_url: 'https://vetoschool.eu/admin',
            lesson_url: 'https://vetoschool.eu/lesson', schedule_url: 'https://vetoschool.eu/schedule',
            homework_url: 'https://vetoschool.eu/hw', result_url: 'https://vetoschool.eu/result',
            billing_url: 'https://vetoschool.eu/billing', pricing_url: 'https://vetoschool.eu/pricing',
            student_url: 'https://vetoschool.eu/student', reschedule_url: 'https://vetoschool.eu/trial',
            contact_url: 'https://vetoschool.eu/contact', dashboard_url: 'https://vetoschool.eu/dashboard',
            progress_url: 'https://vetoschool.eu/progress', recommendation_url: 'https://vetoschool.eu/rec',
            settings_url: 'https://vetoschool.eu/settings',
          });
          expect(rendered, `${event}/${role}/${lang}`).toBeTruthy();
          expect(rendered!.text.length).toBeGreaterThan(10);
          expect(rendered!.buttons.length, `${event}/${role}/${lang} buttons`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('never falls back to a generic "open dashboard" button', () => {
    const labels = Object.values(BUTTON_LABELS).flatMap(entry => Object.values(entry));
    expect(labels).not.toContain('Открыть кабинет');
  });

  it('drops buttons without a valid https url', () => {
    const rendered = renderNotification('homework_assigned', 'parent', 'ru', { homework_title: 'Unit 3' });
    expect(rendered!.buttons).toHaveLength(0);
  });

  it('escapes user supplied html', () => {
    const rendered = renderNotification('homework_assigned', 'parent', 'ru', {
      homework_title: '<script>alert(1)</script>',
      homework_url: 'https://vetoschool.eu/hw',
    });
    expect(rendered!.text).not.toContain('<script>');
    expect(rendered!.text).toContain('&lt;script&gt;');
  });

  it('hides label-only lines when a variable is empty', () => {
    const rendered = renderNotification('lesson_cancelled', 'parent', 'ru', {
      student_name: 'Аня', lesson_date: '5 августа 2026', lesson_time: '14:00',
      schedule_url: 'https://vetoschool.eu/schedule',
    });
    expect(rendered!.text).not.toContain('Причина:');
  });
});

describe('event specific content', () => {
  const url = { schedule_url: 'https://vetoschool.eu/s', homework_url: 'https://vetoschool.eu/h', result_url: 'https://vetoschool.eu/r', lesson_url: 'https://vetoschool.eu/l', billing_url: 'https://vetoschool.eu/b', request_url: 'https://vetoschool.eu/q', reschedule_url: 'https://vetoschool.eu/t', pricing_url: 'https://vetoschool.eu/p' };

  it('covers each trial booking status with its own template', () => {
    for (const event of ['trial_request_created', 'trial_request_confirmed', 'trial_request_rescheduled', 'trial_request_cancelled', 'trial_request_no_show', 'trial_request_completed', 'trial_recommendation_ready', 'trial_request_converted'] as const) {
      const roles = Object.keys(NOTIFICATION_TEMPLATES[event]!);
      expect(roles.length, event).toBeGreaterThan(0);
    }
  });

  it('does not notify the parent that the trial lesson is merely completed', () => {
    expect(NOTIFICATION_TEMPLATES.trial_request_completed!.parent).toBeUndefined();
    expect(NOTIFICATION_TEMPLATES.trial_recommendation_ready!.parent).toBeTruthy();
  });

  it('shows a was/now block when a lesson moves', () => {
    const rendered = renderNotification('lesson_rescheduled', 'parent', 'ru', {
      student_name: 'Аня', old_date: '5 августа 2026', old_time: '14:00',
      new_date: '6 августа 2026', new_time: '15:00', ...url,
    });
    expect(rendered!.text).toContain('Было:');
    expect(rendered!.text).toContain('Стало:');
    expect(rendered!.buttons[0].label).toBe('Открыть расписание');
  });

  it('uses distinct events and wording for new and updated grades', () => {
    const created = renderNotification('grade_published', 'parent', 'ru', { score: 5, max_score: 5, score_note: scoreNote(5, 5, 'ru'), content_title: 'Unit 1', ...url });
    const updated = renderNotification('grade_updated', 'parent', 'ru', { score: 4, max_score: 5, content_title: 'Unit 1', ...url });
    expect(created!.text).toContain('🏆 Отличная работа!');
    expect(updated!.text).toContain('✏️ Оценка обновлена');
  });

  it('adapts the tone to the score', () => {
    expect(scoreNote(5, 5, 'ru')).toContain('Отличная');
    expect(scoreNote(3, 5, 'ua')).toContain('Гарний');
    expect(scoreNote(1, 5, 'en')).toContain('practising');
  });

  it('routes homework events to the right recipients', () => {
    expect(NOTIFICATION_TEMPLATES.homework_assigned!.teacher).toBeUndefined();
    expect(NOTIFICATION_TEMPLATES.homework_submitted!.teacher).toBeTruthy();
    const rendered = renderNotification('homework_submitted', 'teacher', 'en', { student_name: 'Ann', homework_title: 'Unit 3', submitted_at: '5 August 2026', ...url });
    expect(rendered!.buttons[0].label).toBe('Review homework');
  });

  it('gives payment events actionable buttons', () => {
    const ok = renderNotification('payment_succeeded', 'parent', 'ru', { plan_name: 'Group', amount: 49, currency: 'EUR', ...url });
    const failed = renderNotification('payment_failed', 'parent', 'ru', { plan_name: 'Group', amount: 49, currency: 'EUR', ...url });
    const cancelled = renderNotification('subscription_cancelled', 'parent', 'ru', { plan_name: 'Group', access_until: '5 сентября 2026', ...url });
    expect(ok!.buttons[0].label).toBe('Открыть тариф');
    expect(failed!.buttons[0].label).toBe('Обновить способ оплаты');
    expect(cancelled!.buttons[0].label).toBe('Управление подпиской');
  });

  it('keeps critical events non-mutable by preferences', () => {
    expect(isCritical('lesson_cancelled')).toBe(true);
    expect(isCritical('lesson_rescheduled')).toBe(true);
    expect(isCritical('payment_failed')).toBe(true);
    expect(isCritical('subscription_ended')).toBe(true);
    expect(isCritical('weekly_progress_summary')).toBe(false);
  });
});

describe('duplicate protection', () => {
  const base = { eventType: 'grade_published', entityId: 'content-1', recipientId: 'parent-1', channel: 'telegram' as const };

  it('produces a stable key for the same event', () => {
    expect(idempotencyKey(base)).toBe(idempotencyKey({ ...base }));
  });

  it('separates channels, recipients and versions', () => {
    expect(idempotencyKey({ ...base, channel: 'email' })).not.toBe(idempotencyKey(base));
    expect(idempotencyKey({ ...base, recipientId: 'parent-2' })).not.toBe(idempotencyKey(base));
    expect(idempotencyKey({ ...base, eventVersion: 2 })).not.toBe(idempotencyKey(base));
  });
});
