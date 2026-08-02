ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS star_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_stars_earned integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_celebration integer NOT NULL DEFAULT 0;

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS rewarded_stars INT NOT NULL DEFAULT 0
  CHECK (rewarded_stars >= 0 AND rewarded_stars <= 5);

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
  previous_rewarded_stars int;
  normalized_stars int;
  awarded_stars int;
BEGIN
  SELECT user_id, COALESCE(rewarded_stars, 0)
  INTO homework_student_id, previous_rewarded_stars
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

  normalized_stars := CASE
    WHEN COALESCE(_star_rating, 0) > 0
    THEN LEAST(5, GREATEST(1, _star_rating))
    ELSE 0
  END;

  awarded_stars := CASE
    WHEN _status IS DISTINCT FROM 'revision_requested'
      AND normalized_stars > previous_rewarded_stars
    THEN normalized_stars - previous_rewarded_stars
    ELSE 0
  END;

  UPDATE public.content_items
  SET
    teacher_comment = COALESCE(_teacher_comment, ''),
    review_comment = COALESCE(_teacher_comment, ''),
    result_percent = _result_percent,
    star_rating = _star_rating,
    rewarded_stars = CASE
      WHEN _status IS DISTINCT FROM 'revision_requested'
      THEN GREATEST(COALESCE(rewarded_stars, 0), normalized_stars)
      ELSE COALESCE(rewarded_stars, 0)
    END,
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

WITH reward_delta AS (
  SELECT
    user_id,
    SUM(LEAST(5, GREATEST(1, star_rating)) - COALESCE(rewarded_stars, 0))::int AS stars_to_award
  FROM public.content_items
  WHERE type IN ('homework', 'practice', 'grammar', 'listening', 'checkpoint')
    AND reviewed_by_teacher_id IS NOT NULL
    AND homework_status = 'reviewed'
    AND COALESCE(star_rating, 0) > COALESCE(rewarded_stars, 0)
  GROUP BY user_id
)
UPDATE public.profiles AS p
SET
  star_balance = COALESCE(p.star_balance, 0) + reward_delta.stars_to_award,
  total_stars_earned = COALESCE(p.total_stars_earned, 0) + reward_delta.stars_to_award,
  pending_celebration = COALESCE(p.pending_celebration, 0) + reward_delta.stars_to_award
FROM reward_delta
WHERE p.id = reward_delta.user_id
  AND reward_delta.stars_to_award > 0;

UPDATE public.content_items
SET rewarded_stars = LEAST(5, GREATEST(1, star_rating))
WHERE type IN ('homework', 'practice', 'grammar', 'listening', 'checkpoint')
  AND reviewed_by_teacher_id IS NOT NULL
  AND homework_status = 'reviewed'
  AND COALESCE(star_rating, 0) > COALESCE(rewarded_stars, 0);

NOTIFY pgrst, 'reload schema';
