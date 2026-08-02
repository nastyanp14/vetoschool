-- Repair rows where restored assigned content showed 5 stars/100% even though
-- the credited interactive progress had fewer stars. Also keeps theory lessons
-- out of automatic star scoring.

UPDATE public.content_items ci
SET
  star_rating = GREATEST(1, LEAST(5, lp.stars_awarded)),
  result_percent = GREATEST(0, LEAST(100, lp.stars_awarded * 20)),
  interactive_score_percent = GREATEST(0, LEAST(100, lp.stars_awarded * 20)),
  review_comment = 'Интерактивное задание выполнено автоматически.',
  updated_at = now()
FROM public.lesson_progress lp
WHERE ci.user_id = lp.user_id
  AND ci.interactive_lesson_id = lp.lesson_id
  AND ci.type IN ('homework', 'practice', 'grammar', 'listening', 'checkpoint')
  AND lp.stars_awarded BETWEEN 1 AND 4
  AND (
    COALESCE(ci.star_rating, 5) > lp.stars_awarded
    OR COALESCE(ci.result_percent, 100) > lp.stars_awarded * 20
    OR COALESCE(ci.interactive_score_percent, 100) > lp.stars_awarded * 20
  );

CREATE OR REPLACE FUNCTION public.complete_assigned_interactive_content(
  _content_item_id UUID,
  _lesson_id UUID,
  _score_percent INT DEFAULT 100,
  _errors_count INT DEFAULT 0,
  _star_rating INT DEFAULT NULL
)
RETURNS TABLE(stars_awarded INT, already_completed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  content_row public.content_items%ROWTYPE;
  lesson_row public.lessons%ROWTYPE;
  bounded_score INT := GREATEST(0, LEAST(100, COALESCE(_score_percent, 100)));
  bounded_errors INT := GREATEST(0, COALESCE(_errors_count, 0));
  normalized_rating INT := GREATEST(
    1,
    LEAST(
      5,
      COALESCE(_star_rating, GREATEST(1, LEAST(5, CEIL(GREATEST(0, LEAST(100, COALESCE(_score_percent, 100)))::NUMERIC / 20)::INT)))
    )
  );
  progress_award INT := 0;
  award_amount INT := 0;
  inserted_progress_count INT := 0;
  should_persist_result BOOLEAN := false;
BEGIN
  SELECT *
  INTO content_row
  FROM public.content_items
  WHERE id = _content_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Content item not found';
  END IF;

  IF content_row.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the assigned student can complete this content item';
  END IF;

  IF content_row.interactive_lesson_id IS NULL OR content_row.interactive_lesson_id <> _lesson_id THEN
    RAISE EXCEPTION 'Interactive lesson is not assigned to this content item';
  END IF;

  SELECT *
  INTO lesson_row
  FROM public.lessons
  WHERE id = _lesson_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Interactive lesson not found';
  END IF;

  already_completed := COALESCE(content_row.rewarded_stars, 0) > 0
    OR content_row.interactive_completed_at IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.lesson_progress lp
      WHERE lp.user_id = content_row.user_id
        AND lp.lesson_id = _lesson_id
    );

  should_persist_result := NOT already_completed
    OR content_row.interactive_completed_at IS NULL
    OR content_row.star_rating IS NULL
    OR content_row.interactive_score_percent IS NULL;

  IF already_completed THEN
    progress_award := GREATEST(0, COALESCE(NULLIF(content_row.rewarded_stars, 0), content_row.star_rating, normalized_rating));
  ELSIF lesson_row.type IN ('class_task', 'homework', 'practice', 'grammar', 'listening', 'checkpoint') THEN
    progress_award := normalized_rating;
    award_amount := progress_award;
  END IF;

  INSERT INTO public.lesson_progress(user_id, lesson_id, stars_awarded)
  VALUES (content_row.user_id, _lesson_id, progress_award)
  ON CONFLICT (user_id, lesson_id) DO NOTHING;

  GET DIAGNOSTICS inserted_progress_count = ROW_COUNT;

  IF NOT already_completed AND inserted_progress_count = 0 THEN
    already_completed := TRUE;
    award_amount := 0;
  END IF;

  IF award_amount > 0 THEN
    UPDATE public.profiles
    SET
      star_balance = COALESCE(star_balance, 0) + award_amount,
      total_stars_earned = COALESCE(total_stars_earned, 0) + award_amount,
      pending_celebration = COALESCE(pending_celebration, 0) + award_amount
    WHERE id = content_row.user_id;
  END IF;

  IF should_persist_result THEN
    UPDATE public.content_items ci
    SET
      material_mode = 'interactive',
      submitted_at = COALESCE(ci.submitted_at, now()),
      checked_at = COALESCE(ci.checked_at, now()),
      homework_status = 'reviewed',
      result_percent = bounded_score,
      errors_count = bounded_errors,
      star_rating = normalized_rating,
      student_result = 'Interactive completed',
      review_comment = COALESCE(NULLIF(ci.review_comment, ''), 'Интерактивное задание выполнено автоматически.'),
      interactive_completed_at = COALESCE(ci.interactive_completed_at, now()),
      interactive_score_percent = bounded_score,
      interactive_attempts = COALESCE(ci.interactive_attempts, 0) + 1,
      rewarded_stars = CASE
        WHEN COALESCE(ci.rewarded_stars, 0) > 0 THEN ci.rewarded_stars
        ELSE progress_award
      END,
      updated_at = now()
    WHERE ci.user_id = content_row.user_id
      AND ci.interactive_lesson_id = _lesson_id
      AND ci.type IN ('homework', 'practice', 'grammar', 'listening', 'checkpoint');
  ELSE
    UPDATE public.content_items ci
    SET
      interactive_attempts = COALESCE(ci.interactive_attempts, 0) + 1,
      updated_at = now()
    WHERE ci.id = _content_item_id;
  END IF;

  stars_awarded := award_amount;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_assigned_interactive_content(UUID, UUID, INT, INT, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';
