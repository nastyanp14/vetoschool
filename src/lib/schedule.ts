import { supabase } from '@/integrations/supabase/client';
import { cacheGet, cacheSet } from './storage';
import { notifyLessonConducted, notifyScheduleSaved } from './telegram';
import { cachedQuery, invalidateQueryCache, QUERY_LIMITS } from './queryCache';

export interface ScheduleSlot {
  id: string;
  day: string;
  date?: string | null;
  time: string;
  topic: string;
  isConducted: boolean;
  sourceLessonId?: string | null;
  status?: string | null;
  groupId?: string | null;
  teacherId?: string | null;
  durationMinutes?: number | null;
  room?: string | null;
  onlineUrl?: string | null;
}

type ScheduleRow = {
  id: string;
  day: string;
  time: string;
  topic: string;
  is_conducted?: boolean | null;
  source_lesson_id?: string | null;
  scheduled_date?: string | null;
  lesson_status?: string | null;
  group_id?: string | null;
  teacher_id?: string | null;
  duration_minutes?: number | null;
  room?: string | null;
  online_url?: string | null;
};

const key = (uid: string) => `schedule:${uid}`;
const SCHEDULE_COLUMNS = 'id,user_id,group_id,day,scheduled_date,time,topic,is_conducted,source_lesson_id,lesson_status,teacher_id,duration_minutes,room,online_url,position';
const INACTIVE_STATUSES = new Set(['completed', 'cancelled', 'rescheduled', 'student_absent', 'teacher_absent']);

export function isActiveScheduleSlot(slot: ScheduleSlot): boolean {
  return !slot.isConducted && !INACTIVE_STATUSES.has(String(slot.status || '').toLowerCase());
}

export function scheduleSlotTimeValue(slot: ScheduleSlot): number {
  const date = slot.date || '2999-12-31';
  return new Date(`${date}T${slot.time || '00:00'}`).getTime();
}

export function getStudentSchedule(userId: string): ScheduleSlot[] {
  return cacheGet<ScheduleSlot[]>(key(userId)) ?? [];
}

export async function loadStudentSchedule(userId: string, options: { force?: boolean } = {}): Promise<ScheduleSlot[]> {
  return cachedQuery(`postgrest:schedule:${userId}`, 60_000, async () => {
    const { data: memberships, error: membershipError } = await (supabase as any)
      .from('student_group_members')
      .select('group_id')
      .eq('user_id', userId)
      .limit(QUERY_LIMITS.smallList);
    const groupIds = membershipError ? [] : (((memberships as any[]) || []).map(row => row.group_id).filter(Boolean));
    const query = groupIds.length
      ? (supabase as any).from('schedules').select(SCHEDULE_COLUMNS).or(`user_id.eq.${userId},group_id.in.(${groupIds.join(',')})`).order('position', { ascending: true }).limit(QUERY_LIMITS.userList)
      : (supabase as any).from('schedules').select(SCHEDULE_COLUMNS).eq('user_id', userId).order('position', { ascending: true }).limit(QUERY_LIMITS.userList);
    const { data, error } = await query;
    if (error) { console.error(error); return []; }
    const uniqueRows = Array.from(new Map(((data || []) as ScheduleRow[]).map(row => [row.id, row])).values());
    const slots: ScheduleSlot[] = uniqueRows.map(r => ({
      id: r.id,
      day: r.day,
      date: r.scheduled_date ?? null,
      time: r.time,
      topic: r.topic,
      isConducted: !!r.is_conducted || r.lesson_status === 'completed',
      sourceLessonId: r.source_lesson_id ?? null,
      status: r.lesson_status ?? null,
      groupId: r.group_id ?? null,
      teacherId: r.teacher_id ?? null,
      durationMinutes: r.duration_minutes ?? null,
      room: r.room ?? null,
      onlineUrl: r.online_url ?? null,
    })).sort((a, b) => scheduleSlotTimeValue(a) - scheduleSlotTimeValue(b));
    cacheSet(key(userId), slots);
    return slots;
  }, { force: options.force });
}

export async function saveStudentSchedule(userId: string, slots: ScheduleSlot[]): Promise<void> {
  const before = getStudentSchedule(userId);
  const personalSlots = slots.filter(slot => !slot.groupId);
  const retainedIds = personalSlots.map(slot => slot.id);
  let deleteQuery = supabase.from('schedules').delete().eq('user_id', userId);
  if (retainedIds.length) deleteQuery = deleteQuery.not('id', 'in', `(${retainedIds.join(',')})`);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;
  if (personalSlots.length) {
    const rows = personalSlots.map((s, i) => ({
      id: s.id,
      user_id: userId, day: s.day, time: s.time, topic: s.topic, position: i,
      is_conducted: !!s.isConducted,
      source_lesson_id: s.sourceLessonId || null,
      scheduled_date: s.date || null,
      lesson_status: s.status || 'scheduled',
      teacher_id: s.teacherId || null,
      duration_minutes: s.durationMinutes || null,
      room: s.room || null,
      online_url: s.onlineUrl || null,
    }));
    const { error } = await supabase.from('schedules').upsert(rows as never, { onConflict: 'id' });
    if (error) throw error;
  }
  await notifyScheduleSaved(userId, before, slots);
  invalidateQueryCache(`postgrest:schedule:${userId}`);
  await loadStudentSchedule(userId, { force: true });
}

export async function setSlotConducted(slotId: string, value: boolean, studentId?: string): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .update({ is_conducted: value } as never)
    .eq('id', slotId);
  if (error) throw error;
  if (studentId) invalidateQueryCache(`postgrest:schedule:${studentId}`);
  if (value && studentId) {
    const slot = getStudentSchedule(studentId).find(s => s.id === slotId);
    if (slot) await notifyLessonConducted(studentId, { ...slot, isConducted: true });
  }
}

export async function deleteScheduleSlot(slotId: string, studentId?: string): Promise<void> {
  const before = studentId ? getStudentSchedule(studentId).find(slot => slot.id === slotId) : undefined;
  await (supabase as any).from('content_items').delete().like('module_id', `lesson-block:${slotId}:%`);
  await (supabase as any).from('lesson_plan_blocks').delete().eq('schedule_id', slotId);
  await (supabase as any).from('lesson_attendance').delete().eq('lesson_id', slotId);
  await (supabase as any).from('lesson_results').delete().eq('lesson_id', slotId);
  await (supabase as any).from('grades').delete().eq('lesson_id', slotId);
  const { error } = await supabase.from('schedules').delete().eq('id', slotId);
  if (error) throw error;
  if (studentId) invalidateQueryCache(`postgrest:schedule:${studentId}`);
  if (studentId && before) await notifyScheduleSaved(studentId, [before], []);
}
