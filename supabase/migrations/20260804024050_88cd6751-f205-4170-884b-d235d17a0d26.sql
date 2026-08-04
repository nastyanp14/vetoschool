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

GRANT SELECT, INSERT ON public.manual_access_overrides TO authenticated;
GRANT ALL ON public.manual_access_overrides TO service_role;

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

-- Fix: OUT parameters (student_id, parent_id) collided with table columns,
-- making every /start <token> link attempt fail with
-- "column reference \"student_id\" is ambiguous".
CREATE OR REPLACE FUNCTION public.link_telegram_parent(
  p_token_hash text,
  p_chat_id text,
  p_telegram_user_id text,
  p_username text,
  p_first_name text,
  p_last_name text
)
RETURNS TABLE(status text, student_id uuid, parent_id uuid, student_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  token_row public.telegram_link_tokens%ROWTYPE;
  parent_row public.telegram_parent_accounts%ROWTYPE;
  resolved_name text;
  resolved_student_name text;
BEGIN
  IF p_token_hash IS NULL OR p_chat_id IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  SELECT * INTO token_row
  FROM public.telegram_link_tokens t
  WHERE t.token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND
     OR token_row.used_at IS NOT NULL
     OR token_row.revoked_at IS NOT NULL
     OR token_row.expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::uuid, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  resolved_name := NULLIF(btrim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')), '');

  SELECT * INTO parent_row
  FROM public.telegram_parent_accounts a
  WHERE a.telegram_chat_id = p_chat_id
     OR (p_telegram_user_id IS NOT NULL AND a.telegram_user_id = p_telegram_user_id)
  ORDER BY a.created_at
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.telegram_parent_accounts a
    SET telegram_chat_id = p_chat_id,
        telegram_user_id = COALESCE(p_telegram_user_id, a.telegram_user_id),
        telegram_username = COALESCE(p_username, a.telegram_username),
        first_name = COALESCE(p_first_name, a.first_name),
        last_name = COALESCE(p_last_name, a.last_name),
        display_name = COALESCE(resolved_name, a.display_name, p_username),
        parent_name = COALESCE(a.parent_name, resolved_name, p_username),
        linked_at = COALESCE(a.linked_at, now()),
        updated_at = now()
    WHERE a.id = parent_row.id
    RETURNING a.* INTO parent_row;
  ELSE
    INSERT INTO public.telegram_parent_accounts (
      telegram_chat_id, telegram_user_id, telegram_username,
      first_name, last_name, display_name, parent_name, linked_at
    )
    VALUES (
      p_chat_id, p_telegram_user_id, p_username,
      p_first_name, p_last_name, resolved_name, COALESCE(resolved_name, p_username), now()
    )
    RETURNING * INTO parent_row;
  END IF;

  INSERT INTO public.student_parent_links AS spl (student_id, parent_id, active, linked_at)
  VALUES (token_row.student_id, parent_row.id, true, now())
  ON CONFLICT (student_id, parent_id)
  DO UPDATE SET active = true, linked_at = now();

  UPDATE public.telegram_link_tokens t
  SET used_at = now(), used_by_parent_id = parent_row.id
  WHERE t.id = token_row.id;

  UPDATE public.telegram_link_tokens t
  SET revoked_at = now()
  WHERE t.student_id = token_row.student_id
    AND t.id <> token_row.id
    AND t.used_at IS NULL
    AND t.revoked_at IS NULL;

  SELECT p.name INTO resolved_student_name
  FROM public.profiles p
  WHERE p.id = token_row.student_id;

  RETURN QUERY SELECT 'linked'::text, token_row.student_id, parent_row.id, resolved_student_name;
END;
$function$;