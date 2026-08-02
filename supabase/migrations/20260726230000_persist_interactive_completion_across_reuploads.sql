-- Persist assigned interactive completion across admin delete/re-upload flows.
-- A student's completed interactive lesson is the stable source of truth in
-- lesson_progress; content_items can be deleted and recreated by admins.

CREATE OR REPLACE FUNCTION public.repair_student_interactive_completion(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() IS NULL
    OR NOT (
      auth.uid() = _user_id
      OR private.is_admin(auth.uid())
      OR private.teacher_can_access_student(auth.uid(), _user_id)
    )
  THEN
    RAISE EXCEPTION 'Not allowed to repair this student content';
  END IF;

  INSERT INTO public.lesson_progress(user_id, lesson_id, stars_awarded)
  SELECT
    ci.user_id,
    ci.interactive_lesson_id,
    GREATEST(
      0,
      COALESCE(
        NULLIF(ci.rewarded_stars, 0),
        ci.star_rating,
        GREATEST(1, LEAST(5, CEIL(COALESCE(ci.interactive_score_percent, ci.result_percent, 100)::NUMERIC / 20)::INT)),
        0
      )
    )
  FROM public.content_items ci
  WHERE ci.user_id = _user_id
    AND ci.interactive_lesson_id IS NOT NULL
    AND ci.type IN ('homework', 'practice', 'grammar', 'listening', 'checkpoint')
    AND (
      ci.interactive_completed_at IS NOT NULL
      OR ci.homework_status = 'reviewed'
      OR ci.student_result = 'Interactive completed'
      OR ci.checked_at IS NOT NULL
    )
  ON CONFLICT (user_id, lesson_id) DO NOTHING;

  UPDATE public.content_items ci
  SET
    material_mode = 'interactive',
    submitted_at = COALESCE(ci.submitted_at, lp.completed_at, now()),
    checked_at = COALESCE(ci.checked_at, lp.completed_at, now()),
    homework_status = 'reviewed',
    result_percent = COALESCE(ci.result_percent, ci.interactive_score_percent, 100),
    star_rating = COALESCE(
      ci.star_rating,
      GREATEST(1, LEAST(5, CEIL(COALESCE(ci.interactive_score_percent, ci.result_percent, 100)::NUMERIC / 20)::INT))
    ),
    student_result = COALESCE(ci.student_result, 'Interactive completed'),
    review_comment = COALESCE(NULLIF(ci.review_comment, ''), 'Интерактивное задание выполнено автоматически.'),
    interactive_completed_at = COALESCE(ci.interactive_completed_at, lp.completed_at, now()),
    interactive_score_percent = COALESCE(ci.interactive_score_percent, ci.result_percent, 100),
    rewarded_stars = CASE
      WHEN COALESCE(ci.rewarded_stars, 0) > 0 THEN ci.rewarded_stars
      ELSE GREATEST(
        GREATEST(1, LEAST(5, CEIL(COALESCE(ci.interactive_score_percent, ci.result_percent, 100)::NUMERIC / 20)::INT)),
        GREATEST(0, COALESCE(lp.stars_awarded, 0))
      )
    END,
    updated_at = now()
  FROM public.lesson_progress lp
  WHERE ci.user_id = _user_id
    AND ci.user_id = lp.user_id
    AND ci.interactive_lesson_id = lp.lesson_id
    AND ci.type IN ('homework', 'practice', 'grammar', 'listening', 'checkpoint')
    AND (
      ci.interactive_completed_at IS NULL
      OR ci.homework_status IS DISTINCT FROM 'reviewed'
      OR ci.star_rating IS NULL
      OR ci.interactive_score_percent IS NULL
      OR ci.checked_at IS NULL
      OR ci.submitted_at IS NULL
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_student_interactive_completion(UUID) TO authenticated;

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
  progress_award INT := 0;
  award_amount INT := 0;
  inserted_progress_count INT := 0;
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
    OR content_row.interactive_completed_at IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.lesson_progress lp
      WHERE lp.user_id = content_row.user_id
        AND lp.lesson_id = _lesson_id
    );

  IF already_completed THEN
    progress_award := GREATEST(0, COALESCE(NULLIF(content_row.rewarded_stars, 0), content_row.star_rating, normalized_rating));
  ELSIF lesson_row.type IN ('homework', 'practice', 'grammar', 'listening', 'checkpoint') THEN
    progress_award := GREATEST(0, COALESCE(lesson_row.stars_reward, normalized_rating));
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

  UPDATE public.content_items ci
  SET
    material_mode = 'interactive',
    submitted_at = COALESCE(ci.submitted_at, now()),
    checked_at = now(),
    homework_status = 'reviewed',
    result_percent = bounded_score,
    star_rating = normalized_rating,
    student_result = 'Interactive completed',
    review_comment = COALESCE(NULLIF(ci.review_comment, ''), 'Интерактивное задание выполнено автоматически.'),
    interactive_completed_at = COALESCE(ci.interactive_completed_at, now()),
    interactive_score_percent = bounded_score,
    interactive_attempts = COALESCE(ci.interactive_attempts, 0) + 1,
    rewarded_stars = CASE
      WHEN COALESCE(ci.rewarded_stars, 0) > 0 THEN ci.rewarded_stars
      ELSE GREATEST(normalized_rating, progress_award)
    END,
    updated_at = now()
  WHERE ci.user_id = content_row.user_id
    AND ci.interactive_lesson_id = _lesson_id
    AND ci.type IN ('homework', 'practice', 'grammar', 'listening', 'checkpoint');

  stars_awarded := award_amount;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_assigned_interactive_content(UUID, UUID, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';
