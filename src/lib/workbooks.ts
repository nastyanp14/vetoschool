import { supabase } from '@/integrations/supabase/client';
import { WORKBOOK_ASSETS_BUCKET, MechanicType, LessonKind, canReward } from './mechanics';
import { awardStars } from './stars';

export interface Workbook { id: string; title: string; description: string | null; order?: number; is_published: boolean; is_global?: boolean; }
export interface WorkbookAssignment {
  id: string;
  workbook_id: string;
  assignee_type: 'student' | 'group';
  user_id: string | null;
  group_id: string | null;
}
export interface Unit {
  id: string;
  workbook_id: string;
  title: string;
  emoji?: string | null;
  unit_number: number;
  order?: number;
}
export interface Lesson {
  id: string; unit_id: string; title: string; lesson_number: number; order: number;
  type: LessonKind; stars_reward: number;
}
export interface InteractiveTask {
  id: string; lesson_id: string; mechanic_type: MechanicType; order: number; payload_json: any;
}

// ==================== WORKBOOKS ====================
export async function listWorkbooks(): Promise<Workbook[]> {
  const { data, error } = await supabase.from('workbooks').select('*').order('created_at');
  if (error) throw error;
  return ((data as any) || []).map((wb: any) => ({
    ...wb,
    is_published: wb.is_published ?? wb.is_global ?? true,
  }));
}

export async function listAvailableWorkbooks(userId: string): Promise<Workbook[]> {
  const all = await listWorkbooks();
  const global = all.filter(wb => wb.is_published);

  try {
    const { data: direct, error: directError } = await (supabase as any)
      .from('workbook_assignments')
      .select('workbook_id')
      .eq('assignee_type', 'student')
      .eq('user_id', userId);
    if (directError) throw directError;

    const { data: memberships, error: membershipError } = await (supabase as any)
      .from('student_group_members')
      .select('group_id')
      .eq('user_id', userId);
    if (membershipError) throw membershipError;

    const groupIds = ((memberships as any[]) || []).map(row => row.group_id).filter(Boolean);
    let groupAssigned: any[] = [];
    if (groupIds.length > 0) {
      const { data, error } = await (supabase as any)
        .from('workbook_assignments')
        .select('workbook_id')
        .eq('assignee_type', 'group')
        .in('group_id', groupIds);
      if (error) throw error;
      groupAssigned = data || [];
    }

    const assignedIds = new Set([...(direct || []), ...groupAssigned].map(row => row.workbook_id));
    const assigned = all.filter(wb => assignedIds.has(wb.id));
    const byId = new Map<string, Workbook>();
    [...global, ...assigned].forEach(wb => byId.set(wb.id, wb));
    return Array.from(byId.values());
  } catch (error) {
    // Assignment tables may not exist yet in older Supabase projects.
    return global;
  }
}

export async function listWorkbookAssignments(workbookId: string): Promise<WorkbookAssignment[]> {
  const { data, error } = await (supabase as any)
    .from('workbook_assignments')
    .select('*')
    .eq('workbook_id', workbookId);
  if (error) throw error;
  return (data as WorkbookAssignment[]) || [];
}

export async function setWorkbookStudentAssignments(workbookId: string, userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const { error: deleteError } = await (supabase as any)
    .from('workbook_assignments')
    .delete()
    .eq('workbook_id', workbookId)
    .eq('assignee_type', 'student');
  if (deleteError) throw deleteError;

  if (uniqueIds.length === 0) return;
  const rows = uniqueIds.map(userId => ({
    workbook_id: workbookId,
    assignee_type: 'student',
    user_id: userId,
  }));
  const { error } = await (supabase as any).from('workbook_assignments').insert(rows);
  if (error) throw error;
}
export async function createWorkbook(title: string): Promise<Workbook | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error(authError?.message || 'Нужно войти в аккаунт администратора');
  }

  const { data: adminRole, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', authData.user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (roleError) throw roleError;
  if (!adminRole) throw new Error('Создавать воркбуки может только администратор');

  const { data, error } = await supabase
    .from('workbooks')
    .insert({ title, is_global: true } as any)
    .select()
    .single();
  if (error) throw error;
  return { ...(data as any), is_published: (data as any).is_global ?? true } as any;
}
export async function updateWorkbook(id: string, patch: Partial<Workbook>) {
  const clean: any = { ...patch };
  if ('is_published' in clean) {
    clean.is_global = clean.is_published;
    delete clean.is_published;
  }
  delete clean.order;
  const { error } = await supabase.from('workbooks').update(clean).eq('id', id);
  if (error) throw error;
}
export async function deleteWorkbook(id: string) {
  await supabase.from('workbooks').delete().eq('id', id);
}

// ==================== UNITS ====================
export async function listUnits(workbookId: string): Promise<Unit[]> {
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .eq('workbook_id', workbookId)
    .order('unit_number');
  if (error) throw error;
  return ((data as any) || []).map((unit: any) => ({
    ...unit,
    unit_number: unit.unit_number ?? unit.order ?? 1,
    order: unit.order ?? unit.unit_number ?? 1,
  }));
}
export async function createUnit(workbookId: string, title: string, emoji = '🏝️'): Promise<Unit | null> {
  const { data: existing, error: existingError } = await supabase
    .from('units')
    .select('unit_number')
    .eq('workbook_id', workbookId)
    .order('unit_number', { ascending: false })
    .limit(1);
  if (existingError) throw existingError;

  const nextNumber = ((existing?.[0] as any)?.unit_number ?? 0) + 1;
  const { data, error } = await supabase
    .from('units')
    .insert({ workbook_id: workbookId, title, unit_number: nextNumber } as any)
    .select()
    .single();
  if (error) throw error;
  return {
    ...(data as any),
    emoji,
    unit_number: (data as any).unit_number ?? nextNumber,
    order: (data as any).unit_number ?? nextNumber,
  } as any;
}
export async function updateUnit(id: string, patch: Partial<Unit>) {
  const clean: any = { ...patch };
  delete clean.emoji;
  delete clean.order;
  const { error } = await supabase.from('units').update(clean).eq('id', id);
  if (error) throw error;
}
export async function deleteUnit(id: string) {
  const { error } = await supabase.from('units').delete().eq('id', id);
  if (error) throw error;
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
  const { error } = await (supabase as any).from('lesson_progress').insert({ user_id: userId, lesson_id: lesson.id, stars_awarded: stars });
  if (error) {
    if ((error as any).code === '23505') return 0;
    throw error;
  }
  if (stars > 0) {
    await awardStars(userId, stars);
  }
  return stars;
}
