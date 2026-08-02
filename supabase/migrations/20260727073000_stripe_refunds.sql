ALTER TABLE public.stripe_payments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;

CREATE INDEX IF NOT EXISTS idx_stripe_payments_payment_intent
  ON public.stripe_payments(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stripe_payments_charge
  ON public.stripe_payments(stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.stripe_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  stripe_payment_id UUID NOT NULL REFERENCES public.stripe_payments(id) ON DELETE RESTRICT,
  stripe_refund_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  refund_type TEXT NOT NULL CHECK (refund_type IN ('full', 'partial')),
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 6),
  status TEXT NOT NULL,
  created_by_admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_refunds_payment_created
  ON public.stripe_refunds(stripe_payment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_refunds_user_created
  ON public.stripe_refunds(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_refunds_status
  ON public.stripe_refunds(status);

ALTER TABLE public.stripe_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stripe_refunds_select_admin" ON public.stripe_refunds;
CREATE POLICY "stripe_refunds_select_admin"
  ON public.stripe_refunds
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "stripe_refunds_service_role_all" ON public.stripe_refunds;
CREATE POLICY "stripe_refunds_service_role_all"
  ON public.stripe_refunds
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.stripe_refunds TO authenticated;
GRANT ALL ON public.stripe_refunds TO service_role;

DROP TRIGGER IF EXISTS trg_stripe_refunds_updated_at ON public.stripe_refunds;
CREATE TRIGGER trg_stripe_refunds_updated_at
  BEFORE UPDATE ON public.stripe_refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profiles_updated_at();
