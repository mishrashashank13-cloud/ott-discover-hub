-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily reminders to run at 2 AM every day
SELECT cron.schedule(
  'send-daily-reminders',
  '0 2 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://yabzmahzobwuwxylcwoy.supabase.co/functions/v1/send-due-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhYnptYWh6b2J3dXd4eWxjd295Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMzE0NjcsImV4cCI6MjA3MjgwNzQ2N30.6e8_AHtks0vPIwp-eZlnsWDpQnHUssDAKDy6QzEvL0E"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
