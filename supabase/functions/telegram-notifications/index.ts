import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Lang = 'ru' | 'ua' | 'en';
type ParentRow = {
  id: string;
  sendpulse_contact_id: string | null;
  telegram_chat_id: string | null;
  telegram_user_id: string | null;
  telegram_username: string | null;
  parent_name: string | null;
  language: Lang;
  notify_lesson_reminders: boolean;
  notify_homework: boolean;
  notify_grades: boolean;
  notify_schedule_changes: boolean;
};

const encoder = new TextEncoder();

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

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function siteUrl() {
  return (Deno.env.get('SITE_URL') || Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('APP_URL') || '').replace(/\/$/, '');
}

function dashboardUrl(studentId: string, path = 'dashboard') {
  const base = siteUrl();
  return base ? `${base}/${path}?preview=${encodeURIComponent(studentId)}` : `https://t.me/${(Deno.env.get('TELEGRAM_BOT_USERNAME') || 'vetoschool_bot').replace(/^@/, '')}`;
}

function dateTimeLabel(value?: string | null, lang: Lang = 'ru') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';
  return date.toLocaleString(locale, { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function t(lang: Lang, key: string, p: Record<string, string | number | undefined> = {}) {
  const dict: Record<Lang, Record<string, string>> = {
    ru: {
      reminder24: 'Напоминание: завтра у {child} урок английского языка в {time}.',
      reminder1: 'Сегодня в {time} у {child} урок английского языка. До начала остался 1 час.',
      conducted: 'Сегодня {child} прошёл урок английского языка. Домашнее задание и материалы можно посмотреть в личном кабинете.',
      homework: 'Новое домашнее задание для {child}: {title}.',
      grade: '{child} получил новую оценку: {grade} за {title}.',
      comment: 'Комментарий преподавателя: {comment}',
      rescheduled: 'Урок английского языка у {child} перенесён. Было: {oldTime}. Новое время: {newTime}.',
      canceled: 'Урок английского языка у {child} отменён: {oldTime}.',
      scheduledChanged: 'Расписание урока английского языка у {child} обновлено: {newTime}.',
      dashboard: 'Открыть кабинет',
      homeworkButton: 'Посмотреть задание',
      gradeButton: 'Посмотреть результат',
    },
    ua: {
      reminder24: 'Нагадування: завтра у {child} урок англійської мови о {time}.',
      reminder1: 'Сьогодні о {time} у {child} урок англійської мови. До початку залишилась 1 година.',
      conducted: 'Сьогодні {child} пройшов урок англійської мови. Домашнє завдання та матеріали можна переглянути в особистому кабінеті.',
      homework: 'Нове домашнє завдання для {child}: {title}.',
      grade: '{child} отримав нову оцінку: {grade} за {title}.',
      comment: 'Коментар викладача: {comment}',
      rescheduled: 'Урок англійської мови у {child} перенесено. Було: {oldTime}. Новий час: {newTime}.',
      canceled: 'Урок англійської мови у {child} скасовано: {oldTime}.',
      scheduledChanged: 'Розклад уроку англійської мови у {child} оновлено: {newTime}.',
      dashboard: 'Відкрити кабінет',
      homeworkButton: 'Переглянути завдання',
      gradeButton: 'Переглянути результат',
    },
    en: {
      reminder24: 'Reminder: {child} has an English lesson tomorrow at {time}.',
      reminder1: 'Today at {time}, {child} has an English lesson. It starts in 1 hour.',
      conducted: 'Today {child} completed an English lesson. Homework and materials are available in the student dashboard.',
      homework: 'New homework for {child}: {title}.',
      grade: '{child} received a new grade: {grade} for {title}.',
      comment: 'Teacher comment: {comment}',
      rescheduled: '{child}’s English lesson was rescheduled. Old time: {oldTime}. New time: {newTime}.',
      canceled: '{child}’s English lesson was canceled: {oldTime}.',
      scheduledChanged: '{child}’s English lesson schedule was updated: {newTime}.',
      dashboard: 'Open dashboard',
      homeworkButton: 'View homework',
      gradeButton: 'View result',
    },
  };
  return (dict[lang]?.[key] || dict.ru[key] || key).replace(/\{(\w+)\}/g, (_, name) => String(p[name] ?? ''));
}

function button(label: string, url: string) {
  return url ? [{ text: label, url }] : [];
}

function notificationMessage(parent: ParentRow, notification: any) {
  const lang = parent.language || 'ru';
  const payload = notification.payload || {};
  const child = payload.studentName || payload.childName || 'ученик';
  const title = payload.title || payload.topic || 'задание';
  const lessonAt = payload.lessonAt || payload.newLessonAt;
  const time = dateTimeLabel(lessonAt, lang);
  const oldTime = dateTimeLabel(payload.oldLessonAt || payload.oldTime, lang) || payload.oldSlotLabel || '';
  const newTime = dateTimeLabel(payload.newLessonAt || payload.lessonAt, lang) || payload.slotLabel || '';
  const url = payload.url || dashboardUrl(notification.student_id);
  let text = '';
  let buttons = button(t(lang, 'dashboard'), url);

  if (notification.notification_type === 'lesson_reminder_24h') text = t(lang, 'reminder24', { child, time });
  if (notification.notification_type === 'lesson_reminder_1h') text = t(lang, 'reminder1', { child, time });
  if (notification.notification_type === 'lesson_conducted') text = t(lang, 'conducted', { child });
  if (notification.notification_type === 'homework_published') {
    text = t(lang, 'homework', { child, title });
    buttons = button(t(lang, 'homeworkButton'), url);
  }
  if (notification.notification_type === 'grade_published') {
    text = t(lang, 'grade', { child, grade: payload.grade, title });
    if (payload.comment) text += `\n\n${t(lang, 'comment', { comment: payload.comment })}`;
    buttons = button(t(lang, 'gradeButton'), url);
  }
  if (notification.notification_type === 'lesson_rescheduled') {
    text = oldTime ? t(lang, 'rescheduled', { child, oldTime, newTime }) : t(lang, 'scheduledChanged', { child, newTime });
  }
  if (notification.notification_type === 'lesson_canceled') text = t(lang, 'canceled', { child, oldTime: oldTime || payload.slotLabel || '' });

  return { text: text || title, buttons };
}

async function getSendPulseToken() {
  const clientId = Deno.env.get('SENDPULSE_CLIENT_ID');
  const clientSecret = Deno.env.get('SENDPULSE_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('SENDPULSE_CLIENT_ID and SENDPULSE_CLIENT_SECRET are required');
  const response = await fetch('https://api.sendpulse.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data.message || data.error_description || 'Could not authorize SendPulse API');
  return data.access_token as string;
}

async function sendDirectTelegram(chatId: string, text: string, buttons: any[]) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) return false;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: buttons.length ? { inline_keyboard: [buttons] } : undefined,
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return true;
}

async function sendViaSendPulse(parent: ParentRow, text: string, buttons: any[]) {
  if (parent.telegram_chat_id && await sendDirectTelegram(parent.telegram_chat_id, text, buttons)) return;

  const contactId = parent.sendpulse_contact_id || parent.telegram_user_id || parent.telegram_chat_id;
  if (!contactId) throw new Error('Parent does not have SendPulse contact id or Telegram chat id');

  const token = await getSendPulseToken();
  const botId = Deno.env.get('SENDPULSE_BOT_ID') || '';
  const customTemplate = Deno.env.get('SENDPULSE_SEND_ENDPOINT_TEMPLATE');
  const urls = customTemplate
    ? [customTemplate.replace('{contactId}', encodeURIComponent(contactId)).replace('{botId}', encodeURIComponent(botId))]
    : [
        `https://api.sendpulse.com/telegram/contacts/${encodeURIComponent(contactId)}/messages`,
        `https://api.sendpulse.com/chatbots/telegram/contacts/${encodeURIComponent(contactId)}/send`,
        `https://api.sendpulse.com/messengers/telegram/contacts/${encodeURIComponent(contactId)}/messages`,
        botId ? `https://api.sendpulse.com/bots/${encodeURIComponent(botId)}/contacts/${encodeURIComponent(contactId)}/send` : '',
      ].filter(Boolean);

  const payloads = [
    { message: { type: 'text', text, buttons }, contact_id: contactId, bot_id: botId || undefined },
    { text, buttons, contact_id: contactId, bot_id: botId || undefined },
  ];

  let lastError = '';
  for (const url of urls) {
    for (const payload of payloads) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) return;
      lastError = `${response.status} ${await response.text().catch(() => '')}`;
    }
  }
  throw new Error(`SendPulse message failed: ${lastError || 'no endpoint accepted request'}`);
}

