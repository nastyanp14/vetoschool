-- Vetoschool — Storage read access fix for the NEW Supabase project (ggflcriakiudnejmiuwh)
-- Run once in the SQL editor of the NEW project.
--
-- Problem: workbook-assets images were readable only by admins and by students with an
-- active subscription (private.has_active_access). Teachers (and any authenticated user
-- without active access) got a 400 from createSignedUrl, so lesson/card images rendered
-- broken even though the objects exist.
--
-- Fix: keep RLS enabled, keep the bucket private, keep anon locked out — only add
-- teachers to the SELECT policy.

DROP POLICY IF EXISTS wba_read_active_or_admin ON storage.objects;

CREATE POLICY wba_read_active_or_admin
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'workbook-assets'
  AND (
    private.is_admin(auth.uid())
    OR private.teacher_id_for_user(auth.uid()) IS NOT NULL
    OR private.has_active_access(auth.uid())
  )
);

-- Verify:
-- select polname, pg_get_expr(polqual, polrelid)
-- from pg_policy where polrelid = 'storage.objects'::regclass and polname = 'wba_read_active_or_admin';
