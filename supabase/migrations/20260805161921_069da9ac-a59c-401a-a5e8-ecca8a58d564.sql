-- 1. Pin billing/subscription columns on profiles for non-admin writers
CREATE OR REPLACE FUNCTION public.prevent_billing_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR private.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  NEW.stripe_price_id := OLD.stripe_price_id;
  NEW.subscription_status := OLD.subscription_status;
  NEW.plan_id := OLD.plan_id;
  NEW.lesson_format := OLD.lesson_format;
  NEW.lessons_total := OLD.lessons_total;
  NEW.lessons_remaining := OLD.lessons_remaining;
  NEW.current_period_start := OLD.current_period_start;
  NEW.current_period_end := OLD.current_period_end;
  NEW.next_payment_date := OLD.next_payment_date;
  NEW.payment_failed_at := OLD.payment_failed_at;
  NEW.cancel_at_period_end := OLD.cancel_at_period_end;
  NEW.canceled_at := OLD.canceled_at;
  NEW.manual_access_override := OLD.manual_access_override;
  NEW.manual_access_override_by := OLD.manual_access_override_by;
  NEW.manual_access_override_at := OLD.manual_access_override_at;
  NEW.manual_access_override_reason := OLD.manual_access_override_reason;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_billing_self_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_billing_self_update_trg ON public.profiles;
CREATE TRIGGER prevent_billing_self_update_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_billing_self_update();

-- 2. Revoke anon EXECUTE on SECURITY DEFINER functions (keep the pre-login OTP check)
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname <> 'email_otp_is_expired'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn.sig);
  END LOOP;
END;
$$;

-- 3. Scope lesson-audio storage reads
CREATE OR REPLACE FUNCTION private.can_read_lesson_audio(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      private.is_admin(auth.uid())
      OR private.teacher_id_for_user(auth.uid()) IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM public.dictionary_words dw
        WHERE dw.audio_url = _name AND dw.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.content_items ci
        WHERE ci.file_url = _name AND ci.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.interactive_tasks it
        JOIN public.lessons l ON l.id = it.lesson_id
        WHERE it.payload_json::text LIKE '%' || _name || '%'
          AND private.has_active_access(auth.uid())
          AND (
            l.is_global
            OR EXISTS (
              SELECT 1 FROM public.lesson_assignments la
              WHERE la.lesson_id = l.id AND la.user_id = auth.uid()
            )
          )
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION private.can_read_lesson_audio(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_read_lesson_audio(text) TO authenticated, service_role;

DROP POLICY IF EXISTS lesson_audio_authenticated_read ON storage.objects;
CREATE POLICY lesson_audio_scoped_read
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'lesson-audio' AND private.can_read_lesson_audio(name));