
-- Remove old reminder jobs (daily-only and the pg_notify minute job).
SELECT cron.unschedule(jobid) FROM cron.job
 WHERE jobname = 'send-daily-reminders'
    OR command ILIKE '%send_due_reminders()%';

-- New job: every 5 minutes, call the edge function with the stored key.
SELECT cron.schedule(
  'send-due-reminders-5min',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://yabzmahzobwuwxylcwoy.supabase.co/functions/v1/send-due-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Function-Key', (
          SELECT key_value FROM public.internal_secrets
          WHERE key_name = 'reminder_function_key'
        )
      ),
      body := '{}'::jsonb
    );
  $$
);
