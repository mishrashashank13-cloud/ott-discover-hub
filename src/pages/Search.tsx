import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { tmdbApi } from "@/lib/tmdb";
import { MovieCard } from "@/components/MovieCard";
import { SearchBar } from "@/components/SearchBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Search as SearchIcon } from "lucide-react";

export const Search = () => {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || "");

  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam) {
      setSearchQuery(queryParam);
    }
  }, [searchParams]);

  const {
    data: searchResults,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["search", searchQuery],
    queryFn: () => tmdbApi.searchMulti(searchQuery),
    enabled: searchQuery.length > 0,
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Search Header */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="text-center mb-8">
            <SearchIcon className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Search Movies & TV Shows
            </h1>
            <p className="text-muted-foreground">
              Discover your next favorite movie or TV show from millions of titles
            </p>
          </div>

          <SearchBar onSearch={handleSearch} className="w-full" />
        </div>

        {/* Search Results */}
        <div className="max-w-7xl mx-auto">
          {error && (
            <Alert className="border-destructive/50 bg-destructive/10 mb-8">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Failed to search. Please try again.</AlertDescription>
            </Alert>
          )}

          {searchQuery && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                {isLoading ? (
                  "Searching..."
                ) : searchResults?.results?.length ? (
                  `Found ${searchResults.results.length} results for "${searchQuery}"`
                ) : (
                  `No results found for "${searchQuery}"`
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

          {searchResults && searchResults.results && searchResults.results.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {searchResults.results
                .filter((item) => item.poster_path) // Only show items with posters
                .map((item) => (
                  <MovieCard key={item.id} item={item} />
                ))}
            </div>
          )}

          {!searchQuery && (
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