-- 1. Синхронизация meeting_url <-> lesson_url в заявках на пробный урок
UPDATE public.trial_bookings SET meeting_url = lesson_url WHERE meeting_url IS NULL AND lesson_url IS NOT NULL;
UPDATE public.trial_bookings SET lesson_url = meeting_url WHERE lesson_url IS NULL AND meeting_url IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_trial_meeting_url()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.meeting_url IS NULL THEN NEW.meeting_url := NEW.lesson_url; END IF;
    IF NEW.lesson_url IS NULL THEN NEW.lesson_url := NEW.meeting_url; END IF;
    RETURN NEW;
  END IF;

  IF NEW.meeting_url IS DISTINCT FROM OLD.meeting_url THEN
    NEW.lesson_url := NEW.meeting_url;
  ELSIF NEW.lesson_url IS DISTINCT FROM OLD.lesson_url THEN
    NEW.meeting_url := NEW.lesson_url;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trial_bookings_sync_meeting_url ON public.trial_bookings;
CREATE TRIGGER trial_bookings_sync_meeting_url
BEFORE INSERT OR UPDATE ON public.trial_bookings
FOR EACH ROW EXECUTE FUNCTION public.sync_trial_meeting_url();

-- 2. Провайдер отправки писем: Lovable Email
ALTER TABLE public.transactional_emails ALTER COLUMN provider SET DEFAULT 'lovable_email';
ALTER TABLE public.email_send_log ALTER COLUMN provider SET DEFAULT 'lovable_email';
ALTER TABLE public.notification_log ALTER COLUMN provider SET DEFAULT 'lovable_email';
UPDATE public.transactional_emails SET provider = 'lovable_email' WHERE provider IS DISTINCT FROM 'lovable_email';
UPDATE public.email_send_log SET provider = 'lovable_email' WHERE provider IS DISTINCT FROM 'lovable_email';
UPDATE public.notification_log SET provider = 'lovable_email' WHERE channel = 'email' AND provider IS DISTINCT FROM 'lovable_email';