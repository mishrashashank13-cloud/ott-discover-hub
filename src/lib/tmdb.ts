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
}

export interface TVShowDetails extends TVShow {
  genres: { id: number; name: string }[];
  number_of_seasons: number;
  number_of_episodes: number;
  tagline: string;
  production_companies: { id: number; name: string; logo_path: string }[];
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
    const today = new Date().toISOString().split('T')[0];
    const endpoint = `/discover/tv?language=en-US&sort_by=first_air_date.asc&first_air_date.gte=${today}&page=1`;
    return tmdbFetch(endpoint, 'IN');
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
};

export const getImageUrl = (path: string, size: 'w300' | 'w500' | 'w780' | 'original' = 'w500') => {
  if (!path) return '/placeholder.svg';
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
};

export const isMovie = (item: Movie | TVShow): item is Movie => {
  return 'title' in item;
};