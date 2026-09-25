-- Daily Dictionary review builds consistency and mastery; it no longer mints stars.
-- Existing balances and previously awarded stars are intentionally left untouched.
CREATE OR REPLACE FUNCTION public.complete_dictionary_review_session(_session_id uuid)
RETURNS TABLE(stars_awarded integer, already_completed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  session_row public.dictionary_review_sessions%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO session_row
  FROM public.dictionary_review_sessions
  WHERE id = _session_id AND user_id = uid
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Review session is unavailable'; END IF;

  IF session_row.completed_at IS NOT NULL THEN
    stars_awarded := 0;
    already_completed := true;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.dictionary_review_sessions
  SET completed_at = now(), stars_awarded = 0
  WHERE id = _session_id;

  stars_awarded := 0;
  already_completed := false;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_dictionary_review_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_dictionary_review_session(uuid) TO authenticated;
