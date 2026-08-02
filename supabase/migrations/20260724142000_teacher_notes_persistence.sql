-- Teacher notes persistence for private, admin-visible, group, lesson, and student ай скопиру.

CREATE TABLE IF NOT EXISTS public.teacher_student_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_student_notes
  ALTER COLUMN student_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS target_id UUID,
  ADD COLUMN IF NOT EXISTS note_type TEXT NOT NULL DEFAULT 'Private',
  ADD COLUMN IF NOT EXISTS attachment_label TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visible_to_admin BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_student_notes_target_type_check'
      AND conrelid = 'public.teacher_student_notes'::regclass
  ) THEN
    ALTER TABLE public.teacher_student_notes
      ADD CONSTRAINT teacher_student_notes_target_type_check
      CHECK (target_type IN ('teacher', 'student', 'group', 'lesson', 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_student_notes_note_type_check'
      AND conrelid = 'public.teacher_student_notes'::regclass
  ) THEN
    ALTER TABLE public.teacher_student_notes
      ADD CONSTRAINT teacher_student_notes_note_type_check
      CHECK (note_type IN ('Private', 'Visible to Admin', 'Important', 'Follow-up'));
  END IF;
END $$;

UPDATE public.teacher_student_notes
SET
  target_type = CASE WHEN student_id IS NULL THEN target_type ELSE 'student' END,
  target_id = COALESCE(target_id, student_id, teacher_id),
  visible_to_admin = visible_to_admin OR note_type = 'Visible to Admin' OR target_type = 'admin'
WHERE target_id IS NULL
   OR (student_id IS NOT NULL AND target_type <> 'student')
   OR visible_to_admin IS NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_student_notes_teacher_created
  ON public.teacher_student_notes(teacher_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_student_notes_target
  ON public.teacher_student_notes(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_teacher_student_notes_admin_visible
  ON public.teacher_student_notes(visible_to_admin)
  WHERE visible_to_admin = true;

DROP TRIGGER IF EXISTS trg_teacher_student_notes_updated ON public.teacher_student_notes;
CREATE TRIGGER trg_teacher_student_notes_updated
  BEFORE UPDATE ON public.teacher_student_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_student_notes TO authenticated;
GRANT ALL ON public.teacher_student_notes TO service_role;
ALTER TABLE public.teacher_student_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_notes_admin_all ON public.teacher_student_notes;
DROP POLICY IF EXISTS teacher_notes_teacher_all ON public.teacher_student_notes;

CREATE POLICY teacher_notes_admin_all
ON public.teacher_student_notes
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY teacher_notes_teacher_all
ON public.teacher_student_notes
FOR ALL
TO authenticated
USING (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND (
    target_type IN ('teacher', 'admin')
    OR (
      target_type = 'student'
      AND student_id IS NOT NULL
      AND private.teacher_can_access_student(auth.uid(), student_id)
    )
    OR (
      target_type = 'group'
      AND target_id IS NOT NULL
      AND private.teacher_can_access_group(auth.uid(), target_id)
    )
    OR (
      target_type = 'lesson'
      AND target_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.schedules s
        WHERE s.id = target_id
          AND s.teacher_id = private.teacher_id_for_user(auth.uid())
      )
    )
  )
)
WITH CHECK (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND author_id = auth.uid()
  AND (
    target_type IN ('teacher', 'admin')
    OR (
      target_type = 'student'
      AND student_id IS NOT NULL
      AND private.teacher_can_access_student(auth.uid(), student_id)
    )
    OR (
      target_type = 'group'
      AND target_id IS NOT NULL
      AND private.teacher_can_access_group(auth.uid(), target_id)
    )
    OR (
      target_type = 'lesson'
      AND target_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.schedules s
        WHERE s.id = target_id
          AND s.teacher_id = private.teacher_id_for_user(auth.uid())
      )
    )
  )
);

NOTIFY pgrst, 'reload schema';
