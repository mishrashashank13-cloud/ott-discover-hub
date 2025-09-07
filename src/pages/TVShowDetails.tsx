import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tmdbApi, getImageUrl } from "@/lib/tmdb";
import { MovieCard } from "@/components/MovieCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { 
  ArrowLeft, 
  Star, 
  Calendar, 
  Tv, 
  Users, 
  AlertCircle 
} from "lucide-react";

export const TVShowDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showId = parseInt(id || "0", 10);

  const {
    data: show,
    isLoading: showLoading,
    error: showError,
  } = useQuery({
    queryKey: ["tv", showId],
    queryFn: () => tmdbApi.getTVShowDetails(showId),
    enabled: !!showId,
  });

  const {
    data: credits,
    isLoading: creditsLoading,
    error: creditsError,
  } = useQuery({
    queryKey: ["tv-credits", showId],
    queryFn: () => tmdbApi.getTVShowCredits(showId),
    enabled: !!showId,
  });

  const {
    data: similarShows,
    isLoading: similarLoading,
  } = useQuery({
    queryKey: ["similar-shows", show?.genres?.map(g => g.id)],
    queryFn: () => tmdbApi.getTVShowsByGenre(show?.genres?.map(g => g.id) || []),
    enabled: !!show?.genres?.length,
  });

  if (showError || creditsError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Alert className="border-destructive/50 bg-destructive/10 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load TV show details</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (showLoading) {
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

  if (!show) return null;

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
      {show.backdrop_path && (
        <div 
          className="h-96 bg-cover bg-center relative"
          style={{
            backgroundImage: `url(${getImageUrl(show.backdrop_path, 'w780')})`,
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
              src={getImageUrl(show.poster_path, 'w500')}
              alt={show.name}
              className="rounded-lg shadow-2xl max-w-full h-auto"
            />
          </div>

          {/* Details */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                {show.name}
              </h1>
              {show.tagline && (
                <p className="text-lg text-muted-foreground italic mb-4">
                  "{show.tagline}"
                </p>
              )}
            </div>

            {/* Rating and Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-rating-gold text-rating-gold" />
                <span className="font-medium">{show.vote_average.toFixed(1)}</span>
                <span className="text-muted-foreground">({show.vote_count} votes)</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>First aired: {formatDate(show.first_air_date)}</span>
              </div>

              <div className="flex items-center gap-1">
                <Tv className="h-4 w-4 text-muted-foreground" />
                <span>{show.number_of_seasons} seasons, {show.number_of_episodes} episodes</span>
              </div>
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-2">
              {show.genres.map((genre) => (
                <Badge key={genre.id} variant="secondary">
                  {genre.name}
                </Badge>
              ))}
            </div>

            {/* Overview */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">Overview</h2>
              <p className="text-muted-foreground leading-relaxed">
                {show.overview}
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
            {show.production_companies && show.production_companies.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">Production</h2>
                <div className="flex flex-wrap gap-4">
                  {show.production_companies.map((company) => (
                    <div key={company.id} className="text-sm text-muted-foreground">
                      {company.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Similar TV Shows */}
            {similarShows && similarShows.results && similarShows.results.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Tv className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">More Like This</h2>
                </div>
                
                <Carousel>
                  <CarouselContent>
                    {similarShows.results
                      .filter(item => item.id !== showId && item.poster_path)
                      .slice(0, 10)
                      .map((show) => (
                        <CarouselItem key={show.id} className="basis-1/2 md:basis-1/3 lg:basis-1/5">
                          <MovieCard item={show} />
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