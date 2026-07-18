ALTER TABLE public.dictionary_words
ADD COLUMN IF NOT EXISTS audio_url text;
