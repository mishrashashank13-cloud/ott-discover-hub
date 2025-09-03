import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { tmdbApi } from "@/lib/tmdb";
import { MovieCard } from "@/components/MovieCard";
import { SearchBar } from "@/components/SearchBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Search as SearchIcon, TrendingUp, Film, Tv, Calendar } from "lucide-react";

export const Search = () => {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || "");
  const category = searchParams.get('category');

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

  const isLoading = category ? categoryLoading : searchLoading;
  const error = category ? categoryError : searchError;
  const results = category ? categoryResults?.results : searchResults?.results;

  return (
    <div className="min-h-screen bg-background">
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
              {results
                .filter((item) => item.poster_path)
                .map((item) => (
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