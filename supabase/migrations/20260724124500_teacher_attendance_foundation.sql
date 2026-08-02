-- Teacher Panel Part 2.1: per-student attendance and single-lesson teacher actions.

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS duration_minutes INT CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  ADD COLUMN IF NOT EXISTS lesson_number TEXT;

CREATE TABLE IF NOT EXISTS public.lesson_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent_excused', 'absent_unexcused', 'late', 'technical_issue')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_attendance_lesson ON public.lesson_attendance(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_attendance_teacher ON public.lesson_attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_attendance_student ON public.lesson_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_attendance_status ON public.lesson_attendance(status);

DROP TRIGGER IF EXISTS trg_lesson_attendance_updated ON public.lesson_attendance;
CREATE TRIGGER trg_lesson_attendance_updated
  BEFORE UPDATE ON public.lesson_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.lesson_attendance TO authenticated;
GRANT ALL ON public.lesson_attendance TO service_role;
ALTER TABLE public.lesson_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lesson_attendance_admin_all ON public.lesson_attendance;
DROP POLICY IF EXISTS lesson_attendance_teacher_manage ON public.lesson_attendance;
DROP POLICY IF EXISTS lesson_attendance_student_read ON public.lesson_attendance;

CREATE POLICY lesson_attendance_admin_all
ON public.lesson_attendance
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY lesson_attendance_teacher_manage
ON public.lesson_attendance
FOR ALL
TO authenticated
USING (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND private.teacher_can_access_student(auth.uid(), student_id)
)
WITH CHECK (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND private.teacher_can_access_student(auth.uid(), student_id)
);

CREATE POLICY lesson_attendance_student_read
ON public.lesson_attendance
FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
  AND private.has_active_access(auth.uid())
);

DROP POLICY IF EXISTS schedules_teacher_insert ON public.schedules;
DROP POLICY IF EXISTS schedules_teacher_update ON public.schedules;
CREATE POLICY schedules_teacher_update
ON public.schedules
FOR UPDATE
TO authenticated
USING (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND private.teacher_can_access_student(auth.uid(), user_id)
)
WITH CHECK (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND private.teacher_can_access_student(auth.uid(), user_id)
);

NOTIFY pgrst, 'reload schema';
