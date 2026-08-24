-- Cron configuration for the NEW external Supabase project.
-- Project ref: ggflcriakiudnejmiuwh. Replace <TELEGRAM_CRON_SECRET> / <SERVICE_ROLE_KEY> placeholders.
-- Run in the new project's SQL editor AFTER scripts/new-supabase-email-queue.sql. Safe to re-run.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 1. Vault secrets used by the jobs -------------------------------------------
-- Shared token checked by telegram-notifications (must equal the
-- TELEGRAM_CRON_SECRET edge function secret).
SELECT vault.create_secret('<TELEGRAM_CRON_SECRET>', 'telegram_cron_secret', 'Cron token for telegram-notifications')
WHERE NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'telegram_cron_secret');

-- Service role key used by the email queue dispatcher.
SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'email_queue_service_role_key', 'Service role key for process-email-queue')
WHERE NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key');

-- 2. Telegram due-notification job (every minute) -----------------------------
SELECT cron.unschedule('telegram-process-due')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-process-due');

SELECT cron.schedule(
  'telegram-process-due',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ggflcriakiudnejmiuwh.supabase.co/functions/v1/telegram-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'telegram_cron_secret')
    ),
    body := jsonb_build_object('action', 'process_due', 'limit', 50)
  );
  $$
);

-- 3. Email queue dispatcher --------------------------------------------------
-- Already created by scripts/new-supabase-email-queue.sql (functions
-- public.email_queue_dispatch() / public.email_queue_wake() plus the wake
-- triggers, all pointing at
--   https://ggflcriakiudnejmiuwh.supabase.co/functions/v1/process-email-queue
-- The 'process-email-queue' cron job is self-arming: the wake trigger schedules
-- it on enqueue and the dispatcher unschedules it when both queues drain.
--
-- 4. Verify -------------------------------------------------------------------
--   SELECT jobname, schedule FROM cron.job;
--   SELECT prosrc FROM pg_proc WHERE proname IN ('email_queue_dispatch','email_queue_wake');
--   SELECT name FROM vault.decrypted_secrets;
