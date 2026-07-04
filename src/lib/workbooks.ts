import { supabase } from '@/integrations/supabase/client';
import { WORKBOOK_ASSETS_BUCKET, MechanicType, LessonKind, canReward } from './mechanics';

export interface Workbook { id: string; title: string; description: string | null; order: number; is_published: boolean; }
export interface Unit { id: string; workbook_id: string; title: string; emoji: string; order: number; }
export interface Lesson {
  id: string; unit_id: string; title: string; lesson_number: number; order: number;
  type: LessonKind; stars_reward: number;
}
export interface InteractiveTask {
  id: string; lesson_id: string; mechanic_type: MechanicType; order: number; payload_json: any;
}

// ==================== WORKBOOKS ====================
export async function listWorkbooks(): Promise<Workbook[]> {
  const { data } = await supabase.from('workbooks').select('*').order('order');
  return (data as any) || [];
}
export async function createWorkbook(title: string): Promise<Workbook | null> {
  const { data: existing } = await supabase.from('workbooks').select('order').order('order', { ascending: false }).limit(1);
  const nextOrder = ((existing?.[0] as any)?.order ?? -1) + 1;
  const { data, error } = await supabase.from('workbooks').insert({ title, order: nextOrder } as any).select().single();
  if (error) { console.error(error); return null; }
  return data as any;
}
export async function updateWorkbook(id: string, patch: Partial<Workbook>) {
  await supabase.from('workbooks').update(patch as any).eq('id', id);
}
export async function deleteWorkbook(id: string) {
  await supabase.from('workbooks').delete().eq('id', id);
}

// ==================== UNITS ====================
export async function listUnits(workbookId: string): Promise<Unit[]> {
  const { data } = await supabase.from('units').select('*').eq('workbook_id', workbookId).order('order');
  return (data as any) || [];
}
export async function createUnit(workbookId: string, title: string, emoji = '🏝️'): Promise<Unit | null> {
  const { data: existing } = await supabase.from('units').select('order').eq('workbook_id', workbookId).order('order', { ascending: false }).limit(1);
  const nextOrder = ((existing?.[0] as any)?.order ?? -1) + 1;
  const { data, error } = await supabase.from('units').insert({ workbook_id: workbookId, title, emoji, order: nextOrder } as any).select().single();
  if (error) { console.error(error); return null; }
  return data as any;
}
export async function updateUnit(id: string, patch: Partial<Unit>) {
  await supabase.from('units').update(patch as any).eq('id', id);
}
export async function deleteUnit(id: string) {
  await supabase.from('units').delete().eq('id', id);
}

// ==================== LESSONS ====================
export async function listLessons(unitId: string): Promise<Lesson[]> {
  const { data } = await supabase.from('lessons').select('*').eq('unit_id', unitId).order('order');
  return (data as any) || [];
}
export async function createLesson(unitId: string, title: string, type: LessonKind = 'practice'): Promise<Lesson | null> {
  const { data: existing } = await supabase.from('lessons').select('order,lesson_number').eq('unit_id', unitId).order('order', { ascending: false }).limit(1);
  const nextOrder = ((existing?.[0] as any)?.order ?? -1) + 1;
  const nextNumber = ((existing?.[0] as any)?.lesson_number ?? 0) + 1;
  const stars = canReward(type) ? 5 : 0;
  const { data, error } = await supabase.from('lessons').insert({
    unit_id: unitId, title, type, order: nextOrder, lesson_number: nextNumber, stars_reward: stars,
  } as any).select().single();
  if (error) { console.error(error); return null; }
  return data as any;
}
export async function updateLesson(id: string, patch: Partial<Lesson>) {
  const clean: any = { ...patch };
  if (clean.type && !canReward(clean.type)) clean.stars_reward = 0;
  await supabase.from('lessons').update(clean).eq('id', id);
}
export async function deleteLesson(id: string) {
  await supabase.from('lessons').delete().eq('id', id);
}

// ==================== TASKS ====================
export async function listTasks(lessonId: string): Promise<InteractiveTask[]> {
  const { data } = await supabase.from('interactive_tasks').select('*').eq('lesson_id', lessonId).order('order');
  return (data as any) || [];
}
export async function createTask(lessonId: string, mechanic: MechanicType, payload: any = {}): Promise<InteractiveTask | null> {
  const { data: existing } = await supabase.from('interactive_tasks').select('order').eq('lesson_id', lessonId).order('order', { ascending: false }).limit(1);
  const nextOrder = ((existing?.[0] as any)?.order ?? -1) + 1;
  const { data, error } = await supabase.from('interactive_tasks').insert({
    lesson_id: lessonId, mechanic_type: mechanic, payload_json: payload, order: nextOrder,
  } as any).select().single();
  if (error) { console.error(error); return null; }
  return data as any;
}
export async function updateTaskPayload(id: string, payload: any) {
  await supabase.from('interactive_tasks').update({ payload_json: payload } as any).eq('id', id);
}
export async function deleteTask(id: string) {
  await supabase.from('interactive_tasks').delete().eq('id', id);
}

// ==================== STORAGE ====================
export async function uploadWorkbookAsset(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(WORKBOOK_ASSETS_BUCKET).upload(path, file, { upsert: false });
  if (error) { console.error(error); return null; }
  return path;
}
export async function signedUrlFor(path: string, expiresInSec = 3600): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(WORKBOOK_ASSETS_BUCKET).createSignedUrl(path, expiresInSec);
  return data?.signedUrl ?? null;
}

// ==================== PROGRESS ====================
export async function getLessonProgress(userId: string): Promise<Record<string, { completed_at: string; stars_awarded: number }>> {
  const { data } = await (supabase as any).from('lesson_progress').select('lesson_id, completed_at, stars_awarded').eq('user_id', userId);
  const map: Record<string, any> = {};
  (data || []).forEach((r: any) => { map[r.lesson_id] = { completed_at: r.completed_at, stars_awarded: r.stars_awarded }; });
  return map;
}
export async function markLessonComplete(userId: string, lesson: Lesson): Promise<number> {
  // Returns stars awarded (0 if already completed).
  const existing = await (supabase as any).from('lesson_progress').select('id, stars_awarded').eq('user_id', userId).eq('lesson_id', lesson.id).maybeSingle();
  if (existing.data) return 0;
  const stars = canReward(lesson.type) ? (lesson.stars_reward || 0) : 0;
  await (supabase as any).from('lesson_progress').insert({ user_id: userId, lesson_id: lesson.id, stars_awarded: stars });
  return stars;
}
