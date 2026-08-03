CREATE TABLE IF NOT EXISTS public.admin_access_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  previous_access_status text,
  new_access_status text,
  previous_payment_status text,
  new_payment_status text,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admin_access_overrides TO authenticated;
GRANT ALL ON public.admin_access_overrides TO service_role;

ALTER TABLE public.admin_access_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_select_access_overrides" ON public.admin_access_overrides;
CREATE POLICY "admins_select_access_overrides"
ON public.admin_access_overrides FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins_insert_access_overrides" ON public.admin_access_overrides;
CREATE POLICY "admins_insert_access_overrides"
ON public.admin_access_overrides FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS admin_access_overrides_user_idx
  ON public.admin_access_overrides (user_id, created_at DESC);

-- Rebuild a student's subscription state from recorded Stripe payments
CREATE OR REPLACE FUNCTION public.repair_stripe_profile_sync(p_user_id uuid)
RETURNS TABLE(lessons_total integer, lessons_remaining integer, subscription_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_lessons integer := 0;
  consumed integer := 0;
  latest public.stripe_payments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can repair subscription sync';
  END IF;

  SELECT COALESCE(SUM(sp.lessons_total), 0) INTO total_lessons
  FROM public.stripe_payments sp
  WHERE sp.user_id = p_user_id;

  SELECT GREATEST(0, COALESCE(p.lessons_total, 0) - COALESCE(p.lessons_remaining, 0))
  INTO consumed
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF consumed IS NULL THEN
    RAISE EXCEPTION 'Student profile not found';
  END IF;

  SELECT * INTO latest
  FROM public.stripe_payments sp
  WHERE sp.user_id = p_user_id
  ORDER BY sp.paid_at DESC
  LIMIT 1;

  UPDATE public.profiles p
  SET
    lessons_total = total_lessons,
    lessons_remaining = GREATEST(0, total_lessons - consumed),
    stripe_customer_id = COALESCE(latest.stripe_customer_id, p.stripe_customer_id),
    stripe_subscription_id = COALESCE(latest.stripe_subscription_id, p.stripe_subscription_id),
    stripe_price_id = COALESCE(latest.stripe_price_id, p.stripe_price_id),
    plan_id = COALESCE(latest.plan_id, p.plan_id),
    lesson_format = COALESCE(latest.lesson_format, p.lesson_format),
    subscription_status = COALESCE(latest.subscription_status, p.subscription_status),
    current_period_start = COALESCE(latest.current_period_start, p.current_period_start),
    current_period_end = COALESCE(latest.current_period_end, p.current_period_end),
    next_payment_date = COALESCE(latest.next_payment_date, p.next_payment_date),
    payment_status = CASE WHEN latest.id IS NOT NULL THEN 'paid'::public.payment_status ELSE p.payment_status END,
    access_status = CASE WHEN latest.id IS NOT NULL THEN 'active'::public.access_status ELSE p.access_status END,
    updated_at = now()
  WHERE p.id = p_user_id;

  RETURN QUERY
  SELECT p.lessons_total, p.lessons_remaining, p.subscription_status
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.repair_stripe_profile_sync(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_stripe_profile_sync(uuid) TO authenticated, service_role;