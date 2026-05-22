/**
 * TMDB Proxy Edge Function
 *
 * This edge function acts as a secure proxy for TMDB API requests.
 * It keeps the TMDB API key secure on the server side and prevents
 * exposure in client-side JavaScript bundles.
 *
 * BingeGuide rule (enforced here):
 *   Only show titles that are available on an OTT provider in India.
 *   If a title has no India OTT availability info, it is filtered out.
 *   This is enforced at the proxy so every listing surface (home, search,
 *   "view more" pages) gets the same India-only OTT content.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// TMDB API configuration
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// -----------------------------------------------------------------------------
// India OTT provider whitelist
//
// These are TMDB provider IDs for the major OTT platforms that operate in
// India. Any title we surface in BingeGuide listings must be available on at
// least one of these. Adding `with_watch_providers` + `watch_region=IN` to a
// TMDB discover query asks TMDB to return only titles streamable on these
// providers in India.
// -----------------------------------------------------------------------------
// 8=Netflix, 119=Amazon Prime Video, 122=Hotstar, 337=Disney+,
// 232=Zee5, 237=SonyLIV, 350=Apple TV+, 220=Jio Cinema (legacy),
// 463=Jio Cinema, 531=Paramount+, 283=Crunchyroll, 2336=MX Player
const INDIA_OTT_PROVIDERS = '8|119|122|337|232|237|350|220|463|531|283|2336';
const INDIA_REGION = 'IN';

// Module-level flag: once we discover the access token is invalid, skip it
// permanently for the lifetime of this isolate.
let accessTokenDisabled = false;

/**
 * Detects whether the stored "access token" is actually just a v3 API key.
 */
function looksLikeTmdbApiKey(value: string): boolean {
  return /^[a-f0-9]{32}$/i.test(value.trim());
}

async function tmdbRequest(endpoint: string): Promise<any> {
  const rawAccessToken = Deno.env.get('TMDB_ACCESS_TOKEN') ?? '';
  const rawApiKey = Deno.env.get('TMDB_API_KEY') ?? '';

  const accessToken = rawAccessToken.trim().replace(/^bearer\s+/i, '');
  const apiKey = rawApiKey.trim();
  const accessTokenIsActuallyApiKey = looksLikeTmdbApiKey(accessToken);
  const fallbackApiKey = apiKey || (accessTokenIsActuallyApiKey ? accessToken : '');

  if (!accessToken && !apiKey) {
    console.error('TMDB credentials are not configured');
    throw new Error('TMDB credentials not configured');
  }

  const runHttpRequest = async (): Promise<Response> => {
    const useAccessToken = Boolean(accessToken && !accessTokenDisabled && !accessTokenIsActuallyApiKey);

    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Encoding': 'identity',
    };

    if (useAccessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    } else if (fallbackApiKey) {
      url.searchParams.set('api_key', fallbackApiKey);
    } else {
      throw new Error('TMDB access token invalid and no TMDB_API_KEY fallback configured');
    }

    console.log(`TMDB request: ${url.pathname}${url.search}`);

    let response = await fetch(url.toString(), { headers });

    if (response.status === 401 && useAccessToken && fallbackApiKey) {
      console.warn('TMDB access token returned 401; falling back to TMDB_API_KEY');
      try { await response.text(); } catch { /* ignore */ }
      accessTokenDisabled = true;

      const retryUrl = new URL(`${TMDB_BASE_URL}${endpoint}`);
      retryUrl.searchParams.set('api_key', fallbackApiKey);
      response = await fetch(retryUrl.toString(), {
        headers: { Accept: 'application/json', 'Accept-Encoding': 'identity' },
      });
    }

    if (!response.ok) {
      const bodySnippet = await response.text().then((t) => t.slice(0, 300)).catch(() => '');
      console.error(`TMDB API error: ${response.status} for ${endpoint}`);
      if (bodySnippet) console.error(`TMDB API body: ${bodySnippet}`);
      throw new Error(`TMDB API error: ${response.status}`);
    }

    return response;
  };

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await runHttpRequest();
      const responseText = await response.text();
      if (!responseText.trim()) throw new Error('TMDB response body was empty');
      return JSON.parse(responseText);
    } catch (unknownError) {
      const safeMessage = unknownError instanceof Error ? unknownError.message : String(unknownError);
      const normalizedMessage = safeMessage.toLowerCase();
      const isRetryable = normalizedMessage.includes('unexpected end of file')
        || normalizedMessage.includes('body was empty')
        || normalizedMessage.includes('connection reset')
        || normalizedMessage.includes('broken pipe');

      if (isRetryable && attempt < maxAttempts) {
        console.warn(`Retrying TMDB request for ${endpoint} (attempt ${attempt})`);
        continue;
      }
      throw unknownError;
    }
  }
  throw new Error('TMDB request failed after retries');
}

/**
 * Fetch multiple pages from TMDB and combine results.
 */
