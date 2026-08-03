import { describe, expect, it } from 'vitest';
import { extractParentIdentity, extractSetting, extractStartToken, webhookSource } from '../../supabase/functions/_shared/telegramCore';
import { telegramParentFromLinkRow } from './telegram';

describe('telegram webhook helpers', () => {
  it('extracts a direct Telegram /start token and parent identity', () => {
    const payload = {
      message: {
        text: '/start link_token_1234567890abcdef',
        chat: { id: 987654321 },
        from: {
          id: 12345,
          username: 'parent_account',
          first_name: 'Anna',
          last_name: 'Vet',
          language_code: 'ru',
        },
      },
    };

    expect(extractStartToken(payload)).toBe('link_token_1234567890abcdef');
    expect(extractParentIdentity(payload)).toMatchObject({
      telegramChatId: '987654321',
      telegramUserId: '12345',
      telegramUsername: 'parent_account',
      parentName: 'Anna Vet',
      language: 'ru',
    });
  });

  it('extracts SendPulse link tokens and settings', () => {
    const payload = {
      contact: {
        id: 'sp_contact_1',
        name: 'Parent Name',
        variables: { link_token: 'sendpulse_1234567890abcdef', language: 'uk' },
      },
      variables: {
        notification_setting: 'homework_off',
      },
    };

    expect(extractStartToken(payload)).toBe('sendpulse_1234567890abcdef');
    expect(extractParentIdentity(payload)).toMatchObject({
      sendpulseContactId: 'sp_contact_1',
      parentName: 'Parent Name',
      language: 'ua',
    });
    expect(extractSetting(payload)).toEqual({ column: 'notify_homework', enabled: false });
  });

  it('accepts only configured SendPulse or Telegram webhook secrets', () => {
    expect(webhookSource({ 'x-webhook-secret': 'sp_secret' }, { sendpulseSecret: 'sp_secret' })).toBe('sendpulse');
    expect(webhookSource({ authorization: 'Bearer sp_secret' }, { sendpulseSecret: 'sp_secret' })).toBe('sendpulse');
    expect(webhookSource({ 'x-telegram-bot-api-secret-token': 'tg_secret' }, { telegramSecret: 'tg_secret' })).toBe('telegram');
    expect(webhookSource({ 'x-telegram-bot-api-secret-token': 'wrong' }, { telegramSecret: 'tg_secret' })).toBe('');
  });

  it('maps active student-parent link rows for dashboard display', () => {
    expect(telegramParentFromLinkRow({
      linked_at: '2026-08-03T10:00:00.000Z',
      telegram_parent_accounts: {
        id: 'parent_1',
        parent_name: '',
        display_name: 'Anna Parent',
        telegram_username: 'anna_parent',
        language: 'en',
        notify_lesson_reminders: true,
        notify_homework: false,
        notify_grades: true,
        notify_schedule_changes: false,
      },
    })).toEqual({
      id: 'parent_1',
      parentName: 'Anna Parent',
      telegramUsername: 'anna_parent',
      linkedAt: '2026-08-03T10:00:00.000Z',
      language: 'en',
      notifyLessonReminders: true,
      notifyHomework: false,
      notifyGrades: true,
      notifyScheduleChanges: false,
    });

    expect(telegramParentFromLinkRow({ telegram_parent_accounts: null })).toBeNull();
  });
});
