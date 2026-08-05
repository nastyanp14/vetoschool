ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'ru';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, lang)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'lang', ''), 'ru')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        lang = COALESCE(NULLIF(EXCLUDED.lang, ''), public.profiles.lang);
  RETURN NEW;
END;
$$;