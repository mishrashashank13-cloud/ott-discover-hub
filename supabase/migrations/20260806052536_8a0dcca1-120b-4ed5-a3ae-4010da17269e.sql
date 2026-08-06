CREATE TABLE public.streaming_availability_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL DEFAULT 'watchmode',
  content_type text NOT NULL,
  tmdb_id text NOT NULL,
  imdb_id text,
  external_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  region text NOT NULL DEFAULT 'IN',
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT streaming_cache_unique_key UNIQUE (source, content_type, tmdb_id, region)
);

GRANT SELECT ON public.streaming_availability_cache TO anon;
GRANT SELECT ON public.streaming_availability_cache TO authenticated;
GRANT ALL ON public.streaming_availability_cache TO service_role;

ALTER TABLE public.streaming_availability_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cached availability is publicly readable"
ON public.streaming_availability_cache
FOR SELECT
TO anon, authenticated
USING (true);

CREATE INDEX idx_streaming_cache_lookup
  ON public.streaming_availability_cache (source, content_type, tmdb_id, region);

CREATE TRIGGER update_streaming_cache_updated_at
BEFORE UPDATE ON public.streaming_availability_cache
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();