ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS student_result TEXT,
  ADD COLUMN IF NOT EXISTS result_percent INT CHECK (result_percent IS NULL OR (result_percent >= 0 AND result_percent <= 100)),
  ADD COLUMN IF NOT EXISTS errors_count INT CHECK (errors_count IS NULL OR errors_count >= 0),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS homework_status TEXT NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS reviewed_by_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_comment TEXT,
  ADD COLUMN IF NOT EXISTS submitted_attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS submitted_attachment_name TEXT;

CREATE OR REPLACE FUNCTION public.submit_student_homework(
  _content_item_id uuid,
  _attachment_url text,
  _attachment_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_student_id uuid;
  existing_stars int;
BEGIN
  SELECT user_id, star_rating
  INTO target_student_id, existing_stars
  FROM public.content_items
  WHERE id = _content_item_id
    AND type IN ('homework', 'practice', 'grammar', 'listening', 'checkpoint')
  LIMIT 1;

  IF target_student_id IS NULL THEN
    RAISE EXCEPTION 'Work item was not found';
  END IF;

  IF target_student_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Student can submit only own work';
  END IF;

  IF COALESCE(existing_stars, 0) > 0 THEN
    RAISE EXCEPTION 'Work is already graded';
  END IF;

  UPDATE public.content_items
  SET
    submitted_attachment_url = NULLIF(BTRIM(_attachment_url), ''),
    submitted_attachment_name = NULLIF(BTRIM(_attachment_name), ''),
    submitted_at = now(),
    homework_status = 'submitted',
    checked_at = NULL,
    reviewed_by_teacher_id = NULL,
    review_comment = NULL,
    result_percent = NULL,
    errors_count = NULL,
    student_result = NULL,
    star_rating = NULL,
    updated_at = now()
  WHERE id = _content_item_id
    AND user_id = target_student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_student_homework(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_student_homework(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
