DO $$
BEGIN
  CREATE TYPE public.trial_booking_status AS ENUM (
    'submitted',
    'confirmed',
    'completed',
    'cancelled',
    'no_show',
    'converted'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.trial_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text UNIQUE,
  parent_name text NOT NULL CHECK (char_length(parent_name) BETWEEN 2 AND 120),
  parent_email text NOT NULL CHECK (parent_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  parent_phone text CHECK (parent_phone IS NULL OR char_length(parent_phone) <= 40),
  preferred_language text NOT NULL CHECK (preferred_language IN ('ru', 'ua', 'en')),
  child_name text NOT NULL CHECK (char_length(child_name) BETWEEN 2 AND 120),
  child_age integer NOT NULL CHECK (child_age BETWEEN 4 AND 16),
  school_grade text NOT NULL CHECK (char_length(school_grade) BETWEEN 1 AND 40),
  english_experience text NOT NULL CHECK (english_experience IN ('none', 'lt1', '1-2', 'gt2')),
  parent_notes text CHECK (parent_notes IS NULL OR char_length(parent_notes) <= 2000),
  assessment_score integer NOT NULL CHECK (assessment_score >= 0),
  preliminary_recommendation text NOT NULL CHECK (
    preliminary_recommendation IN ('Mini Kids', 'Kids Beginners', 'Junior Beginners', 'Kids A1', 'Junior A1')
  ),
  selected_date date NOT NULL,
  selected_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Prague' CHECK (char_length(timezone) BETWEEN 3 AND 80),
  privacy_accepted_at timestamptz NOT NULL,
  guardian_confirmed_at timestamptz NOT NULL,
  marketing_consent_at timestamptz,
  status public.trial_booking_status NOT NULL DEFAULT 'submitted',
  teacher_confirmed_level text CHECK (teacher_confirmed_level IS NULL OR char_length(teacher_confirmed_level) <= 120),
  teacher_confirmed_direction text CHECK (teacher_confirmed_direction IS NULL OR char_length(teacher_confirmed_direction) <= 160),
  internal_notes text CHECK (internal_notes IS NULL OR char_length(internal_notes) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trial_bookings_status_idx ON public.trial_bookings (status);
CREATE INDEX IF NOT EXISTS trial_bookings_selected_date_idx ON public.trial_bookings (selected_date);
CREATE INDEX IF NOT EXISTS trial_bookings_created_at_idx ON public.trial_bookings (created_at DESC);
CREATE INDEX IF NOT EXISTS trial_bookings_parent_email_idx ON public.trial_bookings (lower(parent_email));

CREATE TABLE IF NOT EXISTS public.trial_booking_rate_limits (
  ip_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_hash, window_start)
);

CREATE INDEX IF NOT EXISTS trial_booking_rate_limits_window_idx
  ON public.trial_booking_rate_limits (window_start DESC);

CREATE OR REPLACE FUNCTION public.touch_trial_bookings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trial_bookings_touch_updated_at ON public.trial_bookings;
CREATE TRIGGER trial_bookings_touch_updated_at
  BEFORE UPDATE ON public.trial_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_trial_bookings_updated_at();

DROP TRIGGER IF EXISTS trial_booking_rate_limits_touch_updated_at ON public.trial_booking_rate_limits;
CREATE TRIGGER trial_booking_rate_limits_touch_updated_at
  BEFORE UPDATE ON public.trial_booking_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_trial_bookings_updated_at();

ALTER TABLE public.trial_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_booking_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage trial bookings" ON public.trial_bookings;
CREATE POLICY "Admins can manage trial bookings"
  ON public.trial_bookings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role can manage trial bookings" ON public.trial_bookings;
CREATE POLICY "Service role can manage trial bookings"
  ON public.trial_bookings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage trial booking rate limits" ON public.trial_booking_rate_limits;
CREATE POLICY "Service role can manage trial booking rate limits"
  ON public.trial_booking_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
