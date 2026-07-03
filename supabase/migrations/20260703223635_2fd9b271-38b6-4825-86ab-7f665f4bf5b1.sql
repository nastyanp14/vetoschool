
-- ========== Enums ==========
DO $$ BEGIN
  CREATE TYPE public.lesson_kind AS ENUM ('theory','class_task','homework','practice','checkpoint');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== workbooks ==========
CREATE TABLE IF NOT EXISTS public.workbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  level TEXT,
  description TEXT,
  is_global BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workbooks TO authenticated;
GRANT ALL ON public.workbooks TO service_role;
ALTER TABLE public.workbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wb_select_auth" ON public.workbooks FOR SELECT TO authenticated USING (true);
CREATE POLICY "wb_admin_ins" ON public.workbooks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "wb_admin_upd" ON public.workbooks FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "wb_admin_del" ON public.workbooks FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_workbooks_updated BEFORE UPDATE ON public.workbooks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== units ==========
CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id UUID NOT NULL REFERENCES public.workbooks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  unit_number INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "units_select_auth" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "units_admin_ins" ON public.units FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "units_admin_upd" ON public.units FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "units_admin_del" ON public.units FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_units_updated BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_units_workbook ON public.units(workbook_id, unit_number);

-- ========== lessons ==========
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  lesson_number INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  type public.lesson_kind NOT NULL DEFAULT 'theory',
  "order" INT NOT NULL DEFAULT 0,
  stars_reward INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons_select_auth" ON public.lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "lessons_admin_ins" ON public.lessons FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "lessons_admin_upd" ON public.lessons FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "lessons_admin_del" ON public.lessons FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lessons_updated BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_lessons_unit ON public.lessons(unit_id, "order");

-- ========== interactive_tasks ==========
CREATE TABLE IF NOT EXISTS public.interactive_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  "order" INT NOT NULL DEFAULT 0,
  mechanic_type TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interactive_tasks TO authenticated;
GRANT ALL ON public.interactive_tasks TO service_role;
ALTER TABLE public.interactive_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "it_select_auth" ON public.interactive_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "it_admin_ins" ON public.interactive_tasks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "it_admin_upd" ON public.interactive_tasks FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "it_admin_del" ON public.interactive_tasks FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_it_updated BEFORE UPDATE ON public.interactive_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_it_lesson ON public.interactive_tasks(lesson_id, "order");

-- ========== storage policies for 'workbook-assets' ==========
-- Any authenticated user can read (assets used by lessons); only admins can write.
CREATE POLICY "wba_read_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'workbook-assets');
CREATE POLICY "wba_admin_ins" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workbook-assets' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "wba_admin_upd" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'workbook-assets' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'workbook-assets' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "wba_admin_del" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'workbook-assets' AND public.has_role(auth.uid(),'admin'));
