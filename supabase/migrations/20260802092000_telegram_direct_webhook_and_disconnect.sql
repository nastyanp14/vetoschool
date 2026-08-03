ALTER TABLE public.student_parent_links
  ADD COLUMN IF NOT EXISTS linked_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'telegram',
  ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE public.telegram_link_tokens
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

UPDATE public.telegram_link_tokens
SET status = 'used'
WHERE used_at IS NOT NULL
  AND status = 'active';

DROP POLICY IF EXISTS student_parent_links_student_delete ON public.student_parent_links;
CREATE POLICY student_parent_links_student_delete
ON public.student_parent_links
FOR DELETE
TO authenticated
USING (
  student_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE INDEX IF NOT EXISTS idx_student_parent_links_linked_at
  ON public.student_parent_links(student_id, linked_at DESC);
