
CREATE TABLE public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  day text not null,
  time text not null,
  topic text not null default '',
  position int not null default 0,
  created_at timestamp with time zone not null default now()
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedules_select_own_or_admin" ON public.schedules
FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "schedules_admin_all" ON public.schedules
FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_schedules_user ON public.schedules(user_id);
