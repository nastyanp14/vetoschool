-- Interactive lesson targeting: all students, selected students, or groups.

CREATE TABLE IF NOT EXISTS public.student_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.workbook_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id UUID NOT NULL REFERENCES public.workbooks(id) ON DELETE CASCADE,
  assignee_type TEXT NOT NULL CHECK (assignee_type IN ('student', 'group')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.student_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workbook_assignments_target_check CHECK (
    (assignee_type = 'student' AND user_id IS NOT NULL AND group_id IS NULL)
    OR
    (assignee_type = 'group' AND group_id IS NOT NULL AND user_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS workbook_assignments_student_uniq
  ON public.workbook_assignments(workbook_id, user_id)
  WHERE assignee_type = 'student';

CREATE UNIQUE INDEX IF NOT EXISTS workbook_assignments_group_uniq
  ON public.workbook_assignments(workbook_id, group_id)
  WHERE assignee_type = 'group';

CREATE INDEX IF NOT EXISTS idx_student_group_members_user
  ON public.student_group_members(user_id);

CREATE INDEX IF NOT EXISTS idx_workbook_assignments_workbook
  ON public.workbook_assignments(workbook_id);

CREATE INDEX IF NOT EXISTS idx_workbook_assignments_user
  ON public.workbook_assignments(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workbook_assignments TO authenticated;

GRANT ALL ON public.student_groups TO service_role;
GRANT ALL ON public.student_group_members TO service_role;
GRANT ALL ON public.workbook_assignments TO service_role;

ALTER TABLE public.student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_groups_select_auth" ON public.student_groups;
DROP POLICY IF EXISTS "student_groups_admin_ins" ON public.student_groups;
DROP POLICY IF EXISTS "student_groups_admin_upd" ON public.student_groups;
DROP POLICY IF EXISTS "student_groups_admin_del" ON public.student_groups;

CREATE POLICY "student_groups_select_auth"
  ON public.student_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "student_groups_admin_ins"
  ON public.student_groups FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "student_groups_admin_upd"
  ON public.student_groups FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "student_groups_admin_del"
  ON public.student_groups FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "student_group_members_select_auth" ON public.student_group_members;
DROP POLICY IF EXISTS "student_group_members_admin_ins" ON public.student_group_members;
DROP POLICY IF EXISTS "student_group_members_admin_upd" ON public.student_group_members;
DROP POLICY IF EXISTS "student_group_members_admin_del" ON public.student_group_members;

CREATE POLICY "student_group_members_select_auth"
  ON public.student_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "student_group_members_admin_ins"
  ON public.student_group_members FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "student_group_members_admin_upd"
  ON public.student_group_members FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "student_group_members_admin_del"
  ON public.student_group_members FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "workbook_assignments_select_auth" ON public.workbook_assignments;
DROP POLICY IF EXISTS "workbook_assignments_admin_ins" ON public.workbook_assignments;
DROP POLICY IF EXISTS "workbook_assignments_admin_upd" ON public.workbook_assignments;
DROP POLICY IF EXISTS "workbook_assignments_admin_del" ON public.workbook_assignments;

CREATE POLICY "workbook_assignments_select_auth"
  ON public.workbook_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "workbook_assignments_admin_ins"
  ON public.workbook_assignments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "workbook_assignments_admin_upd"
  ON public.workbook_assignments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "workbook_assignments_admin_del"
  ON public.workbook_assignments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_student_groups_updated ON public.student_groups;

CREATE TRIGGER trg_student_groups_updated
  BEFORE UPDATE ON public.student_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
