-- Repair assigned interactive practice visibility and completion state.
-- Non-destructive: lets students read their own assigned content and reconciles
-- assigned content rows when the child completed the same lesson from the map.

DROP POLICY IF EXISTS content_select_own ON public.content_items;
CREATE POLICY content_select_own
ON public.content_items
FOR SELECT
TO authenticated
USING (
  private.is_admin(auth.uid())
  OR private.teacher_can_access_student(auth.uid(), user_id)
  OR auth.uid() = user_id
);

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
  student_result = 'Interactive completed',
  review_comment = COALESCE(NULLIF(ci.review_comment, ''), 'Интерактивное задание выполнено автоматически.'),
  interactive_completed_at = COALESCE(ci.interactive_completed_at, lp.completed_at, now()),
  interactive_score_percent = COALESCE(ci.interactive_score_percent, ci.result_percent, 100),
  rewarded_stars = CASE
    WHEN COALESCE(ci.rewarded_stars, 0) > 0 THEN ci.rewarded_stars
    ELSE GREATEST(
      GREATEST(1, LEAST(5, CEIL(COALESCE(ci.interactive_score_percent, ci.result_percent, 100)::NUMERIC / 20)::INT)),
      LEAST(5, GREATEST(0, COALESCE(lp.stars_awarded, 0)))
    )
  END,
  updated_at = now()
FROM public.lesson_progress lp
WHERE ci.user_id = lp.user_id
  AND ci.interactive_lesson_id = lp.lesson_id
  AND ci.type IN ('homework', 'practice', 'grammar', 'listening', 'checkpoint')
  AND (
    ci.interactive_completed_at IS NULL
    OR ci.homework_status IS DISTINCT FROM 'reviewed'
    OR ci.star_rating IS NULL
    OR ci.interactive_score_percent IS NULL
  );

NOTIFY pgrst, 'reload schema';
