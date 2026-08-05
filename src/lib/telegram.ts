import { supabase } from '@/integrations/supabase/client';
import type { ContentItem } from './content';
import type { ScheduleSlot } from './schedule';

export type TelegramNotifyType =
  | 'lesson_scheduled'
  | 'lesson_rescheduled'
  | 'lesson_canceled'
  | 'lesson_conducted'
  | 'homework_published'
  | 'grade_published';

export interface TelegramParentAccount {
  id: string;
  parentName?: string | null;
  telegramUsername?: string | null;
  linkedAt?: string | null;
  language: 'ru' | 'ua' | 'en';
  notifyLessonReminders: boolean;
  notifyHomework: boolean;
  notifyGrades: boolean;
  notifyScheduleChanges: boolean;
}

const botUsername = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'vetoschool_bot').replace(/^@/, '');

function asAnySupabase() {
  return supabase as any;
}

export const APP_TIMEZONE = 'Europe/Prague';

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

// Lesson dates/times are entered without a timezone and always mean local school
// time (Europe/Prague). Never rely on the browser timezone here.
export function normalizeIso(date?: string | null, time?: string | null) {
  if (!date || !time) return null;
  const withSeconds = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  const guess = new Date(`${date}T${withSeconds}Z`);
  if (Number.isNaN(guess.getTime())) return null;
  let ts = guess.getTime() - tzOffsetMs(guess, APP_TIMEZONE);
  ts = guess.getTime() - tzOffsetMs(new Date(ts), APP_TIMEZONE);
  return new Date(ts).toISOString();
}


async function invokeTelegram(body: Record<string, unknown>) {
  try {
    const { error } = await supabase.functions.invoke('telegram-notifications', { body });
    if (error) console.warn('telegram notification skipped', error);
  } catch (error) {
    console.warn('telegram notification skipped', error);
  }
}

export function telegramParentFromLinkRow(row: any): TelegramParentAccount | null {
  const parent = Array.isArray(row?.telegram_parent_accounts)
    ? row.telegram_parent_accounts[0]
    : row?.telegram_parent_accounts;
  if (!parent?.id) return null;
  return {
    id: parent.id,
    parentName: parent.parent_name || parent.display_name || [parent.first_name, parent.last_name].filter(Boolean).join(' ') || null,
    telegramUsername: parent.telegram_username,
    linkedAt: row.linked_at || parent.linked_at || row.created_at || null,
    language: parent.language || 'ru',
    notifyLessonReminders: !!parent.notify_lesson_reminders,
    notifyHomework: !!parent.notify_homework,
    notifyGrades: !!parent.notify_grades,
    notifyScheduleChanges: !!parent.notify_schedule_changes,
  };
}

export async function createTelegramLink(studentId: string) {
  const { data, error } = await supabase.functions.invoke('telegram-notifications', {
    body: { action: 'create_link_token', studentId },
  });
  if (error) throw error;
  const token = data?.token;
  if (!token) throw new Error('Telegram link token was not created');
  return {
    token,
    url: (data.url as string | null) || `https://t.me/${(data.botUsername as string | undefined)?.replace(/^@/, '') || botUsername}?start=${encodeURIComponent(token)}`,
    expiresAt: data.expiresAt as string,
  };
}

export async function listTelegramParents(studentId: string): Promise<TelegramParentAccount[]> {
  const selectWithExplicitRelation = `
    parent_id,
    linked_at,
    created_at,
    active,
    telegram_parent_accounts!student_parent_links_parent_id_fkey (
      id,
      parent_name,
      display_name,
      first_name,
      last_name,
      telegram_username,
      language,
      linked_at,
      notify_lesson_reminders,
      notify_homework,
      notify_grades,
      notify_schedule_changes
    )
  `;

  const firstResult = await asAnySupabase()
    .from('student_parent_links')
    .select(selectWithExplicitRelation)
    .eq('student_id', studentId)
    .eq('active', true)
    .order('linked_at', { ascending: false });

  const { data, error } = firstResult.error
    ? await asAnySupabase()
      .from('student_parent_links')
      .select('linked_at,created_at,active,telegram_parent_accounts(*)')
      .eq('student_id', studentId)
      .eq('active', true)
      .order('linked_at', { ascending: false })
    : firstResult;

  if (error) {
    console.warn('Could not load Telegram parents (embedded query)', error);
  }

  const embedded = (data || [])
    .map(telegramParentFromLinkRow)
    .filter((parent): parent is TelegramParentAccount => Boolean(parent));
  if (embedded.length) return embedded;

  // Fallback: PostgREST embedding can come back empty when the joined row is
  // filtered by its own RLS policy evaluation. Fetch links and parents apart.
  const { data: links, error: linksError } = await asAnySupabase()
    .from('student_parent_links')
    .select('parent_id,linked_at,created_at,active')
    .eq('student_id', studentId)
    .eq('active', true);
  if (linksError || !links?.length) {
    if (linksError) console.warn('Could not load Telegram parent links', linksError);
    return [];
  }

  const parentIds = links.map((row: any) => row.parent_id).filter(Boolean);
  const { data: accounts, error: accountsError } = await asAnySupabase()
    .from('telegram_parent_accounts')
    .select('*')
    .in('id', parentIds);
  if (accountsError) {
    console.warn('Could not load Telegram parent accounts', accountsError);
    return [];
  }

  const accountById = new Map((accounts || []).map((account: any) => [account.id, account]));
  return links
    .map((row: any) => telegramParentFromLinkRow({ ...row, telegram_parent_accounts: accountById.get(row.parent_id) }))
    .filter((parent): parent is TelegramParentAccount => Boolean(parent));

}

