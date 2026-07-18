-- Secure authentication/access split.
-- Identity verification is handled by Supabase Auth.
-- Paid learning access remains a manual admin-controlled application status.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE public.payment_status AS ENUM ('unpaid', 'pending_review', 'paid', 'refunded');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_status') THEN
    CREATE TYPE public.access_status AS ENUM ('pending', 'active', 'suspended', 'cancelled');
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS access_status public.access_status NOT NULL DEFAULT 'pending';

UPDATE public.profiles
SET
  access_status = CASE WHEN has_access THEN 'active'::public.access_status ELSE access_status END,
  payment_status = CASE WHEN has_access THEN 'paid'::public.payment_status ELSE payment_status END;

CREATE OR REPLACE FUNCTION private.has_active_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND access_status = 'active'
  )
$$;

REVOKE ALL ON FUNCTION private.has_active_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_active_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_profile_access_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.has_access := NEW.access_status = 'active';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_access_flags ON public.profiles;
CREATE TRIGGER profiles_sync_access_flags
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_access_flags();

CREATE OR REPLACE FUNCTION public.prevent_paid_access_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF (
    NEW.has_access IS DISTINCT FROM OLD.has_access
    OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.access_status IS DISTINCT FROM OLD.access_status
  ) AND NOT private.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can change paid access status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_has_access ON public.profiles;
DROP TRIGGER IF EXISTS profiles_protect_paid_access ON public.profiles;
CREATE TRIGGER profiles_protect_paid_access
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_paid_access_self_update();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name text;
  user_email text;
  role_to_assign public.app_role;
BEGIN
  user_email := lower(coalesce(new.email, ''));
  user_name := coalesce(
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(user_email, '@', 1),
    ''
  );
  role_to_assign := CASE WHEN user_email = 'vetoschool.english@gmail.com' THEN 'admin'::public.app_role ELSE 'student'::public.app_role END;

  INSERT INTO public.profiles (id, name, email, payment_status, access_status)
  VALUES (
    new.id,
    user_name,
    user_email,
    CASE WHEN role_to_assign = 'admin' THEN 'paid'::public.payment_status ELSE 'unpaid'::public.payment_status END,
    CASE WHEN role_to_assign = 'admin' THEN 'active'::public.access_status ELSE 'pending'::public.access_status END
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = CASE WHEN public.profiles.name = '' THEN EXCLUDED.name ELSE public.profiles.name END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, role_to_assign)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF role_to_assign = 'student' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'student')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_access_flags() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_paid_access_self_update() FROM PUBLIC, anon, authenticated;

-- Keep self profile updates limited to identity/profile fields.
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND has_access IS NOT DISTINCT FROM (SELECT p.has_access FROM public.profiles p WHERE p.id = auth.uid())
  AND payment_status IS NOT DISTINCT FROM (SELECT p.payment_status FROM public.profiles p WHERE p.id = auth.uid())
  AND access_status IS NOT DISTINCT FROM (SELECT p.access_status FROM public.profiles p WHERE p.id = auth.uid())
);

-- Paid materials are readable only by admins or manually activated students.
DROP POLICY IF EXISTS content_select_own ON public.content_items;
CREATE POLICY content_select_own
ON public.content_items
FOR SELECT
TO authenticated
USING (
  private.is_admin(auth.uid())
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
  OR (
    auth.uid() = user_id
    AND private.has_active_access(auth.uid())
  )
);

DROP POLICY IF EXISTS "wb_select_auth" ON public.workbooks;
DROP POLICY IF EXISTS "workbooks_select_active_or_admin" ON public.workbooks;
CREATE POLICY "workbooks_select_active_or_admin"
ON public.workbooks
FOR SELECT
TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_active_access(auth.uid()));

DROP POLICY IF EXISTS "units_select_auth" ON public.units;
DROP POLICY IF EXISTS "units_select_active_or_admin" ON public.units;
CREATE POLICY "units_select_active_or_admin"
ON public.units
FOR SELECT
TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_active_access(auth.uid()));

DROP POLICY IF EXISTS "lessons_select_auth" ON public.lessons;
DROP POLICY IF EXISTS "lessons_select_active_or_admin" ON public.lessons;
CREATE POLICY "lessons_select_active_or_admin"
ON public.lessons
FOR SELECT
TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_active_access(auth.uid()));

DROP POLICY IF EXISTS "it_select_auth" ON public.interactive_tasks;
DROP POLICY IF EXISTS "interactive_tasks_select_active_or_admin" ON public.interactive_tasks;
CREATE POLICY "interactive_tasks_select_active_or_admin"
ON public.interactive_tasks
FOR SELECT
TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_active_access(auth.uid()));

DROP POLICY IF EXISTS "wba_read_auth" ON storage.objects;
DROP POLICY IF EXISTS wba_read_auth ON storage.objects;
DROP POLICY IF EXISTS "wba_read_active_or_admin" ON storage.objects;
CREATE POLICY "wba_read_active_or_admin"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'workbook-assets'
  AND (private.is_admin(auth.uid()) OR private.has_active_access(auth.uid()))
);

DROP POLICY IF EXISTS "dict_select_own" ON public.dictionary_words;
DROP POLICY IF EXISTS "dictionary_words_select_active_or_admin" ON public.dictionary_words;
CREATE POLICY "dictionary_words_select_active_or_admin"
ON public.dictionary_words
FOR SELECT
TO authenticated
USING (
  private.is_admin(auth.uid())
  OR (
    auth.uid() = user_id
    AND private.has_active_access(auth.uid())
  )
);

DROP POLICY IF EXISTS lp_select_self_or_admin ON public.lesson_progress;
DROP POLICY IF EXISTS "lp_select_self_or_admin" ON public.lesson_progress;
DROP POLICY IF EXISTS "lesson_progress_select_active_or_admin" ON public.lesson_progress;
CREATE POLICY "lesson_progress_select_active_or_admin"
ON public.lesson_progress
FOR SELECT
TO authenticated
USING (
  private.is_admin(auth.uid())
  OR (
    auth.uid() = user_id
    AND private.has_active_access(auth.uid())
  )
);

DROP POLICY IF EXISTS lp_ins_self ON public.lesson_progress;
DROP POLICY IF EXISTS "lesson_progress_insert_active_self" ON public.lesson_progress;
CREATE POLICY "lesson_progress_insert_active_self"
ON public.lesson_progress
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND private.has_active_access(auth.uid()));

DROP POLICY IF EXISTS lp_upd_self ON public.lesson_progress;
DROP POLICY IF EXISTS "lesson_progress_update_active_self" ON public.lesson_progress;
CREATE POLICY "lesson_progress_update_active_self"
ON public.lesson_progress
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND private.has_active_access(auth.uid()))
WITH CHECK (auth.uid() = user_id AND private.has_active_access(auth.uid()));
