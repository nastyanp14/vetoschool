-- Teacher Panel foundation: LMS read model, teacher-owned visibility, and content-edit lockdown.

ALTER TABLE public.student_groups
  ADD COLUMN IF NOT EXISTS course TEXT,
  ADD COLUMN IF NOT EXISTS current_unit TEXT,
  ADD COLUMN IF NOT EXISTS current_lesson TEXT,
  ADD COLUMN IF NOT EXISTS progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive', 'trial', 'completed')),
  ADD COLUMN IF NOT EXISTS lesson_duration_minutes INT CHECK (lesson_duration_minutes IS NULL OR lesson_duration_minutes > 0),
  ADD COLUMN IF NOT EXISTS weekly_frequency INT CHECK (weekly_frequency IS NULL OR weekly_frequency >= 0),
  ADD COLUMN IF NOT EXISTS start_date DATE;

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS room TEXT,
  ADD COLUMN IF NOT EXISTS online_url TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age TEXT,
  ADD COLUMN IF NOT EXISTS level TEXT,
  ADD COLUMN IF NOT EXISTS course TEXT,
  ADD COLUMN IF NOT EXISTS student_status TEXT NOT NULL DEFAULT 'trial' CHECK (student_status IN ('active', 'paused', 'inactive', 'trial', 'completed'));

CREATE INDEX IF NOT EXISTS idx_student_groups_teacher_status ON public.student_groups(teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_student_groups_course_level ON public.student_groups(course, level);
CREATE INDEX IF NOT EXISTS idx_profiles_student_status ON public.profiles(student_status);
CREATE INDEX IF NOT EXISTS idx_profiles_level_course ON public.profiles(level, course);
CREATE INDEX IF NOT EXISTS idx_schedules_teacher_date ON public.schedules(teacher_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_schedules_group_date ON public.schedules(group_id, scheduled_date);

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (
  private.is_admin(auth.uid())
  OR auth.uid() = id
  OR private.teacher_can_access_student(auth.uid(), id)
);

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

DROP POLICY IF EXISTS schedules_select_own ON public.schedules;
CREATE POLICY schedules_select_own
ON public.schedules
FOR SELECT
TO authenticated
USING (
  private.is_admin(auth.uid())
  OR private.teacher_can_access_student(auth.uid(), user_id)
  OR teacher_id = private.teacher_id_for_user(auth.uid())
  OR (
    auth.uid() = user_id
    AND private.has_active_access(auth.uid())
  )
);

DROP POLICY IF EXISTS content_teacher_insert ON public.content_items;
DROP POLICY IF EXISTS content_teacher_update ON public.content_items;
DROP POLICY IF EXISTS grades_teacher_manage ON public.grades;
DROP POLICY IF EXISTS dict_teacher_insert ON public.dictionary_words;
DROP POLICY IF EXISTS dict_teacher_update ON public.dictionary_words;
DROP POLICY IF EXISTS dict_teacher_delete ON public.dictionary_words;

NOTIFY pgrst, 'reload schema';
