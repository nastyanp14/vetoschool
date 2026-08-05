CREATE OR REPLACE FUNCTION public.prevent_paid_access_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Backend contexts (service role / SECURITY DEFINER billing functions) run
  -- without an end-user JWT: auth.uid() is NULL. Those must be allowed to
  -- apply Stripe payment state; only real logged-in non-admin users are blocked.
  IF auth.uid() IS NULL OR private.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF (
    NEW.has_access IS DISTINCT FROM OLD.has_access
    OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.access_status IS DISTINCT FROM OLD.access_status
  ) THEN
    RAISE EXCEPTION 'Only admins can change paid access status';
  END IF;

  RETURN NEW;
END;
$$;