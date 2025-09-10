-- Add email column to profiles and create reminders table

-- 1) Add email to profiles if not exists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2) Update trigger function to also populate email from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, mobile_number, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'mobile_number',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3) Create reminders table
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_title TEXT,
  content_type TEXT,
  release_date DATE NOT NULL,
  last_notified_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_reminders_updated_at ON public.reminders;
CREATE TRIGGER update_reminders_updated_at
BEFORE UPDATE ON public.reminders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Policies: users can manage their own reminders
DROP POLICY IF EXISTS "Users can view their own reminders" ON public.reminders;
CREATE POLICY "Users can view their own reminders"
ON public.reminders FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own reminders" ON public.reminders;
CREATE POLICY "Users can insert their own reminders"
ON public.reminders FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reminders" ON public.reminders;
CREATE POLICY "Users can update their own reminders"
ON public.reminders FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own reminders" ON public.reminders;
CREATE POLICY "Users can delete their own reminders"
ON public.reminders FOR DELETE
USING (auth.uid() = user_id);


