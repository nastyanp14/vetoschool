-- Live mode policy fix: avoid public.has_role in RLS checks.

DROP POLICY IF EXISTS "lesson_live_sessions_select" ON public.lesson_live_sessions;
DROP POLICY IF EXISTS "lesson_live_sessions_student_ins" ON public.lesson_live_sessions;
DROP POLICY IF EXISTS "lesson_live_sessions_student_upd" ON public.lesson_live_sessions;
DROP POLICY IF EXISTS "lesson_live_sessions_admin_all" ON public.lesson_live_sessions;

CREATE POLICY "lesson_live_sessions_select"
  ON public.lesson_live_sessions FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "lesson_live_sessions_student_ins"
  ON public.lesson_live_sessions FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "lesson_live_sessions_student_upd"
  ON public.lesson_live_sessions FOR UPDATE TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "lesson_live_sessions_admin_all"
  ON public.lesson_live_sessions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "lesson_live_events_select" ON public.lesson_live_events;
DROP POLICY IF EXISTS "lesson_live_events_student_ins" ON public.lesson_live_events;
DROP POLICY IF EXISTS "lesson_live_events_teacher_ins" ON public.lesson_live_events;
DROP POLICY IF EXISTS "lesson_live_events_admin_del" ON public.lesson_live_events;

CREATE POLICY "lesson_live_events_select"
  ON public.lesson_live_events FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "lesson_live_events_student_ins"
  ON public.lesson_live_events FOR INSERT TO authenticated
  WITH CHECK (
    (actor_role = 'student' AND student_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "lesson_live_events_teacher_ins"
  ON public.lesson_live_events FOR INSERT TO authenticated
  WITH CHECK (
    actor_role = 'teacher'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "lesson_live_events_admin_del"
  ON public.lesson_live_events FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );
