CREATE TABLE public.ai_recommendation_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  signature TEXT NOT NULL,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '12 hours')
);

CREATE UNIQUE INDEX ai_recommendation_cache_user_idx ON public.ai_recommendation_cache (user_id);

GRANT SELECT ON public.ai_recommendation_cache TO authenticated;
GRANT ALL ON public.ai_recommendation_cache TO service_role;

ALTER TABLE public.ai_recommendation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own AI recommendations"
  ON public.ai_recommendation_cache FOR SELECT TO authenticated
  USING (auth.uid() = user_id);