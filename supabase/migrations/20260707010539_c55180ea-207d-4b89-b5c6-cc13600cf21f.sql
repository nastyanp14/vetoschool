ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

DROP POLICY IF EXISTS "wb_admin_ins" ON public.workbooks;
DROP POLICY IF EXISTS "wb_admin_upd" ON public.workbooks;
DROP POLICY IF EXISTS "wb_admin_del" ON public.workbooks;

CREATE POLICY "wb_admin_ins" ON public.workbooks
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "wb_admin_upd" ON public.workbooks
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "wb_admin_del" ON public.workbooks
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);