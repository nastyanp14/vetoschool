ALTER TABLE public.telegram_notifications
  ADD COLUMN IF NOT EXISTS recipient_type text NOT NULL DEFAULT 'parent',
  ADD COLUMN IF NOT EXISTS recipient_label text,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'telegram';

ALTER TABLE public.telegram_notifications
  DROP CONSTRAINT IF EXISTS telegram_notifications_recipient_type_check;

ALTER TABLE public.telegram_notifications
  ADD CONSTRAINT telegram_notifications_recipient_type_check
  CHECK (recipient_type IN ('parent', 'admin'));

CREATE INDEX IF NOT EXISTS idx_telegram_notifications_recipient_created
  ON public.telegram_notifications(recipient_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_notifications_stripe_admin
  ON public.telegram_notifications(student_id, created_at DESC)
  WHERE recipient_type = 'admin';

DROP POLICY IF EXISTS telegram_notifications_admin_read ON public.telegram_notifications;
CREATE POLICY telegram_notifications_admin_read
ON public.telegram_notifications
FOR SELECT TO authenticated
USING (
  private.is_admin(auth.uid())
  OR (
    student_id = auth.uid()
    AND recipient_type = 'parent'
  )
);

GRANT SELECT ON public.telegram_notifications TO authenticated;
GRANT ALL ON public.telegram_notifications TO service_role;
