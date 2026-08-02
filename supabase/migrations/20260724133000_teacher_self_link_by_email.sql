-- Allow a logged-in teacher to safely link their auth/profile user to an existing
-- teachers row with the same email. This fixes legacy teacher rows created before
-- the auth user existed, without exposing other teachers.

create or replace function public.link_current_teacher_by_email()
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  _email text;
  _teacher_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select p.email
  into _email
  from public.profiles p
  where p.id = auth.uid();

  if _email is null then
    return null;
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'teacher'::public.app_role
  ) then
    return null;
  end if;

  update public.teachers t
  set teacher_user_id = auth.uid(),
      updated_at = now()
  where lower(t.email) = lower(_email)
    and (t.teacher_user_id is null or t.teacher_user_id = auth.uid())
  returning t.id into _teacher_id;

  if _teacher_id is null then
    select t.id
    into _teacher_id
    from public.teachers t
    where t.teacher_user_id = auth.uid()
    limit 1;
  end if;

  return _teacher_id;
end;
$$;

revoke all on function public.link_current_teacher_by_email() from public, anon;
grant execute on function public.link_current_teacher_by_email() to authenticated;

notify pgrst, 'reload schema';
