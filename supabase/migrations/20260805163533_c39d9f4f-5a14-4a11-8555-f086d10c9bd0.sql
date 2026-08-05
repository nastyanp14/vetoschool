-- 1. Anon-executable SECURITY DEFINER function: user-enumeration oracle over auth.users
REVOKE EXECUTE ON FUNCTION public.email_otp_is_expired(text, integer) FROM PUBLIC, anon, authenticated;

-- 2. Admin-only repair helper should not be callable by regular signed-in users
REVOKE EXECUTE ON FUNCTION public.repair_stripe_profile_sync(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repair_stripe_profile_sync(uuid) TO service_role;

-- 3. Billing columns: pin them in the self-update policy in addition to the guard trigger
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND (
    private.is_admin(auth.uid())
    OR (
      has_access IS NOT DISTINCT FROM (SELECT p.has_access FROM public.profiles p WHERE p.id = auth.uid())
      AND payment_status IS NOT DISTINCT FROM (SELECT p.payment_status FROM public.profiles p WHERE p.id = auth.uid())
      AND access_status IS NOT DISTINCT FROM (SELECT p.access_status FROM public.profiles p WHERE p.id = auth.uid())
      AND stripe_customer_id IS NOT DISTINCT FROM (SELECT p.stripe_customer_id FROM public.profiles p WHERE p.id = auth.uid())
      AND stripe_subscription_id IS NOT DISTINCT FROM (SELECT p.stripe_subscription_id FROM public.profiles p WHERE p.id = auth.uid())
      AND stripe_price_id IS NOT DISTINCT FROM (SELECT p.stripe_price_id FROM public.profiles p WHERE p.id = auth.uid())
      AND subscription_status IS NOT DISTINCT FROM (SELECT p.subscription_status FROM public.profiles p WHERE p.id = auth.uid())
      AND plan_id IS NOT DISTINCT FROM (SELECT p.plan_id FROM public.profiles p WHERE p.id = auth.uid())
      AND lessons_total IS NOT DISTINCT FROM (SELECT p.lessons_total FROM public.profiles p WHERE p.id = auth.uid())
      AND lessons_remaining IS NOT DISTINCT FROM (SELECT p.lessons_remaining FROM public.profiles p WHERE p.id = auth.uid())
      AND manual_access_override IS NOT DISTINCT FROM (SELECT p.manual_access_override FROM public.profiles p WHERE p.id = auth.uid())
    )
  )
);
