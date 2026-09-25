-- Persistent Daily Review state and idempotent rewards.
-- This migration is intentionally additive: dictionary_words and existing dictionary UI data stay unchanged.

CREATE TABLE IF NOT EXISTS public.dictionary_word_progress (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  word_id uuid NOT NULL REFERENCES public.dictionary_words(id) ON DELETE CASCADE,
  learned_at timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz,
  next_review_at timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
  review_interval_days integer NOT NULL DEFAULT 1 CHECK (review_interval_days BETWEEN 1 AND 365),
  success_count integer NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  error_count integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  mastery integer NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 100),
  priority integer NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 99),
  last_exercise_type text CHECK (last_exercise_type IS NULL OR last_exercise_type IN ('translation', 'speaking', 'word_building')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, word_id)
);

CREATE INDEX IF NOT EXISTS dictionary_word_progress_due_idx
  ON public.dictionary_word_progress(user_id, next_review_at, priority DESC);

CREATE TABLE IF NOT EXISTS public.dictionary_review_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_nonce text NOT NULL,
  session_kind text NOT NULL DEFAULT 'daily' CHECK (session_kind IN ('daily', 'difficult')),
  local_day date NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  stars_awarded integer NOT NULL DEFAULT 0 CHECK (stars_awarded >= 0),
  UNIQUE (user_id, client_nonce)
);

CREATE INDEX IF NOT EXISTS dictionary_review_sessions_user_day_idx
  ON public.dictionary_review_sessions(user_id, local_day DESC, completed_at);

CREATE TABLE IF NOT EXISTS public.dictionary_review_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.dictionary_review_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  word_id uuid NOT NULL REFERENCES public.dictionary_words(id) ON DELETE CASCADE,
  exercise_type text NOT NULL CHECK (exercise_type IN ('translation', 'speaking', 'word_building')),
  is_correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dictionary_review_attempts_session_idx
  ON public.dictionary_review_attempts(session_id, word_id, created_at);

ALTER TABLE public.dictionary_word_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictionary_review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictionary_review_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dictionary_progress_select_own ON public.dictionary_word_progress;
CREATE POLICY dictionary_progress_select_own ON public.dictionary_word_progress
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS dictionary_progress_manage_own ON public.dictionary_word_progress;
CREATE POLICY dictionary_progress_manage_own ON public.dictionary_word_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR private.is_admin(auth.uid()))
  WITH CHECK (
    (auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.dictionary_words word
      WHERE word.id = word_id AND word.user_id = auth.uid()
    ))
    OR private.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS dictionary_review_sessions_select_own ON public.dictionary_review_sessions;
