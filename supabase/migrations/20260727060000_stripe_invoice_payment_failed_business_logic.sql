ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'failed';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.stripe_payment_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  stripe_event_id TEXT NOT NULL UNIQUE,
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  amount_due INTEGER,
  currency TEXT,
  status TEXT NOT NULL DEFAULT 'failed' CHECK (status = 'failed'),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_payment_failures_user_created
  ON public.stripe_payment_failures(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_payment_failures_subscription
  ON public.stripe_payment_failures(stripe_subscription_id);

ALTER TABLE public.stripe_payment_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stripe_payment_failures_service_role_all" ON public.stripe_payment_failures;
CREATE POLICY "stripe_payment_failures_service_role_all"
  ON public.stripe_payment_failures
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "stripe_payment_failures_select_own" ON public.stripe_payment_failures;
CREATE POLICY "stripe_payment_failures_select_own"
  ON public.stripe_payment_failures
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

GRANT ALL ON public.stripe_payment_failures TO service_role;
GRANT SELECT ON public.stripe_payment_failures TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_stripe_invoice_payment_failed(
  p_user_id UUID,
  p_stripe_event_id TEXT,
  p_stripe_invoice_id TEXT,
  p_stripe_customer_id TEXT,
  p_stripe_subscription_id TEXT,
  p_subscription_status TEXT,
  p_payment_failed_at TIMESTAMPTZ,
  p_next_payment_date TIMESTAMPTZ,
  p_amount_due INTEGER,
  p_currency TEXT,
  p_failure_reason TEXT
)
RETURNS TABLE(failure_inserted BOOLEAN, lessons_remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_failure_id UUID;
  current_lessons_remaining INTEGER;
BEGIN
  INSERT INTO public.stripe_payment_failures (
    user_id,
    stripe_event_id,
    stripe_invoice_id,
    stripe_customer_id,
    stripe_subscription_id,
    amount_due,
    currency,
    status,
    failure_reason,
    created_at
  )
  VALUES (
    p_user_id,
    p_stripe_event_id,
    p_stripe_invoice_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_amount_due,
    lower(p_currency),
    'failed',
    left(p_failure_reason, 1000),
    COALESCE(p_payment_failed_at, now())
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO inserted_failure_id;

  UPDATE public.profiles
  SET
    subscription_status = p_subscription_status,
    payment_status = 'failed'::public.payment_status,
    payment_failed_at = COALESCE(p_payment_failed_at, now()),
    next_payment_date = p_next_payment_date,
    updated_at = now()
  WHERE public.profiles.id = p_user_id
  RETURNING public.profiles.lessons_remaining INTO current_lessons_remaining;

  IF current_lessons_remaining IS NULL THEN
    RAISE EXCEPTION 'stripe_invoice_failed_profile_update_failed';
  END IF;

  RETURN QUERY SELECT inserted_failure_id IS NOT NULL, current_lessons_remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stripe_invoice_payment_failed(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_stripe_invoice_payment_failed(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TEXT, TEXT
) TO service_role;
