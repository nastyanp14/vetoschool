DROP POLICY IF EXISTS "units_admin_ins" ON public.units;
DROP POLICY IF EXISTS "units_admin_upd" ON public.units;
DROP POLICY IF EXISTS "units_admin_del" ON public.units;

CREATE POLICY "units_admin_ins" ON public.units
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "units_admin_upd" ON public.units
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "units_admin_del" ON public.units
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

DROP POLICY IF EXISTS "lessons_admin_ins" ON public.lessons;
DROP POLICY IF EXISTS "lessons_admin_upd" ON public.lessons;
DROP POLICY IF EXISTS "lessons_admin_del" ON public.lessons;

CREATE POLICY "lessons_admin_ins" ON public.lessons
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "lessons_admin_upd" ON public.lessons
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "lessons_admin_del" ON public.lessons
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

DROP POLICY IF EXISTS "it_admin_ins" ON public.interactive_tasks;
DROP POLICY IF EXISTS "it_admin_upd" ON public.interactive_tasks;
DROP POLICY IF EXISTS "it_admin_del" ON public.interactive_tasks;

CREATE POLICY "it_admin_ins" ON public.interactive_tasks
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "it_admin_upd" ON public.interactive_tasks
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "it_admin_del" ON public.interactive_tasks
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

DROP POLICY IF EXISTS "lp_select_self_or_admin" ON public.lesson_progress;

CREATE POLICY "lp_select_self_or_admin" ON public.lesson_progress
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

DROP POLICY IF EXISTS "wba_admin_ins" ON storage.objects;
DROP POLICY IF EXISTS "wba_admin_upd" ON storage.objects;
DROP POLICY IF EXISTS "wba_admin_del" ON storage.objects;

CREATE POLICY "wba_admin_ins" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'workbook-assets'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "wba_admin_upd" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'workbook-assets'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
)
WITH CHECK (
  bucket_id = 'workbook-assets'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "wba_admin_del" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'workbook-assets'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;