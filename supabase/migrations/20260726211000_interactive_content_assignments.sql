-- Connect admin-assigned lesson blocks to existing interactive workbook lessons.
-- Non-destructive: only adds metadata columns, widens existing block-kind checks,
-- and creates one RPC used by students to complete assigned interactive content.

ALTER TABLE public.lesson_plan_blocks
  ADD COLUMN IF NOT EXISTS material_mode TEXT NOT NULL DEFAULT 'file_link';

ALTER TABLE public.lesson_plan_blocks
  DROP CONSTRAINT IF EXISTS lesson_plan_blocks_block_kind_check;

ALTER TABLE public.lesson_plan_blocks
  ADD CONSTRAINT lesson_plan_blocks_block_kind_check
  CHECK (block_kind IN ('theory', 'class_task', 'homework', 'practice', 'grammar', 'listening', 'checkpoint'));

ALTER TABLE public.lesson_plan_blocks
  DROP CONSTRAINT IF EXISTS lesson_plan_blocks_material_mode_check;

ALTER TABLE public.lesson_plan_blocks
  ADD CONSTRAINT lesson_plan_blocks_material_mode_check
  CHECK (material_mode IN ('file_link', 'interactive'));

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS interactive_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS interactive_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interactive_score_percent INT,
  ADD COLUMN IF NOT EXISTS interactive_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS material_mode TEXT NOT NULL DEFAULT 'file_link',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS result_percent INT,
  ADD COLUMN IF NOT EXISTS errors_count INT,
  ADD COLUMN IF NOT EXISTS teacher_comment TEXT,
  ADD COLUMN IF NOT EXISTS student_result TEXT,
  ADD COLUMN IF NOT EXISTS rewarded_stars INT NOT NULL DEFAULT 0;

ALTER TABLE public.content_items
  DROP CONSTRAINT IF EXISTS content_items_material_mode_check;

ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_material_mode_check
  CHECK (material_mode IN ('file_link', 'interactive'));

CREATE INDEX IF NOT EXISTS idx_content_items_interactive_lesson
  ON public.content_items(interactive_lesson_id)
  WHERE interactive_lesson_id IS NOT NULL;

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
  rating INT;
  award_amount INT := 0;
  inserted_progress_id UUID;
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

  rating := GREATEST(1, LEAST(5, CEIL(bounded_score::NUMERIC / 20)::INT));
  award_amount := CASE
    WHEN lesson_row.type IN ('homework', 'practice', 'checkpoint') THEN GREATEST(0, COALESCE(lesson_row.stars_reward, rating))
    ELSE 0
  END;

  IF COALESCE(content_row.rewarded_stars, 0) > 0 THEN
    award_amount := 0;
    already_completed := TRUE;
  ELSE
    INSERT INTO public.lesson_progress(user_id, lesson_id, stars_awarded)
    VALUES (content_row.user_id, _lesson_id, award_amount)
    ON CONFLICT (user_id, lesson_id) DO NOTHING
    RETURNING id, stars_awarded INTO inserted_progress_id, award_amount;

    already_completed := inserted_progress_id IS NULL;
    IF already_completed THEN
      award_amount := 0;
    END IF;
  END IF;

  IF award_amount > 0 THEN
    UPDATE public.profiles
    SET
      star_balance = COALESCE(star_balance, 0) + award_amount,
      total_stars_earned = COALESCE(total_stars_earned, 0) + award_amount,
      pending_celebration = COALESCE(pending_celebration, 0) + award_amount
    WHERE id = content_row.user_id;
  END IF;

  UPDATE public.content_items
  SET
    material_mode = 'interactive',
    submitted_at = COALESCE(submitted_at, now()),
    checked_at = now(),
    homework_status = 'reviewed',
    result_percent = bounded_score,
    star_rating = rating,
    student_result = 'Interactive completed',
    review_comment = COALESCE(NULLIF(review_comment, ''), 'Интерактивное задание выполнено автоматически.'),
    interactive_completed_at = now(),
    interactive_score_percent = bounded_score,
    interactive_attempts = COALESCE(interactive_attempts, 0) + 1,
    rewarded_stars = COALESCE(rewarded_stars, 0) + award_amount,
    updated_at = now()
  WHERE id = _content_item_id;

  stars_awarded := award_amount;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_assigned_interactive_content(UUID, UUID, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';