export async function disconnectTelegramParent(studentId: string, parentId: string) {
  // The table has no DELETE/UPDATE policy for end users, so a direct mutation
  // silently affects 0 rows. Use the SECURITY DEFINER RPC instead: it keeps the
  // Telegram account (still usable for other children) and only deactivates
  // this student-parent link so the parent can reconnect with a new token.
  const { data, error } = await asAnySupabase().rpc('disconnect_telegram_parent', {
    _student_id: studentId,
    _parent_id: parentId,
  });
  if (error) throw error;
  return data === true;
}

export async function notifyContentChanges(studentId: string, before: ContentItem[], after: ContentItem[]) {
  const beforeById = new Map(before.map(item => [item.id, item]));
  const events: Record<string, unknown>[] = [];

  for (const item of after) {
    const prev = beforeById.get(item.id);
    const lessonAt = normalizeIso(item.scheduledDate, item.scheduledTime);
    const becamePublished = item.unlocked && !prev?.unlocked;
    const scheduleChanged = prev && item.type === 'lesson' && item.unlocked && lessonAt && (
      prev.scheduledDate !== item.scheduledDate || prev.scheduledTime !== item.scheduledTime
    );
    const becameGraded = !!item.starRating && item.starRating > 0 && (
      !prev?.starRating || prev.starRating !== item.starRating
    );

    if (item.type === 'lesson' && lessonAt && (becamePublished || (!prev && item.unlocked))) {
      events.push({ type: 'lesson_scheduled', item, lessonAt });
    }
    if (scheduleChanged) {
      events.push({
        type: 'lesson_rescheduled',
        item,
        lessonAt,
        oldLessonAt: normalizeIso(prev?.scheduledDate, prev?.scheduledTime),
      });
    }
    if (item.type === 'homework' && becamePublished) {
      events.push({ type: 'homework_published', item });
    }
    if (becameGraded && item.type !== 'lesson') {
      events.push({ type: 'grade_published', item, gradeEventId: item.updatedAt || item.id });
    }
  }

  await Promise.all(events.map(event => invokeTelegram({ action: 'content_event', studentId, ...event })));
}

export async function notifyContentDeleted(studentId: string, item: ContentItem | undefined) {
  if (!item || item.type !== 'lesson' || !item.unlocked) return;
  const oldLessonAt = normalizeIso(item.scheduledDate, item.scheduledTime);
  await invokeTelegram({ action: 'content_event', type: 'lesson_canceled', studentId, item, oldLessonAt });
}

export async function notifyLessonConducted(studentId: string, slot: ScheduleSlot) {
  await invokeTelegram({ action: 'schedule_event', type: 'lesson_conducted', studentId, slot });
}

export async function notifyHomeworkReviewed(studentId: string, item: {
  id: string;
  type: string;
  title: string;
  starRating?: number | null;
  teacherComment?: string | null;
  reviewComment?: string | null;
}) {
  if (!studentId || !item.id || !item.starRating || item.starRating <= 0) return;
  await invokeTelegram({
    action: 'content_event',
    type: 'grade_published',
    studentId,
    item: {
      id: item.id,
      type: item.type,
      title: item.title,
      starRating: item.starRating,
      teacherComment: item.teacherComment || item.reviewComment || '',
    },
  });
}

export async function notifyLessonGradePublished(studentId: string, input: {
  lessonId: string;
  title: string;
  score: number;
  comment?: string | null;
  category?: string | null;
}) {
  if (!studentId || !input.lessonId || !input.score || input.score <= 0) return;
  const categoryKey = (input.category || 'lesson').toLowerCase().replace(/[^a-z0-9_-]+/gi, '-');
  await invokeTelegram({
    action: 'content_event',
    type: 'grade_published',
    studentId,
    item: {
      id: `lesson-result:${input.lessonId}:${studentId}:${categoryKey}`,
      type: 'checkpoint',
      title: input.title,
      starRating: input.score,
      teacherComment: input.comment || '',
    },
  });
}

export async function notifyScheduleSaved(studentId: string, before: ScheduleSlot[], after: ScheduleSlot[]) {
  const beforeById = new Map(before.map(slot => [slot.id, slot]));
  const beforeSignatures = new Set(before.map(slot => `${slot.day}|${slot.time}|${slot.topic}`));
  const events: Record<string, unknown>[] = [];

  for (const slot of after) {
    const prev = beforeById.get(slot.id);
    if (prev && (prev.day !== slot.day || prev.time !== slot.time || prev.topic !== slot.topic)) {
      events.push({ type: 'lesson_rescheduled', slot, oldSlot: prev });
    } else if (!prev && !beforeSignatures.has(`${slot.day}|${slot.time}|${slot.topic}`)) {
      events.push({ type: 'lesson_scheduled', slot });
    }
  }

  const afterSignatures = new Set(after.map(slot => `${slot.day}|${slot.time}|${slot.topic}`));
  for (const slot of before) {
    if (!after.find(next => next.id === slot.id) && !afterSignatures.has(`${slot.day}|${slot.time}|${slot.topic}`)) {
      events.push({ type: 'lesson_canceled', slot });
    }
  }

  await Promise.all(events.map(event => invokeTelegram({ action: 'schedule_event', studentId, ...event })));
}

export async function notifyHomeworkAssigned(studentId: string, item: { id: string; title: string }) {
  if (!studentId || !item?.id) return;
  await invokeTelegram({
    action: 'content_event',
    type: 'homework_published',
    studentId,
    item: { id: item.id, type: 'homework', title: item.title },
  });
}
