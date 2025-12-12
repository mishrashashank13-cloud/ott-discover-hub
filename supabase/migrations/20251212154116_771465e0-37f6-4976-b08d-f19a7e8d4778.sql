-- Drop the broken function and recreate with correct schema
DROP FUNCTION IF EXISTS public.send_due_reminders();

-- Create corrected function that matches the actual reminders table schema
-- This function triggers notifications for reminders where release_date is today
-- and last_notified_on is NULL (not yet notified)
CREATE OR REPLACE FUNCTION public.send_due_reminders()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
BEGIN
  -- Loop through reminders due today that haven't been notified yet
  FOR r IN
    SELECT id, content_id, content_title, content_type, release_date, user_id
    FROM public.reminders
    WHERE release_date::date <= CURRENT_DATE 
      AND last_notified_on IS NULL
  LOOP
    -- Send notification via pg_notify channel
    PERFORM pg_notify(
      'reminders_channel', 
      json_build_object(
        'id', r.id, 
        'content_id', r.content_id,
        'content_title', r.content_title,
        'content_type', r.content_type,
        'release_date', r.release_date,
        'user_id', r.user_id
      )::text
    );
    
    -- Mark as notified by setting last_notified_on
    UPDATE public.reminders 
    SET last_notified_on = CURRENT_DATE 
    WHERE id = r.id;
  END LOOP;
END;
$function$;