
-- 1. Prevent non-admins from updating has_access on profiles
CREATE OR REPLACE FUNCTION public.prevent_has_access_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.has_access IS DISTINCT FROM OLD.has_access AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can change has_access';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_has_access ON public.profiles;
CREATE TRIGGER profiles_protect_has_access
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_has_access_self_update();

-- 2. Restrictive policy on user_roles so only admins can write
CREATE POLICY "roles_only_admins_write"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 3. Fix search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 4. Revoke EXECUTE on SECURITY DEFINER helpers from API roles (they still run inside RLS as the table owner)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_has_access_self_update() FROM anon, authenticated, public;

-- 5. Make 'content' bucket private and add per-user storage policies
UPDATE storage.buckets SET public = false WHERE id = 'content';

DROP POLICY IF EXISTS "content_read_own_or_admin" ON storage.objects;
DROP POLICY IF EXISTS "content_insert_own_or_admin" ON storage.objects;
DROP POLICY IF EXISTS "content_update_own_or_admin" ON storage.objects;
DROP POLICY IF EXISTS "content_delete_own_or_admin" ON storage.objects;

CREATE POLICY "content_read_own_or_admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'content'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()))
);

CREATE POLICY "content_insert_own_or_admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'content'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()))
);

CREATE POLICY "content_update_own_or_admin"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'content'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()))
);

CREATE POLICY "content_delete_own_or_admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'content'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()))
);
