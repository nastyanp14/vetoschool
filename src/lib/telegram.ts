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

function normalizeIso(date?: string | null, time?: string | null) {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

async function invokeTelegram(body: Record<string, unknown>) {
  try {
    const { error } = await supabase.functions.invoke('telegram-notifications', { body });
    if (error) console.warn('telegram notification skipped', error);
  } catch (error) {
    console.warn('telegram notification skipped', error);
  }
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
    url: `https://t.me/${botUsername}?start=${encodeURIComponent(token)}`,
    expiresAt: data.expiresAt as string,
  };
}

export async function listTelegramParents(studentId: string): Promise<TelegramParentAccount[]> {
  const { data, error } = await asAnySupabase()
    .from('student_parent_links')
    .select('telegram_parent_accounts(*)')
    .eq('student_id', studentId);
  if (error) {
    console.warn('Could not load Telegram parents', error);
    return [];
  }
  return (data || [])
    .map((row: any) => row.telegram_parent_accounts)
    .filter(Boolean)
    .map((parent: any) => ({
      id: parent.id,
      parentName: parent.parent_name,
      telegramUsername: parent.telegram_username,
      language: parent.language || 'ru',
      notifyLessonReminders: !!parent.notify_lesson_reminders,
      notifyHomework: !!parent.notify_homework,
      notifyGrades: !!parent.notify_grades,
      notifyScheduleChanges: !!parent.notify_schedule_changes,
    }));
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
    const becameGraded = item.unlocked && !!item.starRating && item.starRating > 0 && (
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
      events.push({ type: 'grade_published', item });
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
