-- Add RLS policy for taste_classics table to allow public read access
CREATE POLICY "Anyone can view taste classics"
ON public.taste_classics
FOR SELECT
USING (true);