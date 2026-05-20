
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS remind_at timestamptz,
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

-- Backfill remind_at for existing rows from release_date (9 AM UTC)
UPDATE public.reminders
SET remind_at = (release_date::timestamptz + INTERVAL '9 hours')
WHERE remind_at IS NULL;

-- Make remind_at required going forward
ALTER TABLE public.reminders
  ALTER COLUMN remind_at SET NOT NULL;

-- Fast lookup for the cron sweep
CREATE INDEX IF NOT EXISTS idx_reminders_due
  ON public.reminders (remind_at)
  WHERE notified_at IS NULL;
