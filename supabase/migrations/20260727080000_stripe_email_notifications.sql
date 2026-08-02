CREATE TABLE IF NOT EXISTS public.email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_key TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  notification_type TEXT NOT NULL,
  stripe_event_id TEXT,
  stripe_payment_id UUID REFERENCES public.stripe_payments(id) ON DELETE SET NULL,
  stripe_refund_id UUID REFERENCES public.stripe_refunds(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'sendpulse',
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_user_created
  ON public.email_notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_notifications_type_created
  ON public.email_notifications(notification_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_notifications_status
  ON public.email_notifications(status);

CREATE INDEX IF NOT EXISTS idx_email_notifications_stripe_event
  ON public.email_notifications(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_notifications_select_admin" ON public.email_notifications;
CREATE POLICY "email_notifications_select_admin"
  ON public.email_notifications
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

DROP POLICY IF EXISTS "email_notifications_service_role_all" ON public.email_notifications;
CREATE POLICY "email_notifications_service_role_all"
  ON public.email_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.email_notifications TO authenticated;
GRANT ALL ON public.email_notifications TO service_role;

DROP TRIGGER IF EXISTS trg_email_notifications_updated_at ON public.email_notifications;
CREATE TRIGGER trg_email_notifications_updated_at
  BEFORE UPDATE ON public.email_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profiles_updated_at();
