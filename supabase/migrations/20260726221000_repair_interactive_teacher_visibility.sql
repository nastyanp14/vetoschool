-- Repair visibility for assigned interactive lessons and their automatic results.
-- Non-destructive: refreshes RLS policies and adds a read-only RPC fallback for tasks.

DROP POLICY IF EXISTS "it_select_auth" ON public.interactive_tasks;
CREATE POLICY "it_select_auth"
ON public.interactive_tasks
FOR SELECT
TO authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.get_interactive_tasks_for_lesson(_lesson_id UUID)
RETURNS SETOF public.interactive_tasks
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT it.*
  FROM public.interactive_tasks it
  WHERE it.lesson_id = _lesson_id
  ORDER BY it."order";
$$;

GRANT EXECUTE ON FUNCTION public.get_interactive_tasks_for_lesson(UUID) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'content_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.content_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'lesson_live_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_live_sessions;
  END IF;
END $$;

DROP POLICY IF EXISTS content_select_own ON public.content_items;
CREATE POLICY content_select_own
ON public.content_items
FOR SELECT
TO authenticated
USING (
  private.is_admin(auth.uid())
  OR private.teacher_can_access_student(auth.uid(), user_id)
  OR (
    auth.uid() = user_id
    AND private.has_active_access(auth.uid())
  )
);

DROP POLICY IF EXISTS lesson_plan_blocks_teacher_read ON public.lesson_plan_blocks;
CREATE POLICY lesson_plan_blocks_teacher_read
ON public.lesson_plan_blocks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.schedules s
    WHERE s.id = lesson_plan_blocks.schedule_id
      AND (
        s.teacher_id = private.teacher_id_for_user(auth.uid())
        OR private.teacher_can_access_student(auth.uid(), s.user_id)
        OR private.teacher_can_access_group(auth.uid(), s.group_id)
      )
  )
);

DROP POLICY IF EXISTS lesson_plan_blocks_student_read ON public.lesson_plan_blocks;
CREATE POLICY lesson_plan_blocks_student_read
ON public.lesson_plan_blocks
FOR SELECT
TO authenticated
USING (
  private.has_active_access(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.schedules s
    WHERE s.id = lesson_plan_blocks.schedule_id
      AND (
        s.user_id = auth.uid()
        OR private.group_has_student(s.group_id, auth.uid())
      )
  )
);

NOTIFY pgrst, 'reload schema';
