ALTER TABLE public.student_parent_links
  ADD COLUMN IF NOT EXISTS disconnected_at timestamptz;

CREATE OR REPLACE FUNCTION public.disconnect_telegram_parent(_student_id uuid, _parent_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF auth.uid() <> _student_id AND NOT private.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_allowed_to_disconnect_parent';
  END IF;

  UPDATE public.student_parent_links
  SET active = false,
      disconnected_at = now()
  WHERE student_id = _student_id
    AND parent_id = _parent_id
    AND active = true;

  GET DIAGNOSTICS affected = ROW_COUNT;

  IF affected > 0 THEN
    UPDATE public.telegram_notifications
    SET status = 'canceled',
        canceled_at = now(),
        updated_at = now()
    WHERE student_id = _student_id
      AND parent_id = _parent_id
      AND status = 'pending';
  END IF;

  RETURN affected > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.disconnect_telegram_parent(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disconnect_telegram_parent(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disconnect_telegram_parent(uuid, uuid) TO service_role;