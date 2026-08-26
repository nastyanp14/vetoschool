import { supabase } from '@/integrations/supabase/client';
import { WORKBOOK_ASSETS_BUCKET, MechanicType, LessonKind, canReward, calculateInteractiveScore } from './mechanics';
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
export async function getLessonById(lessonId: string): Promise<Lesson | null> {
  if (!lessonId) return null;
  const { data, error } = await supabase.from('lessons').select('*').eq('id', lessonId).maybeSingle();
  if (error) throw error;
  return (data as any) || null;
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
  const { data, error } = await supabase.from('interactive_tasks').select('*').eq('lesson_id', lessonId).order('order');
  if (!error) return (data as any) || [];

  console.warn('interactive_tasks select failed, trying RPC fallback', error.message);
  const fallback = await (supabase as any).rpc('get_interactive_tasks_for_lesson', {
    _lesson_id: lessonId,
  });
  if (fallback.error) {
    console.warn('get_interactive_tasks_for_lesson RPC failed', fallback.error.message);
    return [];
  }
  return (fallback.data as any) || [];
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

function isInlineOrRemoteAsset(path: string) {
  return /^(https?:|data:|blob:)/i.test(path);
}

function isStorageAuthReadinessError(error: unknown) {
  const err = error as { statusCode?: string | number; status?: string | number; message?: string; name?: string };
  const status = String(err?.statusCode ?? err?.status ?? '');
  const text = `${err?.name || ''} ${err?.message || ''}`.toLowerCase();
  return (
    status === '401' ||
    status === '403' ||
    status === '404' ||
    text.includes('object not found') ||
    text.includes('unauthorized') ||
    text.includes('jwt')
  );
}

async function waitForWorkbookAssetSession(timeoutMs = 2500): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) return true;
  } catch {
    // Storage signing below will surface the actual failure.
  }

  if (typeof supabase.auth.onAuthStateChange !== 'function') return false;

  return new Promise(resolve => {
    let settled = false;
    let subscription: { unsubscribe: () => void } | undefined;
    const done = (ready: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription?.unsubscribe();
      resolve(ready);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    const result = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) done(true);
    });
    subscription = result.data.subscription;
  });
}

export async function signedUrlFor(path: string, expiresInSec = 3600): Promise<string | null> {
  if (!path) return null;
  if (isInlineOrRemoteAsset(path)) return path;

  await waitForWorkbookAssetSession();
  const sign = () => supabase.storage.from(WORKBOOK_ASSETS_BUCKET).createSignedUrl(path, expiresInSec);
  let { data, error } = await sign();
  if (data?.signedUrl) return data.signedUrl;

  if (isStorageAuthReadinessError(error) && await waitForWorkbookAssetSession(1500)) {
    const retry = await sign();
    data = retry.data;
    error = retry.error;
    if (data?.signedUrl) return data.signedUrl;
  }

  if (error && import.meta.env.DEV) {
    const err = error as { statusCode?: string | number; status?: string | number; message?: string; name?: string };
    console.warn('Could not sign workbook asset URL', {
      bucket: WORKBOOK_ASSETS_BUCKET,
      path,
      status: err.statusCode ?? err.status ?? null,
      name: err.name ?? null,
      message: err.message ?? 'Storage signing failed',
    });
  }
  return null;
}

// ==================== PROGRESS ====================
export async function getLessonProgress(userId: string): Promise<Record<string, { completed_at: string; stars_awarded: number }>> {
  const { data } = await (supabase as any).from('lesson_progress').select('lesson_id, completed_at, stars_awarded').eq('user_id', userId);
  const map: Record<string, any> = {};
  (data || []).forEach((r: any) => { map[r.lesson_id] = { completed_at: r.completed_at, stars_awarded: r.stars_awarded }; });
  return map;
}

async function markMatchingAssignedInteractiveContentComplete(
  userId: string,
  lesson: Lesson,
  scorePercent = 100,
  rewardedStars = 0,
  errorsCount = 0,
) {
  const boundedScore = Math.max(0, Math.min(100, Math.round(scorePercent)));
  const rating = calculateInteractiveScore(100, 100 - boundedScore).starRating;
  const completedAt = new Date().toISOString();
  const trackedReward = canReward(lesson.type) ? Math.max(rating, Number(rewardedStars || 0)) : 0;
  const { error } = await (supabase as any)
    .from('content_items')
    .update({
      material_mode: 'interactive',
      submitted_at: completedAt,
      checked_at: completedAt,
      homework_status: 'reviewed',
      result_percent: boundedScore,
      errors_count: errorsCount,
      star_rating: rating,
      student_result: 'Interactive completed',
      review_comment: 'Интерактивное задание выполнено автоматически.',
      interactive_completed_at: completedAt,
      interactive_score_percent: boundedScore,
      rewarded_stars: trackedReward,
      updated_at: completedAt,
    })
    .eq('user_id', userId)
    .eq('interactive_lesson_id', lesson.id)
    .is('interactive_completed_at', null);
  if (error) console.warn('Could not sync matching assigned interactive content', error.message);
}

