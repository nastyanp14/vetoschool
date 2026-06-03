
CREATE TABLE public.dictionary_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  word text NOT NULL,
  translation text NOT NULL,
  emoji text NOT NULL DEFAULT '✨',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dictionary_words TO authenticated;
GRANT ALL ON public.dictionary_words TO service_role;

ALTER TABLE public.dictionary_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dict_select_own" ON public.dictionary_words
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.is_admin(auth.uid()));

CREATE POLICY "dict_admin_manage" ON public.dictionary_words
  FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

CREATE INDEX dictionary_words_user_id_idx ON public.dictionary_words(user_id);
