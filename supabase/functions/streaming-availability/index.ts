/**
 * Streaming Availability Edge Function
 * ------------------------------------
 * PURPOSE (in plain words):
 *   BingeGuide keeps using TMDB for all "what is this title" information
 *   (poster, story, cast, ratings). This function only answers ONE question:
 *   "Where can I watch this title right now, and what does it cost?"
 *
 * WHY AN EDGE FUNCTION:
 *   The Watchmode API key must never reach the browser. It lives here, on the
 *   server, inside a Supabase secret (WATCHMODE_API_KEY).
 *
 * HOW IT WORKS (step by step):
 *   1. The browser asks for availability of a title (by TMDB id + type).
 *   2. We first look in the `streaming_availability_cache` table.
 *      If we have a fresh (< 24h old) answer, we return it immediately.
 *   3. Otherwise we ask the external provider (Watchmode), normalise the
 *      answer into our own simple shape, store it in the cache, and return it.
 *   4. If anything goes wrong we return an empty, valid answer so the UI can
 *      quietly fall back to the TMDB data it already shows.
 *
 * EXTENSIBILITY:
 *   Providers are registered in the `PROVIDERS` map below. Adding TVMaze,
 *   Trakt or AniList later means writing one more object with a `fetch`
 *   method that returns the same normalised shape — nothing else changes.
 */

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Shared types: the single shape every provider must return
// ---------------------------------------------------------------------------

/** One place where a title can be watched. */
interface AvailabilityOffer {
  provider_name: string;          // e.g. "Netflix"
  logo_url: string | null;        // absolute image URL (may be null)
  type: 'stream' | 'rent' | 'buy' | 'free' | 'other';
  web_url: string | null;         // deep link to the title on that platform
  price: number | null;           // rent/buy price when the provider reports it
  currency: string | null;        // e.g. "INR"
  format: string | null;          // e.g. "HD", "4K"
}

/** The full answer we hand back to the browser. */
interface AvailabilityResult {
  source: string;                 // which provider answered ("watchmode")
  region: string;                 // country code, we use "IN" (India)
  external_id: string | null;     // the id the provider used for this title
  offers: AvailabilityOffer[];    // may be empty — that is a valid answer
}

/** Everything a provider needs in order to identify a title. */
interface TitleLookup {
  contentType: 'movie' | 'tv';
  tmdbId: string;
  imdbId?: string | null;
  title?: string | null;
  year?: string | number | null;
  region: string;
}

// ---------------------------------------------------------------------------
// Watchmode provider implementation
// ---------------------------------------------------------------------------

const WATCHMODE_BASE = 'https://api.watchmode.com/v1';

/** Small helper: perform a GET request and parse JSON, or return null. */
async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      // Drain the body so the connection can be reused, then give up.
      await res.text();
      return null;
    }
    return await res.json();
  } catch (_error) {
    return null;
  }
}

/**
 * Find the Watchmode internal id for a title.
 * Matching order (most reliable first): TMDB id -> IMDb id -> title + year.
 */
async function findWatchmodeId(apiKey: string, lookup: TitleLookup): Promise<string | null> {
  const tmdbType = lookup.contentType === 'movie' ? 'movie' : 'tv';

  // 1) Search by TMDB id (Watchmode supports this directly).
  const byTmdb = await getJson(
    `${WATCHMODE_BASE}/search/?apiKey=${apiKey}&search_field=tmdb_${tmdbType}_id&search_value=${encodeURIComponent(lookup.tmdbId)}`,
  );
  const tmdbHit = byTmdb?.title_results?.[0]?.id;
  if (tmdbHit) return String(tmdbHit);

  // 2) Search by IMDb id when we have one.
  if (lookup.imdbId) {
    const byImdb = await getJson(
      `${WATCHMODE_BASE}/search/?apiKey=${apiKey}&search_field=imdb_id&search_value=${encodeURIComponent(lookup.imdbId)}`,
    );
    const imdbHit = byImdb?.title_results?.[0]?.id;
    if (imdbHit) return String(imdbHit);
  }

  // 3) Last resort: match on the title name, then prefer the right year.
  if (lookup.title) {
    const byName = await getJson(
      `${WATCHMODE_BASE}/autocomplete-search/?apiKey=${apiKey}&search_value=${encodeURIComponent(lookup.title)}&search_type=2`,
    );
    const results: any[] = byName?.results ?? [];
    const wantedYear = lookup.year ? String(lookup.year).slice(0, 4) : null;
    const match =
      (wantedYear && results.find((r) => String(r.year) === wantedYear)) || results[0];
    if (match?.id) return String(match.id);
  }

  return null;
}

/** Turn Watchmode's raw source list into our normalised offer list. */
function normaliseWatchmodeSources(sources: any[], region: string): AvailabilityOffer[] {
  const typeMap: Record<string, AvailabilityOffer['type']> = {
    sub: 'stream',
    rent: 'rent',
    buy: 'buy',
    free: 'free',
    tve: 'other',
  };

  // Keep only the requested region, then remove duplicate platform+type pairs.
  const seen = new Set<string>();
  const offers: AvailabilityOffer[] = [];

  for (const source of sources) {
    if (String(source?.region ?? '').toUpperCase() !== region.toUpperCase()) continue;

    const type = typeMap[String(source?.type)] ?? 'other';
    const key = `${source?.name}-${type}`;
    if (seen.has(key)) continue;
    seen.add(key);

    offers.push({
      provider_name: String(source?.name ?? 'Unknown'),
      logo_url: null, // filled in below from the Watchmode source catalog
      type,
      web_url: source?.web_url ? String(source.web_url) : null,
      price: typeof source?.price === 'number' ? source.price : null,
      currency: region.toUpperCase() === 'IN' ? 'INR' : null,
      format: source?.format ? String(source.format) : null,
    });
  }

  return offers;
}

