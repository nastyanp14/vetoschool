CREATE TABLE IF NOT EXISTS public.telegram_parent_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sendpulse_contact_id text UNIQUE,
  telegram_chat_id text UNIQUE,
  telegram_user_id text UNIQUE,
  telegram_username text,
  parent_name text,
  language text NOT NULL DEFAULT 'ru' CHECK (language IN ('ru', 'ua', 'en')),
  notify_lesson_reminders boolean NOT NULL DEFAULT true,
  notify_homework boolean NOT NULL DEFAULT true,
  notify_grades boolean NOT NULL DEFAULT true,
  notify_schedule_changes boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_parent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES public.telegram_parent_accounts(id) ON DELETE CASCADE,
  relationship text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, parent_id)
);

CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_parent_id uuid REFERENCES public.telegram_parent_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  notification_type text NOT NULL,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.telegram_parent_accounts(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'canceled', 'failed')),
  sent_at timestamptz,
  canceled_at timestamptz,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_parent_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_parent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS telegram_parent_accounts_admin_read ON public.telegram_parent_accounts;
CREATE POLICY telegram_parent_accounts_admin_read
ON public.telegram_parent_accounts
FOR SELECT TO authenticated
USING (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS telegram_parent_accounts_linked_student_read ON public.telegram_parent_accounts;
CREATE POLICY telegram_parent_accounts_linked_student_read
ON public.telegram_parent_accounts
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.student_parent_links spl
    WHERE spl.parent_id = telegram_parent_accounts.id
      AND spl.student_id = auth.uid()
  )
);

DROP POLICY IF EXISTS telegram_parent_accounts_service_all ON public.telegram_parent_accounts;
CREATE POLICY telegram_parent_accounts_service_all
ON public.telegram_parent_accounts
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS student_parent_links_admin_read ON public.student_parent_links;
CREATE POLICY student_parent_links_admin_read
ON public.student_parent_links
FOR SELECT TO authenticated
USING (private.is_admin(auth.uid()) OR student_id = auth.uid());

DROP POLICY IF EXISTS student_parent_links_service_all ON public.student_parent_links;
CREATE POLICY student_parent_links_service_all
ON public.student_parent_links
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS telegram_link_tokens_admin_read ON public.telegram_link_tokens;
CREATE POLICY telegram_link_tokens_admin_read
ON public.telegram_link_tokens
FOR SELECT TO authenticated
USING (private.is_admin(auth.uid()) OR student_id = auth.uid() OR created_by = auth.uid());

DROP POLICY IF EXISTS telegram_link_tokens_service_all ON public.telegram_link_tokens;
CREATE POLICY telegram_link_tokens_service_all
ON public.telegram_link_tokens
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS telegram_notifications_admin_read ON public.telegram_notifications;
CREATE POLICY telegram_notifications_admin_read
ON public.telegram_notifications
FOR SELECT TO authenticated
USING (private.is_admin(auth.uid()) OR student_id = auth.uid());

DROP POLICY IF EXISTS telegram_notifications_service_all ON public.telegram_notifications;
CREATE POLICY telegram_notifications_service_all
ON public.telegram_notifications
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_student_parent_links_student ON public.student_parent_links(student_id);
CREATE INDEX IF NOT EXISTS idx_student_parent_links_parent ON public.student_parent_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_hash ON public.telegram_link_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_telegram_notifications_due ON public.telegram_notifications(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_telegram_notifications_student_type ON public.telegram_notifications(student_id, notification_type);
CREATE INDEX IF NOT EXISTS idx_telegram_notifications_payload_lesson_ref
  ON public.telegram_notifications ((payload->>'lessonRef'))
  WHERE payload ? 'lessonRef';

CREATE OR REPLACE FUNCTION public.touch_telegram_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS telegram_parent_accounts_touch ON public.telegram_parent_accounts;
CREATE TRIGGER telegram_parent_accounts_touch
BEFORE UPDATE ON public.telegram_parent_accounts
FOR EACH ROW EXECUTE FUNCTION public.touch_telegram_updated_at();

DROP TRIGGER IF EXISTS telegram_notifications_touch ON public.telegram_notifications;
CREATE TRIGGER telegram_notifications_touch
BEFORE UPDATE ON public.telegram_notifications
FOR EACH ROW EXECUTE FUNCTION public.touch_telegram_updated_at();