CREATE POLICY dictionary_review_sessions_select_own ON public.dictionary_review_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS dictionary_review_attempts_select_own ON public.dictionary_review_attempts;
CREATE POLICY dictionary_review_attempts_select_own ON public.dictionary_review_attempts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dictionary_word_progress TO authenticated;
GRANT SELECT ON public.dictionary_review_sessions, public.dictionary_review_attempts TO authenticated;
GRANT ALL ON public.dictionary_word_progress, public.dictionary_review_sessions, public.dictionary_review_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.start_dictionary_review_session(
  _client_nonce text,
  _session_kind text DEFAULT 'daily',
  _local_day date DEFAULT current_date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  session_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _session_kind NOT IN ('daily', 'difficult') THEN RAISE EXCEPTION 'Invalid review session kind'; END IF;
  IF _local_day < current_date - 1 OR _local_day > current_date + 1 THEN RAISE EXCEPTION 'Invalid local day'; END IF;
  IF length(coalesce(_client_nonce, '')) < 8 THEN RAISE EXCEPTION 'Invalid client nonce'; END IF;

  INSERT INTO public.dictionary_review_sessions(user_id, client_nonce, session_kind, local_day)
  VALUES (uid, _client_nonce, _session_kind, _local_day)
  ON CONFLICT (user_id, client_nonce) DO UPDATE SET client_nonce = EXCLUDED.client_nonce
  RETURNING id INTO session_id;
  RETURN session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_dictionary_review_answer(
  _session_id uuid,
  _word_id uuid,
  _exercise_type text,
  _answer text
)
RETURNS TABLE(is_correct boolean, persisted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  session_row public.dictionary_review_sessions%ROWTYPE;
  progress_row public.dictionary_word_progress%ROWTYPE;
  word_row public.dictionary_words%ROWTYPE;
  normalized_answer text;
  normalized_target text;
  next_interval integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _exercise_type NOT IN ('translation', 'speaking', 'word_building') THEN RAISE EXCEPTION 'Invalid exercise type'; END IF;

  SELECT * INTO session_row FROM public.dictionary_review_sessions
  WHERE id = _session_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND OR session_row.completed_at IS NOT NULL THEN RAISE EXCEPTION 'Review session is unavailable'; END IF;

  SELECT * INTO word_row FROM public.dictionary_words WHERE id = _word_id AND user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dictionary word is unavailable'; END IF;
  SELECT * INTO progress_row FROM public.dictionary_word_progress
  WHERE user_id = uid AND word_id = _word_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Word is not marked as learned'; END IF;
  IF progress_row.next_review_at > session_row.started_at
    AND NOT EXISTS (
      SELECT 1 FROM public.dictionary_review_attempts
      WHERE session_id = _session_id AND user_id = uid AND word_id = _word_id
    )
  THEN
    RAISE EXCEPTION 'Word is not due for review';
  END IF;

  normalized_answer := trim(regexp_replace(lower(coalesce(_answer, '')), '[^[:alnum:]]+', ' ', 'g'));
  normalized_target := trim(regexp_replace(lower(CASE WHEN _exercise_type = 'translation' THEN word_row.translation ELSE word_row.word END), '[^[:alnum:]]+', ' ', 'g'));
  IF _exercise_type = 'speaking' THEN
    is_correct := normalized_target = ANY(regexp_split_to_array(normalized_answer, '\\s+'));
  ELSE
    is_correct := normalized_answer = normalized_target;
  END IF;

  INSERT INTO public.dictionary_review_attempts(session_id, user_id, word_id, exercise_type, is_correct)
  VALUES (_session_id, uid, _word_id, _exercise_type, is_correct);

  IF is_correct THEN
    next_interval := CASE progress_row.success_count
      WHEN 0 THEN 3
      WHEN 1 THEN 7
      WHEN 2 THEN 14
      ELSE 30
    END;
    UPDATE public.dictionary_word_progress SET
      last_reviewed_at = now(),
      next_review_at = now() + make_interval(days => next_interval),
      review_interval_days = next_interval,
      success_count = success_count + 1,
      mastery = LEAST(100, mastery + 20),
      priority = GREATEST(0, priority - 1),
      last_exercise_type = _exercise_type,
      updated_at = now()
    WHERE user_id = uid AND word_id = _word_id;
  ELSE
    UPDATE public.dictionary_word_progress SET
      last_reviewed_at = now(),
      next_review_at = now() + interval '1 day',
      review_interval_days = 1,
      error_count = error_count + 1,
      mastery = GREATEST(0, mastery - 15),
      priority = LEAST(99, priority + 2),
      last_exercise_type = _exercise_type,
      updated_at = now()
    WHERE user_id = uid AND word_id = _word_id;
  END IF;

  persisted := true;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_dictionary_review_session(_session_id uuid)
RETURNS TABLE(stars_awarded integer, already_completed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  session_row public.dictionary_review_sessions%ROWTYPE;
  award_amount integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO session_row FROM public.dictionary_review_sessions
  WHERE id = _session_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review session is unavailable'; END IF;

  IF session_row.completed_at IS NOT NULL THEN
    stars_awarded := session_row.stars_awarded;
    already_completed := true;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Serialize rewards for this student. A refresh or a second session on the
  -- same local day may be completed, but cannot mint another daily reward.
  PERFORM 1 FROM public.profiles WHERE id = uid FOR UPDATE;

  IF session_row.session_kind = 'daily'
    AND NOT EXISTS (
      SELECT 1 FROM public.dictionary_review_sessions prior
      WHERE prior.user_id = uid
        AND prior.session_kind = 'daily'
        AND prior.local_day = session_row.local_day
        AND prior.completed_at IS NOT NULL
        AND prior.id <> _session_id
    )
  THEN
    SELECT coalesce(count(*) * 10, 0)::integer INTO award_amount
    FROM (
      SELECT word_id
      FROM public.dictionary_review_attempts
      WHERE session_id = _session_id AND user_id = uid
      GROUP BY word_id
      HAVING bool_and(is_correct)
    ) correct_words;
  END IF;

  UPDATE public.dictionary_review_sessions
  SET completed_at = now(), stars_awarded = award_amount
  WHERE id = _session_id;

  IF award_amount > 0 THEN
    PERFORM set_config('app.stars_rpc', 'on', true);
    UPDATE public.profiles SET
      star_balance = coalesce(star_balance, 0) + award_amount,
      total_stars_earned = coalesce(total_stars_earned, 0) + award_amount,
      pending_celebration = coalesce(pending_celebration, 0) + award_amount
    WHERE id = uid;
  END IF;

  stars_awarded := award_amount;
  already_completed := false;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.start_dictionary_review_session(text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_dictionary_review_answer(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_dictionary_review_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_dictionary_review_session(text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_dictionary_review_answer(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_dictionary_review_session(uuid) TO authenticated;
