-- Restore safe RLS rules required for login and admin access

-- Make helper functions callable by authenticated app users for RLS checks and role loading.
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Ensure the has_access protection trigger exists on profiles.
DROP TRIGGER IF EXISTS profiles_protect_has_access ON public.profiles;
CREATE TRIGGER profiles_protect_has_access
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_has_access_self_update();

-- Profiles: keep users limited to their own profile; admins can manage everyone.
DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
DROP POLICY IF EXISTS profiles_delete_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_self_authenticated ON public.profiles;

CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY profiles_update_self
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_insert_self_authenticated
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_admin_all
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- User roles: users can read only their own role; only admins can manage roles.
DROP POLICY IF EXISTS roles_select_self_or_admin ON public.user_roles;
DROP POLICY IF EXISTS roles_admin_all ON public.user_roles;
DROP POLICY IF EXISTS roles_only_admins_write ON public.user_roles;
DROP POLICY IF EXISTS roles_select_self ON public.user_roles;
DROP POLICY IF EXISTS roles_admin_manage ON public.user_roles;
DROP POLICY IF EXISTS roles_block_non_admin_writes ON public.user_roles;

CREATE POLICY roles_select_self
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY roles_admin_manage
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY roles_block_non_admin_writes
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Content items: admins can manage all; students can only read their own content.
DROP POLICY IF EXISTS content_select_own_or_admin ON public.content_items;
DROP POLICY IF EXISTS content_admin_all ON public.content_items;
DROP POLICY IF EXISTS content_select_own ON public.content_items;
DROP POLICY IF EXISTS content_admin_manage ON public.content_items;

CREATE POLICY content_select_own
ON public.content_items
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY content_admin_manage
ON public.content_items
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Schedules: admins can manage all; students can only read their own schedule.
DROP POLICY IF EXISTS schedules_select_own_or_admin ON public.schedules;
DROP POLICY IF EXISTS schedules_admin_all ON public.schedules;
DROP POLICY IF EXISTS schedules_select_own ON public.schedules;
DROP POLICY IF EXISTS schedules_admin_manage ON public.schedules;

CREATE POLICY schedules_select_own
ON public.schedules
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY schedules_admin_manage
ON public.schedules
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));