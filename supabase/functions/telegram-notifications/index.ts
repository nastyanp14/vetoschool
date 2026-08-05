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
  notify_billing: boolean;
  notify_trials: boolean;
  notify_weekly: boolean;
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

// Все тексты живут в едином реестре шаблонов.
import {
  formatDate,
  formatTime,
  formatWhen,
  idempotencyKey,
  isCritical,
  preferenceFor,
  renderNotification,
  scoreNote,
  type NotificationEvent,
  type NotifyLang,
  type NotifyRole,
} from '../_shared/notificationTemplates.ts';
import {
  enqueueNotificationEmail,
  renderNotificationEmail,
} from '../_shared/notificationEmail.tsx';

/** Старые типы очереди -> события реестра. */
const EVENT_ALIASES: Record<string, NotificationEvent> = {
  lesson_reminder_24h: 'lesson_reminder_24h',
  lesson_reminder_1h: 'lesson_reminder_1h',
  lesson_reminder_10m: 'lesson_reminder_10m',
  lesson_conducted: 'lesson_completed',
  lesson_completed: 'lesson_completed',
  lesson_scheduled: 'lesson_scheduled',
  lesson_rescheduled: 'lesson_rescheduled',
  lesson_canceled: 'lesson_cancelled',
  lesson_cancelled: 'lesson_cancelled',
  lesson_no_show: 'lesson_no_show',
  homework_published: 'homework_assigned',
  homework_assigned: 'homework_assigned',
  homework_updated: 'homework_updated',
  homework_canceled: 'homework_cancelled',
  homework_cancelled: 'homework_cancelled',
  homework_submitted: 'homework_submitted',
  lesson_result_published: 'lesson_result_published',
  grade_published: 'grade_published',
  grade_updated: 'grade_updated',
  trial_confirmed: 'trial_request_confirmed',
  trial_request_confirmed: 'trial_request_confirmed',
  trial_rescheduled: 'trial_request_rescheduled',
  trial_request_rescheduled: 'trial_request_rescheduled',
  trial_canceled: 'trial_request_cancelled',
  trial_request_cancelled: 'trial_request_cancelled',
  trial_reminder_24h: 'trial_reminder_24h',
  trial_reminder_1h: 'trial_reminder_1h',
  trial_reminder_10m: 'trial_reminder_10m',
  trial_request_completed: 'trial_request_completed',
  trial_request_no_show: 'trial_request_no_show',
  trial_request_converted: 'trial_request_converted',
  trial_recommendation_ready: 'trial_recommendation_ready',
  payment_succeeded: 'payment_succeeded',
  payment_failed: 'payment_failed',
  subscription_cancelled: 'subscription_cancelled',
  subscription_ended: 'subscription_ended',
  lessons_low_balance: 'lessons_low_balance',
  weekly_progress_summary: 'weekly_progress_summary',
};

