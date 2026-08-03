GRANT SELECT ON public.student_parent_links TO authenticated;
GRANT SELECT ON public.telegram_parent_accounts TO authenticated;

DROP POLICY IF EXISTS student_parent_links_student_read ON public.student_parent_links;
CREATE POLICY student_parent_links_student_read
ON public.student_parent_links
FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
  OR private.is_admin(auth.uid())
);

DROP POLICY IF EXISTS telegram_parent_accounts_student_link_read ON public.telegram_parent_accounts;
CREATE POLICY telegram_parent_accounts_student_link_read
ON public.telegram_parent_accounts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.student_parent_links spl
    WHERE spl.parent_id = telegram_parent_accounts.id
      AND (
        spl.student_id = auth.uid()
        OR private.is_admin(auth.uid())
      )
  )
);
