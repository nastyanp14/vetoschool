-- Live interactive lesson sessions and events.

CREATE TABLE IF NOT EXISTS public.lesson_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  current_task_id UUID REFERENCES public.interactive_tasks(id) ON DELETE SET NULL,
  current_task_index INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.lesson_live_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.lesson_live_sessions(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT 'student' CHECK (actor_role IN ('student', 'teacher', 'system')),
  event_type TEXT NOT NULL,
  task_id UUID REFERENCES public.interactive_tasks(id) ON DELETE SET NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_live_sessions_student
  ON public.lesson_live_sessions(student_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_lesson_live_sessions_lesson
  ON public.lesson_live_sessions(lesson_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_lesson_live_events_session
  ON public.lesson_live_events(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lesson_live_events_student
  ON public.lesson_live_events(student_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_live_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_live_events TO authenticated;
GRANT ALL ON public.lesson_live_sessions TO service_role;
GRANT ALL ON public.lesson_live_events TO service_role;

ALTER TABLE public.lesson_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_live_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_live_sessions_select" ON public.lesson_live_sessions;
DROP POLICY IF EXISTS "lesson_live_sessions_student_ins" ON public.lesson_live_sessions;
DROP POLICY IF EXISTS "lesson_live_sessions_student_upd" ON public.lesson_live_sessions;
DROP POLICY IF EXISTS "lesson_live_sessions_admin_all" ON public.lesson_live_sessions;

CREATE POLICY "lesson_live_sessions_select"
  ON public.lesson_live_sessions FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "lesson_live_sessions_student_ins"
  ON public.lesson_live_sessions FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "lesson_live_sessions_student_upd"
  ON public.lesson_live_sessions FOR UPDATE TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (student_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "lesson_live_sessions_admin_all"
  ON public.lesson_live_sessions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "lesson_live_events_select" ON public.lesson_live_events;
DROP POLICY IF EXISTS "lesson_live_events_student_ins" ON public.lesson_live_events;
DROP POLICY IF EXISTS "lesson_live_events_teacher_ins" ON public.lesson_live_events;
DROP POLICY IF EXISTS "lesson_live_events_admin_del" ON public.lesson_live_events;

CREATE POLICY "lesson_live_events_select"
  ON public.lesson_live_events FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "lesson_live_events_student_ins"
  ON public.lesson_live_events FOR INSERT TO authenticated
  WITH CHECK (
    (actor_role = 'student' AND student_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );

CREATE POLICY "lesson_live_events_teacher_ins"
  ON public.lesson_live_events FOR INSERT TO authenticated
  WITH CHECK (actor_role = 'teacher' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "lesson_live_events_admin_del"
  ON public.lesson_live_events FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
