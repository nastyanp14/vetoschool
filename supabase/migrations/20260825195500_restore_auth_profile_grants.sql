-- Restore table privileges required by authenticated app sessions.
-- RLS policies still restrict users to their own profile/role and preserve
-- admin-only paid access controls.
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
