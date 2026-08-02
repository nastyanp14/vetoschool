ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.apply_stripe_subscription_state(
  p_user_id UUID,
  p_stripe_customer_id TEXT,
  p_stripe_subscription_id TEXT,
  p_subscription_status TEXT,
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ,
  p_next_payment_date TIMESTAMPTZ,
  p_cancel_at_period_end BOOLEAN,
  p_canceled_at TIMESTAMPTZ,
  p_stripe_price_id TEXT,
  p_plan_id TEXT,
  p_lesson_format TEXT
)
RETURNS TABLE(lessons_remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_lessons_remaining INTEGER;
BEGIN
  UPDATE public.profiles
  SET
    subscription_status = p_subscription_status,
    current_period_start = p_current_period_start,
    current_period_end = p_current_period_end,
    next_payment_date = p_next_payment_date,
    cancel_at_period_end = COALESCE(p_cancel_at_period_end, false),
    canceled_at = p_canceled_at,
    stripe_price_id = COALESCE(p_stripe_price_id, public.profiles.stripe_price_id),
    plan_id = COALESCE(p_plan_id, public.profiles.plan_id),
    lesson_format = COALESCE(p_lesson_format, public.profiles.lesson_format),
    updated_at = now()
  WHERE public.profiles.id = p_user_id
    AND public.profiles.stripe_customer_id = p_stripe_customer_id
    AND public.profiles.stripe_subscription_id = p_stripe_subscription_id
  RETURNING public.profiles.lessons_remaining INTO current_lessons_remaining;

  IF current_lessons_remaining IS NULL THEN
    RAISE EXCEPTION 'stripe_subscription_state_profile_update_failed';
  END IF;

  RETURN QUERY SELECT current_lessons_remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stripe_subscription_state(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_stripe_subscription_state(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ, TEXT, TEXT, TEXT
) TO service_role;
