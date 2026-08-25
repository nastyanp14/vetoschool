-- Restore the new-user role assignment that was lost when the language column
-- was added to profiles. This preserves the newer lang behavior.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_email text;
  user_name text;
  user_lang text;
  role_to_assign public.app_role;
BEGIN
  user_email := lower(coalesce(new.email, ''));
  user_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(user_email, '@', 1),
    'Student'
  );
  user_lang := coalesce(nullif(new.raw_user_meta_data ->> 'lang', ''), 'ru');

  IF user_email = 'vetoschool.english@gmail.com' THEN
    role_to_assign := 'admin'::public.app_role;
  ELSIF EXISTS (SELECT 1 FROM public.teachers t WHERE lower(t.email) = user_email) THEN
    role_to_assign := 'teacher'::public.app_role;
  ELSE
    role_to_assign := 'student'::public.app_role;
  END IF;

  INSERT INTO public.profiles (id, email, name, lang, has_access, payment_status, access_status)
  VALUES (
    new.id,
    user_email,
    user_name,
    user_lang,
    role_to_assign::text = 'admin',
    CASE WHEN role_to_assign::text = 'admin' THEN 'paid'::public.payment_status ELSE 'unpaid'::public.payment_status END,
    CASE WHEN role_to_assign::text = 'admin' THEN 'active'::public.access_status ELSE 'pending'::public.access_status END
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    lang = COALESCE(NULLIF(EXCLUDED.lang, ''), public.profiles.lang),
    name = COALESCE(NULLIF(public.profiles.name, ''), EXCLUDED.name);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, role_to_assign)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.teachers
  SET teacher_user_id = new.id
  WHERE lower(email) = user_email
    AND teacher_user_id IS NULL;

  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

INSERT INTO public.user_roles (user_id, role)
SELECT
  p.id,
  CASE
    WHEN lower(p.email) = 'vetoschool.english@gmail.com' THEN 'admin'::public.app_role
    WHEN EXISTS (SELECT 1 FROM public.teachers t WHERE lower(t.email) = lower(p.email)) THEN 'teacher'::public.app_role
    ELSE 'student'::public.app_role
  END
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_roles ur
  WHERE ur.user_id = p.id
);

UPDATE public.teachers t
SET teacher_user_id = p.id
FROM public.profiles p
WHERE lower(t.email) = lower(p.email)
  AND t.teacher_user_id IS NULL;
