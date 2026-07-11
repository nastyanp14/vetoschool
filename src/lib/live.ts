import { supabase } from '@/integrations/supabase/client';

export interface LiveSession {
  id: string;
  lesson_id: string;
  student_id: string;
  status: 'active' | 'completed' | 'abandoned';
  current_task_id: string | null;
  current_task_index: number;
  started_at: string;
  last_seen_at: string;
  completed_at: string | null;
  lesson_title?: string;
  student_name?: string;
  student_email?: string;
}

export interface LiveEvent {
  id: string;
  session_id: string;
  lesson_id: string;
  student_id: string;
  actor_user_id: string | null;
  actor_role: 'student' | 'teacher' | 'system';
  event_type: string;
  task_id: string | null;
  payload_json: any;
  created_at: string;
}

const LIVE_TABLE_MISSING = 'Live mode tables are not ready yet.';
const STALE_SESSION_MINUTES = 6;

function normalizeSession(row: any): LiveSession {
  return {
    id: row.id,
    lesson_id: row.lesson_id,
    student_id: row.student_id,
    status: row.status,
    current_task_id: row.current_task_id ?? null,
    current_task_index: row.current_task_index ?? 0,
    started_at: row.started_at,
    last_seen_at: row.last_seen_at,
    completed_at: row.completed_at ?? null,
    lesson_title: row.lessons?.title,
    student_name: row.profiles?.name,
    student_email: row.profiles?.email,
  };
}

export async function startLiveSession(lessonId: string, studentId: string): Promise<LiveSession | null> {
  await cleanupStaleLiveSessions();

  const now = new Date().toISOString();
  await (supabase as any)
    .from('lesson_live_sessions')
    .update({ status: 'abandoned', completed_at: now, last_seen_at: now })
    .eq('student_id', studentId)
    .eq('status', 'active')
    .neq('lesson_id', lessonId);

  const existing = await (supabase as any)
    .from('lesson_live_sessions')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('last_seen_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.data && !existing.error) {
    await (supabase as any)
      .from('lesson_live_sessions')
      .update({ status: 'abandoned', completed_at: now, last_seen_at: now })
      .eq('lesson_id', lessonId)
      .eq('student_id', studentId)
      .eq('status', 'active')
      .neq('id', existing.data.id);

    const { data, error } = await (supabase as any)
      .from('lesson_live_sessions')
      .update({ current_task_id: null, current_task_index: 0, last_seen_at: now })
      .eq('id', existing.data.id)
      .select('*')
      .single();
    if (!error) return normalizeSession(data);
  }

  const { data, error } = await (supabase as any)
    .from('lesson_live_sessions')
    .insert({ lesson_id: lessonId, student_id: studentId })
    .select('*')
    .single();
  if (error) {
    console.warn(LIVE_TABLE_MISSING, error.message);
    return null;
  }
  return normalizeSession(data);
}

export async function updateLiveSession(sessionId: string, patch: Partial<LiveSession>) {
  const clean: any = { ...patch, last_seen_at: new Date().toISOString() };
  delete clean.lesson_title;
  delete clean.student_name;
  delete clean.student_email;
  const { error } = await (supabase as any).from('lesson_live_sessions').update(clean).eq('id', sessionId);
  if (error) console.warn('Live session update failed', error.message);
}

export async function completeLiveSession(sessionId: string) {
  await updateLiveSession(sessionId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  } as Partial<LiveSession>);
}

export async function abandonLiveSession(sessionId: string) {
  await updateLiveSession(sessionId, {
    status: 'abandoned',
    completed_at: new Date().toISOString(),
  } as Partial<LiveSession>);
}

export async function cleanupStaleLiveSessions(maxAgeMinutes = STALE_SESSION_MINUTES) {
  const staleBefore = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
  const finishedAt = new Date().toISOString();
  const { error } = await (supabase as any)
    .from('lesson_live_sessions')
    .update({ status: 'abandoned', completed_at: finishedAt })
    .eq('status', 'active')
    .lt('last_seen_at', staleBefore);
  if (error) console.warn('Live stale cleanup failed', error.message);
}

export async function cleanupDuplicateActiveSessions() {
  const { data, error } = await (supabase as any)
    .from('lesson_live_sessions')
    .select('id, student_id, last_seen_at')
    .eq('status', 'active')
    .order('last_seen_at', { ascending: false });
  if (error) {
    console.warn('Live duplicate cleanup failed', error.message);
    return;
  }

  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  for (const session of (data as any[]) || []) {
    if (seen.has(session.student_id)) duplicateIds.push(session.id);
    else seen.add(session.student_id);
  }
  if (duplicateIds.length === 0) return;

  const finishedAt = new Date().toISOString();
  const update = await (supabase as any)
    .from('lesson_live_sessions')
    .update({ status: 'abandoned', completed_at: finishedAt, last_seen_at: finishedAt })
    .in('id', duplicateIds);
  if (update.error) console.warn('Live duplicate cleanup update failed', update.error.message);
}

export async function recordLiveEvent(input: {
  sessionId: string | null;
  lessonId: string;
  studentId: string;
  actorUserId?: string | null;
  actorRole?: 'student' | 'teacher' | 'system';
  eventType: string;
  taskId?: string | null;
  payload?: any;
}) {
  if (!input.sessionId) return;
  const { error } = await (supabase as any).from('lesson_live_events').insert({
    session_id: input.sessionId,
    lesson_id: input.lessonId,
    student_id: input.studentId,
    actor_user_id: input.actorUserId ?? input.studentId,
    actor_role: input.actorRole ?? 'student',
    event_type: input.eventType,
    task_id: input.taskId ?? null,
    payload_json: input.payload ?? {},
  });
  if (error) console.warn('Live event failed', error.message);
}

export async function listLiveSessions(): Promise<LiveSession[]> {
  await cleanupStaleLiveSessions();
  await cleanupDuplicateActiveSessions();
  const query = (supabase as any)
    .from('lesson_live_sessions')
    .select('*, lessons(title), profiles(name,email)')
    .order('last_seen_at', { ascending: false })
    .limit(30);
  const { data, error } = await query;
  if (!error) return ((data as any[]) || []).map(normalizeSession);

  // Some Supabase projects need a schema cache refresh before nested profile joins work.
  // The live monitor can still function with raw sessions and local user names from Admin.
  const fallback = await (supabase as any)
    .from('lesson_live_sessions')
    .select('*')
    .order('last_seen_at', { ascending: false })
    .limit(30);
  if (fallback.error) throw fallback.error;
  return ((fallback.data as any[]) || []).map(normalizeSession);
}

export async function listLiveEvents(sessionId: string): Promise<LiveEvent[]> {
  const { data, error } = await (supabase as any)
    .from('lesson_live_events')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data as LiveEvent[]) || [];
}

export async function sendTeacherHint(session: LiveSession, message: string) {
  const { data } = await supabase.auth.getUser();
  await recordLiveEvent({
    sessionId: session.id,
    lessonId: session.lesson_id,
    studentId: session.student_id,
    actorUserId: data.user?.id ?? null,
    actorRole: 'teacher',
    eventType: 'teacher_hint',
    payload: { message },
  });
}

export function subscribeLiveSessionEvents(sessionId: string, onEvent: (event: LiveEvent) => void) {
  const channel = supabase
    .channel(`live-events-${sessionId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'lesson_live_events', filter: `session_id=eq.${sessionId}` },
      payload => onEvent(payload.new as LiveEvent),
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function subscribeLiveSessions(onChange: () => void) {
  const channel = supabase
    .channel('live-sessions-admin')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_live_sessions' }, onChange)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lesson_live_events' }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
