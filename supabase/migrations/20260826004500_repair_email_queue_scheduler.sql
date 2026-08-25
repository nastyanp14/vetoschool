-- Repair production email queue scheduling after the Supabase project move.
-- This migration intentionally does not read, send, delete, or move existing
-- pgmq queued/DLQ messages.

CREATE OR REPLACE FUNCTION public.email_queue_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pgmq.q_auth_emails WHERE vt <= now()
  ) AND NOT EXISTS (
    SELECT 1 FROM pgmq.q_transactional_emails WHERE vt <= now()
  ) THEN
    RETURN;
  END IF;

  IF COALESCE(
    (SELECT retry_after_until FROM public.email_send_state WHERE id = 1),
    '-infinity'::timestamptz
  ) > now() THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://ggflcriakiudnejmiuwh.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.email_queue_wake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);

  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'process-email-queue'
      AND (
        active IS DISTINCT FROM true
        OR schedule <> '* * * * *'
        OR command <> 'SELECT public.email_queue_dispatch();'
      )
  ) THEN
    PERFORM cron.unschedule('process-email-queue');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'process-email-queue'
      AND active IS true
      AND schedule = '* * * * *'
      AND command = 'SELECT public.email_queue_dispatch();'
  ) THEN
    PERFORM cron.schedule(
      'process-email-queue',
      '* * * * *',
      'SELECT public.email_queue_dispatch();'
    );
  END IF;

  PERFORM net.http_post(
    url := 'https://ggflcriakiudnejmiuwh.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'email_queue_wake failed (enqueue preserved): %', SQLERRM;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    PERFORM cron.unschedule('process-email-queue');
  END IF;

  PERFORM cron.schedule(
    'process-email-queue',
    '* * * * *',
    'SELECT public.email_queue_dispatch();'
  );
END $$;
