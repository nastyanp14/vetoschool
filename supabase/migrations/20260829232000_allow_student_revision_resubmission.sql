-- A teacher's revision request reopens the work for exactly one replacement
-- submission, including work that had previously received a star rating.

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
  existing_status text;
BEGIN
  SELECT user_id, star_rating, homework_status
  INTO target_student_id, existing_stars, existing_status
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

  IF COALESCE(existing_stars, 0) > 0
    AND existing_status IS DISTINCT FROM 'revision_requested' THEN
    RAISE EXCEPTION 'Work is already graded';
  END IF;

  IF existing_status IN ('submitted', 'reviewed') THEN
    RAISE EXCEPTION 'Work cannot be replaced unless the teacher requests revision';
  END IF;

  UPDATE public.content_items
  SET
    submitted_attachment_url = NULLIF(BTRIM(_attachment_url), ''),
    submitted_attachment_name = NULLIF(BTRIM(_attachment_name), ''),
    submitted_at = now(),
    homework_status = 'submitted',
    checked_at = NULL,
    reviewed_by_teacher_id = NULL,
    teacher_comment = NULL,
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

REVOKE ALL ON FUNCTION public.submit_student_homework(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_student_homework(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
