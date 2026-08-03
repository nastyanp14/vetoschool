export type TelegramLanguage = 'ru' | 'ua' | 'en';

export type ParentIdentity = {
  sendpulseContactId: string;
  telegramChatId: string;
  telegramUserId: string;
  telegramUsername: string;
  parentName: string;
  language: TelegramLanguage;
};

export type TelegramSetting = {
  column: 'notify_lesson_reminders' | 'notify_homework' | 'notify_grades' | 'notify_schedule_changes';
  enabled: boolean;
};

type HeaderSource = Headers | Record<string, string | undefined | null>;

function headerValue(headers: HeaderSource, name: string) {
  if (headers instanceof Headers) return headers.get(name) || '';
  const lower = name.toLowerCase();
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === lower);
  return found?.[1] || '';
}

export function valueAt(body: any, paths: string[]) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => acc?.[key], body);
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return '';
}

export function telegramLanguage(body: any): TelegramLanguage {
  const raw = valueAt(body, [
    'message.from.language_code',
    'language',
    'lang',
    'contact.language',
    'contact.lang',
    'variables.language',
    'variables.lang',
    'contact.variables.language',
    'contact.variables.lang',
    'answers.language',
  ]).toLowerCase();
  if (raw.includes('uk') || raw.includes('ua') || raw.includes('укр')) return 'ua';
  if (raw.includes('en') || raw.includes('англ')) return 'en';
  return 'ru';
}

export function extractStartToken(body: any) {
  const explicit = valueAt(body, [
    'link_token',
    'start_param',
    'payload.token',
    'payload.start_param',
    'variables.link_token',
    'variables.start_param',
    'variables.start',
    'custom_fields.link_token',
    'customFields.link_token',
    'contact.variables.link_token',
    'contact.variables.start_param',
    'command.args',
  ]);
  const explicitMatch = explicit.match(/(?:\/start|start)\s+([A-Za-z0-9_-]{16,})/i);
  if (explicitMatch?.[1]) return explicitMatch[1];
  if (explicit) return explicit;
  const text = valueAt(body, ['text', 'data.text', 'last_message.text', 'event.text', 'message.text', 'message.caption']);
  const match = text.match(/(?:\/start|start)\s+([A-Za-z0-9_-]{16,})/i) || text.match(/link[_-]?([A-Fa-f0-9]{32,})/);
  return match?.[1] || '';
}

export function extractSetting(body: any): TelegramSetting | null {
  const raw = valueAt(body, ['notification_setting', 'setting', 'payload.setting', 'variables.notification_setting']).toLowerCase();
  const text = valueAt(body, ['text', 'message.text', 'data.text', 'event.text']).toLowerCase();
  const source = raw || text;
  const enabledRaw = valueAt(body, ['enabled', 'payload.enabled', 'variables.enabled']).toLowerCase();
  const enabled = enabledRaw ? ['1', 'true', 'on', 'yes', 'да', 'так'].includes(enabledRaw) : !source.includes('_off') && !source.includes('off') && !source.includes('выкл') && !source.includes('вимк');
  if (source.includes('reminder') || source.includes('напомин') || source.includes('нагад')) return { column: 'notify_lesson_reminders', enabled };
  if (source.includes('homework') || source.includes('домаш')) return { column: 'notify_homework', enabled };
  if (source.includes('grade') || source.includes('оцен') || source.includes('оцін')) return { column: 'notify_grades', enabled };
  if (source.includes('schedule') || source.includes('перен') || source.includes('cancel') || source.includes('скас') || source.includes('отмен')) return { column: 'notify_schedule_changes', enabled };
  return null;
}

export function extractParentIdentity(body: any): ParentIdentity {
  const firstName = valueAt(body, ['message.from.first_name', 'from.first_name']);
  const lastName = valueAt(body, ['message.from.last_name', 'from.last_name']);
  const parentName = valueAt(body, ['parent_name', 'contact.name', 'subscriber.name']) || [firstName, lastName].filter(Boolean).join(' ');
  return {
    sendpulseContactId: valueAt(body, ['contact.id', 'contact_id', 'subscriber.id', 'subscriber_id', 'contactId']),
    telegramChatId: valueAt(body, ['telegram.chat_id', 'chat.id', 'chat_id', 'message.chat.id', 'contact.telegram_chat_id']),
    telegramUserId: valueAt(body, ['telegram.user_id', 'from.id', 'message.from.id', 'user.id', 'telegram_id']),
    telegramUsername: valueAt(body, ['telegram.username', 'from.username', 'message.from.username', 'username', 'contact.username']),
    parentName,
    language: telegramLanguage(body),
  };
}

export function webhookSource(headers: HeaderSource, secrets: { sendpulseSecret?: string | null; telegramSecret?: string | null }) {
  const telegramSecret = secrets.telegramSecret || '';
  if (telegramSecret && headerValue(headers, 'x-telegram-bot-api-secret-token') === telegramSecret) return 'telegram';

  const sendpulseSecret = secrets.sendpulseSecret || '';
  if (
    sendpulseSecret
    && (
      headerValue(headers, 'x-webhook-secret') === sendpulseSecret
      || headerValue(headers, 'authorization') === `Bearer ${sendpulseSecret}`
    )
  ) return 'sendpulse';

  return '';
}
