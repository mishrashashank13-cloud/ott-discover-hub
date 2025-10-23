-- Fix handle_new_user to match current profiles schema and add trigger
-- 1) Drop existing trigger if it exists
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
  -- auth.users may not exist in this environment; ignore
  NULL;
END $$;

-- 2) Create function that inserts proper columns into public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_username text;
  v_mobile   text;
BEGIN
  -- Derive values from user metadata
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(COALESCE(NEW.email, ''), '@', 1),
    'user_' || substr(NEW.id::text, 1, 8)
  );
  v_mobile := NEW.raw_user_meta_data->>'mobile_number';

  -- Insert into profiles using current schema
  INSERT INTO public.profiles (user_id, email, username, mobile_number)
  VALUES (NEW.id, NEW.email, v_username, v_mobile);

  RETURN NEW;
END;
$$;

-- 3) Recreate the trigger to run after a user signs up
DO $$
BEGIN
  -- Create trigger only if it doesn't already exist
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
END $$;