async function tmdbMultiPage(endpoint: string, pages: number = 3): Promise<any> {
  const allResults: any[] = [];
  for (let page = 1; page <= pages; page++) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const data = await tmdbRequest(`${endpoint}${separator}page=${page}`);
    if (data.results) allResults.push(...data.results);
    if (data.page >= data.total_pages) break;
  }
  return { results: allResults };
}

/**
 * Adds the India OTT-availability filters to a discover query.
 * We append them only if the caller didn't already set them, so explicit
 * filters from the UI still win.
 */
function withIndiaOttFilters(params: URLSearchParams): URLSearchParams {
  if (!params.has('with_watch_providers')) {
    params.set('with_watch_providers', INDIA_OTT_PROVIDERS);
  }
  if (!params.has('watch_region')) {
    params.set('watch_region', INDIA_REGION);
  }
  return params;
}

/**
 * For an array of search results (each having id + media_type), keep only
 * those that are streamable on an India OTT provider. Items missing
 * media_type, or whose provider lookup returns no India entry, are dropped.
 *
 * This enforces the rule for the search endpoint, which can't be filtered
 * server-side by TMDB directly.
 */
async function filterSearchResultsByIndiaOtt(results: any[]): Promise<any[]> {
  // India OTT provider IDs as a Set for fast membership checks.
  const allowed = new Set(INDIA_OTT_PROVIDERS.split('|').map((id) => Number(id)));

  // Only movies and tv shows can have watch providers; people are dropped.
  const candidates = results.filter((r) => r && (r.media_type === 'movie' || r.media_type === 'tv'));

  // Limit concurrent provider lookups to avoid hammering TMDB.
  const concurrency = 6;
  const kept: any[] = [];

  for (let i = 0; i < candidates.length; i += concurrency) {
    const batch = candidates.slice(i, i + concurrency);
    const checks = await Promise.all(batch.map(async (item) => {
      try {
        const data = await tmdbRequest(`/${item.media_type}/${item.id}/watch/providers`);
        const india = data?.results?.IN;
        if (!india) return null;
        // A title counts as "available in India" if any of flatrate/ads/free
        // matches our OTT whitelist. We exclude buy/rent because rule says
        // listing must be on a network/OTT (subscription or free).
        const buckets = [india.flatrate, india.ads, india.free].filter(Boolean) as any[][];
        const hasAllowed = buckets.some((bucket) =>
          bucket.some((p) => allowed.has(p.provider_id))
        );
        return hasAllowed ? item : null;
      } catch {
        return null;
      }
    }));
    for (const k of checks) if (k) kept.push(k);
  }

  return kept;
}

