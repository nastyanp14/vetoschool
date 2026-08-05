import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { extractParentIdentity, extractSetting, extractStartToken, webhookSource } from '../_shared/telegramCore.ts';
import { renderNotification } from '../_shared/notificationTemplates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token, x-webhook-secret, x-sendpulse-signature',
};

const encoder = new TextEncoder();
type Lang = 'ru' | 'ua' | 'en';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function telegramApi(method: string, payload: Record<string, unknown>) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    console.error(`telegram ${method} failed [${response.status}]:`, JSON.stringify(data));
  }
  return data;
}

function telegramChatId(body: any) {
  const value = body?.message?.chat?.id || body?.chat?.id || body?.telegram?.chat_id || body?.chat_id;
  return value ? String(value) : '';
}

async function sendTelegramReply(chatId: string, text: string) {
  if (!chatId || !Deno.env.get('TELEGRAM_BOT_TOKEN')) return;
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

async function upsertParent(admin: any, body: any) {
  const {
    sendpulseContactId,
    telegramChatId,
    telegramUserId,
    telegramUsername,
    parentName,
    language,
  } = extractParentIdentity(body);

  if (!sendpulseContactId && !telegramChatId && !telegramUserId) {
    throw new Error('Webhook does not contain SendPulse contact id or Telegram chat id');
  }

  const identityColumn = sendpulseContactId ? 'sendpulse_contact_id' : telegramChatId ? 'telegram_chat_id' : 'telegram_user_id';
  const identityValue = sendpulseContactId || telegramChatId || telegramUserId;
  const payload = {
    sendpulse_contact_id: sendpulseContactId || null,
    telegram_chat_id: telegramChatId || null,
    telegram_user_id: telegramUserId || null,
    telegram_username: telegramUsername || null,
    parent_name: parentName || null,
    language,
  };

  const { data: existing } = await admin.from('telegram_parent_accounts').select('*').eq(identityColumn, identityValue).maybeSingle();
  if (existing) {
    const { data, error } = await admin.from('telegram_parent_accounts').update(payload).eq('id', existing.id).select('*').single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await admin.from('telegram_parent_accounts').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

async function linkByToken(admin: any, token: string, parent: any, source: string) {
  const tokenHash = await sha256(token);
  const { data: link, error } = await admin
    .from('telegram_link_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!link) return { linked: false, reason: 'expired_or_used' };

  const { error: relError } = await admin
    .from('student_parent_links')
    .upsert({
      student_id: link.student_id,
      parent_id: parent.id,
      active: true,
      linked_at: new Date().toISOString(),
      provider: 'telegram',
      source,
    }, { onConflict: 'student_id,parent_id' });
  if (relError) throw relError;

  const { error: usedError } = await admin
    .from('telegram_link_tokens')
    .update({ used_at: new Date().toISOString(), used_by_parent_id: parent.id, status: 'used' })
    .eq('id', link.id);
  if (usedError) throw usedError;

  return { linked: true, studentId: link.student_id };
}

const T: Record<Lang, Record<string, string>> = {
  ru: {
    welcome: 'Привет! Это бот школы Vetoschool. Откройте личный кабинет ученика и нажмите «Подключить Telegram», чтобы получить персональную ссылку.',
    linked: 'Готово! Вы подключены к ученику {name}. Здесь будут напоминания об уроках, домашние задания, оценки и переносы.',
    expired: 'Ссылка недействительна или уже использована. Попросите создать новую ссылку в личном кабинете.',
    settings: 'Настройки уведомлений. Нажмите, чтобы включить или выключить:',
    notLinked: 'Сначала подключите бота по персональной ссылке из личного кабинета.',
    unlinked: 'Уведомления отключены. Чтобы подключиться снова, используйте новую ссылку из кабинета.',
    saved: 'Сохранено',
    langSet: 'Язык уведомлений: русский',
    help: 'Команды: /settings - уведомления, /language - язык, /stop - отключить уведомления.',
    reminders: 'Напоминания об уроках',
    homework: 'Домашние задания',
    grades: 'Оценки',
    schedule: 'Переносы и отмены',
  },
  ua: {
    welcome: 'Вітаємо! Це бот школи Vetoschool. Відкрийте кабінет учня та натисніть «Підключити Telegram», щоб отримати персональне посилання.',
    linked: 'Готово! Ви підключені до учня {name}. Тут будуть нагадування про уроки, домашні завдання, оцінки та перенесення.',
    expired: 'Посилання недійсне або вже використане. Створіть нове посилання в кабінеті.',
    settings: 'Налаштування сповіщень. Натисніть, щоб увімкнути або вимкнути:',
    notLinked: 'Спочатку підключіть бота за персональним посиланням із кабінету.',
    unlinked: 'Сповіщення вимкнено. Щоб підключитися знову, скористайтеся новим посиланням.',
    saved: 'Збережено',
    langSet: 'Мова сповіщень: українська',
    help: 'Команди: /settings - сповіщення, /language - мова, /stop - вимкнути сповіщення.',
    reminders: 'Нагадування про уроки',
    homework: 'Домашні завдання',
    grades: 'Оцінки',
    schedule: 'Перенесення та скасування',
  },
  en: {
    welcome: 'Hi! This is the Vetoschool bot. Open the student dashboard and tap "Connect Telegram" to get a personal link.',
    linked: 'All set! You are connected to {name}. You will receive lesson reminders, homework, grades and schedule changes here.',
    expired: 'This link is invalid or already used. Please create a new one in the dashboard.',
    settings: 'Notification settings. Tap to switch on or off:',
    notLinked: 'Connect the bot first using the personal link from the dashboard.',
    unlinked: 'Notifications are off. Use a new link from the dashboard to reconnect.',
    saved: 'Saved',
    langSet: 'Notification language: English',
    help: 'Commands: /settings - notifications, /language - language, /stop - turn notifications off.',
    reminders: 'Lesson reminders',
    homework: 'Homework',
    grades: 'Grades',
    schedule: 'Reschedules and cancellations',
  },
};

const SETTING_COLUMNS: Record<string, string> = {
  reminders: 'notify_lesson_reminders',
  homework: 'notify_homework',
  grades: 'notify_grades',
  schedule: 'notify_schedule_changes',
};

function settingsKeyboard(parent: any, lang: Lang) {
  const rows = Object.entries(SETTING_COLUMNS).map(([key, column]) => [{
    text: `${parent[column] ? '✅' : '❌'} ${T[lang][key]}`,
    callback_data: `toggle:${key}`,
  }]);
  rows.push([
    { text: '🇷🇺 RU', callback_data: 'lang:ru' },
    { text: '🇺🇦 UA', callback_data: 'lang:ua' },
    { text: '🇬🇧 EN', callback_data: 'lang:en' },
  ]);
  return { inline_keyboard: rows };
}

function detectLang(code?: string | null): Lang {
  const raw = (code || '').toLowerCase();
  if (raw.startsWith('uk') || raw.startsWith('ua')) return 'ua';
  if (raw.startsWith('en')) return 'en';
  return 'ru';
}

async function findParent(admin: any, chatId: string) {
  const { data } = await admin.from('telegram_parent_accounts').select('*').eq('telegram_chat_id', chatId).maybeSingle();
  return data;
}

async function handleTelegramUpdate(admin: any, update: any) {
  const callback = update.callback_query;
  if (callback) {
    const chatId = String(callback.message?.chat?.id ?? '');
    const parent = chatId ? await findParent(admin, chatId) : null;
    const lang: Lang = (parent?.language as Lang) || detectLang(callback.from?.language_code);
    if (!parent) {
      await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: T[lang].notLinked });
      return json({ ok: true });
    }
    const [kind, value] = String(callback.data || '').split(':');
    if (kind === 'toggle' && SETTING_COLUMNS[value]) {
      const column = SETTING_COLUMNS[value];
      const { data: updated } = await admin
        .from('telegram_parent_accounts')
        .update({ [column]: !parent[column], updated_at: new Date().toISOString() })
        .eq('id', parent.id)
        .select('*')
        .single();
      await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: T[lang].saved });
      await telegramApi('editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: callback.message?.message_id,
        reply_markup: settingsKeyboard(updated || parent, lang),
      });
      return json({ ok: true });
    }
    if (kind === 'lang' && ['ru', 'ua', 'en'].includes(value)) {
      const nextLang = value as Lang;
      const { data: updated } = await admin
        .from('telegram_parent_accounts')
        .update({ language: nextLang, updated_at: new Date().toISOString() })
        .eq('id', parent.id)
        .select('*')
        .single();
      await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: T[nextLang].langSet });
      await telegramApi('editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: callback.message?.message_id,
        reply_markup: settingsKeyboard(updated || parent, nextLang),
      });
      return json({ ok: true });
    }
    await telegramApi('answerCallbackQuery', { callback_query_id: callback.id });
    return json({ ok: true });
  }

  const message = update.message ?? update.edited_message;
  const chatId = message?.chat?.id != null ? String(message.chat.id) : '';
  if (!chatId) return json({ ok: true, ignored: true });

  const text = String(message.text || '').trim();
  const existing = await findParent(admin, chatId);
  const lang: Lang = (existing?.language as Lang) || detectLang(message.from?.language_code);

  const startMatch = text.match(/^\/start(?:@\S+)?\s+([A-Za-z0-9_-]{8,})$/);
  if (startMatch) {
    const tokenHash = await sha256(startMatch[1]);
    const { data, error } = await admin.rpc('link_telegram_parent', {
      p_token_hash: tokenHash,
      p_chat_id: chatId,
      p_telegram_user_id: message.from?.id != null ? String(message.from.id) : null,
      p_username: message.from?.username ?? null,
      p_first_name: message.from?.first_name ?? null,
      p_last_name: message.from?.last_name ?? null,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (result?.status !== 'linked') {
      await telegramApi('sendMessage', { chat_id: chatId, text: T[lang].expired });
      return json({ ok: true, linked: false });
    }
    const parent = await findParent(admin, chatId);
    if (parent && !existing) {
      await admin.from('telegram_parent_accounts').update({ language: lang }).eq('id', parent.id);
    }
    // Одно аккуратное сообщение о подключении из единого реестра шаблонов.
    const connected = renderNotification('telegram_connected', 'parent', lang, {
      student_name: result.student_name || '',
    });
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: connected?.text || T[lang].linked.replace('{name}', result.student_name || ''),
      parse_mode: 'HTML',
      reply_markup: settingsKeyboard({ ...(parent || {}), language: lang }, lang),
    });
    return json({ ok: true, linked: true });
  }

  if (/^\/start\b/.test(text)) {
    await telegramApi('sendMessage', { chat_id: chatId, text: T[lang].welcome });
    return json({ ok: true });
  }

  if (/^\/(settings|language)\b/.test(text)) {
    if (!existing) {
      await telegramApi('sendMessage', { chat_id: chatId, text: T[lang].notLinked });
      return json({ ok: true });
    }
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: T[lang].settings,
      reply_markup: settingsKeyboard(existing, lang),
    });
    return json({ ok: true });
  }

  if (/^\/(stop|unlink)\b/.test(text)) {
    if (existing) {
      await admin.from('student_parent_links').update({ active: false }).eq('parent_id', existing.id);
      await admin.from('telegram_parent_accounts').update({
        notify_lesson_reminders: false,
        notify_homework: false,
        notify_grades: false,
        notify_schedule_changes: false,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
    }
    await telegramApi('sendMessage', { chat_id: chatId, text: T[lang].unlinked });
    return json({ ok: true });
  }

  await telegramApi('sendMessage', { chat_id: chatId, text: existing ? T[lang].help : T[lang].welcome });
  return json({ ok: true });
}

async function handleSendPulseWebhook(admin: any, body: any, source: string) {
  const parent = await upsertParent(admin, body);
  const token = extractStartToken(body);
  const chatId = telegramChatId(body) || parent.telegram_chat_id || '';
  const setting = extractSetting(body);
  const result: Record<string, unknown> = { success: true, source, parentId: parent.id };

  if (token) {
    const link = await linkByToken(admin, token, parent, source);
    result.link = link;
    if (source === 'telegram') {
      await sendTelegramReply(
        chatId,
        link.linked
          ? 'Telegram подключен к Vetoschool. Теперь сюда будут приходить уведомления об уроках, домашних заданиях, оценках, расписании и тарифе.'
          : 'Ссылка для подключения устарела или уже использована. Откройте кабинет ребенка и нажмите "Подключить Telegram" еще раз.'
      );
    }
  } else if (source === 'telegram') {
    await sendTelegramReply(
      chatId,
      'Чтобы подключить Telegram к Vetoschool, откройте свежую ссылку из кабинета ребенка или отправьте команду /start с кодом из этой ссылки.'
    );
  }

  if (setting) {
    const { error } = await admin.from('telegram_parent_accounts').update({ [setting.column]: setting.enabled }).eq('id', parent.id);
    if (error) throw error;
    result.setting = setting;
  }

  return json(result);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const sendpulseSecret = Deno.env.get('SENDPULSE_WEBHOOK_SECRET');
    const telegramSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || sendpulseSecret;
    const source = webhookSource(req.headers, { sendpulseSecret, telegramSecret });
    if (!source) {
      if (!sendpulseSecret && !telegramSecret) {
        console.error('telegram-webhook: no webhook secret is configured');
        return json({ error: 'Webhook is not configured' }, 500);
      }
      console.error('telegram-webhook: request rejected by webhook secret check');
      return json({ error: 'Forbidden' }, 403);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));

    if (source === 'telegram' && (body.message || body.edited_message || body.callback_query)) {
      return await handleTelegramUpdate(admin, body);
    }

    return await handleSendPulseWebhook(admin, body, source);
  } catch (error) {
    console.error('telegram-webhook error:', (error as Error).message);
    return json({ error: (error as Error).message }, 500);
  }
});
