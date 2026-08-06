import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tmdbApi, getImageUrl } from "@/lib/tmdb";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { MovieCard } from "@/components/MovieCard";
import { RemindMeButton } from "@/components/RemindMeButton";
import { LikeDislikeButtons } from "@/components/LikeDislikeButtons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";
import { SEO } from "@/components/SEO";
import { AvailableOn } from "@/components/AvailableOn";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { 
  ArrowLeft, 
  Star, 
  Calendar, 
  Tv, 
  Users, 
  AlertCircle,
  Monitor,
  Languages,
  Subtitles
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

  const {
    data: watchProviders,
  } = useQuery({
    queryKey: ["tv-watch-providers", showId],
    queryFn: () => tmdbApi.getTVWatchProviders(showId),
    enabled: !!showId,
  });

  // Capture browsing history when user views the TV show
  useEffect(() => {
    const captureHistory = async () => {
      if (!show) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      try {
        await supabase.from("browsing_history").insert({
          user_id: session.user.id,
          content_id: show.id.toString(),
          content_type: "tv",
          content_title: show.name,
          poster_path: show.poster_path,
          viewed_at: new Date().toISOString(),
        });
      } catch (error) {
        // Log error only in development to prevent info disclosure
        logger.error("Error capturing browsing history:", error);
      }
    };

    captureHistory();
  }, [show]);

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

  // Truncate overview to a safe meta-description length (max 160 chars).
  const metaDescription = (show.overview || `${show.name} — TV show details, cast and watch options on BingeGuide.`)
    .slice(0, 157)
    .trim();

  return (
    <div className="min-h-screen bg-background">
      {/* Per-route SEO tags + TVSeries JSON-LD for rich search results. */}
      <SEO
        title={`${show.name} — TV Show Details | BingeGuide`.slice(0, 60)}
        description={metaDescription}
        path={`/tv/${show.id}`}
        ogType="video.tv_show"
        image={show.poster_path ? getImageUrl(show.poster_path, 'w500') : undefined}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "TVSeries",
          name: show.name,
          description: show.overview,
          image: show.poster_path ? getImageUrl(show.poster_path, 'w500') : undefined,
          startDate: show.first_air_date || undefined,
          numberOfSeasons: show.number_of_seasons,
          numberOfEpisodes: show.number_of_episodes,
          genre: show.genres?.map((g) => g.name),
          aggregateRating: show.vote_count
            ? {
                "@type": "AggregateRating",
                ratingValue: show.vote_average,
                ratingCount: show.vote_count,
                bestRating: 10,
              }
            : undefined,
        }}
      />
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

            {/* Language and Subtitle Information */}
            {show.spoken_languages && show.spoken_languages.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Languages className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <h2 className="text-base font-semibold text-foreground mb-2">Audio Languages</h2>
                    <div className="flex flex-wrap gap-2">
                      {show.spoken_languages.map((lang, index) => (
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
                    <h2 className="text-base font-semibold text-foreground mb-2">Subtitles Available</h2>
                    <div className="flex flex-wrap gap-2">
                      {show.spoken_languages.map((lang, index) => (
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
                  <Monitor className="h-6 w-6 text-primary" />
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

            {/* Available On - streaming/rent/buy options enriched via Watchmode */}
            <AvailableOn
              contentType="tv"
              tmdbId={show.id}
              title={show.name}
              year={show.first_air_date?.slice(0, 4)}
            />

            {/* Like/Dislike and Remind Me Buttons */}
            <div className="space-y-4">
              <LikeDislikeButtons
                contentId={show.id.toString()}
                contentTitle={show.name}
                contentType="tv"
                posterPath={show.poster_path}
              />
              
              <RemindMeButton
                contentId={show.id.toString()}
                contentTitle={show.name}
                contentType="tv"
                releaseDate={show.first_air_date}
                variant="default"
                size="lg"
                className="w-full"
              />
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

            {/* Networks - Display broadcasting/streaming platforms for the show */}
            {show.networks && show.networks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Tv className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Networks</h2>
                </div>
                <div className="flex flex-wrap gap-4">
                  {show.networks.map((network) => (
                    <div key={network.id} className="flex flex-col items-center gap-2 group">
                      {network.logo_path ? (
                        <img
                          src={getImageUrl(network.logo_path, 'w300')}
                          alt={network.name}
                          className="h-12 w-auto max-w-[100px] object-contain bg-white/90 rounded-lg p-2 group-hover:scale-110 transition-transform duration-200"
                        />
                      ) : (
                        <div className="h-12 px-4 flex items-center justify-center bg-muted rounded-lg">
                          <span className="text-sm font-medium text-foreground">{network.name}</span>
                        </div>
                      )}
                      <span className="text-xs text-center font-medium text-muted-foreground max-w-[100px] truncate">
                        {network.name}
                      </span>
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