export function templateVars(payload: any, lang: NotifyLang, now = new Date()) {
  const lessonAt = payload.lessonAt || payload.newLessonAt || null;
  const oldAt = payload.oldLessonAt || payload.oldTime || null;
  const [scoreRaw, maxRaw] = String(payload.grade || '').split('/');
  const score = Number(scoreRaw);
  const maxScore = Number(maxRaw) || 5;
  const url = payload.url || '';
  return {
    student_name: payload.studentName || payload.childName || '',
    child_name: payload.childName || payload.studentName || '',
    parent_name: payload.parentName || '',
    teacher_name: payload.teacherName || '',
    lesson_topic: payload.topic || payload.title || '',
    lesson_title: payload.title || payload.topic || '',
    homework_title: payload.title || '',
    content_title: payload.title || '',
    due_date: payload.dueDate ? formatDate(payload.dueDate, lang) : '',
    lesson_when: lessonAt ? formatWhen(lessonAt, lang, now) : payload.slotLabel || '',
    lesson_date: lessonAt ? formatDate(lessonAt, lang) : payload.slotLabel || '',
    lesson_time: lessonAt ? formatTime(lessonAt, lang) : '',
    old_date: oldAt ? formatDate(oldAt, lang) : payload.oldSlotLabel || '',
    old_time: oldAt ? formatTime(oldAt, lang) : '',
    new_date: lessonAt ? formatDate(lessonAt, lang) : payload.slotLabel || '',
    new_time: lessonAt ? formatTime(lessonAt, lang) : '',
    cancellation_reason: payload.reason || payload.cancellationReason || '',
    score: Number.isFinite(score) ? score : '',
    max_score: maxScore,
    score_note: Number.isFinite(score) ? scoreNote(score, maxScore, lang) : '',
    teacher_comment: payload.comment || payload.teacherComment || '',
    lesson_summary: payload.summary || '',
    homework_summary: payload.homeworkSummary || '',
    plan_name: payload.planName || '',
    amount: payload.amount ?? '',
    currency: payload.currency || '',
    lessons_added: payload.lessonsAdded ?? '',
    lessons_remaining: payload.lessonsRemaining ?? '',
    next_payment_date: payload.nextPaymentDate ? formatDate(payload.nextPaymentDate, lang) : '',
    access_until: payload.accessUntil ? formatDate(payload.accessUntil, lang) : '',
    invoice_number: payload.invoiceNumber || '',
    final_level: payload.finalLevel || '',
    recommended_format: payload.recommendedFormat || '',
    recommended_group: payload.recommendedGroup || '',
    recommended_plan: payload.recommendedPlan || '',
    assigned_group: payload.assignedGroup || '',
    purchased_plan: payload.purchasedPlan || payload.planName || '',
    payment_status: payload.paymentStatus || '',
    first_lesson_date: payload.firstLessonDate ? formatDate(payload.firstLessonDate, lang) : '',
    lessons_total: payload.lessonsTotal ?? '',
    lessons_completed: payload.lessonsCompleted ?? '',
    homework_completed: payload.homeworkCompleted ?? '',
    average_score: payload.averageScore ?? '',
    learning_streak: payload.learningStreak ?? '',
    progress_summary: payload.progressSummary || '',
    teacher_weekly_comment: payload.teacherWeeklyComment || '',
    submitted_at: payload.submittedAt ? formatDate(payload.submittedAt, lang) : '',
    // контекстные ссылки: без валидного https кнопка просто не показывается
    schedule_url: url, lesson_url: payload.lessonUrl || url, homework_url: url, result_url: url,
    request_url: payload.requestUrl || url, billing_url: payload.billingUrl || url,
    dashboard_url: url, progress_url: url, contact_url: payload.contactUrl || url,
    reschedule_url: payload.rescheduleUrl || url, pricing_url: payload.pricingUrl || url,
    student_url: payload.studentUrl || url, recommendation_url: payload.recommendationUrl || url,
    settings_url: payload.settingsUrl || url,
  };
}

export function notificationMessage(parent: ParentRow, notification: any) {
  const lang = (parent.language || 'ru') as NotifyLang;
  const payload = notification.payload || {};
  const event = EVENT_ALIASES[notification.notification_type] || (notification.notification_type as NotificationEvent);
  const rendered = renderNotification(event, 'parent', lang, templateVars(payload, lang));
  if (!rendered) {
    return { text: payload.title || notification.notification_type, buttons: [] as any[] };
  }
  return {
    text: rendered.text,
    buttons: rendered.buttons.map(entry => ({ text: entry.label, url: entry.url })),
    subject: rendered.subject,
    event,
  };
}


async function sendDirectTelegram(chatId: string, text: string, buttons: any[]) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) return null;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      // Каждая кнопка отдельной строкой — так действия читаются лучше.
      reply_markup: buttons.length ? { inline_keyboard: buttons.map(button => [button]) } : undefined,
      disable_web_page_preview: true,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(JSON.stringify(data));
  return String(data?.result?.message_id ?? '') || null;
}

