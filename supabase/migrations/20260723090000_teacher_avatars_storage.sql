-- Teacher profile photos: shared avatars bucket + restricted teacher self-updates.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
drop policy if exists avatars_teacher_insert_own_folder on storage.objects;
drop policy if exists avatars_teacher_update_own_folder on storage.objects;
drop policy if exists avatars_teacher_delete_own_folder on storage.objects;

create policy avatars_public_read
on storage.objects
for select
to public
using (bucket_id = 'avatars');

create policy avatars_teacher_insert_own_folder
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy avatars_teacher_update_own_folder
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy avatars_teacher_delete_own_folder
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists teachers_teacher_update_own on public.teachers;

create policy teachers_teacher_update_own
on public.teachers
for update
to authenticated
using (teacher_user_id = auth.uid())
with check (teacher_user_id = auth.uid());

create or replace function public.prevent_teacher_restricted_self_update()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null or private.is_admin(auth.uid()) then
    return new;
  end if;

  if old.teacher_user_id = auth.uid() then
    if new.email is distinct from old.email
      or new.status is distinct from old.status
      or new.admin_note is distinct from old.admin_note
      or new.teacher_user_id is distinct from old.teacher_user_id
      or new.invite_email_sent_at is distinct from old.invite_email_sent_at
      or new.created_at is distinct from old.created_at
      or new.last_login_at is distinct from old.last_login_at then
      raise exception 'Teachers can update only their own editable profile fields';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_teacher_restricted_self_update on public.teachers;

create trigger prevent_teacher_restricted_self_update
before update on public.teachers
for each row
execute function public.prevent_teacher_restricted_self_update();

notify pgrst, 'reload schema';
