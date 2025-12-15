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
 * Make authenticated request to TMDB API
 * Uses the TMDB_ACCESS_TOKEN from environment variables
 */
async function tmdbRequest(endpoint: string): Promise<Response> {
  const token = Deno.env.get('TMDB_ACCESS_TOKEN');
  
  if (!token) {
    console.error('TMDB_ACCESS_TOKEN not configured');
    throw new Error('TMDB API token not configured');
  }

  const url = `${TMDB_BASE_URL}${endpoint}`;
  console.log(`TMDB request: ${endpoint}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`TMDB API error: ${response.status} for ${endpoint}`);
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
    // Upcoming endpoints
    // =========================================================================
    else if (path === '/upcoming/movie') {
      const today = new Date().toISOString().slice(0, 10);
      responseData = await tmdbMultiPage(`/discover/movie?region=IN&primary_release_date.gte=${today}&sort_by=primary_release_date.asc`);
    }
    else if (path === '/upcoming/tv') {
      const today = new Date().toISOString().slice(0, 10);
      responseData = await tmdbMultiPage(`/discover/tv?watch_region=IN&first_air_date.gte=${today}&sort_by=first_air_date.asc`);
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
      const params = new URLSearchParams();
      params.append('region', 'IN');
      
      // Forward all query params
      searchParams.forEach((value, key) => {
        params.append(key, value);
      });
      
      if (!params.has('sort_by')) {
        params.append('sort_by', 'popularity.desc');
      }
      
      responseData = await tmdbMultiPage(`/discover/movie?${params.toString()}`);
    }
    else if (path === '/discover/tv') {
      const params = new URLSearchParams();
      params.append('watch_region', 'IN');
      
      // Forward all query params
      searchParams.forEach((value, key) => {
        params.append(key, value);
      });
      
      if (!params.has('sort_by')) {
        params.append('sort_by', 'popularity.desc');
      }
      
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

  } catch (error) {
    console.error('TMDB proxy error:', error.message);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch content data' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
