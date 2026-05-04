-- Defense in depth: enforce has_access immutability for self-update at the RLS layer
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND has_access IS NOT DISTINCT FROM (SELECT p.has_access FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Remove the duplicate public.is_admin to ensure only private.is_admin (used by RLS) exists
DROP FUNCTION IF EXISTS public.is_admin(uuid);