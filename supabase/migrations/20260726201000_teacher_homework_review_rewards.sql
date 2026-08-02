CREATE OR REPLACE FUNCTION public.teacher_review_homework(
  _homework_id uuid,
  _teacher_id uuid,
  _teacher_comment text,
  _result_percent int,
  _star_rating int,
  _status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  homework_student_id uuid;
  previous_star_rating int;
  awarded_stars int;
BEGIN
  SELECT user_id, star_rating
  INTO homework_student_id, previous_star_rating
  FROM public.content_items
  WHERE id = _homework_id
    AND type IN ('homework', 'practice', 'grammar', 'listening', 'checkpoint')
  LIMIT 1;

  IF homework_student_id IS NULL THEN
    RAISE EXCEPTION 'Homework item was not found';
  END IF;

  IF NOT private.is_admin(auth.uid()) AND (
    _teacher_id IS DISTINCT FROM private.teacher_id_for_user(auth.uid())
    OR NOT private.teacher_can_access_student(auth.uid(), homework_student_id)
  ) THEN
    RAISE EXCEPTION 'Teacher cannot review this homework';
  END IF;

  awarded_stars := CASE
    WHEN _status IS DISTINCT FROM 'revision_requested'
      AND COALESCE(_star_rating, 0) > 0
      AND COALESCE(previous_star_rating, 0) <= 0
    THEN LEAST(5, GREATEST(1, _star_rating))
    ELSE 0
  END;

  UPDATE public.content_items
  SET
    teacher_comment = COALESCE(_teacher_comment, ''),
    review_comment = COALESCE(_teacher_comment, ''),
    result_percent = _result_percent,
    star_rating = _star_rating,
    reviewed_by_teacher_id = _teacher_id,
    homework_status = CASE WHEN _status = 'revision_requested' THEN 'revision_requested' ELSE 'reviewed' END,
    checked_at = now(),
    student_result = CASE WHEN _status = 'revision_requested' THEN 'Revision Requested' ELSE student_result END,
    updated_at = now()
  WHERE id = _homework_id;

  IF awarded_stars > 0 THEN
    UPDATE public.profiles
    SET
      star_balance = COALESCE(star_balance, 0) + awarded_stars,
      total_stars_earned = COALESCE(total_stars_earned, 0) + awarded_stars,
      pending_celebration = COALESCE(pending_celebration, 0) + awarded_stars
    WHERE id = homework_student_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.teacher_review_homework(uuid, uuid, text, int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_review_homework(uuid, uuid, text, int, int, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
