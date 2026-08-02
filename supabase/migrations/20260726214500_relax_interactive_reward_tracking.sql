-- Allow interactive lessons to award more than 5 stars while keeping homework ratings 1..5.
-- Non-destructive: keeps all existing data and only relaxes the reward tracking constraint.

ALTER TABLE public.content_items
  DROP CONSTRAINT IF EXISTS content_items_rewarded_stars_check;

ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_rewarded_stars_check
  CHECK (rewarded_stars >= 0);

CREATE OR REPLACE FUNCTION public.complete_assigned_interactive_content(
  _content_item_id UUID,
  _lesson_id UUID,
  _score_percent INT DEFAULT 100
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
  normalized_rating INT;
  award_amount INT := 0;
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

  normalized_rating := GREATEST(1, LEAST(5, CEIL(bounded_score::NUMERIC / 20)::INT));
  already_completed := COALESCE(content_row.rewarded_stars, 0) > 0
    OR content_row.interactive_completed_at IS NOT NULL;

  IF NOT already_completed
    AND lesson_row.type IN ('homework', 'practice', 'grammar', 'listening', 'checkpoint')
  THEN
    award_amount := GREATEST(0, COALESCE(lesson_row.stars_reward, normalized_rating));
  END IF;

  UPDATE public.content_items
  SET
    material_mode = 'interactive',
    submitted_at = COALESCE(submitted_at, now()),
    checked_at = now(),
    homework_status = 'reviewed',
    result_percent = bounded_score,
    star_rating = normalized_rating,
    student_result = 'Interactive completed',
    review_comment = COALESCE(NULLIF(review_comment, ''), 'Интерактивное задание выполнено автоматически.'),
    interactive_completed_at = now(),
    interactive_score_percent = bounded_score,
    interactive_attempts = COALESCE(interactive_attempts, 0) + 1,
    rewarded_stars = COALESCE(rewarded_stars, 0) + award_amount,
    updated_at = now()
  WHERE id = _content_item_id;

  IF award_amount > 0 THEN
    UPDATE public.profiles
    SET
      star_balance = COALESCE(star_balance, 0) + award_amount,
      total_stars_earned = COALESCE(total_stars_earned, 0) + award_amount,
      pending_celebration = COALESCE(pending_celebration, 0) + award_amount
    WHERE id = content_row.user_id;
  END IF;

  BEGIN
    INSERT INTO public.lesson_progress(user_id, lesson_id, stars_awarded)
    VALUES (content_row.user_id, _lesson_id, award_amount)
    ON CONFLICT (user_id, lesson_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  stars_awarded := award_amount;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_assigned_interactive_content(UUID, UUID, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';
