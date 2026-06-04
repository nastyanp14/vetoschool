
-- Stars piggy bank fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS star_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_stars_earned integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_celebration integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avatar_id text;

-- Avatar shop purchases
CREATE TABLE IF NOT EXISTS public.avatar_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  avatar_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, avatar_id)
);

GRANT SELECT, INSERT, DELETE ON public.avatar_purchases TO authenticated;
GRANT ALL ON public.avatar_purchases TO service_role;

ALTER TABLE public.avatar_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchases_select_own_or_admin"
  ON public.avatar_purchases FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.is_admin(auth.uid()));

CREATE POLICY "purchases_insert_own_or_admin"
  ON public.avatar_purchases FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR private.is_admin(auth.uid()));

CREATE POLICY "purchases_admin_manage"
  ON public.avatar_purchases FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));
