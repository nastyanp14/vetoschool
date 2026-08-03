-- Telegram parent account details
ALTER TABLE public.telegram_parent_accounts
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz;

UPDATE public.telegram_parent_accounts
SET linked_at = COALESCE(linked_at, created_at)
WHERE linked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS telegram_parent_accounts_chat_id_key
  ON public.telegram_parent_accounts (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS telegram_parent_accounts_user_id_key
  ON public.telegram_parent_accounts (telegram_user_id)
  WHERE telegram_user_id IS NOT NULL;

-- Student <-> parent links
ALTER TABLE public.student_parent_links
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS student_parent_links_student_parent_key
  ON public.student_parent_links (student_id, parent_id);

CREATE INDEX IF NOT EXISTS student_parent_links_active_idx
  ON public.student_parent_links (student_id)
  WHERE active;

-- Link tokens
ALTER TABLE public.telegram_link_tokens
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS telegram_link_tokens_hash_key
  ON public.telegram_link_tokens (token_hash);

CREATE INDEX IF NOT EXISTS telegram_link_tokens_student_open_idx
  ON public.telegram_link_tokens (student_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;

-- Atomic linking used by the Telegram webhook (service role only)
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
AS $$
DECLARE
  token_row public.telegram_link_tokens%ROWTYPE;
  parent_row public.telegram_parent_accounts%ROWTYPE;
  resolved_name text;
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
    UPDATE public.telegram_parent_accounts
    SET telegram_chat_id = p_chat_id,
        telegram_user_id = COALESCE(p_telegram_user_id, telegram_user_id),
        telegram_username = COALESCE(p_username, telegram_username),
        first_name = COALESCE(p_first_name, first_name),
        last_name = COALESCE(p_last_name, last_name),
        display_name = COALESCE(resolved_name, display_name, p_username),
        parent_name = COALESCE(parent_name, resolved_name, p_username),
        linked_at = COALESCE(linked_at, now()),
        updated_at = now()
    WHERE id = parent_row.id
    RETURNING * INTO parent_row;
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

  INSERT INTO public.student_parent_links (student_id, parent_id, active, linked_at)
  VALUES (token_row.student_id, parent_row.id, true, now())
  ON CONFLICT (student_id, parent_id)
  DO UPDATE SET active = true, linked_at = now();

  UPDATE public.telegram_link_tokens
  SET used_at = now(), used_by_parent_id = parent_row.id
  WHERE id = token_row.id;

  UPDATE public.telegram_link_tokens
  SET revoked_at = now()
  WHERE student_id = token_row.student_id
    AND id <> token_row.id
    AND used_at IS NULL
    AND revoked_at IS NULL;

  SELECT p.name INTO resolved_name FROM public.profiles p WHERE p.id = token_row.student_id;

  RETURN QUERY SELECT 'linked'::text, token_row.student_id, parent_row.id, resolved_name;
END;
$$;

REVOKE ALL ON FUNCTION public.link_telegram_parent(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_telegram_parent(text, text, text, text, text, text) TO service_role;