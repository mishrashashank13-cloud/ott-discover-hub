/**
 * Streaming Availability - Frontend Helper
 * ----------------------------------------
 * Talks to the `streaming-availability` Edge Function, which is the only place
 * that knows the Watchmode API key. TMDB stays the source of all other data.
 *
 * The helper is deliberately provider-agnostic: the `source` argument lets us
 * plug in TVMaze / Trakt / AniList later without touching any UI code.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/** One watch option for a title (stream, rent, buy, ...). */
export interface AvailabilityOffer {
  provider_name: string;
  logo_url: string | null;
  type: 'stream' | 'rent' | 'buy' | 'free' | 'other';
  web_url: string | null;
  price: number | null;
  currency: string | null;
  format: string | null;
}

/** Full answer from the availability service. */
export interface AvailabilityResult {
  source: string;
  region: string;
  external_id: string | null;
  offers: AvailabilityOffer[];
}

/** What the caller must tell us so the title can be matched externally. */
export interface AvailabilityRequest {
  contentType: 'movie' | 'tv';
  tmdbId: number | string;
  imdbId?: string | null;
  title?: string | null;
  year?: string | number | null;
  region?: string;
  source?: string;
}

/**
 * Fetch streaming availability for a title.
 * Always resolves — on any failure it returns an empty offer list so the
 * details page can silently keep showing the existing TMDB providers.
 */
export const fetchStreamingAvailability = async (
  request: AvailabilityRequest,
): Promise<AvailabilityResult> => {
  const region = request.region ?? 'IN';
  const source = request.source ?? 'watchmode';

  try {
    const { data, error } = await supabase.functions.invoke('streaming-availability', {
      body: { ...request, region, source },
    });

    if (error || !data) {
      logger.error('Streaming availability lookup failed', error);
      return { source, region, external_id: null, offers: [] };
    }

    return {
      source: data.source ?? source,
      region: data.region ?? region,
      external_id: data.external_id ?? null,
      offers: Array.isArray(data.offers) ? data.offers : [],
    };
  } catch (error) {
    logger.error('Streaming availability lookup threw', error);
    return { source, region, external_id: null, offers: [] };
  }
};
