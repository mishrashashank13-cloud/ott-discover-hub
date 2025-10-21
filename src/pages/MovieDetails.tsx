import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tmdbApi, getImageUrl } from "@/lib/tmdb";
import { MovieCard } from "@/components/MovieCard";
import { RemindMeButton } from "@/components/RemindMeButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { 
  ArrowLeft, 
  Star, 
  Calendar, 
  Clock, 
  Users, 
  AlertCircle,
  Film,
  Tv,
  Languages,
  Subtitles
} from "lucide-react";

export const MovieDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const movieId = parseInt(id || "0", 10);

  const {
    data: movie,
    isLoading: movieLoading,
    error: movieError,
  } = useQuery({
    queryKey: ["movie", movieId],
    queryFn: () => tmdbApi.getMovieDetails(movieId),
    enabled: !!movieId,
  });

  const {
    data: credits,
    isLoading: creditsLoading,
    error: creditsError,
  } = useQuery({
    queryKey: ["movie-credits", movieId],
    queryFn: () => tmdbApi.getMovieCredits(movieId),
    enabled: !!movieId,
  });

  const {
    data: similarMovies,
    isLoading: similarLoading,
  } = useQuery({
    queryKey: ["similar-movies", movie?.genres?.map(g => g.id)],
    queryFn: () => tmdbApi.getMoviesByGenre(movie?.genres?.map(g => g.id) || []),
    enabled: !!movie?.genres?.length,
  });

  const {
    data: watchProviders,
  } = useQuery({
    queryKey: ["movie-watch-providers", movieId],
    queryFn: () => tmdbApi.getMovieWatchProviders(movieId),
    enabled: !!movieId,
  });

  if (movieError || creditsError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Alert className="border-destructive/50 bg-destructive/10 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load movie details</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (movieLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-24 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Skeleton className="aspect-[2/3] rounded-lg" />
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-20 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!movie) return null;

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Backdrop */}
      {movie.backdrop_path && (
        <div 
          className="h-96 bg-cover bg-center relative"
          style={{
            backgroundImage: `url(${getImageUrl(movie.backdrop_path, 'w780')})`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        </div>
      )}

      <div className="container mx-auto px-4 py-8 -mt-32 relative z-10">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-8 hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Poster */}
          <div className="flex justify-center lg:justify-start">
            <img
              src={getImageUrl(movie.poster_path, 'w500')}
              alt={movie.title}
              className="rounded-lg shadow-2xl max-w-full h-auto"
            />
          </div>

          {/* Details */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                {movie.title}
              </h1>
              {movie.tagline && (
                <p className="text-lg text-muted-foreground italic mb-4">
                  "{movie.tagline}"
                </p>
              )}
            </div>

            {/* Rating and Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-rating-gold text-rating-gold" />
                <span className="font-medium">{movie.vote_average.toFixed(1)}</span>
                <span className="text-muted-foreground">({movie.vote_count} votes)</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{formatDate(movie.release_date)}</span>
              </div>

              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatRuntime(movie.runtime)}</span>
              </div>
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-2">
              {movie.genres.map((genre) => (
                <Badge key={genre.id} variant="secondary">
                  {genre.name}
                </Badge>
              ))}
            </div>

            {/* Language and Subtitle Information */}
            {movie.spoken_languages && movie.spoken_languages.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Languages className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-2">Audio Languages</h3>
                    <div className="flex flex-wrap gap-2">
                      {movie.spoken_languages.map((lang, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {lang.english_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Subtitles className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-2">Subtitles Available</h3>
                    <div className="flex flex-wrap gap-2">
                      {movie.spoken_languages.map((lang, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {lang.english_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* OTT Platforms - Prominent Display */}
            {watchProviders?.results?.IN && (
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-l-4 border-primary rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Tv className="h-6 w-6 text-primary" />
                  <h2 className="text-2xl font-bold text-foreground">Watch Now</h2>
                </div>
                
                {watchProviders.results.IN.flatrate && watchProviders.results.IN.flatrate.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Streaming</p>
                    <div className="flex flex-wrap gap-4">
                      {watchProviders.results.IN.flatrate.map((provider: any) => (
                        <div key={provider.provider_id} className="flex flex-col items-center gap-2 group">
                          <div className="relative">
                            <img
                              src={getImageUrl(provider.logo_path, 'w300')}
                              alt={provider.provider_name}
                              className="w-16 h-16 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-200"
                            />
                          </div>
                          <span className="text-xs text-center font-medium max-w-[80px] truncate">
                            {provider.provider_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {watchProviders.results.IN.rent && watchProviders.results.IN.rent.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Rent</p>
                    <div className="flex flex-wrap gap-4">
                      {watchProviders.results.IN.rent.map((provider: any) => (
                        <div key={provider.provider_id} className="flex flex-col items-center gap-2 group">
                          <img
                            src={getImageUrl(provider.logo_path, 'w300')}
                            alt={provider.provider_name}
                            className="w-16 h-16 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-200"
                          />
                          <span className="text-xs text-center font-medium max-w-[80px] truncate">
                            {provider.provider_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {watchProviders.results.IN.buy && watchProviders.results.IN.buy.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Buy</p>
                    <div className="flex flex-wrap gap-4">
                      {watchProviders.results.IN.buy.map((provider: any) => (
                        <div key={provider.provider_id} className="flex flex-col items-center gap-2 group">
                          <img
                            src={getImageUrl(provider.logo_path, 'w300')}
                            alt={provider.provider_name}
                            className="w-16 h-16 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-200"
                          />
                          <span className="text-xs text-center font-medium max-w-[80px] truncate">
                            {provider.provider_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Remind Me Button */}
            <div className="flex gap-4">
              <RemindMeButton
                contentId={movie.id.toString()}
                contentTitle={movie.title}
                contentType="movie"
                releaseDate={movie.release_date}
                variant="default"
                size="lg"
              />
            </div>

            {/* Overview */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">Overview</h2>
              <p className="text-muted-foreground leading-relaxed">
                {movie.overview}
              </p>
            </div>

            {/* Cast */}
            {credits && credits.cast && credits.cast.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Cast</h2>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {credits.cast.slice(0, 8).map((actor) => (
                    <div key={actor.id} className="text-center">
                      <img
                        src={getImageUrl(actor.profile_path, 'w300')}
                        alt={actor.name}
                        className="w-full aspect-[2/3] object-cover rounded-lg mb-2"
                      />
                      <p className="font-medium text-sm text-foreground">{actor.name}</p>
                      <p className="text-xs text-muted-foreground">{actor.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Production Companies */}
            {movie.production_companies && movie.production_companies.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">Production</h2>
                <div className="flex flex-wrap gap-4">
                  {movie.production_companies.map((company) => (
                    <div key={company.id} className="text-sm text-muted-foreground">
                      {company.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Similar Movies */}
            {similarMovies && similarMovies.results && similarMovies.results.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Film className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">More Like This</h2>
                </div>
                
                <Carousel>
                  <CarouselContent>
                    {similarMovies.results
                      .filter(item => item.id !== movieId && item.poster_path)
                      .slice(0, 10)
                      .map((movie) => (
                        <CarouselItem key={movie.id} className="basis-1/2 md:basis-1/3 lg:basis-1/5">
                          <MovieCard item={movie} />
                        </CarouselItem>
                      ))}
                  </CarouselContent>
                  <CarouselPrevious />
                  <CarouselNext />
                </Carousel>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};