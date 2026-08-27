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