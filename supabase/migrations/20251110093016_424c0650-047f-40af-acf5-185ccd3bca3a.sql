-- Create browsing_history table to track user content views
CREATE TABLE public.browsing_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  content_id text NOT NULL,
  content_type text NOT NULL,
  content_title text,
  poster_path text,
  viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.browsing_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for browsing_history
CREATE POLICY "Users can view their own browsing history"
ON public.browsing_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own browsing history"
ON public.browsing_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own browsing history"
ON public.browsing_history
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX idx_browsing_history_user_id ON public.browsing_history(user_id);
CREATE INDEX idx_browsing_history_viewed_at ON public.browsing_history(viewed_at DESC);