CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  stripe_created_at TIMESTAMPTZ NOT NULL,
  created_at_stripe TIMESTAMPTZ NOT NULL,
  livemode BOOLEAN NOT NULL DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'processing'
    CHECK (processing_status IN ('processing', 'processed', 'ignored', 'error')),
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'failed', 'ignored')),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS created_at_stripe TIMESTAMPTZ;

UPDATE public.stripe_webhook_events
SET created_at_stripe = stripe_created_at
WHERE created_at_stripe IS NULL;

ALTER TABLE public.stripe_webhook_events
  ALTER COLUMN created_at_stripe SET NOT NULL;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processing';

UPDATE public.stripe_webhook_events
SET status = CASE processing_status
  WHEN 'processed' THEN 'processed'
  WHEN 'ignored' THEN 'ignored'
  WHEN 'error' THEN 'failed'
  ELSE 'processing'
END
WHERE status IS NULL OR status NOT IN ('processing', 'processed', 'failed', 'ignored');

ALTER TABLE public.stripe_webhook_events
  DROP CONSTRAINT IF EXISTS stripe_webhook_events_status_check;

ALTER TABLE public.stripe_webhook_events
  ADD CONSTRAINT stripe_webhook_events_status_check
  CHECK (status IN ('processing', 'processed', 'failed', 'ignored'));

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
  ON public.stripe_webhook_events(status);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type_created_at_stripe
  ON public.stripe_webhook_events(event_type, created_at_stripe DESC);
