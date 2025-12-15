/**
 * TMDB API Client - Frontend Module
 * 
 * This module handles all TMDB (The Movie Database) API interactions through
 * a backend proxy. The proxy pattern keeps the TMDB API key secure on the
 * server side and prevents exposure in client-side JavaScript bundles.
 * 
 * All requests go through /api/tmdb/* endpoints which are handled by the
 * Python backend (api/index.py).
 */

// Base URL for TMDB image assets (public, no API key needed)
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// =============================================================================
// Type Definitions
// These interfaces define the shape of data returned by TMDB API
// =============================================================================

/**
 * Represents a movie object from TMDB API
 */
export interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  original_language: string;
}

/**
 * Represents a TV show object from TMDB API
 */
export interface TVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  original_language: string;
}

/**
 * Extended movie details including genres, runtime, and production info
 */
export interface MovieDetails extends Movie {
  genres: { id: number; name: string }[];
  runtime: number;
  tagline: string;
  production_companies: { id: number; name: string; logo_path: string }[];
  spoken_languages: { english_name: string; iso_639_1: string; name: string }[];
  original_language: string;
}

/**
 * Extended TV show details including seasons, episodes, and production info
 */
export interface TVShowDetails extends TVShow {
  genres: { id: number; name: string }[];
  number_of_seasons: number;
  number_of_episodes: number;
  tagline: string;
  production_companies: { id: number; name: string; logo_path: string }[];
  spoken_languages: { english_name: string; iso_639_1: string; name: string }[];
  original_language: string;
}

/**
 * Represents a cast member from movie/TV credits
 */
export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string;
}

/**
 * Credits response containing cast information
 */
export interface Credits {
  cast: CastMember[];
}

/**
 * Genre object from TMDB
 */
export interface Genre {
  id: number;
  name: string;
}

/**
 * Streaming/watch provider information
 */
export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

/**
 * Filter options for discover endpoints
 */
export interface DiscoverFilters {
  with_genres?: string;
  with_watch_providers?: string;
  with_original_language?: string;
  primary_release_year?: number;
  first_air_date_year?: number;
  watch_region?: string;
}

// =============================================================================
// API Helper Functions
// These handle communication with the backend proxy
// =============================================================================

/**
 * Make a fetch request to the backend TMDB proxy.
 * Handles error responses and JSON parsing.
 * 
 * @param endpoint - The proxy endpoint path (e.g., '/api/tmdb/trending/movie')
 * @returns Parsed JSON response from the proxy
 * @throws Error if the request fails
 */
const proxyFetch = async (endpoint: string): Promise<any> => {
  const response = await fetch(endpoint);
  
  if (!response.ok) {
    // Log error for debugging but don't expose internal details
    console.error('TMDB proxy request failed:', response.status);
    throw new Error('Failed to fetch content data');
  }
  
  return response.json();
};

// =============================================================================
// TMDB API Client
// Provides methods for all TMDB operations through the backend proxy
// =============================================================================

