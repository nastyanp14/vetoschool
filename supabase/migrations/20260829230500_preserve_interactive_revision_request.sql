-- Interactive progress repair must not erase a teacher's explicit request for
-- revision. Completion metadata remains repairable, while the review workflow
-- stays in revision_requested until a later student/teacher action changes it.

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
      OR ci.homework_status IN ('reviewed', 'revision_requested')
      OR ci.student_result IN ('Interactive completed', 'Revision Requested')
      OR ci.checked_at IS NOT NULL
    )
  ON CONFLICT (user_id, lesson_id) DO NOTHING;

  UPDATE public.content_items ci
  SET
    material_mode = 'interactive',
    submitted_at = COALESCE(ci.submitted_at, lp.completed_at, now()),
    checked_at = COALESCE(ci.checked_at, lp.completed_at, now()),
    homework_status = CASE
      WHEN ci.homework_status = 'revision_requested' THEN 'revision_requested'
      ELSE 'reviewed'
    END,
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
      OR ci.homework_status IS NULL
      OR ci.homework_status NOT IN ('reviewed', 'revision_requested')
      OR ci.star_rating IS NULL
      OR ci.interactive_score_percent IS NULL
      OR ci.checked_at IS NULL
      OR ci.submitted_at IS NULL
    );
END;
$$;

REVOKE ALL ON FUNCTION public.repair_student_interactive_completion(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_student_interactive_completion(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
