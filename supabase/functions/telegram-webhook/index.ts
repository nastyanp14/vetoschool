import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
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

function safeEqual(a: string | null, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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
    help: 'Команды: /settings — уведомления, /language — язык, /stop — отключить уведомления.',
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
    help: 'Команди: /settings — сповіщення, /language — мова, /stop — вимкнути сповіщення.',
    reminders: 'Нагадування про уроки',
    homework: 'Домашні завдання',
    grades: 'Оцінки',
    schedule: 'Перенесення та скасування',
  },
  en: {
    welcome: 'Hi! This is the Vetoschool bot. Open the student dashboard and tap “Connect Telegram” to get a personal link.',
    linked: 'All set! You are connected to {name}. You will receive lesson reminders, homework, grades and schedule changes here.',
    expired: 'This link is invalid or already used. Please create a new one in the dashboard.',
    settings: 'Notification settings. Tap to switch on or off:',
    notLinked: 'Connect the bot first using the personal link from the dashboard.',
    unlinked: 'Notifications are off. Use a new link from the dashboard to reconnect.',
    saved: 'Saved',
    langSet: 'Notification language: English',
    help: 'Commands: /settings — notifications, /language — language, /stop — turn notifications off.',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Fail closed: without the configured Telegram secret token the endpoint refuses every request.
    const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('telegram-webhook: TELEGRAM_WEBHOOK_SECRET is not configured');
      return json({ error: 'Webhook is not configured' }, 500);
    }
    if (!safeEqual(req.headers.get('x-telegram-bot-api-secret-token'), webhookSecret)) {
      return json({ error: 'Forbidden' }, 403);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const update = await req.json().catch(() => ({}));

    // ---- Callback buttons (settings + language) ----
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

    // ---- Text messages ----
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
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: T[lang].linked.replace('{name}', result.student_name || ''),
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
  } catch (error) {
    console.error('telegram-webhook error:', (error as Error).message);
    return json({ error: (error as Error).message }, 500);
  }
});
