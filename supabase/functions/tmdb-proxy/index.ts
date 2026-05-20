/**
 * TMDB Proxy Edge Function
 * 
 * This edge function acts as a secure proxy for TMDB API requests.
 * It keeps the TMDB API key secure on the server side and prevents
 * exposure in client-side JavaScript bundles.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// TMDB API configuration
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Make an authenticated request to TMDB.
 *
 * Why this exists:
 * - We NEVER call TMDB directly from the browser (it would expose credentials).
 * - This function reads TMDB credentials from server-side secrets.
 *
 * Supported credentials (either one is enough):
 * - TMDB_ACCESS_TOKEN: TMDB v4 Read Access Token (recommended)
 * - TMDB_API_KEY: TMDB v3 API Key (fallback)
 */
// Module-level flag: once we discover the access token is invalid, skip it
// permanently for the lifetime of this isolate. Avoids paying the 401 + retry
// cost on every request, which was triggering "unexpected end of file" errors
// from intermittent TMDB connection drops on the doubled requests.
let accessTokenDisabled = false;

async function tmdbRequest(endpoint: string): Promise<Response> {
  // Read secrets from the Edge Function environment (server-side only).
  const rawAccessToken = Deno.env.get('TMDB_ACCESS_TOKEN') ?? '';
  const rawApiKey = Deno.env.get('TMDB_API_KEY') ?? '';

  // Normalize input to avoid common copy/paste mistakes (Bearer prefix, whitespace).
  const accessToken = rawAccessToken.trim().replace(/^bearer\s+/i, '');
  const apiKey = rawApiKey.trim();

  if (!accessToken && !apiKey) {
    console.error('TMDB credentials are not configured (TMDB_ACCESS_TOKEN / TMDB_API_KEY missing)');
    throw new Error('TMDB credentials not configured');
  }

  // Pick auth strategy: prefer v4 token unless we've already learned it's bad.
  const useAccessToken = accessToken && !accessTokenDisabled;

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (useAccessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (apiKey) {
    url.searchParams.set('api_key', apiKey);
  } else {
    // Access token disabled but no api key fallback exists.
    throw new Error('TMDB access token invalid and no TMDB_API_KEY fallback configured');
  }

  console.log(`TMDB request: ${url.pathname}${url.search}`);

  let response = await fetch(url.toString(), { headers });

  // If v4 token is rejected and we have a v3 api key, fall back once and
  // remember the failure so subsequent requests skip the v4 attempt entirely.
  if (response.status === 401 && useAccessToken && apiKey) {
    console.warn('TMDB access token returned 401; disabling token, falling back to TMDB_API_KEY');
    // Drain the failed response body so the connection can be released cleanly.
    try { await response.body?.cancel(); } catch { /* ignore */ }
    accessTokenDisabled = true;

    const retryUrl = new URL(`${TMDB_BASE_URL}${endpoint}`);
    retryUrl.searchParams.set('api_key', apiKey);
    response = await fetch(retryUrl.toString(), { headers: { Accept: 'application/json' } });
  }

  if (!response.ok) {
    // Capture a short snippet of TMDB's response body for debugging.
    // (No secrets are logged here.)
    const bodySnippet = await response
      .text()
      .then((t) => t.slice(0, 300))
      .catch(() => '');

    console.error(`TMDB API error: ${response.status} for ${endpoint}`);
    if (bodySnippet) console.error(`TMDB API body (first 300 chars): ${bodySnippet}`);

    throw new Error(`TMDB API error: ${response.status}`);
  }

  return response;
}

/**
 * Fetch multiple pages from TMDB and combine results
 * Used for endpoints that need more than 20 results
 */
async function tmdbMultiPage(endpoint: string, pages: number = 3): Promise<any> {
  const allResults: any[] = [];
  
  for (let page = 1; page <= pages; page++) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await tmdbRequest(`${endpoint}${separator}page=${page}`);
    const data = await response.json();
    
    if (data.results) {
      allResults.push(...data.results);
    }
    
    // Stop if we've reached the last page
    if (data.page >= data.total_pages) break;
  }

  return { results: allResults };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ---------------------------------------------------------------------------
  // Lightweight access control:
  // Require the caller to present the project's Supabase publishable (anon) key
  // via either the `apikey` header or `Authorization: Bearer <key>` header.
  // This prevents random third parties from abusing the proxy to burn through
  // TMDB API quota, while still allowing the BingeGuide frontend (which always
  // ships the publishable key) to call the function without a signed-in user.
  // ---------------------------------------------------------------------------
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

    // Route handling based on path
    // =========================================================================
    // Trending endpoints
    // =========================================================================
    if (path === '/trending/movie') {
      responseData = await tmdbMultiPage('/trending/movie/week?region=IN');
    } 
    else if (path === '/trending/tv') {
      responseData = await tmdbMultiPage('/trending/tv/week?region=IN');
    }
    else if (path === '/trending/all') {
      responseData = await tmdbMultiPage('/trending/all/week?region=IN');
    }
    // =========================================================================
    // Upcoming endpoints - Filter for future releases only (release_date > today)
    // =========================================================================
    else if (path === '/upcoming/movie') {
      // Use tomorrow's date to ensure we only get truly upcoming movies
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      responseData = await tmdbMultiPage(`/discover/movie?region=IN&primary_release_date.gte=${tomorrowStr}&sort_by=primary_release_date.asc`);
    }
    else if (path === '/upcoming/tv') {
      // Use tomorrow's date to ensure we only get truly upcoming TV shows
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      responseData = await tmdbMultiPage(`/discover/tv?watch_region=IN&first_air_date.gte=${tomorrowStr}&sort_by=first_air_date.asc`);
    }
    // =========================================================================
    // Popular endpoints
    // =========================================================================
    else if (path === '/popular/movie') {
      responseData = await tmdbMultiPage('/movie/popular?region=IN');
    }
    else if (path === '/popular/tv') {
      responseData = await tmdbMultiPage('/tv/popular?watch_region=IN');
    }
    // =========================================================================
    // Search endpoint
    // =========================================================================
    else if (path === '/search') {
      const query = searchParams.get('query');
      if (!query || query.length < 2) {
        return new Response(
          JSON.stringify({ error: 'Query must be at least 2 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const response = await tmdbRequest(`/search/multi?query=${encodeURIComponent(query)}&region=IN`);
      responseData = await response.json();
    }
    // =========================================================================
    // Movie details and credits
    // =========================================================================
    else if (path.match(/^\/movie\/(\d+)$/)) {
      const movieId = path.split('/')[2];
      const response = await tmdbRequest(`/movie/${movieId}?language=en-US`);
      responseData = await response.json();
    }
    else if (path.match(/^\/movie\/(\d+)\/credits$/)) {
      const movieId = path.split('/')[2];
      const response = await tmdbRequest(`/movie/${movieId}/credits`);
      responseData = await response.json();
    }
    else if (path.match(/^\/movie\/(\d+)\/watch-providers$/)) {
      const movieId = path.split('/')[2];
      const response = await tmdbRequest(`/movie/${movieId}/watch/providers`);
      responseData = await response.json();
    }
    // =========================================================================
    // TV show details and credits
    // =========================================================================
    else if (path.match(/^\/tv\/(\d+)$/)) {
      const tvId = path.split('/')[2];
      const response = await tmdbRequest(`/tv/${tvId}?language=en-US`);
      responseData = await response.json();
    }
    else if (path.match(/^\/tv\/(\d+)\/credits$/)) {
      const tvId = path.split('/')[2];
      const response = await tmdbRequest(`/tv/${tvId}/credits`);
      responseData = await response.json();
    }
    else if (path.match(/^\/tv\/(\d+)\/watch-providers$/)) {
      const tvId = path.split('/')[2];
      const response = await tmdbRequest(`/tv/${tvId}/watch/providers`);
      responseData = await response.json();
    }
    // =========================================================================
    // Discover endpoints (movies and TV)
    // =========================================================================
    else if (path === '/discover/movie') {
      // Forward caller's query params first, then fill in defaults only if missing.
      // This prevents duplicate keys (e.g. two `region=IN`) which TMDB rejects with 400.
      const params = new URLSearchParams();
      searchParams.forEach((value, key) => {
        params.append(key, value);
      });
      if (!params.has('region')) params.set('region', 'IN');
      if (!params.has('sort_by')) params.set('sort_by', 'popularity.desc');

      responseData = await tmdbMultiPage(`/discover/movie?${params.toString()}`);
    }
    else if (path === '/discover/tv') {
      // Forward caller's query params first, then fill in defaults only if missing.
      // Avoids duplicate `watch_region` which produces a TMDB 400 "Invalid parameters".
      const params = new URLSearchParams();
      searchParams.forEach((value, key) => {
        params.append(key, value);
      });
      if (!params.has('watch_region')) params.set('watch_region', 'IN');
      if (!params.has('sort_by')) params.set('sort_by', 'popularity.desc');

      responseData = await tmdbMultiPage(`/discover/tv?${params.toString()}`);
    }
    // =========================================================================
    // Genre endpoints
    // =========================================================================
    else if (path === '/genre/movie') {
      const response = await tmdbRequest('/genre/movie/list?language=en-US');
      responseData = await response.json();
    }
    else if (path === '/genre/tv') {
      const response = await tmdbRequest('/genre/tv/list?language=en-US');
      responseData = await response.json();
    }
    // =========================================================================
    // Watch providers endpoint
    // =========================================================================
    else if (path === '/watch-providers') {
      const region = searchParams.get('watch_region') || 'IN';
      const response = await tmdbRequest(`/watch/providers/movie?watch_region=${region}`);
      responseData = await response.json();
    }
    // =========================================================================
    // Unknown endpoint
    // =========================================================================
    else {
      console.error(`Unknown endpoint: ${path}`);
      return new Response(
        JSON.stringify({ error: 'Unknown endpoint' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (unknownError) {
    // We keep the client response generic (security best practice),
    // but we log enough on the server to diagnose the issue.
    const safeMessage = unknownError instanceof Error ? unknownError.message : String(unknownError);

    console.error('TMDB proxy error:', safeMessage);

    return new Response(
      JSON.stringify({ error: 'Failed to fetch content data' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
