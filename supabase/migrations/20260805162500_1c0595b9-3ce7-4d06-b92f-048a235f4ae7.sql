DROP POLICY IF EXISTS avatars_public_read ON storage.objects;

CREATE POLICY avatars_authenticated_read
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');