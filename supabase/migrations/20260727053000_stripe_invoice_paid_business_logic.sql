ALTER TABLE public.stripe_payments
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'checkout.session.completed',
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;

ALTER TABLE public.stripe_payments
  ALTER COLUMN checkout_session_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_payments_invoice_id_unique
  ON public.stripe_payments(stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stripe_payments_event_type_created
  ON public.stripe_payments(event_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.apply_stripe_subscription_payment(
  p_user_id UUID,
  p_event_type TEXT,
  p_stripe_event_id TEXT,
  p_checkout_session_id TEXT,
  p_stripe_invoice_id TEXT,
  p_stripe_customer_id TEXT,
  p_stripe_subscription_id TEXT,
  p_stripe_price_id TEXT,
  p_subscription_status TEXT,
  p_plan_id TEXT,
  p_lesson_format TEXT,
  p_lessons_total INTEGER,
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ,
  p_next_payment_date TIMESTAMPTZ,
  p_customer_email TEXT,
  p_amount_total INTEGER,
  p_currency TEXT
)
RETURNS TABLE(payment_inserted BOOLEAN, lessons_remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_payment_id UUID;
  next_lessons_remaining INTEGER;
BEGIN
  IF p_event_type NOT IN ('checkout.session.completed', 'invoice.paid') THEN
    RAISE EXCEPTION 'unsupported_stripe_payment_event';
  END IF;

  IF p_lessons_total IS NULL OR p_lessons_total <= 0 THEN
    RAISE EXCEPTION 'invalid_lessons_total';
  END IF;

  INSERT INTO public.stripe_payments (
    user_id,
    event_type,
    stripe_event_id,
    checkout_session_id,
    stripe_invoice_id,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    subscription_status,
    plan_id,
    lesson_format,
    lessons_total,
    amount_total,
    currency,
    customer_email,
    current_period_start,
    current_period_end,
    next_payment_date
  )
  VALUES (
    p_user_id,
    p_event_type,
    p_stripe_event_id,
    p_checkout_session_id,
    p_stripe_invoice_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_stripe_price_id,
    p_subscription_status,
    p_plan_id,
    p_lesson_format,
    p_lessons_total,
    p_amount_total,
    lower(p_currency),
    lower(p_customer_email),
    p_current_period_start,
    p_current_period_end,
    p_next_payment_date
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO inserted_payment_id;

  IF inserted_payment_id IS NULL THEN
    UPDATE public.profiles
    SET
      subscription_status = p_subscription_status,
      payment_status = 'paid'::public.payment_status,
      current_period_start = p_current_period_start,
      current_period_end = p_current_period_end,
      next_payment_date = p_next_payment_date,
      updated_at = now()
    WHERE public.profiles.id = p_user_id
    RETURNING public.profiles.lessons_remaining INTO next_lessons_remaining;

    RETURN QUERY SELECT false, COALESCE(next_lessons_remaining, 0);
    RETURN;
  END IF;

  UPDATE public.profiles
  SET
    stripe_customer_id = p_stripe_customer_id,
    stripe_subscription_id = p_stripe_subscription_id,
    stripe_price_id = p_stripe_price_id,
    subscription_status = p_subscription_status,
    plan_id = p_plan_id,
    lesson_format = p_lesson_format,
    lessons_total = GREATEST(COALESCE(public.profiles.lessons_total, 0), 0) + p_lessons_total,
    lessons_remaining = GREATEST(COALESCE(public.profiles.lessons_remaining, 0), 0) + p_lessons_total,
    current_period_start = p_current_period_start,
    current_period_end = p_current_period_end,
    next_payment_date = p_next_payment_date,
    payment_status = 'paid'::public.payment_status,
    access_status = 'active'::public.access_status,
    updated_at = now()
  WHERE public.profiles.id = p_user_id
  RETURNING public.profiles.lessons_remaining INTO next_lessons_remaining;

  IF next_lessons_remaining IS NULL THEN
    RAISE EXCEPTION 'stripe_subscription_payment_profile_update_failed';
  END IF;

  RETURN QUERY SELECT true, next_lessons_remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stripe_subscription_payment(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INTEGER, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_stripe_subscription_payment(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INTEGER, TEXT
) TO service_role;
