import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Lang = 'ru' | 'ua' | 'en';
type ParentRow = {
  id: string;
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

const APP_TZ = 'Europe/Prague';

// Offset (ms) between UTC and the app timezone at the given instant.
function tzOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
  );
  return asUtc - date.getTime();
}

// "2026-08-05T03:57" entered by an admin means 03:57 in Europe/Prague.
// The edge runtime is UTC, so a naive Date() parse would shift it by 1-2 hours.
export function naiveLocalToIso(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim().replace(' ', 'T');
  if (/(z|[+-]\d{2}:?\d{2})$/i.test(normalized)) {
    const absolute = new Date(normalized);
    return Number.isNaN(absolute.getTime()) ? null : absolute.toISOString();
  }
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized) ? `${normalized}:00` : normalized;
  const guess = new Date(`${withSeconds}Z`);
  if (Number.isNaN(guess.getTime())) return null;
  let ts = guess.getTime() - tzOffsetMs(guess, APP_TZ);
  ts = guess.getTime() - tzOffsetMs(new Date(ts), APP_TZ);
  return new Date(ts).toISOString();
}

function dateTimeLabel(value?: string | null, lang: Lang = 'ru') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';
  return date.toLocaleString(locale, { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: APP_TZ });
}


function t(lang: Lang, key: string, p: Record<string, string | number | undefined> = {}) {
  const dict: Record<Lang, Record<string, string>> = {
    ru: {
      reminder24: 'Напоминание: завтра у {child} урок английского языка в {time}.',
      reminder1: 'Сегодня в {time} у {child} урок английского языка. До начала остался 1 час.',
      conducted: 'Сегодня {child} прошёл урок английского языка. Домашнее задание и материалы можно посмотреть в личном кабинете.',
      homework: 'Новое домашнее задание для {child}: {title}.',
      homeworkUpdated: 'Домашнее задание для {child} обновлено: {title}.',
      homeworkCanceled: 'Домашнее задание для {child} отменено: {title}.',
      lessonResult: 'Опубликован результат урока для {child}: {title}.',
      grade: '{child} получил новую оценку: {grade} за {title}.',
      comment: 'Комментарий преподавателя: {comment}',
      rescheduled: 'Урок английского языка у {child} перенесён. Было: {oldTime}. Новое время: {newTime}.',
      canceled: 'Урок английского языка у {child} отменён: {oldTime}.',
      scheduledChanged: 'Расписание урока английского языка у {child} обновлено: {newTime}.',
      dashboard: 'Открыть кабинет',
      homeworkButton: 'Посмотреть задание',
      gradeButton: 'Посмотреть результат',
      trialConfirmed: 'Пробный урок для {child} подтверждён: {newTime}.',
      trialRescheduled: 'Пробный урок для {child} перенесён. Было: {oldTime}. Новое время: {newTime}.',
      trialCanceled: 'Пробный урок для {child} отменён.',
    },
    ua: {
      reminder24: 'Нагадування: завтра у {child} урок англійської мови о {time}.',
      reminder1: 'Сьогодні о {time} у {child} урок англійської мови. До початку залишилась 1 година.',
      conducted: 'Сьогодні {child} пройшов урок англійської мови. Домашнє завдання та матеріали можна переглянути в особистому кабінеті.',
      homework: 'Нове домашнє завдання для {child}: {title}.',
      homeworkUpdated: 'Домашнє завдання для {child} оновлено: {title}.',
      homeworkCanceled: 'Домашнє завдання для {child} скасовано: {title}.',
      lessonResult: 'Опубліковано результат уроку для {child}: {title}.',
      grade: '{child} отримав нову оцінку: {grade} за {title}.',
      comment: 'Коментар викладача: {comment}',
      rescheduled: 'Урок англійської мови у {child} перенесено. Було: {oldTime}. Новий час: {newTime}.',
      canceled: 'Урок англійської мови у {child} скасовано: {oldTime}.',
      scheduledChanged: 'Розклад уроку англійської мови у {child} оновлено: {newTime}.',
      dashboard: 'Відкрити кабінет',
      homeworkButton: 'Переглянути завдання',
      gradeButton: 'Переглянути результат',
      trialConfirmed: 'Пробний урок для {child} підтверджено: {newTime}.',
      trialRescheduled: 'Пробний урок для {child} перенесено. Було: {oldTime}. Новий час: {newTime}.',
      trialCanceled: 'Пробний урок для {child} скасовано.',
    },
    en: {
      reminder24: 'Reminder: {child} has an English lesson tomorrow at {time}.',
      reminder1: 'Today at {time}, {child} has an English lesson. It starts in 1 hour.',
      conducted: 'Today {child} completed an English lesson. Homework and materials are available in the student dashboard.',
      homework: 'New homework for {child}: {title}.',
      homeworkUpdated: 'Homework for {child} was updated: {title}.',
      homeworkCanceled: 'Homework for {child} was canceled: {title}.',
      lessonResult: 'A lesson result was published for {child}: {title}.',
      grade: '{child} received a new grade: {grade} for {title}.',
      comment: 'Teacher comment: {comment}',
      rescheduled: '{child}’s English lesson was rescheduled. Old time: {oldTime}. New time: {newTime}.',
      canceled: '{child}’s English lesson was canceled: {oldTime}.',
      scheduledChanged: '{child}’s English lesson schedule was updated: {newTime}.',
      dashboard: 'Open dashboard',
      homeworkButton: 'View homework',
      gradeButton: 'View result',
      trialConfirmed: 'The trial lesson for {child} is confirmed: {newTime}.',
      trialRescheduled: 'The trial lesson for {child} was rescheduled. Old time: {oldTime}. New time: {newTime}.',
      trialCanceled: 'The trial lesson for {child} was canceled.',
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
  if (notification.notification_type === 'homework_updated') text = t(lang, 'homeworkUpdated', { child, title });
  if (notification.notification_type === 'homework_canceled') text = t(lang, 'homeworkCanceled', { child, title });
  if (notification.notification_type === 'lesson_result_published') text = t(lang, 'lessonResult', { child, title });
  if (notification.notification_type === 'grade_published') {
    text = t(lang, 'grade', { child, grade: payload.grade, title });
    if (payload.comment) text += `\n\n${t(lang, 'comment', { comment: payload.comment })}`;
    buttons = button(t(lang, 'gradeButton'), url);
  }
  if (notification.notification_type === 'lesson_rescheduled') {
    text = oldTime ? t(lang, 'rescheduled', { child, oldTime, newTime }) : t(lang, 'scheduledChanged', { child, newTime });
  }
  if (notification.notification_type === 'lesson_canceled') text = t(lang, 'canceled', { child, oldTime: oldTime || payload.slotLabel || '' });
  if (notification.notification_type === 'trial_confirmed') text = t(lang, 'trialConfirmed', { child, newTime });
  if (notification.notification_type === 'trial_rescheduled') text = t(lang, 'trialRescheduled', { child, oldTime, newTime });
  if (notification.notification_type === 'trial_canceled') text = t(lang, 'trialCanceled', { child });

  return { text: text || title, buttons };
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

let cachedBotUsername: string | null = null;
async function telegramBotUsername() {
  if (cachedBotUsername) return cachedBotUsername;
  const envName = (Deno.env.get('TELEGRAM_BOT_USERNAME') || '').replace(/^@/, '');
  if (envName) {
    cachedBotUsername = envName;
    return cachedBotUsername;
  }
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) return '';
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json().catch(() => ({}));
    cachedBotUsername = data?.result?.username || '';
    return cachedBotUsername;
  } catch {
    return '';
  }
}

async function sendToParent(parent: ParentRow, text: string, buttons: any[]) {
  if (!Deno.env.get('TELEGRAM_BOT_TOKEN')) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  if (!parent.telegram_chat_id) throw new Error('Parent is not connected to the Telegram bot');
  await sendDirectTelegram(parent.telegram_chat_id, text, buttons);
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

async function teacherIdsForUser(admin: any, userId: string): Promise<string[]> {
  // teacher_students.teacher_id / student_groups.teacher_id reference teachers.id,
  // NOT the auth user id. Resolve the teacher rows owned by this auth user first.
  const { data } = await admin.from('teachers').select('id').eq('teacher_user_id', userId);
  const ids = (data || []).map((row: { id: string }) => row.id);
  return ids.length ? ids : [];
}

async function canNotifyForStudent(admin: any, userId: string | null, studentId: string) {
  if (!userId || !studentId) return false;
  if (userId === studentId) return true;
  if (await isAdmin(admin, userId)) return true;

  const teacherIds = await teacherIdsForUser(admin, userId);
  if (!teacherIds.length) return false;

  const { data: directTeacher } = await admin
    .from('teacher_students')
    .select('teacher_id')
    .in('teacher_id', teacherIds)
    .eq('student_id', studentId)
    .maybeSingle();
  if (directTeacher) return true;

  const { data: groupTeacher } = await admin
    .from('student_group_members')
    .select('student_groups!inner(teacher_id)')
    .eq('user_id', studentId)
    .in('student_groups.teacher_id', teacherIds)
    .maybeSingle();
  return !!groupTeacher;
}

async function studentName(admin: any, studentId: string) {
  const { data } = await admin.from('profiles').select('name,email').eq('id', studentId).maybeSingle();
  return data?.name || data?.email?.split('@')[0] || 'ученик';
}

async function parentsFor(admin: any, studentId: string): Promise<ParentRow[]> {
  const { data, error } = await admin
    .from('student_parent_links')
    .select('telegram_parent_accounts(*)')
    .eq('student_id', studentId)
    .eq('active', true);
  if (error) throw error;
  return (data || [])
    .map((row: any) => row.telegram_parent_accounts)
    .filter((parent: any) => parent && parent.telegram_chat_id);
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

  if (type === 'homework_updated' || type === 'homework_canceled' || type === 'lesson_result_published') {
    const eventId = String(body.eventId || item.updatedAt || item.updated_at || now);
    for (const parent of parents.filter(parent => parent.notify_homework)) {
      await enqueue(admin, {
        event_key: `content:${item.id}:${parent.id}:${type}:${eventId}`,
        notification_type: type,
        student_id: studentId,
        parent_id: parent.id,
        scheduled_for: now,
        payload: { studentName: name, title: item.title, comment: item.comment || '', url },
      });
    }
  }

  if (type === 'grade_published') {
    const gradeEventId = String(body.gradeEventId || item.updatedAt || item.updated_at || item.id);
    for (const parent of parents.filter(parent => parent.notify_grades)) {
      await enqueue(admin, {
        event_key: `content:${item.id}:${parent.id}:grade:${item.starRating}:${gradeEventId}`,
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
  return [slot.date || slot.scheduled_date || slot.day, slot.time].filter(Boolean).join(' ');
}

function slotLessonAt(slot: any) {
  const date = slot?.date || slot?.scheduled_date;
  const time = slot?.time;
  if (!date || !time) return null;
  return naiveLocalToIso(`${date}T${time}`);
}

function preferenceAllows(parent: ParentRow, notificationType: string) {
  if (notificationType === 'lesson_reminder_24h' || notificationType === 'lesson_reminder_1h' || notificationType === 'lesson_conducted') {
    return parent.notify_lesson_reminders;
  }
  if (notificationType === 'homework_published' || notificationType === 'homework_updated' || notificationType === 'homework_canceled' || notificationType === 'lesson_result_published') return parent.notify_homework;
  if (notificationType === 'grade_published') return parent.notify_grades;
  if (notificationType === 'lesson_rescheduled' || notificationType === 'lesson_canceled') return parent.notify_schedule_changes;
  if (notificationType === 'trial_confirmed' || notificationType === 'trial_rescheduled' || notificationType === 'trial_canceled') return parent.notify_schedule_changes;
  return false;
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
  const lessonAt = slotLessonAt(slot);

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
    if (lessonAt && type !== 'lesson_canceled') {
      for (const parent of parents.filter(parent => parent.notify_lesson_reminders)) {
        for (const reminder of [{ suffix: '24h', minutes: 24 * 60 }, { suffix: '1h', minutes: 60 }]) {
          const scheduledFor = minutesBefore(lessonAt, reminder.minutes);
          if (new Date(scheduledFor).getTime() <= Date.now()) continue;
          await enqueue(admin, {
            event_key: `${lessonRef}:${parent.id}:reminder:${reminder.suffix}:${lessonAt}`,
            notification_type: reminder.suffix === '24h' ? 'lesson_reminder_24h' : 'lesson_reminder_1h',
            student_id: studentId,
            parent_id: parent.id,
            scheduled_for: scheduledFor,
            payload: { studentName: name, topic: slot.topic, lessonAt, lessonRef, url },
          });
        }
      }
    }
    for (const parent of parents.filter(parent => parent.notify_schedule_changes)) {
      await enqueue(admin, {
        event_key: `${lessonRef}:${parent.id}:${type}:${body.eventId || `${slotLabel(oldSlot)}:${slotLabel(slot)}`}`,
        notification_type: type === 'lesson_canceled' ? 'lesson_canceled' : 'lesson_rescheduled',
        student_id: studentId,
        parent_id: parent.id,
        scheduled_for: now,
        payload: { studentName: name, topic: slot.topic, oldSlotLabel: slotLabel(oldSlot), slotLabel: slotLabel(slot), lessonRef, url },
      });
    }
  }
}

async function handleTrialEvent(admin: any, body: any) {
  const bookingId = String(body.bookingId || '');
  if (!bookingId) throw new Error('bookingId is required');
  const { data: booking, error } = await admin.from('trial_bookings').select('*').eq('id', bookingId).single();
  if (error) throw error;
  const { data: profile } = await admin.from('profiles').select('id').ilike('email', booking.parent_email).maybeSingle();
  if (!profile?.id) return;
  const parents = await parentsFor(admin, profile.id);
  const currentAt = naiveLocalToIso(`${booking.selected_date}T${booking.selected_time}`);
  const previousAt = body.previousDate && body.previousTime ? naiveLocalToIso(`${body.previousDate}T${body.previousTime}`) : null;
  const changedTime = previousAt && previousAt !== currentAt;
  const type = booking.status === 'cancelled' ? 'trial_canceled' : changedTime ? 'trial_rescheduled' : 'trial_confirmed';
  const now = new Date().toISOString();
  await admin.from('telegram_notifications').update({ status: 'canceled', canceled_at: now }).eq('trial_booking_id', bookingId).eq('status', 'pending');
  for (const parent of parents.filter(parent => parent.notify_schedule_changes)) {
    await enqueue(admin, {
      event_key: `trial:${bookingId}:${parent.id}:${type}:${booking.updated_at}`,
      notification_type: type, student_id: profile.id, trial_booking_id: bookingId, parent_id: parent.id, scheduled_for: now,
      payload: { studentName: booking.child_name, oldLessonAt: previousAt, newLessonAt: currentAt, lessonAt: currentAt, url: dashboardUrl(profile.id, 'dashboard') },
    });
  }
  if (type !== 'trial_canceled' && currentAt) {
    const scheduledFor = minutesBefore(currentAt, 60);
    if (new Date(scheduledFor).getTime() > Date.now()) {
      for (const parent of parents.filter(parent => parent.notify_lesson_reminders)) {
        await enqueue(admin, {
          event_key: `trial:${bookingId}:${parent.id}:reminder:1h:${currentAt}`,
          notification_type: 'lesson_reminder_1h', student_id: profile.id, trial_booking_id: bookingId, parent_id: parent.id, scheduled_for: scheduledFor,
          payload: { studentName: booking.child_name, lessonAt: currentAt, lessonRef: `trial:${bookingId}`, url: dashboardUrl(profile.id, 'dashboard') },
        });
      }
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
  let skipped = 0;
  const REMINDER_TYPES = ['lesson_reminder_24h', 'lesson_reminder_1h'];
  const STALE_GRACE_MS = 10 * 60_000;
  const MAX_NOTIFICATION_AGE_MS = 24 * 60 * 60_000;
  const MAX_ATTEMPTS = 4;

  for (const notification of data || []) {
    const processingStartedAt = new Date().toISOString();
    const { data: claimed } = await admin
      .from('telegram_notifications')
      .update({ attempts: notification.attempts + 1, processing_started_at: processingStartedAt, updated_at: processingStartedAt })
      .eq('id', notification.id)
      .eq('status', 'pending')
      .eq('attempts', notification.attempts)
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    const skip = async (reason: string) => {
      await admin
        .from('telegram_notifications')
        .update({ status: 'canceled', canceled_at: new Date().toISOString(), skipped_reason: reason })
        .eq('id', notification.id);
      skipped++;
    };

    // Never deliver a reminder after the lesson already started, and never deliver
    // a reminder that the queue picked up long after its scheduled slot.
    if (REMINDER_TYPES.includes(notification.notification_type)) {
      const lessonAt = notification.payload?.lessonAt ? new Date(notification.payload.lessonAt).getTime() : null;
      if (lessonAt && Date.now() >= lessonAt) {
        await skip('stale: lesson already started');
        continue;
      }
    } else if (Date.now() - new Date(notification.scheduled_for).getTime() > MAX_NOTIFICATION_AGE_MS) {
      await skip('stale: notification expired');
      continue;
      if (Date.now() - new Date(notification.scheduled_for).getTime() > STALE_GRACE_MS) {
        await skip('stale: reminder window missed');
        continue;
      }
    }

    const parent = notification.telegram_parent_accounts as ParentRow | null;
    if (!parent) {
      await admin
        .from('telegram_notifications')
        .update({ status: 'failed', error: 'Parent account not found', skipped_reason: 'parent_not_found' })
        .eq('id', notification.id);
      failed++;
      continue;
    }
    if (!preferenceAllows(parent, notification.notification_type)) {
      await skip('preference_disabled');
      continue;
    }
    try {
      const message = notificationMessage(parent, notification);
      await sendToParent(parent, message.text, message.buttons);
      await admin.from('telegram_notifications').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', notification.id);
      sent++;
    } catch (error) {
      const attempts = Number(notification.attempts || 0) + 1;
      if (attempts < MAX_ATTEMPTS) {
        await admin.from('telegram_notifications').update({
          status: 'pending',
          error: (error as Error).message,
          scheduled_for: new Date(Date.now() + attempts * 60_000).toISOString(),
        }).eq('id', notification.id);
      } else {
        await admin.from('telegram_notifications').update({ status: 'failed', error: (error as Error).message }).eq('id', notification.id);
        failed++;
      }
    }
  }

  return { sent, failed, skipped, checked: data?.length || 0 };
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

      // Any previous unused invitation for this student becomes invalid.
      await admin
        .from('telegram_link_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('student_id', studentId)
        .neq('token_hash', tokenHash)
        .is('used_at', null)
        .is('revoked_at', null);

      const botUsername = await telegramBotUsername();
      return json({
        token,
        expiresAt,
        botUsername,
        url: botUsername ? `https://t.me/${botUsername}?start=${encodeURIComponent(token)}` : null,
      });
    }

    if (action === 'content_event') {
      if (!adminUser && !(await canNotifyForStudent(admin, userId, body.studentId))) return json({ error: 'Forbidden' }, 403);
      await handleContentEvent(admin, body);
      // Deliver instantly instead of waiting for the next cron tick.
      const flushed = await processDue(admin, 25).catch(() => null);
      return json({ success: true, flushed });
    }
    if (action === 'schedule_event') {
      if (!adminUser && !(await canNotifyForStudent(admin, userId, body.studentId))) return json({ error: 'Forbidden' }, 403);
      await handleScheduleEvent(admin, body);
      const flushed = await processDue(admin, 25).catch(() => null);
      return json({ success: true, flushed });
    }
    if (action === 'trial_event') {
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      await handleTrialEvent(admin, body);
      const flushed = await processDue(admin, 25).catch(() => null);
      return json({ success: true, flushed });
    }


    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
