-- Move admin checks to a non-exposed schema so RLS can work without public RPC access.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
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
      AND role = 'admin'
  )
$$;

REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated;

-- Public SECURITY DEFINER helpers must not be callable directly from the app API.
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_has_access_self_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prevent_has_access_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.has_access IS DISTINCT FROM OLD.has_access AND NOT private.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can change has_access';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_has_access_self_update() FROM PUBLIC, anon, authenticated;

-- Profiles: authenticated users can read/update only themselves; admins can manage all profiles.
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_self_authenticated ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;

CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY profiles_update_self
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_insert_self_authenticated
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_admin_all
ON public.profiles
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

-- User roles: users can read their own role; admins can read and manage roles; students cannot write roles.
DROP POLICY IF EXISTS roles_select_self ON public.user_roles;
DROP POLICY IF EXISTS roles_admin_manage ON public.user_roles;
DROP POLICY IF EXISTS roles_block_non_admin_writes ON public.user_roles;
DROP POLICY IF EXISTS roles_select_admin ON public.user_roles;
DROP POLICY IF EXISTS roles_insert_admin ON public.user_roles;
DROP POLICY IF EXISTS roles_update_admin ON public.user_roles;
DROP POLICY IF EXISTS roles_delete_admin ON public.user_roles;

CREATE POLICY roles_select_self
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY roles_select_admin
ON public.user_roles
FOR SELECT
TO authenticated
USING (private.is_admin(auth.uid()));

CREATE POLICY roles_insert_admin
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY roles_update_admin
ON public.user_roles
FOR UPDATE
TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY roles_delete_admin
ON public.user_roles
FOR DELETE
TO authenticated
USING (private.is_admin(auth.uid()));

-- Content items: students read only their own; admins manage all.
DROP POLICY IF EXISTS content_select_own ON public.content_items;
DROP POLICY IF EXISTS content_admin_manage ON public.content_items;

CREATE POLICY content_select_own
ON public.content_items
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY content_admin_manage
ON public.content_items
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

-- Schedules: students read only their own; admins manage all.
DROP POLICY IF EXISTS schedules_select_own ON public.schedules;
DROP POLICY IF EXISTS schedules_admin_manage ON public.schedules;

CREATE POLICY schedules_select_own
ON public.schedules
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY schedules_admin_manage
ON public.schedules
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

-- Grades: keep the same access model but use the internal admin check.
DROP POLICY IF EXISTS grades_select_own_or_admin ON public.grades;
DROP POLICY IF EXISTS grades_admin_all ON public.grades;

CREATE POLICY grades_select_own_or_admin
ON public.grades
FOR SELECT
TO authenticated
USING ((auth.uid() = user_id) OR private.is_admin(auth.uid()));

CREATE POLICY grades_admin_all
ON public.grades
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

-- Storage content bucket: remove old public-read/admin policies and keep private own-or-admin access.
DROP POLICY IF EXISTS content_files_public_read ON storage.objects;
DROP POLICY IF EXISTS content_files_admin_write ON storage.objects;
DROP POLICY IF EXISTS content_files_admin_update ON storage.objects;
DROP POLICY IF EXISTS content_files_admin_delete ON storage.objects;
DROP POLICY IF EXISTS content_read_own_or_admin ON storage.objects;
DROP POLICY IF EXISTS content_insert_own_or_admin ON storage.objects;
DROP POLICY IF EXISTS content_update_own_or_admin ON storage.objects;
DROP POLICY IF EXISTS content_delete_own_or_admin ON storage.objects;

CREATE POLICY content_read_own_or_admin
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'content'
  AND (((auth.uid())::text = (storage.foldername(name))[1]) OR private.is_admin(auth.uid()))
);

CREATE POLICY content_insert_own_or_admin
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'content'
  AND (((auth.uid())::text = (storage.foldername(name))[1]) OR private.is_admin(auth.uid()))
);

CREATE POLICY content_update_own_or_admin
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'content'
  AND (((auth.uid())::text = (storage.foldername(name))[1]) OR private.is_admin(auth.uid()))
)
WITH CHECK (
  bucket_id = 'content'
  AND (((auth.uid())::text = (storage.foldername(name))[1]) OR private.is_admin(auth.uid()))
);

CREATE POLICY content_delete_own_or_admin
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'content'
  AND (((auth.uid())::text = (storage.foldername(name))[1]) OR private.is_admin(auth.uid()))
);