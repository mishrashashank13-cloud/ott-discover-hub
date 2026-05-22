
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.reminders;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_due_reminders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_due_reminders() FROM anon, authenticated;

REVOKE SELECT ON public.taste_classics FROM anon;
DROP POLICY IF EXISTS "Anyone can view taste classics" ON public.taste_classics;
CREATE POLICY "Authenticated users can view taste classics"
ON public.taste_classics
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
CREATE POLICY "Anyone can submit valid contact form"
ON public.contact_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(email) BETWEEN 5 AND 254
  AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND comments IS NOT NULL
  AND length(comments) BETWEEN 1 AND 5000
  AND (phone_number IS NULL OR length(phone_number) <= 32)
);
