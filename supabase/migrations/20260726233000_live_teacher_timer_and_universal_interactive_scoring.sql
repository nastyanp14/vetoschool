-- Live teacher visibility, lesson timer start, and universal interactive scoring.
-- Non-destructive: keeps existing progress/results and replaces server-side helpers.

DROP POLICY IF EXISTS schedules_teacher_update ON public.schedules;
CREATE POLICY schedules_teacher_update
ON public.schedules
FOR UPDATE
TO authenticated
USING (
  private.is_admin(auth.uid())
  OR (
    teacher_id = private.teacher_id_for_user(auth.uid())
    AND (
      user_id IS NULL
      OR private.teacher_can_access_student(auth.uid(), user_id)
      OR private.teacher_can_access_group(auth.uid(), group_id)
    )
  )
)
WITH CHECK (
  private.is_admin(auth.uid())
  OR (
    teacher_id = private.teacher_id_for_user(auth.uid())
    AND (
      user_id IS NULL
      OR private.teacher_can_access_student(auth.uid(), user_id)
      OR private.teacher_can_access_group(auth.uid(), group_id)
    )
  )
);

CREATE OR REPLACE FUNCTION public.teacher_start_lesson(_lesson_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  schedule_row public.schedules%ROWTYPE;
  current_teacher_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  current_teacher_id := private.teacher_id_for_user(auth.uid());

  SELECT *
  INTO schedule_row
  FROM public.schedules
  WHERE id = _lesson_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;

  IF NOT (
    private.is_admin(auth.uid())
    OR schedule_row.teacher_id = current_teacher_id
    OR private.teacher_can_access_student(auth.uid(), schedule_row.user_id)
    OR private.teacher_can_access_group(auth.uid(), schedule_row.group_id)
  ) THEN
    RAISE EXCEPTION 'Not allowed to start this lesson';
  END IF;

  UPDATE public.schedules
  SET
    lesson_status = 'in_progress',
    is_conducted = false,
    started_at = COALESCE(started_at, now()),
    completed_at = NULL,
    updated_at = now()
  WHERE id = _lesson_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.teacher_start_lesson(UUID) TO authenticated;

DROP POLICY IF EXISTS "lesson_live_sessions_select" ON public.lesson_live_sessions;
DROP POLICY IF EXISTS "lesson_live_sessions_student_ins" ON public.lesson_live_sessions;
DROP POLICY IF EXISTS "lesson_live_sessions_student_upd" ON public.lesson_live_sessions;
DROP POLICY IF EXISTS "lesson_live_sessions_admin_all" ON public.lesson_live_sessions;

CREATE POLICY "lesson_live_sessions_select"
  ON public.lesson_live_sessions FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR private.is_admin(auth.uid())
    OR private.teacher_can_access_student(auth.uid(), student_id)
  );

CREATE POLICY "lesson_live_sessions_student_ins"
  ON public.lesson_live_sessions FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR private.is_admin(auth.uid())
  );

CREATE POLICY "lesson_live_sessions_student_upd"
  ON public.lesson_live_sessions FOR UPDATE TO authenticated
  USING (
    student_id = auth.uid()
    OR private.is_admin(auth.uid())
  )
  WITH CHECK (
    student_id = auth.uid()
    OR private.is_admin(auth.uid())
  );

CREATE POLICY "lesson_live_sessions_admin_all"
  ON public.lesson_live_sessions FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "lesson_live_events_select" ON public.lesson_live_events;
DROP POLICY IF EXISTS "lesson_live_events_student_ins" ON public.lesson_live_events;
DROP POLICY IF EXISTS "lesson_live_events_teacher_ins" ON public.lesson_live_events;
DROP POLICY IF EXISTS "lesson_live_events_admin_del" ON public.lesson_live_events;

CREATE POLICY "lesson_live_events_select"
  ON public.lesson_live_events FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR private.is_admin(auth.uid())
    OR private.teacher_can_access_student(auth.uid(), student_id)
  );

CREATE POLICY "lesson_live_events_student_ins"
  ON public.lesson_live_events FOR INSERT TO authenticated
  WITH CHECK (
    (actor_role = 'student' AND student_id = auth.uid())
    OR private.is_admin(auth.uid())
  );

CREATE POLICY "lesson_live_events_teacher_ins"
  ON public.lesson_live_events FOR INSERT TO authenticated
  WITH CHECK (
    actor_role = 'teacher'
    AND (
      private.is_admin(auth.uid())
      OR private.teacher_can_access_student(auth.uid(), student_id)
    )
  );

CREATE POLICY "lesson_live_events_admin_del"
  ON public.lesson_live_events FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_visible_live_sessions()