async function currentUser(req: Request, anonKey: string) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const client = createClient(Deno.env.get('SUPABASE_URL')!, anonKey, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await client.auth.getUser(token);
  if (error) return null;
  return data.user?.id || null;
}

async function isAdmin(admin: any, userId: string | null) {
  if (!userId) return false;
  const { data } = await admin.from('user_roles').select('role').eq('user_id', userId);
  return !!data?.some((row: { role: string }) => row.role === 'admin');
}

async function studentName(admin: any, studentId: string) {
  const { data } = await admin.from('profiles').select('name,email').eq('id', studentId).maybeSingle();
  return data?.name || data?.email?.split('@')[0] || 'ученик';
}

async function parentsFor(admin: any, studentId: string): Promise<ParentRow[]> {
  const { data, error } = await admin
    .from('student_parent_links')
    .select('telegram_parent_accounts(*)')
    .eq('student_id', studentId);
  if (error) throw error;
  return (data || []).map((row: any) => row.telegram_parent_accounts).filter(Boolean);
}

async function enqueue(admin: any, row: any) {
  const { error } = await admin.from('telegram_notifications').upsert(row, { onConflict: 'event_key', ignoreDuplicates: true });
  if (error) throw error;
}

async function cancelLessonReminders(admin: any, studentId: string, lessonRef: string) {
  await admin
    .from('telegram_notifications')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('student_id', studentId)
    .eq('status', 'pending')
    .in('notification_type', ['lesson_reminder_24h', 'lesson_reminder_1h'])
    .eq('payload->>lessonRef', lessonRef);
}

