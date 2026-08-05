CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT vault.create_secret(
  'k13ilkWJhUeVI9PHSfGY1RiOrzcWsd6Q',
  'telegram_cron_secret',
  'Shared token used by the telegram notification cron job'
)
WHERE NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'telegram_cron_secret');

SELECT cron.unschedule('telegram-process-due')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-process-due');

SELECT cron.schedule(
  'telegram-process-due',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://teapriepxqctgjfhposm.supabase.co/functions/v1/telegram-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'telegram_cron_secret')
    ),
    body := jsonb_build_object('action', 'process_due', 'limit', 50)
  );
  $$
);