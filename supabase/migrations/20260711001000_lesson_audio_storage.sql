-- Generated pronunciation audio is private. Authenticated students receive short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lesson-audio', 'lesson-audio', false, 10485760, ARRAY['audio/mpeg'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "lesson_audio_authenticated_read" ON storage.objects;
CREATE POLICY "lesson_audio_authenticated_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lesson-audio');

-- Upload/update/delete is intentionally omitted for browser clients.
-- The generate-card-audio Edge Function writes with the service role.
