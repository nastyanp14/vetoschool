-- ISOLATED LOCAL DATABASE ONLY. Minimal existing schema + actual role helpers.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE SCHEMA realtime;
GRANT USAGE ON SCHEMA public,private,auth,realtime TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, name text);
CREATE TABLE public.user_roles(user_id uuid REFERENCES public.profiles,role text);
CREATE TABLE public.teachers(id uuid PRIMARY KEY,teacher_user_id uuid REFERENCES public.profiles,first_name text,last_name text,status text);
CREATE TABLE public.teacher_students(teacher_id uuid REFERENCES public.teachers,student_id uuid REFERENCES public.profiles);
CREATE TABLE public.student_groups(id uuid PRIMARY KEY,teacher_id uuid REFERENCES public.teachers);
CREATE TABLE public.student_group_members(group_id uuid REFERENCES public.student_groups,user_id uuid REFERENCES public.profiles);
CREATE TABLE public.schedules(id uuid PRIMARY KEY,teacher_id uuid REFERENCES public.teachers,user_id uuid REFERENCES public.profiles,group_id uuid REFERENCES public.student_groups);
-- Realtime transport stub: records outgoing messages for recipient/privacy assertions.
CREATE TABLE realtime.messages(extension text,topic text,payload jsonb,event text,private boolean);
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON realtime.messages TO authenticated;
CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('realtime.topic',true) $$;
CREATE FUNCTION realtime.send(payload jsonb,event text,topic text,private boolean) RETURNS void LANGUAGE sql AS $$
 INSERT INTO realtime.messages VALUES('broadcast',topic,payload,event,private)
$$;
