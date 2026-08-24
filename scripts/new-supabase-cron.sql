-- Cron configuration for the NEW external Supabase project.
-- Replace ggflcriakiudnejmiuwh before running, and set real secret values.
-- Run in the new project's SQL editor. Safe to re-run.

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
-- public.email_queue_dispatch() and public.email_queue_wake() came from the
-- backup with the OLD project URL baked into their bodies. Re-create both with
-- the new ref (bodies are otherwise unchanged) — see
-- supabase/migrations/20260805032106_email_infra.sql for the originals, and
-- replace every occurrence of the old *.supabase.co host with:
--   https://ggflcriakiudnejmiuwh.supabase.co/functions/v1/process-email-queue
--
-- Verify afterwards:
--   SELECT jobname, schedule FROM cron.job;
--   SELECT prosrc FROM pg_proc WHERE proname IN ('email_queue_dispatch','email_queue_wake');