function minutesBefore(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() - minutes * 60_000).toISOString();
}

async function handleContentEvent(admin: any, body: any) {
  const studentId = body.studentId;
  const item = body.item || {};
  const type = body.type as string;
  const name = await studentName(admin, studentId);
  const parents = await parentsFor(admin, studentId);
  const now = new Date().toISOString();
  const lessonRef = `content:${item.id}`;
  const url = `${dashboardUrl(studentId)}&tab=${item.type === 'homework' ? 'homework' : item.type === 'lesson' ? 'lessons' : 'grades'}`;

  if ((type === 'lesson_scheduled' || type === 'lesson_rescheduled') && body.lessonAt) {
    await cancelLessonReminders(admin, studentId, lessonRef);
    for (const parent of parents.filter(parent => parent.notify_lesson_reminders)) {
      for (const reminder of [{ suffix: '24h', minutes: 24 * 60 }, { suffix: '1h', minutes: 60 }]) {
        const scheduledFor = minutesBefore(body.lessonAt, reminder.minutes);
        if (new Date(scheduledFor).getTime() <= Date.now()) continue;
        await enqueue(admin, {
          event_key: `${lessonRef}:${parent.id}:reminder:${reminder.suffix}:${body.lessonAt}`,
          notification_type: reminder.suffix === '24h' ? 'lesson_reminder_24h' : 'lesson_reminder_1h',
          student_id: studentId,
          parent_id: parent.id,
          scheduled_for: scheduledFor,
          payload: { studentName: name, title: item.title, lessonAt: body.lessonAt, lessonRef, url },
        });
      }
    }
  }

  if (type === 'lesson_rescheduled') {
    for (const parent of parents.filter(parent => parent.notify_schedule_changes)) {
      await enqueue(admin, {
        event_key: `${lessonRef}:${parent.id}:rescheduled:${body.oldLessonAt || 'new'}:${body.lessonAt}`,
        notification_type: 'lesson_rescheduled',
        student_id: studentId,
        parent_id: parent.id,
        scheduled_for: now,
        payload: { studentName: name, title: item.title, oldLessonAt: body.oldLessonAt, newLessonAt: body.lessonAt, lessonRef, url },
      });
    }
  }

  if (type === 'lesson_canceled') {
    await cancelLessonReminders(admin, studentId, lessonRef);
    for (const parent of parents.filter(parent => parent.notify_schedule_changes)) {
      await enqueue(admin, {
        event_key: `${lessonRef}:${parent.id}:canceled:${body.oldLessonAt || item.scheduledDate || now}`,
        notification_type: 'lesson_canceled',
        student_id: studentId,
        parent_id: parent.id,
        scheduled_for: now,
        payload: { studentName: name, title: item.title, oldLessonAt: body.oldLessonAt, lessonRef, url },
      });
    }
  }

  if (type === 'homework_published') {
    for (const parent of parents.filter(parent => parent.notify_homework)) {
      await enqueue(admin, {
        event_key: `content:${item.id}:${parent.id}:homework_published`,
        notification_type: 'homework_published',
        student_id: studentId,
        parent_id: parent.id,
        scheduled_for: now,
        payload: { studentName: name, title: item.title, url },
      });
    }
  }

  if (type === 'grade_published') {
    for (const parent of parents.filter(parent => parent.notify_grades)) {
      await enqueue(admin, {
        event_key: `content:${item.id}:${parent.id}:grade:${item.starRating}`,
        notification_type: 'grade_published',
        student_id: studentId,
        parent_id: parent.id,
        scheduled_for: now,
        payload: { studentName: name, title: item.title, grade: `${item.starRating}/5`, comment: item.teacherComment || item.comment || '', url },
      });
    }
  }
}

