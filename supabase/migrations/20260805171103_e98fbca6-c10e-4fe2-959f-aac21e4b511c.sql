CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  recipient_role TEXT NOT NULL DEFAULT 'parent',
  recipient_id UUID,
  recipient_email TEXT,
  telegram_chat_id TEXT,
  student_id UUID,
  channel TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'ru',
  status TEXT NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,
  subject TEXT,
  body_preview TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_log_channel_check CHECK (channel IN ('telegram', 'email')),
  CONSTRAINT notification_log_status_check CHECK (status IN ('pending', 'sent', 'failed', 'skipped', 'canceled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_log_idempotency_key_uidx
  ON public.notification_log (idempotency_key);
CREATE INDEX IF NOT EXISTS notification_log_entity_idx
  ON public.notification_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_log_student_idx
  ON public.notification_log (student_id, created_at DESC);

GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_log_admin_read"
  ON public.notification_log FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()));

CREATE POLICY "notification_log_own_read"
  ON public.notification_log FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR student_id = auth.uid()
    OR (student_id IS NOT NULL AND private.teacher_can_access_student(auth.uid(), student_id))
  );

CREATE TRIGGER notification_log_set_updated_at
  BEFORE UPDATE ON public.notification_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();