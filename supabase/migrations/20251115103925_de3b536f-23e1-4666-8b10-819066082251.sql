-- Add language and genre preference columns to profiles table
-- These will store arrays of preferences with their ranks (lower rank = higher priority)
ALTER TABLE public.profiles
ADD COLUMN language_preferences jsonb DEFAULT '[]'::jsonb,
ADD COLUMN genre_preferences jsonb DEFAULT '[]'::jsonb;

-- Add comments to document the structure
COMMENT ON COLUMN public.profiles.language_preferences IS 'Array of objects with structure: [{language: string, rank: number}]. Lower rank means higher priority.';
COMMENT ON COLUMN public.profiles.genre_preferences IS 'Array of objects with structure: [{genre: string, rank: number}]. Lower rank means higher priority.';