/**
 * Журнал отправок. Уникальный idempotency_key не даёт отправить то же самое
 * событие тому же получателю дважды: повторная отправка администратором
 * должна поднимать event_version.
 */
async function logNotification(admin: any, entry: {
  eventType: string;
  eventVersion?: number;
  entityType: string;
  entityId: string;
  recipientRole?: string;
  recipientId?: string | null;
  recipientEmail?: string | null;
  telegramChatId?: string | null;
  studentId?: string | null;
  channel: 'telegram' | 'email';
  language: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  providerMessageId?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  errorMessage?: string | null;
}) {
  const key = idempotencyKey({
    eventType: entry.eventType,
    entityId: entry.entityId,
    recipientId: entry.recipientId || entry.telegramChatId || entry.recipientEmail || 'unknown',
    channel: entry.channel,
    eventVersion: entry.eventVersion ?? 1,
  });
  const now = new Date().toISOString();
  const { error } = await admin.from('notification_log').upsert({
    event_type: entry.eventType,
    event_version: entry.eventVersion ?? 1,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    recipient_role: entry.recipientRole || 'parent',
    recipient_id: entry.recipientId || null,
    recipient_email: entry.recipientEmail || null,
    telegram_chat_id: entry.telegramChatId || null,
    student_id: entry.studentId || null,
    channel: entry.channel,
    language: entry.language,
    status: entry.status,
    provider_message_id: entry.providerMessageId || null,
    subject: entry.subject || null,
    body_preview: entry.bodyPreview ? entry.bodyPreview.slice(0, 500) : null,
    error_message: entry.errorMessage || null,
    idempotency_key: key,
    sent_at: entry.status === 'sent' ? now : null,
    failed_at: entry.status === 'failed' ? now : null,
  }, { onConflict: 'idempotency_key', ignoreDuplicates: true });
  if (error) console.error('notification_log write failed', error.message);
  return key;
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
  return await sendDirectTelegram(parent.telegram_chat_id, text, buttons);
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

const PREFERENCE_COLUMN: Record<string, keyof ParentRow> = {
  lessons: 'notify_lesson_reminders',
  homework: 'notify_homework',
  grades: 'notify_grades',
  schedule: 'notify_schedule_changes',
  billing: 'notify_billing',
  trials: 'notify_trials',
  weekly: 'notify_weekly',
};

function registryEvent(notificationType: string): NotificationEvent {
  return EVENT_ALIASES[notificationType] || (notificationType as NotificationEvent);
}

/**
 * Настройки получателя решают всё, кроме критичных событий
 * (отмена, перенос, биллинг) — их родитель получает всегда.
 */
function preferenceAllows(parent: ParentRow, notificationType: string) {
  const event = registryEvent(notificationType);
  if (isCritical(event, 'parent')) return true;
  const preference = preferenceFor(event, 'parent');
  if (!preference) return false;
  const column = PREFERENCE_COLUMN[preference];
  if (!column) return false;
  return parent[column] !== false;
}

/* ----------------------------------------------------- email-канал */

function pickLangCode(value?: string | null): NotifyLang {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'ua' || normalized === 'uk') return 'ua';
  if (normalized === 'en') return 'en';
  return 'ru';
}

async function studentContact(admin: any, studentId: string) {
  const { data } = await admin.from('profiles').select('email,name,lang').eq('id', studentId).maybeSingle();
  return data || null;
}

/** Следующая версия события: повторная отправка не спорит с idempotency_key. */
async function nextEventVersion(admin: any, entityType: string, entityId: string, eventType: string) {
  const { data } = await admin
    .from('notification_log')
    .select('event_version')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('event_type', eventType)
    .order('event_version', { ascending: false })
    .limit(1);
  return Number(data?.[0]?.event_version || 0) + 1;
}

/**
 * Письмо строится из того же реестра, что и Telegram, и уходит в очередь
 * transactional_emails. Дубли отсекает уникальный idempotency_key.
 */