function isCatalogRequest(path: string): boolean {
  return [
    '/trending/movie', '/trending/tv', '/trending/all',
    '/upcoming/movie', '/upcoming/tv',
    '/popular/movie', '/popular/tv',
    '/discover/movie', '/discover/tv',
    '/search', '/genre/movie', '/genre/tv', '/watch-providers',
  ].includes(path);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Lightweight access control: require the project's anon key.
  const expectedKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const apiKeyHeader = req.headers.get('apikey') ?? '';
  const authHeader = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const presented = apiKeyHeader || authHeader;

  if (!expectedKey || presented !== expectedKey) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/tmdb-proxy', '');
    const searchParams = url.searchParams;

    console.log(`Processing request: ${path}`);

    let responseData: any;

    // =========================================================================
    // Trending endpoints
    // Native /trending doesn't support watch_providers filter, so we route
    // through /discover sorted by popularity (effectively "what's hot on
    // India OTT right now").
    // =========================================================================
    if (path === '/trending/movie') {
      const params = withIndiaOttFilters(new URLSearchParams());
      params.set('sort_by', 'popularity.desc');
      responseData = await tmdbMultiPage(`/discover/movie?${params.toString()}`);
    }
    else if (path === '/trending/tv') {
      const params = withIndiaOttFilters(new URLSearchParams());
      params.set('sort_by', 'popularity.desc');
      responseData = await tmdbMultiPage(`/discover/tv?${params.toString()}`);
    }
    else if (path === '/trending/all') {
      // "All" combines movies + tv, both India-OTT filtered.
      const movieParams = withIndiaOttFilters(new URLSearchParams());
      movieParams.set('sort_by', 'popularity.desc');
      const tvParams = withIndiaOttFilters(new URLSearchParams());
      tvParams.set('sort_by', 'popularity.desc');
      const [movies, tv] = await Promise.all([
        tmdbMultiPage(`/discover/movie?${movieParams.toString()}`),
        tmdbMultiPage(`/discover/tv?${tvParams.toString()}`),
      ]);
      responseData = { results: [...movies.results, ...tv.results] };
    }
    // =========================================================================
    // Upcoming endpoints - future releases on India OTT only
    // =========================================================================
    else if (path === '/upcoming/movie') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      const params = withIndiaOttFilters(new URLSearchParams());
      params.set('primary_release_date.gte', tomorrowStr);
      params.set('sort_by', 'primary_release_date.asc');
      responseData = await tmdbMultiPage(`/discover/movie?${params.toString()}`);
    }
    else if (path === '/upcoming/tv') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      const params = withIndiaOttFilters(new URLSearchParams());
      params.set('first_air_date.gte', tomorrowStr);
      params.set('sort_by', 'first_air_date.asc');
      responseData = await tmdbMultiPage(`/discover/tv?${params.toString()}`);
    }
    // =========================================================================
    // Popular endpoints - India OTT only
    // =========================================================================
    else if (path === '/popular/movie') {
      const params = withIndiaOttFilters(new URLSearchParams());
      params.set('sort_by', 'popularity.desc');
      responseData = await tmdbMultiPage(`/discover/movie?${params.toString()}`);
    }
    else if (path === '/popular/tv') {
      const params = withIndiaOttFilters(new URLSearchParams());
      params.set('sort_by', 'popularity.desc');
      responseData = await tmdbMultiPage(`/discover/tv?${params.toString()}`);
    }
    // =========================================================================
    // Search endpoint - filter results by India OTT availability
    // =========================================================================
    else if (path === '/search') {
      const query = searchParams.get('query');
      if (!query || query.length < 2) {
        return new Response(
          JSON.stringify({ error: 'Query must be at least 2 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const raw = await tmdbRequest(`/search/multi?query=${encodeURIComponent(query)}&region=IN`);
      const filtered = await filterSearchResultsByIndiaOtt(raw?.results ?? []);
      responseData = { ...raw, results: filtered };
    }
    // =========================================================================
    // Movie details and credits
    // =========================================================================
    else if (path.match(/^\/movie\/(\d+)$/)) {
      responseData = await tmdbRequest(`/movie/${path.split('/')[2]}?language=en-US`);
    }
    else if (path.match(/^\/movie\/(\d+)\/credits$/)) {
      responseData = await tmdbRequest(`/movie/${path.split('/')[2]}/credits`);
    }
    else if (path.match(/^\/movie\/(\d+)\/watch-providers$/)) {
      responseData = await tmdbRequest(`/movie/${path.split('/')[2]}/watch/providers`);
    }
    // =========================================================================
    // TV show details and credits
    // =========================================================================
    else if (path.match(/^\/tv\/(\d+)$/)) {
      responseData = await tmdbRequest(`/tv/${path.split('/')[2]}?language=en-US`);
    }
    else if (path.match(/^\/tv\/(\d+)\/credits$/)) {
      responseData = await tmdbRequest(`/tv/${path.split('/')[2]}/credits`);
    }
    else if (path.match(/^\/tv\/(\d+)\/watch-providers$/)) {
      responseData = await tmdbRequest(`/tv/${path.split('/')[2]}/watch/providers`);
    }
    // =========================================================================
    // Discover endpoints - default to India OTT availability
    // =========================================================================
    else if (path === '/discover/movie') {
      const params = new URLSearchParams();
      searchParams.forEach((value, key) => params.append(key, value));
      withIndiaOttFilters(params);
      if (!params.has('sort_by')) params.set('sort_by', 'popularity.desc');
      responseData = await tmdbMultiPage(`/discover/movie?${params.toString()}`);
    }
    else if (path === '/discover/tv') {
      const params = new URLSearchParams();
      searchParams.forEach((value, key) => params.append(key, value));
      withIndiaOttFilters(params);
      if (!params.has('sort_by')) params.set('sort_by', 'popularity.desc');
      responseData = await tmdbMultiPage(`/discover/tv?${params.toString()}`);
    }
    // =========================================================================
    // Genre and watch-providers passthroughs
    // =========================================================================
    else if (path === '/genre/movie') {
      responseData = await tmdbRequest('/genre/movie/list?language=en-US');
    }
    else if (path === '/genre/tv') {
      responseData = await tmdbRequest('/genre/tv/list?language=en-US');
    }
    else if (path === '/watch-providers') {
      const region = searchParams.get('watch_region') || INDIA_REGION;
      responseData = await tmdbRequest(`/watch/providers/movie?watch_region=${region}`);
    }
    else {
      console.error(`Unknown endpoint: ${path}`);
      return new Response(
        JSON.stringify({ error: 'Unknown endpoint' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (unknownError) {
    const safeMessage = unknownError instanceof Error ? unknownError.message : String(unknownError);
    console.error('TMDB proxy error:', safeMessage);

    const failedUrl = new URL(req.url);
    const failedPath = failedUrl.pathname.replace('/tmdb-proxy', '');

    if (isCatalogRequest(failedPath)) {
      console.warn(`Returning fallback payload for catalog endpoint: ${failedPath}`);
      return new Response(
        JSON.stringify({ results: [], fallback: true, error: 'Temporarily unavailable' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Failed to fetch content data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
