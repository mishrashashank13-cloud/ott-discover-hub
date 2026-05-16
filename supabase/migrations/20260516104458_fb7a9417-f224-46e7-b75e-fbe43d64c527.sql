
-- Harden handle_new_user trigger: validate/sanitize user-controlled metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  base_username text;
  candidate text;
  attempt integer := 0;
BEGIN
  -- Sanitize: derive base username from email prefix, strip unsafe chars, cap length
  base_username := COALESCE(
    NULLIF(
      substring(
        regexp_replace(split_part(COALESCE(NEW.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g'),
        1, 50
      ),
      ''
    ),
    'user_' || substr(NEW.id::text, 1, 8)
  );

  LOOP
    IF attempt = 0 THEN
      candidate := base_username;
    ELSE
      candidate := substring(base_username, 1, 40) || '_' ||
                   substr(md5(clock_timestamp()::text || random()::text), 1, 6);
    END IF;

    INSERT INTO public.profiles (user_id, email, username, mobile_number)
    VALUES (NEW.id, NEW.email, candidate, NULL)
    ON CONFLICT (username) DO NOTHING;

    IF FOUND THEN
      EXIT;
    END IF;

    attempt := attempt + 1;
    IF attempt > 5 THEN
      candidate := 'user_' || substr(md5(NEW.id::text), 1, 8);
      INSERT INTO public.profiles (user_id, email, username, mobile_number)
      VALUES (NEW.id, NEW.email, candidate, NULL)
      ON CONFLICT (username) DO NOTHING;
      EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Lock down internal_secrets: explicit restrictive deny on all access from non-service roles
DROP POLICY IF EXISTS "Deny all access to internal_secrets" ON public.internal_secrets;
CREATE POLICY "Deny all access to internal_secrets"
ON public.internal_secrets
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- Make contact_submissions SELECT policy explicit (service role only via restrictive deny)
DROP POLICY IF EXISTS "Service role can view submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Deny client reads of contact submissions" ON public.contact_submissions;
CREATE POLICY "Deny client reads of contact submissions"
ON public.contact_submissions
AS RESTRICTIVE
FOR SELECT
TO authenticated, anon
USING (false);
