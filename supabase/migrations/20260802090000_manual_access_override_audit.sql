ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS manual_access_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_access_override_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manual_access_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_access_override_reason text;

UPDATE public.profiles
SET manual_access_override = true
WHERE access_status = 'active'
  AND stripe_customer_id IS NULL
  AND stripe_subscription_id IS NULL
  AND manual_access_override = false;

CREATE INDEX IF NOT EXISTS idx_profiles_manual_access_override
  ON public.profiles(manual_access_override)
  WHERE manual_access_override = true;

CREATE TABLE IF NOT EXISTS public.manual_access_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('enabled', 'disabled')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 8 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_access_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manual_access_overrides_admin_read ON public.manual_access_overrides;
CREATE POLICY manual_access_overrides_admin_read
ON public.manual_access_overrides
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS manual_access_overrides_admin_insert ON public.manual_access_overrides;
CREATE POLICY manual_access_overrides_admin_insert
ON public.manual_access_overrides
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_manual_access_overrides_student
  ON public.manual_access_overrides(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_manual_access_overrides_admin
  ON public.manual_access_overrides(admin_id, created_at DESC);
