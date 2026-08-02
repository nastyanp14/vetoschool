-- Admin -> Teacher -> Lesson Result flow.
-- Safe additive migration: no data deletion and no destructive rewrites.

ALTER TABLE public.lesson_results
  ADD COLUMN IF NOT EXISTS admin_note TEXT NOT NULL DEFAULT '';

ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_grades_lesson ON public.grades(lesson_id);
CREATE UNIQUE INDEX IF NOT EXISTS grades_lesson_student_category_uniq
  ON public.grades(lesson_id, user_id, category)
  WHERE lesson_id IS NOT NULL;

DROP POLICY IF EXISTS grades_teacher_lesson_insert ON public.grades;
DROP POLICY IF EXISTS grades_teacher_lesson_update ON public.grades;

CREATE POLICY grades_teacher_lesson_insert
ON public.grades
FOR INSERT
TO authenticated
WITH CHECK (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND private.teacher_can_access_student(auth.uid(), user_id)
  AND EXISTS (
    SELECT 1
    FROM public.schedules s
    WHERE s.id = grades.lesson_id
      AND s.teacher_id = private.teacher_id_for_user(auth.uid())
  )
);

CREATE POLICY grades_teacher_lesson_update
ON public.grades
FOR UPDATE
TO authenticated
USING (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND private.teacher_can_access_student(auth.uid(), user_id)
  AND EXISTS (
    SELECT 1
    FROM public.schedules s
    WHERE s.id = grades.lesson_id
      AND s.teacher_id = private.teacher_id_for_user(auth.uid())
  )
)
WITH CHECK (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND private.teacher_can_access_student(auth.uid(), user_id)
  AND EXISTS (
    SELECT 1
    FROM public.schedules s
    WHERE s.id = grades.lesson_id
      AND s.teacher_id = private.teacher_id_for_user(auth.uid())
  )
);

CREATE TABLE IF NOT EXISTS public.lesson_plan_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  block_kind TEXT NOT NULL CHECK (block_kind IN ('theory', 'class_task', 'homework', 'practice', 'checkpoint')),
  source_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  material_title TEXT NOT NULL DEFAULT '',
  material_url TEXT,
  admin_note TEXT NOT NULL DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, block_kind)
);

ALTER TABLE public.lesson_plan_blocks
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS block_kind TEXT,
  ADD COLUMN IF NOT EXISTS source_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS material_title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS material_url TEXT,
  ADD COLUMN IF NOT EXISTS admin_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lesson_plan_blocks_block_kind_check'
      AND conrelid = 'public.lesson_plan_blocks'::regclass
  ) THEN
    ALTER TABLE public.lesson_plan_blocks
      ADD CONSTRAINT lesson_plan_blocks_block_kind_check
      CHECK (block_kind IN ('theory', 'class_task', 'homework', 'practice', 'checkpoint'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS lesson_plan_blocks_schedule_kind_uniq
  ON public.lesson_plan_blocks(schedule_id, block_kind);
CREATE INDEX IF NOT EXISTS idx_lesson_plan_blocks_schedule
  ON public.lesson_plan_blocks(schedule_id, position);
CREATE INDEX IF NOT EXISTS idx_lesson_plan_blocks_source_lesson
  ON public.lesson_plan_blocks(source_lesson_id);

DROP TRIGGER IF EXISTS trg_lesson_plan_blocks_updated ON public.lesson_plan_blocks;
CREATE TRIGGER trg_lesson_plan_blocks_updated
  BEFORE UPDATE ON public.lesson_plan_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plan_blocks TO authenticated;
GRANT ALL ON public.lesson_plan_blocks TO service_role;
ALTER TABLE public.lesson_plan_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lesson_plan_blocks_admin_all ON public.lesson_plan_blocks;
DROP POLICY IF EXISTS lesson_plan_blocks_teacher_read ON public.lesson_plan_blocks;
DROP POLICY IF EXISTS lesson_plan_blocks_student_read ON public.lesson_plan_blocks;

CREATE POLICY lesson_plan_blocks_admin_all
ON public.lesson_plan_blocks
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

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

DROP POLICY IF EXISTS schedules_select_own ON public.schedules;
CREATE POLICY schedules_select_own
ON public.schedules
FOR SELECT
TO authenticated
USING (
  private.is_admin(auth.uid())
  OR private.teacher_can_access_student(auth.uid(), user_id)
  OR private.teacher_can_access_group(auth.uid(), group_id)
  OR teacher_id = private.teacher_id_for_user(auth.uid())
  OR (
    private.has_active_access(auth.uid())
    AND (
      auth.uid() = user_id
      OR private.group_has_student(group_id, auth.uid())
    )
  )
);

NOTIFY pgrst, 'reload schema';
