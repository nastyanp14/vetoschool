
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  stars_awarded integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;
GRANT ALL ON public.lesson_progress TO service_role;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lp_select_self_or_admin ON public.lesson_progress;
DROP POLICY IF EXISTS lp_ins_self ON public.lesson_progress;
DROP POLICY IF EXISTS lp_upd_self ON public.lesson_progress;
CREATE POLICY lp_select_self_or_admin ON public.lesson_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY lp_ins_self ON public.lesson_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY lp_upd_self ON public.lesson_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS wba_read_auth ON storage.objects;
DROP POLICY IF EXISTS wba_admin_ins ON storage.objects;
DROP POLICY IF EXISTS wba_admin_upd ON storage.objects;
DROP POLICY IF EXISTS wba_admin_del ON storage.objects;
CREATE POLICY wba_read_auth ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'workbook-assets');
CREATE POLICY wba_admin_ins ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workbook-assets' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY wba_admin_upd ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'workbook-assets' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY wba_admin_del ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'workbook-assets' AND public.has_role(auth.uid(),'admin'));