export async function markLessonComplete(userId: string, lesson: Lesson, scorePercent = 100, errorsCount = 0, starRating?: number): Promise<number> {
  // Returns stars awarded (0 if already completed).
  const existing = await (supabase as any).from('lesson_progress').select('id, stars_awarded').eq('user_id', userId).eq('lesson_id', lesson.id).maybeSingle();
  if (existing.data) {
    await markMatchingAssignedInteractiveContentComplete(userId, lesson, scorePercent, Number(existing.data.stars_awarded || 0), errorsCount);
    return 0;
  }
  const stars = canReward(lesson.type) ? (starRating || calculateInteractiveScore(100, 100 - scorePercent).starRating) : 0;
  const { error } = await (supabase as any).from('lesson_progress').insert({ user_id: userId, lesson_id: lesson.id, stars_awarded: stars });
  if (error) {
    if ((error as any).code === '23505') {
      await markMatchingAssignedInteractiveContentComplete(userId, lesson, scorePercent, stars, errorsCount);
      return 0;
    }
    throw error;
  }
  if (stars > 0) {
    await awardStars(userId, stars);
  }
  await markMatchingAssignedInteractiveContentComplete(userId, lesson, scorePercent, stars, errorsCount);
  return stars;
}

export async function completeAssignedInteractiveContent(
  userId: string,
  contentItemId: string,
  lesson: Lesson,
  scorePercent = 100,
  errorsCount = 0,
  starRating?: number,
): Promise<number> {
  const boundedScore = Math.max(0, Math.min(100, Math.round(scorePercent)));
  const rating = starRating || calculateInteractiveScore(100, 100 - boundedScore).starRating;
  const { data, error } = await (supabase as any).rpc('complete_assigned_interactive_content', {
    _content_item_id: contentItemId,
    _lesson_id: lesson.id,
    _score_percent: boundedScore,
    _errors_count: errorsCount,
    _star_rating: rating,
  });
  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    return Number(row?.stars_awarded || 0);
  }

  console.warn('complete_assigned_interactive_content RPC failed, using client fallback', error);
  const { data: existingContent, error: readError } = await (supabase as any)
    .from('content_items')
    .select('id,user_id,rewarded_stars,interactive_completed_at,star_rating')
    .eq('id', contentItemId)
    .eq('user_id', userId)
    .maybeSingle();
  if (readError) throw readError;
  if (!existingContent) throw error;

  const alreadyRewarded = Number(existingContent.rewarded_stars || 0) > 0 || !!existingContent.interactive_completed_at;
  let stars = 0;
  let progressStars = 0;
  const existingProgress = await (supabase as any)
    .from('lesson_progress')
    .select('id,stars_awarded')
    .eq('user_id', userId)
    .eq('lesson_id', lesson.id)
    .maybeSingle();
  if (existingProgress.error) throw existingProgress.error;
  if (existingProgress.data) {
    progressStars = Number(existingProgress.data.stars_awarded || 0);
  } else {
    const progressAward = alreadyRewarded
      ? Math.max(0, Number(existingContent.rewarded_stars || 0))
      : canReward(lesson.type)
        ? Math.max(0, rating)
        : 0;
    stars = alreadyRewarded ? 0 : progressAward;
    const { error: progressError } = await (supabase as any)
      .from('lesson_progress')
      .insert({ user_id: userId, lesson_id: lesson.id, stars_awarded: progressAward });
    if (progressError) {
      if ((progressError as any).code === '23505') {
        stars = 0;
      } else {
        throw progressError;
      }
    } else {
      progressStars = progressAward;
    }
  }
  const shouldPersistPrimaryResult = !alreadyRewarded && !existingProgress.data;
  const completedAt = new Date().toISOString();
  const trackedReward = stars > 0
    ? Number(existingContent.rewarded_stars || 0) + stars
    : Number(existingContent.rewarded_stars || 0) || Math.max(rating, progressStars);
  const shouldWriteScore = shouldPersistPrimaryResult || !existingContent.interactive_completed_at;
  if (shouldWriteScore) {
    const { error: updateError } = await (supabase as any)
      .from('content_items')
      .update({
        material_mode: 'interactive',
        submitted_at: completedAt,
        checked_at: completedAt,
        homework_status: 'reviewed',
        result_percent: boundedScore,
        errors_count: errorsCount,
        star_rating: rating,
        student_result: 'Interactive completed',
        review_comment: 'Интерактивное задание выполнено автоматически.',
        interactive_completed_at: completedAt,
        interactive_score_percent: boundedScore,
        rewarded_stars: trackedReward,
      })
      .eq('id', contentItemId)
      .eq('user_id', userId);
    if (updateError) throw updateError;
  }
  if (stars > 0) {
    await awardStars(userId, stars);
  }
  await markMatchingAssignedInteractiveContentComplete(userId, lesson, boundedScore, trackedReward, errorsCount);
  return stars;
}
