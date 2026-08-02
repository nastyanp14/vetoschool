-- Teacher workspace expansion: lesson workflow, homework review, grades, dictionary assignment, and private notes.

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS lesson_type TEXT NOT NULL DEFAULT 'individual' CHECK (lesson_type IN ('group', 'individual', 'trial')),
  ADD COLUMN IF NOT EXISTS lesson_status TEXT NOT NULL DEFAULT 'scheduled' CHECK (lesson_status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'student_absent', 'teacher_absent')),
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.student_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS comment TEXT,
  ADD COLUMN IF NOT EXISTS rescheduled_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS teacher_comment TEXT,
  ADD COLUMN IF NOT EXISTS student_result TEXT,
  ADD COLUMN IF NOT EXISTS result_percent INT CHECK (result_percent IS NULL OR (result_percent >= 0 AND result_percent <= 100)),
  ADD COLUMN IF NOT EXISTS errors_count INT CHECK (errors_count IS NULL OR errors_count >= 0),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;

ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.student_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.teacher_student_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedules_teacher ON public.schedules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_schedules_group ON public.schedules(group_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date_status ON public.schedules(scheduled_date, lesson_status);
CREATE INDEX IF NOT EXISTS idx_content_items_due_type ON public.content_items(user_id, type, due_date);
CREATE INDEX IF NOT EXISTS idx_grades_teacher ON public.grades(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_student_notes_teacher ON public.teacher_student_notes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_student_notes_student ON public.teacher_student_notes(student_id);

DROP TRIGGER IF EXISTS trg_schedules_updated ON public.schedules;
CREATE TRIGGER trg_schedules_updated
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_grades_updated ON public.grades;
CREATE TRIGGER trg_grades_updated
  BEFORE UPDATE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_teacher_student_notes_updated ON public.teacher_student_notes;
CREATE TRIGGER trg_teacher_student_notes_updated
  BEFORE UPDATE ON public.teacher_student_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_student_notes TO authenticated;
GRANT ALL ON public.teacher_student_notes TO service_role;
ALTER TABLE public.teacher_student_notes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.group_has_student(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_group_members
    WHERE group_id = _group_id
      AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION private.teacher_can_access_group(_teacher_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_groups
    WHERE id = _group_id
      AND teacher_id = private.teacher_id_for_user(_teacher_user_id)
  )
$$;

REVOKE ALL ON FUNCTION private.group_has_student(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.teacher_can_access_group(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.group_has_student(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.teacher_can_access_group(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "student_groups_select_auth" ON public.student_groups;
CREATE POLICY "student_groups_select_auth"
ON public.student_groups
FOR SELECT
TO authenticated
USING (
  private.is_admin(auth.uid())
  OR private.teacher_can_access_group(auth.uid(), id)
  OR private.group_has_student(id, auth.uid())
);

DROP POLICY IF EXISTS "student_group_members_select_auth" ON public.student_group_members;
CREATE POLICY "student_group_members_select_auth"
ON public.student_group_members
FOR SELECT
TO authenticated
USING (
  private.is_admin(auth.uid())
  OR user_id = auth.uid()
  OR private.teacher_can_access_group(auth.uid(), group_id)
);

DROP POLICY IF EXISTS schedules_teacher_insert ON public.schedules;
DROP POLICY IF EXISTS schedules_teacher_update ON public.schedules;
CREATE POLICY schedules_teacher_insert
ON public.schedules
FOR INSERT
TO authenticated
WITH CHECK (
  private.teacher_can_access_student(auth.uid(), user_id)
  AND teacher_id = private.teacher_id_for_user(auth.uid())
);

CREATE POLICY schedules_teacher_update
ON public.schedules
FOR UPDATE
TO authenticated
USING (
  private.teacher_can_access_student(auth.uid(), user_id)
  OR teacher_id = private.teacher_id_for_user(auth.uid())
)
WITH CHECK (
  private.teacher_can_access_student(auth.uid(), user_id)
  OR teacher_id = private.teacher_id_for_user(auth.uid())
);

DROP POLICY IF EXISTS content_teacher_insert ON public.content_items;
DROP POLICY IF EXISTS content_teacher_update ON public.content_items;
CREATE POLICY content_teacher_insert
ON public.content_items
FOR INSERT
TO authenticated
WITH CHECK (private.teacher_can_access_student(auth.uid(), user_id));

CREATE POLICY content_teacher_update
ON public.content_items
FOR UPDATE
TO authenticated
USING (private.teacher_can_access_student(auth.uid(), user_id))
WITH CHECK (private.teacher_can_access_student(auth.uid(), user_id));

DROP POLICY IF EXISTS grades_teacher_manage ON public.grades;
CREATE POLICY grades_teacher_manage
ON public.grades
FOR ALL
TO authenticated
USING (
  private.teacher_can_access_student(auth.uid(), user_id)
  OR teacher_id = private.teacher_id_for_user(auth.uid())
)
WITH CHECK (
  private.teacher_can_access_student(auth.uid(), user_id)
  AND (
    teacher_id IS NULL
    OR teacher_id = private.teacher_id_for_user(auth.uid())
  )
);

DROP POLICY IF EXISTS dict_teacher_insert ON public.dictionary_words;
DROP POLICY IF EXISTS dict_teacher_update ON public.dictionary_words;
DROP POLICY IF EXISTS dict_teacher_delete ON public.dictionary_words;
CREATE POLICY dict_teacher_insert
ON public.dictionary_words
FOR INSERT
TO authenticated
WITH CHECK (private.teacher_can_access_student(auth.uid(), user_id));

CREATE POLICY dict_teacher_update
ON public.dictionary_words
FOR UPDATE
TO authenticated
USING (private.teacher_can_access_student(auth.uid(), user_id))
WITH CHECK (private.teacher_can_access_student(auth.uid(), user_id));

CREATE POLICY dict_teacher_delete
ON public.dictionary_words
FOR DELETE
TO authenticated
USING (private.teacher_can_access_student(auth.uid(), user_id));

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
  AND private.teacher_can_access_student(auth.uid(), student_id)
)
WITH CHECK (
  teacher_id = private.teacher_id_for_user(auth.uid())
  AND author_id = auth.uid()
  AND private.teacher_can_access_student(auth.uid(), student_id)
);

NOTIFY pgrst, 'reload schema';
