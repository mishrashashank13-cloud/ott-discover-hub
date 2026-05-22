import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { tmdbApi } from "@/lib/tmdb";
import { MovieCard } from "@/components/MovieCard";
import { SearchBar } from "@/components/SearchBar";
import { FilterBar, FilterOptions } from "@/components/FilterBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Search as SearchIcon, TrendingUp, Film, Tv, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sortByUserPreferences, UserPreferences } from "@/lib/contentSorting";
import { SEO } from "@/components/SEO";

export const Search = () => {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || "");
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    genres: [],
    platforms: [],
    language: "",
    year: null,
  });
  const category = searchParams.get('category');

  // Fetch user preferences for sorting
  useEffect(() => {
    const fetchUserPreferences = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('language_preferences, genre_preferences')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          setUserPreferences({
            language_preferences: (profile.language_preferences as any) || [],
            genre_preferences: (profile.genre_preferences as any) || [],
          });
        }
      }
    };
    
    fetchUserPreferences();
  }, []);

  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam) {
      setSearchQuery(queryParam);
    }
  }, [searchParams]);

  // Search query
  const {
    data: searchResults,
    isLoading: searchLoading,
    error: searchError,
  } = useQuery({
    queryKey: ["search", searchQuery],
    queryFn: () => tmdbApi.searchMulti(searchQuery),
    enabled: searchQuery.length > 0 && !category,
  });

  // Filtered discovery query
  const {
    data: filteredResults,
    isLoading: filteredLoading,
    error: filteredError,
  } = useQuery({
    queryKey: ["discover", mediaType, filters],
    queryFn: () => {
      const hasFilters = filters.genres.length > 0 || filters.platforms.length > 0 || filters.language || filters.year;
      if (!hasFilters) return Promise.resolve({ results: [] });
      
      const discoverFilters = {
        with_genres: filters.genres.join(","),
        with_watch_providers: filters.platforms.join("|"),
        with_original_language: filters.language,
        primary_release_year: mediaType === "movie" ? filters.year || undefined : undefined,
        first_air_date_year: mediaType === "tv" ? filters.year || undefined : undefined,
        watch_region: "IN",
      };
      
      return mediaType === "movie" 
        ? tmdbApi.discoverMovies(discoverFilters)
        : tmdbApi.discoverTVShows(discoverFilters);
    },
    enabled: !searchQuery && !category,
  });

  // Category-based queries
  const {
    data: categoryResults,
    isLoading: categoryLoading,
    error: categoryError,
  } = useQuery({
    queryKey: ["category", category],
    queryFn: () => {
      switch (category) {
        case 'trending-movies':
          return tmdbApi.getTrendingMovies();
        case 'trending-tv':
          return tmdbApi.getTrendingTVShows();
        case 'upcoming-movies':
          return tmdbApi.getUpcomingMovies();
        case 'upcoming-tv':
          return tmdbApi.getUpcomingTVShows();
        default:
          return Promise.resolve({ results: [] });
      }
    },
    enabled: !!category,
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const getCategoryTitle = (cat: string) => {
    switch (cat) {
      case 'trending-movies':
        return 'Top Trending Movies';
      case 'trending-tv':
        return 'Trending Web Series';
      case 'upcoming-movies':
        return 'Upcoming Movies';
      case 'upcoming-tv':
        return 'Upcoming Web Series';
      default:
        return 'Results';
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'trending-movies':
        return TrendingUp;
      case 'trending-tv':
        return Tv;
      case 'upcoming-movies':
        return Film;
      case 'upcoming-tv':
        return Calendar;
      default:
        return SearchIcon;
    }
  };

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
  };

  const isLoading = category ? categoryLoading : (searchQuery ? searchLoading : filteredLoading);
  const error = category ? categoryError : (searchQuery ? searchError : filteredError);
  const rawResults = category ? categoryResults?.results : (searchQuery ? searchResults?.results : filteredResults?.results);
  
  // Sort results by user preferences and filter to only include items with posters
  // This ensures the displayed count matches the actual visible items
  const results = useMemo(() => {
    if (!rawResults) return rawResults;
    // Keep items that have ANY usable image (poster or backdrop). Some new
    // TMDB titles only ship a backdrop; MovieCard now uses that as fallback.
    const filteredResults = rawResults.filter((item) => item.poster_path || item.backdrop_path);
    return sortByUserPreferences(filteredResults, userPreferences);
  }, [rawResults, userPreferences]);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Search Movies & TV Shows — BingeGuide"
        description="Search for movies and TV shows across all major OTT platforms. Filter by genre, language, platform, and release year on BingeGuide."
        path="/search"
      />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="text-center mb-8">
            {category ? (
              <>
                {(() => {
                  const Icon = getCategoryIcon(category);
                  return <Icon className="h-12 w-12 text-primary mx-auto mb-4" />;
                })()}
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {getCategoryTitle(category)}
                </h1>
                <p className="text-muted-foreground">
                  Explore all {getCategoryTitle(category).toLowerCase()} available in India
                </p>
              </>
            ) : (
              <>
                <SearchIcon className="h-12 w-12 text-primary mx-auto mb-4" />
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Search Movies & TV Shows
                </h1>
                <p className="text-muted-foreground">
                  Discover your next favorite movie or TV show from millions of titles
                </p>
              </>
            )}
          </div>

          {!category && <SearchBar onSearch={handleSearch} className="w-full" />}
          
          {/* Filters - Show when not searching or in category mode */}
          {!searchQuery && !category && (
            <div className="mt-8 space-y-4">
              <Tabs value={mediaType} onValueChange={(v) => setMediaType(v as "movie" | "tv")} className="w-full">
                <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                  <TabsTrigger value="movie">Movies</TabsTrigger>
                  <TabsTrigger value="tv">TV Shows</TabsTrigger>
                </TabsList>
              </Tabs>
              <FilterBar mediaType={mediaType} onFilterChange={handleFilterChange} className="justify-center" />
            </div>
          )}
        </div>

        {/* Results */}
        <div className="max-w-7xl mx-auto">
          {error && (
            <Alert className="border-destructive/50 bg-destructive/10 mb-8">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {category ? 'Failed to load content' : 'Failed to search'}. Please try again.
              </AlertDescription>
            </Alert>
          )}

          {(searchQuery || category) && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                {isLoading ? (
                  "Loading..."
                ) : results?.length ? (
                  category 
                    ? `${results.length} ${getCategoryTitle(category).toLowerCase()}`
                    : `Found ${results.length} results for "${searchQuery}"`
                ) : (
                  category 
                    ? `No ${getCategoryTitle(category).toLowerCase()} found`
                    : `No results found for "${searchQuery}"`
                )}
              </h2>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          )}

          {results && results.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {results.map((item) => (
                <MovieCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {!searchQuery && !category && (
            <div className="text-center py-16">
              <SearchIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">
                Enter a search term to find movies and TV shows
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};