export const tmdbApi = {
  /**
   * Get trending movies for the current week (India region)
   */
  getTrendingMovies: async (): Promise<{ results: Movie[] }> => {
    return proxyFetch('/api/tmdb/trending/movie');
  },

  /**
   * Get trending TV shows for the current week (India region)
   */
  getTrendingTVShows: async (): Promise<{ results: TVShow[] }> => {
    return proxyFetch('/api/tmdb/trending/tv');
  },

  /**
   * Get upcoming movie releases (India region)
   */
  getUpcomingMovies: async (): Promise<{ results: Movie[] }> => {
    return proxyFetch('/api/tmdb/upcoming/movie');
  },

  /**
   * Get upcoming TV shows using existing backend endpoint
   */
  getUpcomingTVShows: async (): Promise<{ results: TVShow[] }> => {
    try {
      // Use existing upcoming-shows endpoint which has OTT provider filtering
      const res = await fetch('/api/upcoming-shows');
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data && data.results) return data;
      }
    } catch (_) {
      // Silently fall through to discover endpoint
    }
    // Fallback: use discover TV with future air dates
    const today = new Date().toISOString().slice(0, 10);
    return proxyFetch(`/api/tmdb/discover/tv?first_air_date_gte=${today}&sort_by=first_air_date.asc`);
  },

  /**
   * Get popular movies (India region)
   */
  getPopularMovies: async (): Promise<{ results: Movie[] }> => {
    return proxyFetch('/api/tmdb/popular/movie');
  },

  /**
   * Get popular TV shows (India region)
   */
  getPopularTVShows: async (): Promise<{ results: TVShow[] }> => {
    return proxyFetch('/api/tmdb/popular/tv');
  },

  /**
   * Get all trending content (movies and TV combined)
   */
  getTrending: async (): Promise<{ results: (Movie | TVShow)[] }> => {
    return proxyFetch('/api/tmdb/trending/all');
  },

  /**
   * Search for movies and TV shows by query string
   * @param query - Search term (validated server-side for length)
   */
  searchMulti: async (query: string): Promise<{ results: (Movie | TVShow)[] }> => {
    const encodedQuery = encodeURIComponent(query);
    return proxyFetch(`/api/tmdb/search?query=${encodedQuery}`);
  },

  /**
   * Get detailed information about a specific movie
   * @param id - TMDB movie ID
   */
  getMovieDetails: async (id: number): Promise<MovieDetails> => {
    return proxyFetch(`/api/tmdb/movie/${id}`);
  },

  /**
   * Get detailed information about a specific TV show
   * @param id - TMDB TV show ID
   */
  getTVShowDetails: async (id: number): Promise<TVShowDetails> => {
    return proxyFetch(`/api/tmdb/tv/${id}`);
  },

  /**
   * Get cast and crew credits for a movie
   * @param id - TMDB movie ID
   */
  getMovieCredits: async (id: number): Promise<Credits> => {
    return proxyFetch(`/api/tmdb/movie/${id}/credits`);
  },

  /**
   * Get cast and crew credits for a TV show
   * @param id - TMDB TV show ID
   */
  getTVShowCredits: async (id: number): Promise<Credits> => {
    return proxyFetch(`/api/tmdb/tv/${id}/credits`);
  },

  /**
   * Discover movies by genre IDs
   * @param genreIds - Array of TMDB genre IDs
   */
  getMoviesByGenre: async (genreIds: number[]): Promise<{ results: Movie[] }> => {
    const genres = genreIds.join(',');
    return proxyFetch(`/api/tmdb/discover/movie?with_genres=${genres}&sort_by=popularity.desc`);
  },

  /**
   * Discover TV shows by genre IDs
   * @param genreIds - Array of TMDB genre IDs
   */
  getTVShowsByGenre: async (genreIds: number[]): Promise<{ results: TVShow[] }> => {
    const genres = genreIds.join(',');
    return proxyFetch(`/api/tmdb/discover/tv?with_genres=${genres}&sort_by=popularity.desc`);
  },

  /**
   * Get list of all movie genres from TMDB
   */
  getMovieGenres: async (): Promise<{ genres: Genre[] }> => {
    return proxyFetch('/api/tmdb/genre/movie');
  },

  /**
   * Get list of all TV show genres from TMDB
   */
  getTVGenres: async (): Promise<{ genres: Genre[] }> => {
    return proxyFetch('/api/tmdb/genre/tv');
  },

  /**
   * Get available streaming providers for a region
   * @param region - ISO 3166-1 country code (default: IN for India)
   */
  getWatchProviders: async (region: string = 'IN'): Promise<{ results: WatchProvider[] }> => {
    return proxyFetch(`/api/tmdb/watch-providers?watch_region=${region}`);
  },

  /**
   * Discover movies with custom filters
   * @param filters - Filter options for discovery
   */
  discoverMovies: async (filters: DiscoverFilters): Promise<{ results: Movie[] }> => {
    const params = new URLSearchParams();
    if (filters.with_genres) params.append('with_genres', filters.with_genres);
    if (filters.with_watch_providers) params.append('with_watch_providers', filters.with_watch_providers);
    if (filters.with_original_language) params.append('with_original_language', filters.with_original_language);
    if (filters.primary_release_year) params.append('primary_release_year', filters.primary_release_year.toString());
    if (filters.watch_region) params.append('watch_region', filters.watch_region);
    params.append('sort_by', 'popularity.desc');
    return proxyFetch(`/api/tmdb/discover/movie?${params.toString()}`);
  },

  /**
   * Discover TV shows with custom filters
   * @param filters - Filter options for discovery
   */
  discoverTVShows: async (filters: DiscoverFilters): Promise<{ results: TVShow[] }> => {
    const params = new URLSearchParams();
    if (filters.with_genres) params.append('with_genres', filters.with_genres);
    if (filters.with_watch_providers) params.append('with_watch_providers', filters.with_watch_providers);
    if (filters.with_original_language) params.append('with_original_language', filters.with_original_language);
    if (filters.first_air_date_year) params.append('first_air_date_year', filters.first_air_date_year.toString());
    if (filters.watch_region) params.append('watch_region', filters.watch_region);
    params.append('sort_by', 'popularity.desc');
    return proxyFetch(`/api/tmdb/discover/tv?${params.toString()}`);
  },

  /**
   * Get watch providers for a specific movie
   * @param id - TMDB movie ID
   */
  getMovieWatchProviders: async (id: number, region: string = 'IN') => {
    return proxyFetch(`/api/tmdb/movie/${id}/watch-providers`);
  },

  /**
   * Get watch providers for a specific TV show
   * @param id - TMDB TV show ID
   */
  getTVWatchProviders: async (id: number, region: string = 'IN') => {
    return proxyFetch(`/api/tmdb/tv/${id}/watch-providers`);
  },

  /**
   * Get movies available on popular OTT platforms in India
   * Filters by: Netflix, Prime Video, Hotstar, Disney+, Jio Cinema, Zee5
   * @param sortBy - Sort order (popularity or rating)
   */
  getOTTMovies: async (sortBy: 'popularity.desc' | 'vote_average.desc' = 'popularity.desc'): Promise<{ results: Movie[] }> => {
    // Popular OTT providers in India
    const ottProviders = '8|119|122|337|463|531'; // Netflix, Prime, Hotstar, Disney+, Jio Cinema, Zee5
    return proxyFetch(`/api/tmdb/discover/movie?with_watch_providers=${encodeURIComponent(ottProviders)}&watch_region=IN&sort_by=${sortBy}`);
  },

  /**
   * Get TV shows available on popular OTT platforms in India
   * @param sortBy - Sort order (popularity or rating)
   */
  getOTTTVShows: async (sortBy: 'popularity.desc' | 'vote_average.desc' = 'popularity.desc'): Promise<{ results: TVShow[] }> => {
    const ottProviders = '8|119|122|337|463|531';
    return proxyFetch(`/api/tmdb/discover/tv?with_watch_providers=${encodeURIComponent(ottProviders)}&watch_region=IN&sort_by=${sortBy}`);
  },

  /**
   * Get upcoming movies that will be available on OTT platforms
   */
  getUpcomingOTTMovies: async (): Promise<{ results: Movie[] }> => {
    const today = new Date().toISOString().slice(0, 10);
    const ottProviders = '8|119|122|337|463|531';
    return proxyFetch(`/api/tmdb/discover/movie?with_watch_providers=${encodeURIComponent(ottProviders)}&watch_region=IN&primary_release_date_gte=${today}&sort_by=primary_release_date.asc`);
  },

  /**
   * Get upcoming TV shows that will be available on OTT platforms
   */
  getUpcomingOTTTVShows: async (): Promise<{ results: TVShow[] }> => {
    const today = new Date().toISOString().slice(0, 10);
    const ottProviders = '8|119|122|337|463|531';
    return proxyFetch(`/api/tmdb/discover/tv?with_watch_providers=${encodeURIComponent(ottProviders)}&watch_region=IN&first_air_date_gte=${today}&sort_by=first_air_date.asc`);
  },
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a full URL for a TMDB image asset.
 * Images are served directly from TMDB's CDN (no API key required).
 * 
 * @param path - The image path from TMDB (e.g., '/abc123.jpg')
 * @param size - Desired image size (w300, w500, w780, or original)
 * @returns Full URL to the image or placeholder if path is empty
 */
export const getImageUrl = (path: string, size: 'w300' | 'w500' | 'w780' | 'original' = 'w500') => {
  if (!path) return '/placeholder.svg';
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
};

/**
 * Type guard to determine if a content item is a Movie.
 * Movies have 'title', while TV shows have 'name'.
 * 
 * @param item - Movie or TVShow object to check
 * @returns True if the item is a Movie
 */
export const isMovie = (item: Movie | TVShow): item is Movie => {
  return 'title' in item;
};