
-- Roles enum
create type public.app_role as enum ('admin', 'student');

-- Content type enum
create type public.content_type as enum ('lesson', 'homework', 'practice', 'grammar', 'listening');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  has_access boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = 'admin')
$$;

-- Profiles policies
create policy "profiles_select_own_or_admin" on public.profiles for select
  using (auth.uid() = id or public.is_admin(auth.uid()));
create policy "profiles_insert_self" on public.profiles for insert
  with check (auth.uid() = id);
create policy "profiles_update_self_or_admin" on public.profiles for update
  using (auth.uid() = id or public.is_admin(auth.uid()));
create policy "profiles_delete_admin" on public.profiles for delete
  using (public.is_admin(auth.uid()));

-- Roles policies
create policy "roles_select_self_or_admin" on public.user_roles for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "roles_admin_all" on public.user_roles for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Trigger: create profile + assign role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, has_access)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    case when lower(new.email) = 'vetoschool.english@gmail.com' then true else false end
  );
  if lower(new.email) = 'vetoschool.english@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'student');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Content items
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  type public.content_type not null,
  title text not null,
  emoji text not null default '✨',
  file_url text,
  file_name text,
  external_link text,
  due_date date,
  scheduled_date date,
  scheduled_time text,
  unlocked boolean not null default false,
  star_rating int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.content_items enable row level security;

create policy "content_select_own_or_admin" on public.content_items for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "content_admin_all" on public.content_items for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Grades
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid references public.content_items(id) on delete cascade,
  category text not null,
  score numeric not null,
  max_score numeric not null default 100,
  comment text,
  created_at timestamptz not null default now()
);
alter table public.grades enable row level security;

create policy "grades_select_own_or_admin" on public.grades for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "grades_admin_all" on public.grades for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Updated_at trigger for content_items
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger content_items_updated_at before update on public.content_items
  for each row execute function public.set_updated_at();

-- Storage bucket for content files
insert into storage.buckets (id, name, public) values ('content', 'content', true)
  on conflict (id) do nothing;

create policy "content_files_public_read" on storage.objects for select
  using (bucket_id = 'content');
create policy "content_files_admin_write" on storage.objects for insert
  with check (bucket_id = 'content' and public.is_admin(auth.uid()));
create policy "content_files_admin_update" on storage.objects for update
  using (bucket_id = 'content' and public.is_admin(auth.uid()));
create policy "content_files_admin_delete" on storage.objects for delete
  using (bucket_id = 'content' and public.is_admin(auth.uid()));
