const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// For demo purposes, using a public API key - in production, this should be handled server-side
const TMDB_API_KEY = '4e44d9029b1270a757cddc766a1bcb63';

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
}

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
}

export interface MovieDetails extends Movie {
  genres: { id: number; name: string }[];
  runtime: number;
  tagline: string;
  production_companies: { id: number; name: string; logo_path: string }[];
  spoken_languages: { english_name: string; iso_639_1: string; name: string }[];
  original_language: string;
}

export interface TVShowDetails extends TVShow {
  genres: { id: number; name: string }[];
  number_of_seasons: number;
  number_of_episodes: number;
  tagline: string;
  production_companies: { id: number; name: string; logo_path: string }[];
  spoken_languages: { english_name: string; iso_639_1: string; name: string }[];
  original_language: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string;
}

export interface Credits {
  cast: CastMember[];
}

export interface Genre {
  id: number;
  name: string;
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface DiscoverFilters {
  with_genres?: string;
  with_watch_providers?: string;
  with_original_language?: string;
  primary_release_year?: number;
  first_air_date_year?: number;
  watch_region?: string;
}

const tmdbFetch = async (endpoint: string, region?: string) => {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', TMDB_API_KEY);
  if (region) {
    url.searchParams.append('region', region);
  }
  
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to fetch from TMDB');
  }
  return response.json();
};

export const tmdbApi = {
  getTrendingMovies: async (): Promise<{ results: Movie[] }> => {
    return tmdbFetch('/trending/movie/week', 'IN');
  },

  getTrendingTVShows: async (): Promise<{ results: TVShow[] }> => {
    return tmdbFetch('/trending/tv/week', 'IN');
  },

  getUpcomingMovies: async (): Promise<{ results: Movie[] }> => {
    return tmdbFetch('/movie/upcoming', 'IN');
  },

  getUpcomingTVShows: async (): Promise<{ results: TVShow[] }> => {
    try {
      const res = await fetch('/api/upcoming-shows');
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data && data.results) return data;
      }
    } catch (_) {}
    // Fallback to direct TMDB API
    const today = new Date().toISOString().slice(0, 10);
    return tmdbFetch(`/discover/tv?first_air_date.gte=${today}&sort_by=first_air_date.asc&include_adult=false&watch_region=IN`);
  },

  getPopularMovies: async (): Promise<{ results: Movie[] }> => {
    return tmdbFetch('/movie/popular', 'IN');
  },

  getPopularTVShows: async (): Promise<{ results: TVShow[] }> => {
    return tmdbFetch('/tv/popular', 'IN');
  },

  getTrending: async (): Promise<{ results: (Movie | TVShow)[] }> => {
    return tmdbFetch('/trending/all/week', 'IN');
  },

  searchMulti: async (query: string): Promise<{ results: (Movie | TVShow)[] }> => {
    const encodedQuery = encodeURIComponent(query);
    return tmdbFetch(`/search/multi?query=${encodedQuery}`, 'IN');
  },

  getMovieDetails: async (id: number): Promise<MovieDetails> => {
    return tmdbFetch(`/movie/${id}`);
  },

  getTVShowDetails: async (id: number): Promise<TVShowDetails> => {
    return tmdbFetch(`/tv/${id}`);
  },

  getMovieCredits: async (id: number): Promise<Credits> => {
    return tmdbFetch(`/movie/${id}/credits`);
  },

  getTVShowCredits: async (id: number): Promise<Credits> => {
    return tmdbFetch(`/tv/${id}/credits`);
  },

  getMoviesByGenre: async (genreIds: number[]): Promise<{ results: Movie[] }> => {
    const genres = genreIds.join(',');
    return tmdbFetch(`/discover/movie?with_genres=${genres}&sort_by=popularity.desc`, 'IN');
  },

  getTVShowsByGenre: async (genreIds: number[]): Promise<{ results: TVShow[] }> => {
    const genres = genreIds.join(',');
    return tmdbFetch(`/discover/tv?with_genres=${genres}&sort_by=popularity.desc`, 'IN');
  },

  getMovieGenres: async (): Promise<{ genres: Genre[] }> => {
    return tmdbFetch('/genre/movie/list');
  },

  getTVGenres: async (): Promise<{ genres: Genre[] }> => {
    return tmdbFetch('/genre/tv/list');
  },

  getWatchProviders: async (region: string = 'IN'): Promise<{ results: WatchProvider[] }> => {
    return tmdbFetch(`/watch/providers/movie?watch_region=${region}`);
  },

  discoverMovies: async (filters: DiscoverFilters): Promise<{ results: Movie[] }> => {
    const params = new URLSearchParams();
    if (filters.with_genres) params.append('with_genres', filters.with_genres);
    if (filters.with_watch_providers) params.append('with_watch_providers', filters.with_watch_providers);
    if (filters.with_original_language) params.append('with_original_language', filters.with_original_language);
    if (filters.primary_release_year) params.append('primary_release_year', filters.primary_release_year.toString());
    if (filters.watch_region) params.append('watch_region', filters.watch_region);
    params.append('sort_by', 'popularity.desc');
    return tmdbFetch(`/discover/movie?${params.toString()}`);
  },

  discoverTVShows: async (filters: DiscoverFilters): Promise<{ results: TVShow[] }> => {
    const params = new URLSearchParams();
    if (filters.with_genres) params.append('with_genres', filters.with_genres);
    if (filters.with_watch_providers) params.append('with_watch_providers', filters.with_watch_providers);
    if (filters.with_original_language) params.append('with_original_language', filters.with_original_language);
    if (filters.first_air_date_year) params.append('first_air_date_year', filters.first_air_date_year.toString());
    if (filters.watch_region) params.append('watch_region', filters.watch_region);
    params.append('sort_by', 'popularity.desc');
    return tmdbFetch(`/discover/tv?${params.toString()}`);
  },

  getMovieWatchProviders: async (id: number, region: string = 'IN') => {
    return tmdbFetch(`/movie/${id}/watch/providers`);
  },

  getTVWatchProviders: async (id: number, region: string = 'IN') => {
    return tmdbFetch(`/tv/${id}/watch/providers`);
  },
};

export const getImageUrl = (path: string, size: 'w300' | 'w500' | 'w780' | 'original' = 'w500') => {
  if (!path) return '/placeholder.svg';
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
};

export const isMovie = (item: Movie | TVShow): item is Movie => {
  return 'title' in item;
};