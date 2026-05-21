import { useQuery } from "@tanstack/react-query";
import { tmdbApi } from "@/lib/tmdb";
import { MovieCard } from "@/components/MovieCard";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TrendingUp, Film, Tv, Calendar, ArrowRight, Star, Heart, Info, HelpCircle, Mail } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useMemo } from "react";
import { sortByUserPreferences, sortByUserPreferencesStrong, UserPreferences } from "@/lib/contentSorting";
import { logger } from "@/lib/logger";
import { SEO } from "@/components/SEO";

export const Home = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [genreIds, setGenreIds] = useState<number[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  
  // Fetch user data and preferences on component mount
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        // Fetch user's ranked language and genre preferences from profiles table
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
        
        // Fetch user preferences and extract genre IDs for recommendations
        const { data: preferences } = await supabase
          .from('user_preferences')
          .select('content_id, content_type')
          .eq('user_id', user.id);
        
        if (preferences && preferences.length > 0) {
          const genres = new Set<number>();
          
          // Fetch details for each preferred content to get genre IDs
          for (const pref of preferences.slice(0, 5)) { // Limit to first 5 to avoid too many API calls
            try {
              if (pref.content_type === 'movie') {
                const details = await tmdbApi.getMovieDetails(Number(pref.content_id));
                details.genres.forEach(g => genres.add(g.id));
              } else if (pref.content_type === 'tv') {
                const details = await tmdbApi.getTVShowDetails(Number(pref.content_id));
                details.genres.forEach(g => genres.add(g.id));
              }
            } catch (error) {
              // Log error only in development to prevent info disclosure
              logger.error('Error fetching content details:', error);
            }
          }
          
          setGenreIds(Array.from(genres));
        }
      }
    };
    
    checkUser();
  }, []);

  const {
    data: recommendedMovies,
    isLoading: recommendedMoviesLoading,
  } = useQuery({
    queryKey: ["recommended-movies", genreIds],
    queryFn: () => tmdbApi.getMoviesByGenre(genreIds),
    enabled: genreIds.length > 0,
  });

  const {
    data: recommendedTVShows,
    isLoading: recommendedTVShowsLoading,
  } = useQuery({
    queryKey: ["recommended-tv", genreIds],
    queryFn: () => tmdbApi.getTVShowsByGenre(genreIds),
    enabled: genreIds.length > 0,
  });
  
  const {
    data: trendingMovies,
    isLoading: trendingMoviesLoading,
    error: trendingMoviesError,
  } = useQuery({
    queryKey: ["ott-movies"],
    queryFn: () => tmdbApi.getOTTMovies('popularity.desc'),
  });

  const {
    data: trendingTVShows,
    isLoading: trendingTVLoading,
    error: trendingTVError,
  } = useQuery({
    queryKey: ["ott-tv"],
    queryFn: () => tmdbApi.getOTTTVShows('popularity.desc'),
  });

  // Fetch upcoming movies - use same endpoint as View More page for consistency
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

  // Upcoming movies: strong-sort so titles matching the user's preferred
  // languages/genres always appear first, with the rest shown after.
  const filteredUpcomingMovies = useMemo(() => {
    if (!upcomingMovies?.results) return [];
    return sortByUserPreferencesStrong(upcomingMovies.results, userPreferences);
  }, [upcomingMovies, userPreferences]);

  // Upcoming TV shows: same strong-sort behavior as upcoming movies.
  const filteredUpcomingTVShows = useMemo(() => {
    if (!upcomingTVShows?.results) return [];
    return sortByUserPreferencesStrong(upcomingTVShows.results, userPreferences);
  }, [upcomingTVShows, userPreferences]);


  // Sort trending movies by user preferences
  const sortedTrendingMovies = useMemo(() => {
    if (!trendingMovies?.results) return [];
    return sortByUserPreferences(trendingMovies.results, userPreferences);
  }, [trendingMovies, userPreferences]);

  // Sort trending TV shows by user preferences
  const sortedTrendingTVShows = useMemo(() => {
    if (!trendingTVShows?.results) return [];
    return sortByUserPreferences(trendingTVShows.results, userPreferences);
  }, [trendingTVShows, userPreferences]);

  // Sort recommended movies by user preferences
  const sortedRecommendedMovies = useMemo(() => {
    if (!recommendedMovies?.results) return [];
    return sortByUserPreferences(recommendedMovies.results, userPreferences);
  }, [recommendedMovies, userPreferences]);

  // Sort recommended TV shows by user preferences
  const sortedRecommendedTVShows = useMemo(() => {
    if (!recommendedTVShows?.results) return [];
    return sortByUserPreferences(recommendedTVShows.results, userPreferences);
  }, [recommendedTVShows, userPreferences]);

  const LoadingCarousel = () => (
    <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-2 w-2/3" />
        </div>
      ))}
    </div>
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
      {/* Per-route SEO tags — unique title/description/canonical for the homepage. */}
      <SEO
        title="BingeGuide: Your OTT Content Tracker and Reminder"
        description="Discover, track, and get release reminders for movies and TV shows across Netflix, Prime Video, Hotstar, JioCinema and other OTT platforms."
        path="/"
      />
      <div className="container mx-auto px-4 py-8">

        {/* Page H1 — describes the whole page and appears first in reading order. */}
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            BingeGuide: Your OTT Content Tracker and Reminder
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse trending, upcoming, and recommended OTT releases — all in one place.
          </p>
        </header>

        {/* Personalized Recommendations */}
        {userId && genreIds.length > 0 && (
          <>
            <section className="mb-12">
              <SectionHeader 
                icon={Heart} 
                title="Recommended Movies For You" 
                onViewMore={() => navigate('/search?category=recommended')} 
              />
              {recommendedMoviesLoading ? (
                <LoadingCarousel />
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
                  {sortedRecommendedMovies?.slice(0, 16).map((movie) => (
                    <MovieCard key={movie.id} item={movie} />
                  ))}
                </div>
              )}
            </section>

            <section className="mb-16">
              <SectionHeader 
                icon={Heart} 
                title="Recommended Shows For You" 
                onViewMore={() => navigate('/search?category=recommended')} 
              />
              {recommendedTVShowsLoading ? (
                <LoadingCarousel />
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
                  {sortedRecommendedTVShows?.slice(0, 16).map((show) => (
                    <MovieCard key={show.id} item={show} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* Most Anticipated Releases Hero Section
            Sourced from upcoming movies + upcoming TV (true "not yet released")
            and preference-sorted: matches to the user's preferred languages
            or genres appear first. */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <Star className="h-8 w-8 text-primary fill-primary" />
            <h2 className="text-4xl font-bold text-foreground">Most Anticipated Releases</h2>
          </div>
          
          {upcomingMoviesLoading || upcomingTVLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : upcomingMoviesError && upcomingTVError ? (
            <ErrorAlert message="Failed to load most anticipated releases" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                // Top 2 preference-matched upcoming movies + top 2 upcoming TV shows.
                ...(filteredUpcomingMovies?.slice(0, 2) || []),
                ...(filteredUpcomingTVShows?.slice(0, 2) || [])
              ].map((item) => (
                <div key={item.id} className="group relative">
                  <MovieCard item={item} className="transform transition-transform duration-300 group-hover:scale-105" />
                  <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground">
                    Anticipated
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>


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
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
              {sortedTrendingMovies?.slice(0, 16).map((movie) => (
                <MovieCard key={movie.id} item={movie} />
              ))}
            </div>
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
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
              {sortedTrendingTVShows?.slice(0, 16).map((show) => (
                <MovieCard key={show.id} item={show} />
              ))}
            </div>
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
          ) : filteredUpcomingMovies.length === 0 ? (
            <ErrorAlert message="No upcoming movies found" />
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
              {filteredUpcomingMovies.slice(0, 16).map((movie) => (
                <MovieCard key={movie.id} item={movie} />
              ))}
            </div>
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
          ) : filteredUpcomingTVShows.length === 0 ? (
            <ErrorAlert message="No upcoming web series found" />
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
              {filteredUpcomingTVShows.slice(0, 16).map((show) => (
                <MovieCard key={show.id} item={show} />
              ))}
            </div>
          )}
        </section>

        {/* Quick Links Section - About Us, How to Use, and Contact Us */}
        <section className="mb-12 py-8 border-t border-border">
          <div className="flex flex-wrap justify-center gap-6">
            <Link 
              to="/about" 
              className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <Info className="h-5 w-5" />
              <span className="font-medium">About Us</span>
            </Link>
            <Link 
              to="/how-to-use" 
              className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <HelpCircle className="h-5 w-5" />
              <span className="font-medium">How to Use</span>
            </Link>
            <Link 
              to="/contact" 
              className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="h-5 w-5" />
              <span className="font-medium">Contact Us</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};