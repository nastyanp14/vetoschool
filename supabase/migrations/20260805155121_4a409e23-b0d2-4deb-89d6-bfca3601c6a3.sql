
-- 1) VIEW: security invoker
ALTER VIEW public.teacher_student_progress SET (security_invoker = on);

-- 2) search_path hardening
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.set_profiles_updated_at() SET search_path = public;
ALTER FUNCTION public.set_stripe_webhook_events_updated_at() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_telegram_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_trial_bookings_updated_at() SET search_path = public;

-- 3) Revoke EXECUTE on internal / trigger / backend-only functions
REVOKE EXECUTE ON FUNCTION public.cleanup_lesson_block_content_items() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_content_items_for_lesson_plan_block() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_content_items_for_schedule() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_teacher_restricted_self_update() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_profiles_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_stripe_webhook_events_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_telegram_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_trial_bookings_updated_at() FROM anon, authenticated;

-- 4) Signed-in-only RPCs: drop anonymous access
REVOKE EXECUTE ON FUNCTION public.complete_assigned_interactive_content(uuid, uuid, integer, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.disconnect_telegram_parent(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_interactive_tasks_for_lesson(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_student_content_items(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_visible_live_sessions() FROM anon;
REVOKE EXECUTE ON FUNCTION public.repair_student_interactive_completion(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_student_homework(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.teacher_review_homework(uuid, uuid, text, integer, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.teacher_start_lesson(uuid) FROM anon;

-- 5) Remove permissive SELECT policies
DROP POLICY IF EXISTS "it_select_auth" ON public.interactive_tasks;
DROP POLICY IF EXISTS "workbook_assignments_select_auth" ON public.workbook_assignments;

CREATE POLICY "workbook_assignments_select_scoped"
ON public.workbook_assignments
FOR SELECT
TO authenticated
USING (
  private.is_admin(auth.uid())
  OR user_id = auth.uid()
  OR (group_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.student_group_members m
    WHERE m.group_id = workbook_assignments.group_id AND m.user_id = auth.uid()
  ))
  OR (user_id IS NOT NULL AND private.teacher_can_access_student(auth.uid(), user_id))
  OR (group_id IS NOT NULL AND private.teacher_can_access_group(auth.uid(), group_id))
);

-- 6) Email tables: restrict to service_role grantee
DROP POLICY IF EXISTS "Service role can insert send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;
CREATE POLICY "email_send_log_service_only" ON public.email_send_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage send state" ON public.email_send_state;
CREATE POLICY "email_send_state_service_only" ON public.email_send_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;
CREATE POLICY "email_unsubscribe_tokens_service_only" ON public.email_unsubscribe_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON public.suppressed_emails;
DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;
CREATE POLICY "suppressed_emails_service_only" ON public.suppressed_emails
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.email_send_log, public.email_send_state, public.email_unsubscribe_tokens, public.suppressed_emails FROM anon, authenticated;
GRANT ALL ON public.email_send_log, public.email_send_state, public.email_unsubscribe_tokens, public.suppressed_emails TO service_role;

-- 7) Star / avatar integrity
CREATE OR REPLACE FUNCTION public.prevent_star_economy_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR private.is_admin(auth.uid())
     OR coalesce(current_setting('app.stars_rpc', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.star_balance IS DISTINCT FROM OLD.star_balance
     OR NEW.total_stars_earned IS DISTINCT FROM OLD.total_stars_earned
     OR NEW.pending_celebration IS DISTINCT FROM OLD.pending_celebration
     OR NEW.avatar_id IS DISTINCT FROM OLD.avatar_id THEN
    RAISE EXCEPTION 'Star balance and avatar can only be changed through the shop';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_star_self_update ON public.profiles;
CREATE TRIGGER profiles_prevent_star_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_star_economy_self_update();

REVOKE EXECUTE ON FUNCTION public.prevent_star_economy_self_update() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.avatar_cost(_avatar_id text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _avatar_id LIKE 'c-%' THEN 10
    WHEN _avatar_id LIKE 'r-%' THEN 30
    WHEN _avatar_id LIKE 'e-%' THEN 60
    WHEN _avatar_id LIKE 'l-%' THEN 100
    ELSE NULL
  END;
$$;
REVOKE EXECUTE ON FUNCTION public.avatar_cost(text) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.purchase_avatar(_avatar_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cost integer;
  balance integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  cost := public.avatar_cost(_avatar_id);
  IF cost IS NULL THEN RAISE EXCEPTION 'Unknown avatar'; END IF;

  PERFORM set_config('app.stars_rpc', 'on', true);

  SELECT star_balance INTO balance FROM public.profiles WHERE id = uid FOR UPDATE;
  IF balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.avatar_purchases WHERE user_id = uid AND avatar_id = _avatar_id) THEN
    RETURN balance;
  END IF;

  IF balance < cost THEN RAISE EXCEPTION 'Not enough stars'; END IF;

  INSERT INTO public.avatar_purchases (user_id, avatar_id) VALUES (uid, _avatar_id);
  UPDATE public.profiles SET star_balance = balance - cost WHERE id = uid;
  RETURN balance - cost;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.purchase_avatar(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.purchase_avatar(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.equip_avatar(_avatar_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _avatar_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.avatar_purchases WHERE user_id = uid AND avatar_id = _avatar_id
  ) THEN
    RAISE EXCEPTION 'Avatar not owned';
  END IF;

  PERFORM set_config('app.stars_rpc', 'on', true);
  UPDATE public.profiles SET avatar_id = _avatar_id WHERE id = uid;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.equip_avatar(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.equip_avatar(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_star_celebration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM set_config('app.stars_rpc', 'on', true);
  UPDATE public.profiles SET pending_celebration = 0 WHERE id = uid;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.clear_star_celebration() FROM anon;
GRANT EXECUTE ON FUNCTION public.clear_star_celebration() TO authenticated;
