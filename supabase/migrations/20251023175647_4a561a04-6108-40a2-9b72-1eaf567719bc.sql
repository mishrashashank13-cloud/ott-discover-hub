-- Fix signup failure: remove dependency on NEW.raw_user_meta_data and ensure trigger exists
-- 1) Drop existing trigger if it exists to avoid duplicate creation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'on_auth_user_created'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) THEN
    EXECUTE 'DROP TRIGGER on_auth_user_created ON auth.users;';
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- Some environments may not expose auth.users for DDL; ignore
  NULL;
END $$;

-- 2) Create function that avoids referencing raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_username text;
BEGIN
  -- Safely derive username from email; fall back to a short id prefix
  v_username := COALESCE(
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'user_' || substr(NEW.id::text, 1, 8)
  );

  -- Insert minimal profile row (mobile_number can be filled later in app)
  INSERT INTO public.profiles (user_id, email, username, mobile_number)
  VALUES (NEW.id, NEW.email, v_username, NULL);

  RETURN NEW;
END;
$$;

-- 3) Recreate the trigger to run after a user signs up
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'on_auth_user_created'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- If auth.users is not available for trigger creation in this environment, ignore
  NULL;
END $$;
