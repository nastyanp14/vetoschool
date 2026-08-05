ALTER TABLE public.telegram_notifications
  ALTER COLUMN student_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS trial_booking_id uuid REFERENCES public.trial_bookings(id) ON DELETE CASCADE;

ALTER TABLE public.telegram_notifications
  DROP CONSTRAINT IF EXISTS telegram_notifications_subject_check;

ALTER TABLE public.telegram_notifications
  ADD CONSTRAINT telegram_notifications_subject_check
  CHECK (student_id IS NOT NULL OR trial_booking_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_telegram_notifications_trial_booking
  ON public.telegram_notifications(trial_booking_id)
  WHERE trial_booking_id IS NOT NULL;