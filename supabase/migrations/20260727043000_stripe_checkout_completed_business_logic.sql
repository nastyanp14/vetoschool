ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS plan_id TEXT,
  ADD COLUMN IF NOT EXISTS lesson_format TEXT,
  ADD COLUMN IF NOT EXISTS lessons_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lessons_remaining INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_payment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON public.profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id
  ON public.profiles(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.stripe_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  stripe_event_id TEXT NOT NULL UNIQUE,
  checkout_session_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  subscription_status TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  lesson_format TEXT NOT NULL,
  lessons_total INTEGER NOT NULL CHECK (lessons_total > 0),
  amount_total INTEGER,
  currency TEXT,
  customer_email TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  next_payment_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_payments_user_created
  ON public.stripe_payments(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_payments_subscription
  ON public.stripe_payments(stripe_subscription_id);

ALTER TABLE public.stripe_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stripe_payments_service_role_all" ON public.stripe_payments;
CREATE POLICY "stripe_payments_service_role_all"
  ON public.stripe_payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "stripe_payments_select_own" ON public.stripe_payments;
CREATE POLICY "stripe_payments_select_own"
  ON public.stripe_payments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

GRANT ALL ON public.stripe_payments TO service_role;
GRANT SELECT ON public.stripe_payments TO authenticated;

CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profiles_updated_at();

CREATE OR REPLACE FUNCTION public.apply_stripe_checkout_completed(
  p_user_id UUID,
  p_stripe_event_id TEXT,
  p_checkout_session_id TEXT,
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
  INSERT INTO public.stripe_payments (
    user_id,
    stripe_event_id,
    checkout_session_id,
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
    p_stripe_event_id,
    p_checkout_session_id,
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
  ON CONFLICT (stripe_event_id) DO NOTHING
  RETURNING id INTO inserted_payment_id;

  IF inserted_payment_id IS NULL THEN
    SELECT profiles.lessons_remaining
    INTO next_lessons_remaining
    FROM public.profiles
    WHERE profiles.id = p_user_id;

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
    RAISE EXCEPTION 'stripe_checkout_profile_update_failed';
  END IF;

  RETURN QUERY SELECT true, next_lessons_remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stripe_checkout_completed(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INTEGER, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_stripe_checkout_completed(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INTEGER, TEXT
) TO service_role;
