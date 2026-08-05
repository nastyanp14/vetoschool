import { supabase } from '@/integrations/supabase/client';
import { cacheGet, cacheSet } from './storage';
import { notifyLessonConducted, notifyScheduleSaved } from './telegram';

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

export async function loadStudentSchedule(userId: string): Promise<ScheduleSlot[]> {
  const { data: memberships, error: membershipError } = await (supabase as any)
    .from('student_group_members')
    .select('group_id')
    .eq('user_id', userId);
  const groupIds = membershipError ? [] : (((memberships as any[]) || []).map(row => row.group_id).filter(Boolean));
  const query = groupIds.length
    ? (supabase as any).from('schedules').select('*').or(`user_id.eq.${userId},group_id.in.(${groupIds.join(',')})`).order('position', { ascending: true })
    : (supabase as any).from('schedules').select('*').eq('user_id', userId).order('position', { ascending: true });
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
}

export async function saveStudentSchedule(userId: string, slots: ScheduleSlot[]): Promise<void> {
  const before = getStudentSchedule(userId);
  await supabase.from('schedules').delete().eq('user_id', userId);
  if (slots.length) {
    const rows = slots.map((s, i) => ({
      user_id: userId, day: s.day, time: s.time, topic: s.topic, position: i,
      is_conducted: !!s.isConducted,
      source_lesson_id: s.sourceLessonId || null,
    }));
    const { error } = await supabase.from('schedules').insert(rows as never);
    if (error) throw error;
  }
  await notifyScheduleSaved(userId, before, slots);
  await loadStudentSchedule(userId);
}

export async function setSlotConducted(slotId: string, value: boolean, studentId?: string): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .update({ is_conducted: value } as never)
    .eq('id', slotId);
  if (error) throw error;
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
  if (studentId && before) await notifyScheduleSaved(studentId, [before], []);
}
