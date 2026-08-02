-- Teacher Panel business logic foundation.
-- Safe, additive migration: extends existing tables and creates only missing support tables.

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS source_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS carry_over_to_next_lesson TEXT,
  ADD COLUMN IF NOT EXISTS homework_brief TEXT;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.schedules'::regclass
    AND pg_get_constraintdef(oid) ILIKE '%lesson_status%'
    AND contype = 'c'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.schedules DROP CONSTRAINT %I', constraint_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'schedules_lesson_status_business_check'
      AND conrelid = 'public.schedules'::regclass
  ) THEN
    ALTER TABLE public.schedules
      ADD CONSTRAINT schedules_lesson_status_business_check
      CHECK (lesson_status IN (
        'scheduled',
        'upcoming',
        'ready',
        'in_progress',
        'completed',
        'cancelled',
        'rescheduled',
        'student_absent',
        'teacher_absent'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedules_source_lesson ON public.schedules(source_lesson_id);
CREATE INDEX IF NOT EXISTS idx_schedules_teacher_status_date ON public.schedules(teacher_id, lesson_status, scheduled_date);

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS homework_status TEXT NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS reviewed_by_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_comment TEXT,
  ADD COLUMN IF NOT EXISTS submitted_attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS submitted_attachment_name TEXT;

UPDATE public.content_items
SET homework_status = CASE
  WHEN lower(homework_status) IN ('not_submitted', 'submitted', 'reviewed', 'revision_requested', 'late')
    THEN lower(homework_status)
  WHEN lower(homework_status) IN ('revision requested', 'needs revision')
    THEN 'revision_requested'
  ELSE 'not_submitted'
END
WHERE homework_status IS NULL
   OR lower(homework_status) NOT IN ('not_submitted', 'submitted', 'reviewed', 'revision_requested', 'late');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'content_items_homework_status_check'
      AND conrelid = 'public.content_items'::regclass
  ) THEN
    ALTER TABLE public.content_items
      ADD CONSTRAINT content_items_homework_status_check
      CHECK (homework_status IN ('not_submitted', 'submitted', 'reviewed', 'revision_requested', 'late'));
  END IF;
END $$;

UPDATE public.content_items
SET homework_status = CASE
  WHEN checked_at IS NOT NULL AND COALESCE(student_result, '') ILIKE '%revision%' THEN 'revision_requested'
  WHEN checked_at IS NOT NULL THEN 'reviewed'
  WHEN submitted_at IS NOT NULL THEN 'submitted'
  WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE THEN 'late'
  ELSE homework_status
END
WHERE type IN ('homework', 'practice', 'grammar', 'listening')
  AND homework_status = 'not_submitted';

CREATE INDEX IF NOT EXISTS idx_content_items_homework_review
  ON public.content_items(user_id, homework_status, submitted_at, checked_at)
  WHERE type IN ('homework', 'practice', 'grammar', 'listening');

CREATE OR REPLACE FUNCTION public.teacher_review_homework(
  _homework_id uuid,
  _teacher_id uuid,
  _teacher_comment text,
  _result_percent int,
  _star_rating int,
  _status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  homework_student_id uuid;
BEGIN
  SELECT user_id INTO homework_student_id
  FROM public.content_items
  WHERE id = _homework_id
    AND type IN ('homework', 'practice', 'grammar', 'listening')
  LIMIT 1;

  IF homework_student_id IS NULL THEN
    RAISE EXCEPTION 'Homework item was not found';
  END IF;

  IF NOT private.is_admin(auth.uid()) AND (
    _teacher_id IS DISTINCT FROM private.teacher_id_for_user(auth.uid())
    OR NOT private.teacher_can_access_student(auth.uid(), homework_student_id)
  ) THEN
    RAISE EXCEPTION 'Teacher cannot review this homework';
  END IF;

  UPDATE public.content_items
  SET
    teacher_comment = COALESCE(_teacher_comment, ''),
    review_comment = COALESCE(_teacher_comment, ''),
    result_percent = _result_percent,
    star_rating = _star_rating,
    reviewed_by_teacher_id = _teacher_id,
    homework_status = CASE WHEN _status = 'revision_requested' THEN 'revision_requested' ELSE 'reviewed' END,
    checked_at = now(),
    student_result = CASE WHEN _status = 'revision_requested' THEN 'Revision Requested' ELSE student_result END
  WHERE id = _homework_id;
END;
$$;

REVOKE ALL ON FUNCTION public.teacher_review_homework(uuid, uuid, text, int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_review_homework(uuid, uuid, text, int, int, text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.lesson_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  teacher_comment TEXT NOT NULL DEFAULT '',
  homework_brief TEXT NOT NULL DEFAULT '',
  carry_over_to_next_lesson TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id)
);

ALTER TABLE public.lesson_results
  ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS teacher_comment TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS homework_brief TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS carry_over_to_next_lesson TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS lesson_results_lesson_id_uniq
  ON public.lesson_results(lesson_id);

CREATE INDEX IF NOT EXISTS idx_lesson_results_teacher_created ON public.lesson_results(teacher_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_lesson_results_updated ON public.lesson_results;
CREATE TRIGGER trg_lesson_results_updated
  BEFORE UPDATE ON public.lesson_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.lesson_results TO authenticated;
GRANT ALL ON public.lesson_results TO service_role;
ALTER TABLE public.lesson_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lesson_results_admin_all ON public.lesson_results;
DROP POLICY IF EXISTS lesson_results_teacher_manage ON public.lesson_results;
DROP POLICY IF EXISTS lesson_results_student_read ON public.lesson_results;

CREATE POLICY lesson_results_admin_all
ON public.lesson_results
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY lesson_results_teacher_manage
ON public.lesson_results
FOR ALL
TO authenticated
USING (teacher_id = private.teacher_id_for_user(auth.uid()))
WITH CHECK (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.schedules s
    WHERE s.id = lesson_results.lesson_id
      AND s.teacher_id = private.teacher_id_for_user(auth.uid())
  )
);

CREATE POLICY lesson_results_student_read
ON public.lesson_results
FOR SELECT
TO authenticated
USING (
  private.has_active_access(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.schedules s
    WHERE s.id = lesson_results.lesson_id
      AND s.user_id = auth.uid()
  )
);

CREATE TABLE IF NOT EXISTS public.lesson_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL DEFAULT 'reschedule',
  desired_date DATE,
  desired_time TEXT,
  reason TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  admin_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_change_requests
  ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'reschedule',
  ADD COLUMN IF NOT EXISTS desired_date DATE,
  ADD COLUMN IF NOT EXISTS desired_time TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS comment TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_comment TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.lesson_change_requests
SET
  request_type = CASE
    WHEN lower(request_type) IN ('reschedule', 'cancel', 'format_change', 'other') THEN lower(request_type)
    WHEN lower(request_type) IN ('schedule_change', 'schedule change') THEN 'reschedule'
    ELSE 'other'
  END,
  status = CASE
    WHEN lower(status) IN ('pending', 'approved', 'rejected', 'resolved') THEN lower(status)
    ELSE 'pending'
  END
WHERE request_type IS NULL
   OR status IS NULL
   OR lower(request_type) NOT IN ('reschedule', 'cancel', 'format_change', 'other')
   OR lower(status) NOT IN ('pending', 'approved', 'rejected', 'resolved');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lesson_change_requests_status_check'
      AND conrelid = 'public.lesson_change_requests'::regclass
  ) THEN
    ALTER TABLE public.lesson_change_requests
      ADD CONSTRAINT lesson_change_requests_status_check
      CHECK (status IN ('pending', 'approved', 'rejected', 'resolved'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lesson_change_requests_type_check'
      AND conrelid = 'public.lesson_change_requests'::regclass
  ) THEN
    ALTER TABLE public.lesson_change_requests
      ADD CONSTRAINT lesson_change_requests_type_check
      CHECK (request_type IN ('reschedule', 'cancel', 'format_change', 'other'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS lesson_change_requests_open_uniq
  ON public.lesson_change_requests(lesson_id, teacher_id, request_type)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_lesson_change_requests_teacher_status
  ON public.lesson_change_requests(teacher_id, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_lesson_change_requests_updated ON public.lesson_change_requests;
CREATE TRIGGER trg_lesson_change_requests_updated
  BEFORE UPDATE ON public.lesson_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.lesson_change_requests TO authenticated;
GRANT ALL ON public.lesson_change_requests TO service_role;
ALTER TABLE public.lesson_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lesson_change_requests_admin_all ON public.lesson_change_requests;
DROP POLICY IF EXISTS lesson_change_requests_teacher_insert ON public.lesson_change_requests;
DROP POLICY IF EXISTS lesson_change_requests_teacher_read ON public.lesson_change_requests;
DROP POLICY IF EXISTS lesson_change_requests_teacher_update_pending ON public.lesson_change_requests;

CREATE POLICY lesson_change_requests_admin_all
ON public.lesson_change_requests
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY lesson_change_requests_teacher_read
ON public.lesson_change_requests
FOR SELECT
TO authenticated
USING (teacher_id = private.teacher_id_for_user(auth.uid()));

CREATE POLICY lesson_change_requests_teacher_insert
ON public.lesson_change_requests
FOR INSERT
TO authenticated
WITH CHECK (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.schedules s
    WHERE s.id = lesson_change_requests.lesson_id
      AND s.teacher_id = private.teacher_id_for_user(auth.uid())
  )
);

CREATE POLICY lesson_change_requests_teacher_update_pending
ON public.lesson_change_requests
FOR UPDATE
TO authenticated
USING (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND status = 'pending'
)
WITH CHECK (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND status = 'pending'
);

CREATE TABLE IF NOT EXISTS public.teacher_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL DEFAULT '',
  body TEXT,
  student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.student_groups(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
  homework_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_notifications
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.student_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS homework_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_teacher_notifications_teacher_created
  ON public.teacher_notifications(teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_notifications_teacher_unread
  ON public.teacher_notifications(teacher_id, read_at)
  WHERE read_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS teacher_notifications_event_key_uniq
  ON public.teacher_notifications(teacher_id, ((payload ->> 'event_key')))
  WHERE payload ? 'event_key';

DROP TRIGGER IF EXISTS trg_teacher_notifications_updated ON public.teacher_notifications;
CREATE TRIGGER trg_teacher_notifications_updated
  BEFORE UPDATE ON public.teacher_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.teacher_notifications TO authenticated;
GRANT ALL ON public.teacher_notifications TO service_role;
ALTER TABLE public.teacher_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_notifications_admin_all ON public.teacher_notifications;
DROP POLICY IF EXISTS teacher_notifications_teacher_read_update ON public.teacher_notifications;
DROP POLICY IF EXISTS teacher_notifications_teacher_insert ON public.teacher_notifications;
DROP POLICY IF EXISTS teacher_notifications_teacher_update ON public.teacher_notifications;

CREATE POLICY teacher_notifications_admin_all
ON public.teacher_notifications
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY teacher_notifications_teacher_read_update
ON public.teacher_notifications
FOR SELECT
TO authenticated
USING (teacher_id = private.teacher_id_for_user(auth.uid()));

CREATE POLICY teacher_notifications_teacher_insert
ON public.teacher_notifications
FOR INSERT
TO authenticated
WITH CHECK (teacher_id = private.teacher_id_for_user(auth.uid()));

CREATE POLICY teacher_notifications_teacher_update
ON public.teacher_notifications
FOR UPDATE
TO authenticated
USING (teacher_id = private.teacher_id_for_user(auth.uid()))
WITH CHECK (teacher_id = private.teacher_id_for_user(auth.uid()));

DROP POLICY IF EXISTS lesson_attendance_teacher_manage ON public.lesson_attendance;
DROP POLICY IF EXISTS lesson_attendance_teacher_read ON public.lesson_attendance;
DROP POLICY IF EXISTS lesson_attendance_teacher_insert ON public.lesson_attendance;
DROP POLICY IF EXISTS lesson_attendance_teacher_update ON public.lesson_attendance;

CREATE POLICY lesson_attendance_teacher_read
ON public.lesson_attendance
FOR SELECT
TO authenticated
USING (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND private.teacher_can_access_student(auth.uid(), student_id)
);

CREATE POLICY lesson_attendance_teacher_insert
ON public.lesson_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND private.teacher_can_access_student(auth.uid(), student_id)
  AND NOT EXISTS (
    SELECT 1
    FROM public.schedules s
    WHERE s.id = lesson_attendance.lesson_id
      AND s.lesson_status IN ('completed', 'cancelled')
  )
);

CREATE POLICY lesson_attendance_teacher_update
ON public.lesson_attendance
FOR UPDATE
TO authenticated
USING (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND private.teacher_can_access_student(auth.uid(), student_id)
  AND NOT EXISTS (
    SELECT 1
    FROM public.schedules s
    WHERE s.id = lesson_attendance.lesson_id
      AND s.lesson_status IN ('completed', 'cancelled')
  )
)
WITH CHECK (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND private.teacher_can_access_student(auth.uid(), student_id)
  AND NOT EXISTS (
    SELECT 1
    FROM public.schedules s
    WHERE s.id = lesson_attendance.lesson_id
      AND s.lesson_status IN ('completed', 'cancelled')
  )
);

NOTIFY pgrst, 'reload schema';