async function deliverEmail(admin: any, input: {
  event: NotificationEvent;
  entityType: string;
  entityId: string;
  studentId?: string | null;
  recipientEmail?: string | null;
  recipientRole?: NotifyRole;
  lang?: string | null;
  vars: Record<string, unknown>;
  eventVersion?: number;
}) {
  const email = (input.recipientEmail || '').trim().toLowerCase();
  if (!email) return { skipped: 'no_email' };

  const lang = pickLangCode(input.lang);
  const role = input.recipientRole || 'parent';
  const eventVersion = input.eventVersion ?? 1;
  const key = idempotencyKey({
    eventType: input.event,
    entityId: input.entityId,
    recipientId: email,
    channel: 'email',
    eventVersion,
  });

  const { error: claimError } = await admin.from('notification_log').insert({
    event_type: input.event,
    event_version: eventVersion,
    entity_type: input.entityType,
    entity_id: input.entityId,
    recipient_role: role,
    recipient_email: email,
    student_id: input.studentId || null,
    channel: 'email',
    language: lang,
    status: 'pending',
    idempotency_key: key,
  });
  if (claimError) {
    // 23505 = такое письмо уже отправлялось
    if (claimError.code !== '23505') console.error('notification_log claim failed', claimError.message);
    return { skipped: 'duplicate' };
  }

  const finish = async (patch: Record<string, unknown>) => {
    await admin.from('notification_log').update(patch).eq('idempotency_key', key);
  };

  try {
    const rendered = await renderNotificationEmail(input.event, role, lang, input.vars as any);
    if (!rendered) {
      await finish({ status: 'skipped', error_message: 'no_template' });
      return { skipped: 'no_template' };
    }
    const queued = await enqueueNotificationEmail(admin, {
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      label: input.event,
      idempotencyKey: key,
    });
    if (queued.skipped) {
      await finish({ status: 'skipped', error_message: queued.skipped });
      return { skipped: queued.skipped };
    }
    await finish({
      status: 'sent',
      sent_at: new Date().toISOString(),
      provider_message_id: queued.messageId,
      subject: rendered.subject,
      body_preview: rendered.message.text.slice(0, 500),
    });
    return { sent: true };
  } catch (error) {
    await finish({
      status: 'failed',
      failed_at: new Date().toISOString(),
      error_message: (error as Error).message,
    });
    return { skipped: 'failed' };
  }
}

/** Письмо владельцу аккаунта ученика по тем же данным, что и Telegram. */
async function emailStudentEvent(admin: any, studentId: string, notificationType: string, payload: any, entity: { type: string; id: string }, eventVersion = 1) {
  if (!studentId) return;
  const contact = await studentContact(admin, studentId);
  if (!contact?.email) return;
  const lang = pickLangCode(contact.lang);
  await deliverEmail(admin, {
    event: registryEvent(notificationType),
    entityType: entity.type,
    entityId: entity.id,
    studentId,
    recipientEmail: contact.email,
    recipientRole: 'parent',
    lang,
    vars: templateVars({ studentName: contact.name || '', ...payload }, lang) as any,
    eventVersion,
  });
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
      const providerMessageId = await sendToParent(parent, message.text, message.buttons);
      await admin.from('telegram_notifications').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', notification.id);
      await logNotification(admin, {
        eventType: (message as any).event || notification.notification_type,
        entityType: notification.trial_booking_id ? 'trial_booking' : 'notification',
        entityId: String(notification.trial_booking_id || notification.event_key || notification.id),
        recipientRole: 'parent',
        recipientId: parent.id,
        telegramChatId: parent.telegram_chat_id,
        studentId: notification.student_id,
        channel: 'telegram',
        language: parent.language || 'ru',
        status: 'sent',
        providerMessageId,
        subject: (message as any).subject || null,
        bodyPreview: message.text,
      });
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