RETURNS TABLE(
  id UUID,
  lesson_id UUID,
  student_id UUID,
  status TEXT,
  current_task_id UUID,
  current_task_index INT,
  started_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  lesson_title TEXT,
  student_name TEXT,
  student_email TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.lesson_id,
    s.student_id,
    s.status,
    s.current_task_id,
    s.current_task_index,
    s.started_at,
    s.last_seen_at,
    s.completed_at,
    l.title AS lesson_title,
    p.name AS student_name,
    p.email AS student_email
  FROM public.lesson_live_sessions s
  LEFT JOIN public.lessons l ON l.id = s.lesson_id
  LEFT JOIN public.profiles p ON p.id = s.student_id
  WHERE
    s.student_id = auth.uid()
    OR private.is_admin(auth.uid())
    OR private.teacher_can_access_student(auth.uid(), s.student_id)
  ORDER BY s.last_seen_at DESC
  LIMIT 30;
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_live_sessions() TO authenticated;

DROP FUNCTION IF EXISTS public.complete_assigned_interactive_content(UUID, UUID, INT);
DROP FUNCTION IF EXISTS public.complete_assigned_interactive_content(UUID, UUID, INT, INT, INT);

CREATE OR REPLACE FUNCTION public.complete_assigned_interactive_content(
  _content_item_id UUID,
  _lesson_id UUID,
  _score_percent INT DEFAULT 100,
  _errors_count INT DEFAULT 0,
  _star_rating INT DEFAULT NULL
)
RETURNS TABLE(stars_awarded INT, already_completed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  content_row public.content_items%ROWTYPE;
  lesson_row public.lessons%ROWTYPE;
  bounded_score INT := GREATEST(0, LEAST(100, COALESCE(_score_percent, 100)));
  bounded_errors INT := GREATEST(0, COALESCE(_errors_count, 0));
  normalized_rating INT := GREATEST(
    1,
    LEAST(
      5,
      COALESCE(_star_rating, GREATEST(1, LEAST(5, CEIL(GREATEST(0, LEAST(100, COALESCE(_score_percent, 100)))::NUMERIC / 20)::INT)))
    )
  );
  progress_award INT := 0;
  award_amount INT := 0;
  inserted_progress_count INT := 0;
BEGIN
  SELECT *
  INTO content_row
  FROM public.content_items
  WHERE id = _content_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Content item not found';
  END IF;

  IF content_row.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the assigned student can complete this content item';
  END IF;

  IF content_row.interactive_lesson_id IS NULL OR content_row.interactive_lesson_id <> _lesson_id THEN
    RAISE EXCEPTION 'Interactive lesson is not assigned to this content item';
  END IF;

  SELECT *
  INTO lesson_row
  FROM public.lessons
  WHERE id = _lesson_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Interactive lesson not found';
  END IF;

  already_completed := COALESCE(content_row.rewarded_stars, 0) > 0
    OR content_row.interactive_completed_at IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.lesson_progress lp
      WHERE lp.user_id = content_row.user_id
        AND lp.lesson_id = _lesson_id
    );

  IF already_completed THEN
    progress_award := GREATEST(0, COALESCE(NULLIF(content_row.rewarded_stars, 0), content_row.star_rating, normalized_rating));
  ELSIF lesson_row.type IN ('theory', 'class_task', 'homework', 'practice', 'grammar', 'listening', 'checkpoint') THEN
    progress_award := normalized_rating;
    award_amount := progress_award;
  END IF;

  INSERT INTO public.lesson_progress(user_id, lesson_id, stars_awarded)
  VALUES (content_row.user_id, _lesson_id, progress_award)
  ON CONFLICT (user_id, lesson_id) DO NOTHING;

  GET DIAGNOSTICS inserted_progress_count = ROW_COUNT;

  IF NOT already_completed AND inserted_progress_count = 0 THEN
    already_completed := TRUE;
    award_amount := 0;
  END IF;

  IF award_amount > 0 THEN
    UPDATE public.profiles
    SET
      star_balance = COALESCE(star_balance, 0) + award_amount,
      total_stars_earned = COALESCE(total_stars_earned, 0) + award_amount,
      pending_celebration = COALESCE(pending_celebration, 0) + award_amount
    WHERE id = content_row.user_id;
  END IF;

  UPDATE public.content_items ci
  SET
    material_mode = 'interactive',
    submitted_at = COALESCE(ci.submitted_at, now()),
    checked_at = now(),
    homework_status = 'reviewed',
    result_percent = bounded_score,
    errors_count = bounded_errors,
    star_rating = normalized_rating,
    student_result = 'Interactive completed',
    review_comment = COALESCE(NULLIF(ci.review_comment, ''), 'Интерактивное задание выполнено автоматически.'),
    interactive_completed_at = COALESCE(ci.interactive_completed_at, now()),
    interactive_score_percent = bounded_score,
    interactive_attempts = COALESCE(ci.interactive_attempts, 0) + 1,
    rewarded_stars = CASE
      WHEN COALESCE(ci.rewarded_stars, 0) > 0 THEN ci.rewarded_stars
      ELSE progress_award
    END,
    updated_at = now()
  WHERE ci.user_id = content_row.user_id
    AND ci.interactive_lesson_id = _lesson_id
    AND ci.type IN ('homework', 'practice', 'grammar', 'listening', 'checkpoint');

  stars_awarded := award_amount;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_assigned_interactive_content(UUID, UUID, INT, INT, INT) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'lesson_live_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_live_events;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
