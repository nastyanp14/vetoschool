-- Restore runtime privileges for server-side Supabase clients used by
-- production Edge Functions. The service_role key must remain server-side only;
-- anon/authenticated RLS policies are not changed here.

GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA private TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.trial_bookings TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.trial_booking_rate_limits TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.telegram_notifications TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.telegram_parent_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.telegram_link_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.notification_log TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.transactional_emails TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.email_send_log TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.email_send_state TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.email_unsubscribe_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.suppressed_emails TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.email_notifications TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.stripe_payments TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.stripe_payment_failures TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.stripe_refunds TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.stripe_webhook_events TO service_role;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_stripe_subscription_payment(
  uuid, text, text, text, text, text, text, text, text, text, text, integer,
  timestamp with time zone, timestamp with time zone, timestamp with time zone,
  text, integer, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_stripe_invoice_payment_failed(
  uuid, text, text, text, text, text, timestamp with time zone,
  timestamp with time zone, integer, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.link_telegram_parent(text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.disconnect_telegram_parent(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO service_role;
