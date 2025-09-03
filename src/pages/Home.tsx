import { useQuery } from "@tanstack/react-query";
import { tmdbApi } from "@/lib/tmdb";
import { MovieCard } from "@/components/MovieCard";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TrendingUp, Film, Tv, Calendar, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const Home = () => {
  const navigate = useNavigate();
  
  const {
    data: trendingMovies,
    isLoading: trendingMoviesLoading,
    error: trendingMoviesError,
  } = useQuery({
    queryKey: ["trending-movies"],
    queryFn: tmdbApi.getTrendingMovies,
  });

  const {
    data: trendingTVShows,
    isLoading: trendingTVLoading,
    error: trendingTVError,
  } = useQuery({
    queryKey: ["trending-tv"],
    queryFn: tmdbApi.getTrendingTVShows,
  });

  const {
    data: upcomingMovies,
    isLoading: upcomingMoviesLoading,
    error: upcomingMoviesError,
  } = useQuery({
    queryKey: ["upcoming-movies"],
    queryFn: tmdbApi.getUpcomingMovies,
  });

  const {
    data: upcomingTVShows,
    isLoading: upcomingTVLoading,
    error: upcomingTVError,
  } = useQuery({
    queryKey: ["upcoming-tv"],
    queryFn: tmdbApi.getUpcomingTVShows,
  });

  const LoadingCarousel = () => (
    <Carousel>
      <CarouselContent>
        {Array.from({ length: 8 }).map((_, i) => (
          <CarouselItem key={i} className="basis-1/2 md:basis-1/3 lg:basis-1/5">
            <div className="space-y-2">
              <Skeleton className="aspect-[2/3] w-full rounded-lg" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );

  const SectionHeader = ({ icon: Icon, title, onViewMore }: { 
    icon: React.ComponentType<any>, 
    title: string, 
    onViewMore: () => void 
  }) => (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <Icon className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
      </div>
      <button 
        onClick={onViewMore}
        className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors font-medium"
      >
        View More <ArrowRight className="h-4 w-4" />
      </button>
    </div>
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

        {/* Trending Movies */}
        <section className="mb-12">
          <SectionHeader 
            icon={TrendingUp} 
            title="Trending Movies" 
            onViewMore={() => navigate('/search?category=trending-movies')} 
          />
          {trendingMoviesError ? (
            <ErrorAlert message="Failed to load trending movies" />
          ) : trendingMoviesLoading ? (
            <LoadingCarousel />
          ) : (
            <Carousel>
              <CarouselContent>
                {trendingMovies?.results?.slice(0, 8).map((movie) => (
                  <CarouselItem key={movie.id} className="basis-1/2 md:basis-1/3 lg:basis-1/5">
                    <MovieCard item={movie} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          )}
        </section>

        {/* Trending Web Series */}
        <section className="mb-12">
          <SectionHeader 
            icon={Tv} 
            title="Trending Web Series" 
            onViewMore={() => navigate('/search?category=trending-tv')} 
          />
          {trendingTVError ? (
            <ErrorAlert message="Failed to load trending web series" />
          ) : trendingTVLoading ? (
            <LoadingCarousel />
          ) : (
            <Carousel>
              <CarouselContent>
                {trendingTVShows?.results?.slice(0, 8).map((show) => (
                  <CarouselItem key={show.id} className="basis-1/2 md:basis-1/3 lg:basis-1/5">
                    <MovieCard item={show} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          )}
        </section>

        {/* Upcoming Movies */}
        <section className="mb-12">
          <SectionHeader 
            icon={Film} 
            title="Upcoming Movies" 
            onViewMore={() => navigate('/search?category=upcoming-movies')} 
          />
          {upcomingMoviesError ? (
            <ErrorAlert message="Failed to load upcoming movies" />
          ) : upcomingMoviesLoading ? (
            <LoadingCarousel />
          ) : (
            <Carousel>
              <CarouselContent>
                {upcomingMovies?.results?.slice(0, 8).map((movie) => (
                  <CarouselItem key={movie.id} className="basis-1/2 md:basis-1/3 lg:basis-1/5">
                    <MovieCard item={movie} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          )}
        </section>

        {/* Upcoming Web Series */}
        <section className="mb-12">
          <SectionHeader 
            icon={Calendar} 
            title="Upcoming Web Series" 
            onViewMore={() => navigate('/search?category=upcoming-tv')} 
          />
          {upcomingTVError ? (
            <ErrorAlert message="Failed to load upcoming web series" />
          ) : upcomingTVLoading ? (
            <LoadingCarousel />
          ) : (
            <Carousel>
              <CarouselContent>
                {upcomingTVShows?.results?.slice(0, 8).map((show) => (
                  <CarouselItem key={show.id} className="basis-1/2 md:basis-1/3 lg:basis-1/5">
                    <MovieCard item={show} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          )}
        </section>
      </div>
    </div>
  );
};