import { useQuery } from "@tanstack/react-query";
import { tmdbApi } from "@/lib/tmdb";
import { MovieCard } from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TrendingUp, Film, Tv } from "lucide-react";

export const Home = () => {
  const {
    data: trending,
    isLoading: trendingLoading,
    error: trendingError,
  } = useQuery({
    queryKey: ["trending"],
    queryFn: tmdbApi.getTrending,
  });

  const {
    data: popularMovies,
    isLoading: moviesLoading,
    error: moviesError,
  } = useQuery({
    queryKey: ["popular-movies"],
    queryFn: tmdbApi.getPopularMovies,
  });

  const {
    data: popularTVShows,
    isLoading: tvLoading,
    error: tvError,
  } = useQuery({
    queryKey: ["popular-tv"],
    queryFn: tmdbApi.getPopularTVShows,
  });

  const MovieGrid = ({ children }: { children: React.ReactNode }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {children}
    </div>
  );

  const LoadingGrid = () => (
    <MovieGrid>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </MovieGrid>
  );

  const ErrorAlert = ({ message }: { message: string }) => (
    <Alert className="border-destructive/50 bg-destructive/10">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="relative rounded-2xl bg-hero-gradient p-8 mb-12 overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground mb-4">
              Discover Amazing
              <br />
              Movies & Shows
            </h1>
            <p className="text-lg text-primary-foreground/80 max-w-md">
              Explore trending content, popular movies, and TV shows from around the world.
            </p>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
        </section>

        {/* Trending Section */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">Trending This Week</h2>
          </div>

          {trendingError ? (
            <ErrorAlert message="Failed to load trending content" />
          ) : trendingLoading ? (
            <LoadingGrid />
          ) : (
            <MovieGrid>
              {trending?.results?.slice(0, 12).map((item) => (
                <MovieCard key={item.id} item={item} />
              ))}
            </MovieGrid>
          )}
        </section>

        {/* Popular Movies Section */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Film className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">Popular Movies</h2>
          </div>

          {moviesError ? (
            <ErrorAlert message="Failed to load popular movies" />
          ) : moviesLoading ? (
            <LoadingGrid />
          ) : (
            <MovieGrid>
              {popularMovies?.results?.slice(0, 12).map((movie) => (
                <MovieCard key={movie.id} item={movie} />
              ))}
            </MovieGrid>
          )}
        </section>

        {/* Popular TV Shows Section */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Tv className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">Popular TV Shows</h2>
          </div>

          {tvError ? (
            <ErrorAlert message="Failed to load popular TV shows" />
          ) : tvLoading ? (
            <LoadingGrid />
          ) : (
            <MovieGrid>
              {popularTVShows?.results?.slice(0, 12).map((show) => (
                <MovieCard key={show.id} item={show} />
              ))}
            </MovieGrid>
          )}
        </section>
      </div>
    </div>
  );
};