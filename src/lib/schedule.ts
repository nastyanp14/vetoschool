import { supabase } from '@/integrations/supabase/client';
import { cacheGet, cacheSet } from './storage';
import { notifyLessonConducted, notifyScheduleSaved } from './telegram';

export interface ScheduleSlot {
  id: string;
  day: string;
  time: string;
  topic: string;
  isConducted: boolean;
}

const key = (uid: string) => `schedule:${uid}`;

export function getStudentSchedule(userId: string): ScheduleSlot[] {
  return cacheGet<ScheduleSlot[]>(key(userId)) ?? [];
}

export async function loadStudentSchedule(userId: string): Promise<ScheduleSlot[]> {
  const { data, error } = await supabase
    .from('schedules').select('*').eq('user_id', userId).order('position', { ascending: true });
  if (error) { console.error(error); return []; }
  const slots: ScheduleSlot[] = (data || []).map((r: any) => ({
    id: r.id, day: r.day, time: r.time, topic: r.topic, isConducted: !!r.is_conducted,
  }));
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
    } as any));
    const { error } = await supabase.from('schedules').insert(rows);
    if (error) throw error;
  }
  await notifyScheduleSaved(userId, before, slots);
  await loadStudentSchedule(userId);
}

export async function setSlotConducted(slotId: string, value: boolean, studentId?: string): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .update({ is_conducted: value } as any)
    .eq('id', slotId);
  if (error) throw error;
  if (value && studentId) {
    const slot = getStudentSchedule(studentId).find(s => s.id === slotId);
    if (slot) await notifyLessonConducted(studentId, { ...slot, isConducted: true });
  }
}
