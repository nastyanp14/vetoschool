-- Email infrastructure for the NEW external Supabase project (SendPulse transport).
-- Replace <NEW_PROJECT_REF> and <SERVICE_ROLE_KEY> before running. Safe to re-run.
-- Run AFTER the public schema (email_send_state, email_send_log, RPC wrappers,
-- see supabase/migrations/20260805032106_email_infra.sql) exists in the new project.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- 1. Queues -------------------------------------------------------------------
DO $$ BEGIN PERFORM pgmq.create('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2. Vault secret used by the dispatcher (never hardcoded in function code) ----
SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'email_queue_service_role_key', 'Service role key for process-email-queue')
WHERE NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key');

-- 3. Dispatcher: called by cron while the queues are non-empty ----------------
CREATE OR REPLACE FUNCTION public.email_queue_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
     AND NOT EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
    BEGIN
      PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);
      IF EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
         OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
        RETURN;
      END IF;
      PERFORM cron.unschedule('process-email-queue');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_dispatch: cron unschedule failed: %', SQLERRM;
    END;
    RETURN;
  END IF;

  IF (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now() THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://<NEW_PROJECT_REF>.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
END;
$function$;

-- 4. Wake trigger: arms the cron job and pokes the worker on enqueue ----------
CREATE OR REPLACE FUNCTION public.email_queue_wake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    BEGIN
      PERFORM cron.schedule('process-email-queue', '5 seconds', $cron$ SELECT public.email_queue_dispatch(); $cron$);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_wake: cron schedule failed: %', SQLERRM;
    END;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://<NEW_PROJECT_REF>.supabase.co/functions/v1/process-email-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
        )
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'email_queue_wake failed (enqueue preserved): %', SQLERRM;
  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated, PUBLIC;

-- 5. Triggers on the queue tables --------------------------------------------
DROP TRIGGER IF EXISTS email_queue_wake_auth ON pgmq.q_auth_emails;
CREATE TRIGGER email_queue_wake_auth
AFTER INSERT ON pgmq.q_auth_emails
FOR EACH STATEMENT EXECUTE FUNCTION public.email_queue_wake();

DROP TRIGGER IF EXISTS email_queue_wake_transactional ON pgmq.q_transactional_emails;
CREATE TRIGGER email_queue_wake_transactional
AFTER INSERT ON pgmq.q_transactional_emails
FOR EACH STATEMENT EXECUTE FUNCTION public.email_queue_wake();

-- 6. Verify ------------------------------------------------------------------
-- SELECT jobname, schedule FROM cron.job;
-- SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname LIKE 'email_queue_wake%';
-- SELECT * FROM public.email_send_state;
-- SELECT status, count(*) FROM public.email_send_log GROUP BY status;
