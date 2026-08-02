CREATE TABLE IF NOT EXISTS public.admin_lesson_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  admin_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  previous_lessons_remaining INTEGER NOT NULL CHECK (previous_lessons_remaining >= 0),
  new_lessons_remaining INTEGER NOT NULL CHECK (new_lessons_remaining >= 0),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_lesson_adjustments_user_created
  ON public.admin_lesson_adjustments(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_lesson_adjustments_admin_created
  ON public.admin_lesson_adjustments(admin_user_id, created_at DESC);

ALTER TABLE public.admin_lesson_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_lesson_adjustments_select_admin" ON public.admin_lesson_adjustments;
CREATE POLICY "admin_lesson_adjustments_select_admin"
  ON public.admin_lesson_adjustments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "admin_lesson_adjustments_service_role_all" ON public.admin_lesson_adjustments;
CREATE POLICY "admin_lesson_adjustments_service_role_all"
  ON public.admin_lesson_adjustments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.admin_lesson_adjustments TO authenticated;
GRANT ALL ON public.admin_lesson_adjustments TO service_role;

CREATE OR REPLACE FUNCTION public.adjust_subscription_lessons_remaining(
  p_user_id UUID,
  p_new_lessons_remaining INTEGER,
  p_reason TEXT,
  p_idempotency_key TEXT
)
RETURNS TABLE(
  audit_id UUID,
  previous_lessons_remaining INTEGER,
  new_lessons_remaining INTEGER,
  delta INTEGER,
  inserted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_admin_id UUID := auth.uid();
  previous_remaining INTEGER;
  existing_adjustment public.admin_lesson_adjustments%ROWTYPE;
  inserted_adjustment public.admin_lesson_adjustments%ROWTYPE;
BEGIN
  IF current_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = current_admin_id
      AND ur.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can adjust lessons';
  END IF;

  IF p_new_lessons_remaining IS NULL OR p_new_lessons_remaining < 0 OR p_new_lessons_remaining > 1000 THEN
    RAISE EXCEPTION 'Invalid lessons_remaining value';
  END IF;

  IF p_idempotency_key IS NULL OR char_length(trim(p_idempotency_key)) < 12 THEN
    RAISE EXCEPTION 'Invalid idempotency key';
  END IF;

  IF p_reason IS NULL OR char_length(trim(p_reason)) < 6 THEN
    RAISE EXCEPTION 'Adjustment reason is required';
  END IF;

  SELECT *
  INTO existing_adjustment
  FROM public.admin_lesson_adjustments
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN QUERY SELECT
      existing_adjustment.id,
      existing_adjustment.previous_lessons_remaining,
      existing_adjustment.new_lessons_remaining,
      existing_adjustment.delta,
      false;
    RETURN;
  END IF;

  SELECT COALESCE(profiles.lessons_remaining, 0)
  INTO previous_remaining
  FROM public.profiles
  WHERE profiles.id = p_user_id
  FOR UPDATE;

  IF previous_remaining IS NULL THEN
    RAISE EXCEPTION 'Student profile not found';
  END IF;

  UPDATE public.profiles
  SET
    lessons_remaining = p_new_lessons_remaining,
    updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.admin_lesson_adjustments (
    idempotency_key,
    admin_user_id,
    user_id,
    previous_lessons_remaining,
    new_lessons_remaining,
    delta,
    reason
  )
  VALUES (
    trim(p_idempotency_key),
    current_admin_id,
    p_user_id,
    previous_remaining,
    p_new_lessons_remaining,
    p_new_lessons_remaining - previous_remaining,
    trim(p_reason)
  )
  RETURNING * INTO inserted_adjustment;

  RETURN QUERY SELECT
    inserted_adjustment.id,
    inserted_adjustment.previous_lessons_remaining,
    inserted_adjustment.new_lessons_remaining,
    inserted_adjustment.delta,
    true;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_subscription_lessons_remaining(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_subscription_lessons_remaining(UUID, INTEGER, TEXT, TEXT) TO authenticated;
