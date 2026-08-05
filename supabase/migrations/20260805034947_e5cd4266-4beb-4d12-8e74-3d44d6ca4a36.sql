CREATE OR REPLACE FUNCTION public.email_otp_is_expired(_email text, _ttl_seconds integer DEFAULT 600)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT COALESCE(u.confirmation_sent_at, u.recovery_sent_at) < now() - make_interval(secs => GREATEST(60, LEAST(3600, _ttl_seconds)))
      FROM auth.users u
      WHERE lower(u.email) = lower(trim(_email))
      LIMIT 1
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.email_otp_is_expired(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.email_otp_is_expired(text, integer) TO anon, authenticated, service_role;