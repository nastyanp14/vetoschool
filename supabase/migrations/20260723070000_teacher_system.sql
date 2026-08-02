-- Full teacher system: role, directory, assignments, group ownership, and RLS boundaries.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'teacher';

CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  teaching_languages TEXT[] NOT NULL DEFAULT '{}',
  levels TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  admin_note TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'vacation', 'blocked')),
  last_login_at TIMESTAMPTZ,
  invite_email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teacher_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, student_id)
);

ALTER TABLE public.student_groups
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teachers_teacher_user_id ON public.teachers(teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_teachers_email ON public.teachers(lower(email));
CREATE INDEX IF NOT EXISTS idx_teachers_status ON public.teachers(status);
CREATE INDEX IF NOT EXISTS idx_teacher_students_teacher ON public.teacher_students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_student ON public.teacher_students(student_id);
CREATE INDEX IF NOT EXISTS idx_student_groups_teacher ON public.student_groups(teacher_id);

DROP TRIGGER IF EXISTS trg_teachers_updated ON public.teachers;
CREATE TRIGGER trg_teachers_updated
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_teacher_students_updated ON public.teacher_students;
CREATE TRIGGER trg_teacher_students_updated
  BEFORE UPDATE ON public.teacher_students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_students TO authenticated;
GRANT ALL ON public.teachers TO service_role;
GRANT ALL ON public.teacher_students TO service_role;

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_students ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.is_teacher(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = 'teacher'
  )
$$;

CREATE OR REPLACE FUNCTION private.teacher_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id
  FROM public.teachers t
  WHERE t.teacher_user_id = _user_id
    AND t.status <> 'blocked'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.teacher_can_access_student(_teacher_user_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH current_teacher AS (
    SELECT t.id
    FROM public.teachers t
    WHERE t.teacher_user_id = _teacher_user_id
      AND t.status <> 'blocked'
    LIMIT 1
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_students ts
    JOIN current_teacher ct ON ct.id = ts.teacher_id
    WHERE ts.student_id = _student_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.student_groups sg
    JOIN current_teacher ct ON ct.id = sg.teacher_id
    JOIN public.student_group_members sgm ON sgm.group_id = sg.id
    WHERE sgm.user_id = _student_id
  )
$$;

REVOKE ALL ON FUNCTION private.is_teacher(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.teacher_id_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.teacher_can_access_student(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_teacher(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.teacher_id_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.teacher_can_access_student(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_email text;
  user_name text;
  role_to_assign public.app_role;
BEGIN
  user_email := lower(coalesce(new.email, ''));
  user_name := coalesce(
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(user_email, '@', 1),
    'Student'
  );

  IF user_email = 'vetoschool.english@gmail.com' THEN
    role_to_assign := 'admin'::public.app_role;
  ELSIF EXISTS (SELECT 1 FROM public.teachers t WHERE lower(t.email) = user_email) THEN
    role_to_assign := 'teacher'::text::public.app_role;
  ELSE
    role_to_assign := 'student'::public.app_role;
  END IF;

  INSERT INTO public.profiles (id, email, name, has_access, payment_status, access_status)
  VALUES (
    new.id,
    user_email,
    user_name,
    role_to_assign::text = 'admin',
    CASE WHEN role_to_assign::text = 'admin' THEN 'paid'::public.payment_status ELSE 'unpaid'::public.payment_status END,
    CASE WHEN role_to_assign::text = 'admin' THEN 'active'::public.access_status ELSE 'pending'::public.access_status END
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = COALESCE(public.profiles.name, EXCLUDED.name);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, role_to_assign)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.teachers
  SET teacher_user_id = new.id
  WHERE lower(email) = user_email
    AND teacher_user_id IS NULL;

  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS teachers_admin_all ON public.teachers;
DROP POLICY IF EXISTS teachers_teacher_select_own ON public.teachers;
CREATE POLICY teachers_admin_all
ON public.teachers
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY teachers_teacher_select_own
ON public.teachers
FOR SELECT
TO authenticated
USING (teacher_user_id = auth.uid());

DROP POLICY IF EXISTS teacher_students_admin_all ON public.teacher_students;
DROP POLICY IF EXISTS teacher_students_teacher_select_own ON public.teacher_students;
CREATE POLICY teacher_students_admin_all
ON public.teacher_students
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY teacher_students_teacher_select_own
ON public.teacher_students
FOR SELECT
TO authenticated
USING (teacher_id = private.teacher_id_for_user(auth.uid()));

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR private.teacher_can_access_student(auth.uid(), id)
);

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

DROP POLICY IF EXISTS schedules_select_own ON public.schedules;
CREATE POLICY schedules_select_own
ON public.schedules
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

DROP POLICY IF EXISTS grades_select_own_or_admin ON public.grades;
CREATE POLICY grades_select_own_or_admin
ON public.grades
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

DROP POLICY IF EXISTS "dictionary_words_select_active_or_admin" ON public.dictionary_words;
CREATE POLICY "dictionary_words_select_active_or_admin"
ON public.dictionary_words
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

DROP POLICY IF EXISTS "student_groups_select_auth" ON public.student_groups;
CREATE POLICY "student_groups_select_auth"
ON public.student_groups
FOR SELECT
TO authenticated
USING (
  private.is_admin(auth.uid())
  OR teacher_id = private.teacher_id_for_user(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.student_group_members sgm
    WHERE sgm.group_id = student_groups.id
      AND sgm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "student_group_members_select_auth" ON public.student_group_members;
CREATE POLICY "student_group_members_select_auth"
ON public.student_group_members
FOR SELECT
TO authenticated
USING (
  private.is_admin(auth.uid())
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.student_groups sg
    WHERE sg.id = student_group_members.group_id
      AND sg.teacher_id = private.teacher_id_for_user(auth.uid())
  )
);

DROP POLICY IF EXISTS content_read_own_or_admin ON storage.objects;
CREATE POLICY content_read_own_or_admin
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'content'
  AND (
    private.is_admin(auth.uid())
    OR owner = auth.uid()
    OR private.teacher_can_access_student(
      auth.uid(),
      CASE
        WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (storage.foldername(name))[1]::uuid
        ELSE NULL::uuid
      END
    )
  )
);