/** Fetch the availability of one title from Watchmode. */
async function fetchFromWatchmode(lookup: TitleLookup): Promise<AvailabilityResult | null> {
  const apiKey = Deno.env.get('WATCHMODE_API_KEY');
  if (!apiKey) return null; // No key configured -> caller falls back to TMDB.

  const watchmodeId = await findWatchmodeId(apiKey, lookup);
  if (!watchmodeId) return null;

  const sources = await getJson(
    `${WATCHMODE_BASE}/title/${watchmodeId}/sources/?apiKey=${apiKey}&regions=${encodeURIComponent(lookup.region)}`,
  );
  if (!Array.isArray(sources)) return null;

  const offers = normaliseWatchmodeSources(sources, lookup.region);

  // Attach platform logos using Watchmode's public source catalog.
  const catalog = await getJson(`${WATCHMODE_BASE}/sources/?apiKey=${apiKey}`);
  if (Array.isArray(catalog)) {
    const logoByName = new Map<string, string>();
    for (const entry of catalog) {
      if (entry?.name && entry?.logo_100px) logoByName.set(String(entry.name), String(entry.logo_100px));
    }
    for (const offer of offers) {
      offer.logo_url = logoByName.get(offer.provider_name) ?? null;
    }
  }

  return {
    source: 'watchmode',
    region: lookup.region,
    external_id: watchmodeId,
    offers,
  };
}

/**
 * Provider registry. Add future integrations (TVMaze, Trakt, AniList, ...)
 * here — each one only needs a `fetch` returning an AvailabilityResult.
 */
const PROVIDERS: Record<string, { fetch: (lookup: TitleLookup) => Promise<AvailabilityResult | null> }> = {
  watchmode: { fetch: fetchFromWatchmode },
};

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Browsers send a preflight request before the real one.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // An empty but valid answer — used whenever enrichment is not possible.
  const emptyResult = (source: string, region: string): AvailabilityResult => ({
    source,
    region,
    external_id: null,
    offers: [],
  });

  try {
    // Only legitimate Supabase clients (anon key or a signed-in user) may call this.
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('apikey');
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));

    // ---- Validate input (never trust the browser) -------------------------
    const contentType = body?.contentType === 'tv' ? 'tv' : 'movie';
    const tmdbId = String(body?.tmdbId ?? '').trim();
    const region = String(body?.region ?? 'IN').trim().toUpperCase().slice(0, 2) || 'IN';
    const source = String(body?.source ?? 'watchmode').trim().toLowerCase();

    if (!/^\d{1,12}$/.test(tmdbId)) {
      return json({ error: 'A valid numeric tmdbId is required' }, 400);
    }
    if (!PROVIDERS[source]) {
      return json({ error: 'Unknown availability source' }, 400);
    }

    const lookup: TitleLookup = {
      contentType,
      tmdbId,
      imdbId: typeof body?.imdbId === 'string' ? body.imdbId.slice(0, 20) : null,
      title: typeof body?.title === 'string' ? body.title.slice(0, 200) : null,
      year: typeof body?.year === 'string' || typeof body?.year === 'number' ? body.year : null,
      region,
    };

    // Service-role client: it writes to the cache table on behalf of the app.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ---- Step 1: serve from cache when it is still fresh -------------------
    const { data: cached } = await supabase
      .from('streaming_availability_cache')
      .select('data, external_id, expires_at')
      .eq('source', source)
      .eq('content_type', contentType)
      .eq('tmdb_id', tmdbId)
      .eq('region', region)
      .maybeSingle();

    if (cached && new Date(cached.expires_at as string) > new Date()) {
      return json({ ...(cached.data as Record<string, unknown>), cached: true });
    }

    // ---- Step 2: ask the external provider --------------------------------
    const fresh = await PROVIDERS[source].fetch(lookup);

    if (!fresh) {
      // Nothing usable. Return stale cache if we have it, else an empty answer.
      if (cached?.data) return json({ ...(cached.data as Record<string, unknown>), cached: true, stale: true });
      return json(emptyResult(source, region));
    }

    // ---- Step 3: store the fresh answer for the next 24 hours -------------
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('streaming_availability_cache')
      .upsert(
        {
          source,
          content_type: contentType,
          tmdb_id: tmdbId,
          region,
          imdb_id: lookup.imdbId,
          external_id: fresh.external_id,
          data: fresh as unknown as Record<string, unknown>,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'source,content_type,tmdb_id,region' },
      );

    return json({ ...fresh, cached: false });
  } catch (_error) {
    // Never break the details page: answer with an empty, valid payload.
    return json(emptyResult('watchmode', 'IN'));
  }
});
