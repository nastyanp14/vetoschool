ALTER TABLE public.telegram_parent_accounts
  ADD COLUMN IF NOT EXISTS notify_billing boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_trials boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_weekly boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.telegram_parent_accounts.notify_weekly IS 'Weekly progress summary is opt-in: disabled by default.';