function slotLabel(slot: any) {
  if (!slot) return '';
  return [slot.day, slot.time].filter(Boolean).join(' ');
}

async function handleScheduleEvent(admin: any, body: any) {
  const studentId = body.studentId;
  const type = body.type as string;
  const slot = body.slot || {};
  const oldSlot = body.oldSlot || {};
  const name = await studentName(admin, studentId);
  const parents = await parentsFor(admin, studentId);
  const now = new Date().toISOString();
  const lessonRef = `schedule:${slot.id || `${slot.day}-${slot.time}-${slot.topic}`}`;
  const url = `${dashboardUrl(studentId)}&tab=schedule`;

  if (type === 'lesson_conducted') {
    for (const parent of parents.filter(parent => parent.notify_lesson_reminders)) {
      await enqueue(admin, {
        event_key: `${lessonRef}:${parent.id}:conducted`,
        notification_type: 'lesson_conducted',
        student_id: studentId,
        parent_id: parent.id,
        scheduled_for: now,
        payload: { studentName: name, topic: slot.topic, slotLabel: slotLabel(slot), lessonRef, url },
      });
    }
    return;
  }

  if (type === 'lesson_rescheduled' || type === 'lesson_canceled' || type === 'lesson_scheduled') {
    await cancelLessonReminders(admin, studentId, lessonRef);
    for (const parent of parents.filter(parent => parent.notify_schedule_changes)) {
      await enqueue(admin, {
        event_key: `${lessonRef}:${parent.id}:${type}:${slotLabel(oldSlot)}:${slotLabel(slot)}`,
        notification_type: type === 'lesson_canceled' ? 'lesson_canceled' : 'lesson_rescheduled',
        student_id: studentId,
        parent_id: parent.id,
        scheduled_for: now,
        payload: { studentName: name, topic: slot.topic, oldSlotLabel: slotLabel(oldSlot), slotLabel: slotLabel(slot), lessonRef, url },
      });
    }
  }
}

async function processDue(admin: any, limit = 25) {
  const { data, error } = await admin
    .from('telegram_notifications')
    .select('*, telegram_parent_accounts(*)')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(limit);
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  for (const notification of data || []) {
    const parent = notification.telegram_parent_accounts as ParentRow | null;
    if (!parent) {
      await admin.from('telegram_notifications').update({ status: 'failed', error: 'Parent account not found', attempts: notification.attempts + 1 }).eq('id', notification.id);
      failed++;
      continue;
    }
    try {
      const message = notificationMessage(parent, notification);
      await sendViaSendPulse(parent, message.text, message.buttons);
      await admin.from('telegram_notifications').update({ status: 'sent', sent_at: new Date().toISOString(), attempts: notification.attempts + 1, error: null }).eq('id', notification.id);
      sent++;
    } catch (error) {
      await admin.from('telegram_notifications').update({ status: 'failed', attempts: notification.attempts + 1, error: (error as Error).message }).eq('id', notification.id);
      failed++;
    }
  }
  return { sent, failed, checked: data?.length || 0 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'process_due';
    const userId = await currentUser(req, ANON);
    const adminUser = await isAdmin(admin, userId);

    if (action === 'process_due') {
      const cronSecret = Deno.env.get('TELEGRAM_CRON_SECRET');
      if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret && req.headers.get('Authorization') !== `Bearer ${cronSecret}` && !adminUser) {
        return json({ error: 'Forbidden' }, 403);
      }
      return json(await processDue(admin, Math.min(100, Number(body.limit) || 25)));
    }

    if (action === 'create_link_token') {
      const studentId = body.studentId;
      if (!userId || (!adminUser && userId !== studentId)) return json({ error: 'Forbidden' }, 403);
      const token = randomToken();
      const tokenHash = await sha256(token);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
      const { error } = await admin.from('telegram_link_tokens').insert({
        token_hash: tokenHash,
        student_id: studentId,
        created_by: userId,
        expires_at: expiresAt,
      });
      if (error) throw error;
      return json({ token, expiresAt });
    }

    if (!adminUser && action !== 'process_due') return json({ error: 'Forbidden' }, 403);

    if (action === 'content_event') {
      await handleContentEvent(admin, body);
      return json({ success: true });
    }
    if (action === 'schedule_event') {
      await handleScheduleEvent(admin, body);
      return json({ success: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
