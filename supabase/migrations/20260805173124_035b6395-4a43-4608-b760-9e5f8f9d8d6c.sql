ALTER TABLE public.trial_bookings ADD COLUMN IF NOT EXISTS lesson_url TEXT;
ALTER TABLE public.student_groups ADD COLUMN IF NOT EXISTS lesson_url TEXT;

CREATE OR REPLACE FUNCTION public.validate_lesson_url()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  url TEXT;
BEGIN
  IF TG_TABLE_NAME = 'trial_bookings' THEN
    url := NULLIF(btrim(NEW.lesson_url), '');
    NEW.lesson_url := url;
    IF url IS NOT NULL AND url !~* '^https://[^\s]+\.[^\s]+' THEN
      RAISE EXCEPTION 'invalid_lesson_url';
    END IF;
    IF NEW.status = 'confirmed' AND url IS NULL THEN
      RAISE EXCEPTION 'lesson_url_required_for_confirmation';
    END IF;
  ELSE
    url := NULLIF(btrim(NEW.lesson_url), '');
    NEW.lesson_url := url;
    IF url IS NOT NULL AND url !~* '^https://[^\s]+\.[^\s]+' THEN
      RAISE EXCEPTION 'invalid_lesson_url';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_trial_lesson_url ON public.trial_bookings;
CREATE TRIGGER validate_trial_lesson_url
BEFORE INSERT OR UPDATE ON public.trial_bookings
FOR EACH ROW EXECUTE FUNCTION public.validate_lesson_url();

DROP TRIGGER IF EXISTS validate_group_lesson_url ON public.student_groups;
CREATE TRIGGER validate_group_lesson_url
BEFORE INSERT OR UPDATE ON public.student_groups
FOR EACH ROW EXECUTE FUNCTION public.validate_lesson_url();

CREATE OR REPLACE FUNCTION public.apply_group_lesson_url()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  group_url TEXT;
BEGIN
  NEW.online_url := NULLIF(btrim(NEW.online_url), '');
  IF NEW.online_url IS NULL AND NEW.group_id IS NOT NULL THEN
    SELECT NULLIF(btrim(sg.lesson_url), '') INTO group_url
    FROM public.student_groups sg
    WHERE sg.id = NEW.group_id;
    NEW.online_url := group_url;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_group_lesson_url_trigger ON public.schedules;
CREATE TRIGGER apply_group_lesson_url_trigger
BEFORE INSERT OR UPDATE OF group_id, online_url ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.apply_group_lesson_url();

CREATE OR REPLACE FUNCTION public.propagate_group_lesson_url()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.lesson_url IS DISTINCT FROM OLD.lesson_url AND NEW.lesson_url IS NOT NULL THEN
    UPDATE public.schedules s
    SET online_url = NEW.lesson_url, updated_at = now()
    WHERE s.group_id = NEW.id
      AND COALESCE(s.is_conducted, false) = false
      AND COALESCE(s.lesson_status, 'planned') NOT IN ('cancelled', 'completed');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propagate_group_lesson_url_trigger ON public.student_groups;
CREATE TRIGGER propagate_group_lesson_url_trigger
AFTER UPDATE OF lesson_url ON public.student_groups
FOR EACH ROW EXECUTE FUNCTION public.propagate_group_lesson_url();

REVOKE EXECUTE ON FUNCTION public.validate_lesson_url() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_group_lesson_url() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.propagate_group_lesson_url() FROM PUBLIC;