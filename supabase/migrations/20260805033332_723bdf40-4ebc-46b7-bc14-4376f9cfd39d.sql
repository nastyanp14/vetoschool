ALTER TABLE public.telegram_notifications
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS skipped_reason text;

CREATE INDEX IF NOT EXISTS idx_telegram_notifications_due
  ON public.telegram_notifications (status, scheduled_for);