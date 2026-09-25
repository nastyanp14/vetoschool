ALTER TABLE public.trial_bookings
  ADD COLUMN IF NOT EXISTS correct_answers integer CHECK (correct_answers IS NULL OR correct_answers >= 0),
  ADD COLUMN IF NOT EXISTS total_questions integer CHECK (total_questions IS NULL OR total_questions > 0),
  ADD COLUMN IF NOT EXISTS percentage integer CHECK (percentage IS NULL OR percentage BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS english_level text CHECK (english_level IS NULL OR char_length(english_level) BETWEEN 2 AND 40),
  ADD COLUMN IF NOT EXISTS recommended_group text CHECK (recommended_group IS NULL OR char_length(recommended_group) BETWEEN 2 AND 160),
  ADD COLUMN IF NOT EXISTS age_group text CHECK (age_group IS NULL OR char_length(age_group) BETWEEN 2 AND 80),
  ADD COLUMN IF NOT EXISTS test_version text CHECK (test_version IS NULL OR char_length(test_version) BETWEEN 2 AND 80),
  ADD CONSTRAINT trial_bookings_assessment_result_consistency CHECK (
    correct_answers IS NULL
    OR (total_questions IS NOT NULL AND correct_answers <= total_questions)
  );

ALTER TABLE public.trial_bookings
  DROP CONSTRAINT IF EXISTS trial_bookings_preliminary_recommendation_check;

ALTER TABLE public.trial_bookings
  ADD CONSTRAINT trial_bookings_preliminary_recommendation_check CHECK (
    preliminary_recommendation IN ('Mini Kids', 'Kids Beginners', 'Junior Beginners', 'Kids A1', 'Junior A1')
  );
