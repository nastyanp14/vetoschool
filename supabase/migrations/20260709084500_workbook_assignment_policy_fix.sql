-- Workbook assignment policy fix: allow admins through user_roles without public.has_role.

DROP POLICY IF EXISTS "student_groups_select_auth" ON public.student_groups;
DROP POLICY IF EXISTS "student_groups_admin_ins" ON public.student_groups;
DROP POLICY IF EXISTS "student_groups_admin_upd" ON public.student_groups;
DROP POLICY IF EXISTS "student_groups_admin_del" ON public.student_groups;

CREATE POLICY "student_groups_select_auth"
  ON public.student_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY "student_groups_admin_ins"
  ON public.student_groups FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "student_groups_admin_upd"
  ON public.student_groups FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "student_groups_admin_del"
  ON public.student_groups FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "student_group_members_select_auth" ON public.student_group_members;
DROP POLICY IF EXISTS "student_group_members_admin_ins" ON public.student_group_members;
DROP POLICY IF EXISTS "student_group_members_admin_upd" ON public.student_group_members;
DROP POLICY IF EXISTS "student_group_members_admin_del" ON public.student_group_members;

CREATE POLICY "student_group_members_select_auth"
  ON public.student_group_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "student_group_members_admin_ins"
  ON public.student_group_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "student_group_members_admin_upd"
  ON public.student_group_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "student_group_members_admin_del"
  ON public.student_group_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "workbook_assignments_select_auth" ON public.workbook_assignments;
DROP POLICY IF EXISTS "workbook_assignments_admin_ins" ON public.workbook_assignments;
DROP POLICY IF EXISTS "workbook_assignments_admin_upd" ON public.workbook_assignments;
DROP POLICY IF EXISTS "workbook_assignments_admin_del" ON public.workbook_assignments;

CREATE POLICY "workbook_assignments_select_auth"
  ON public.workbook_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "workbook_assignments_admin_ins"
  ON public.workbook_assignments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "workbook_assignments_admin_upd"
  ON public.workbook_assignments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "workbook_assignments_admin_del"
  ON public.workbook_assignments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );
