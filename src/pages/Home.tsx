import { useQuery } from "@tanstack/react-query";
import { tmdbApi, getImageUrl } from "@/lib/tmdb";
import { MovieCard } from "@/components/MovieCard";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TrendingUp, Film, Tv, Calendar, ArrowRight, Star, Heart, Info, HelpCircle, Mail, History, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useMemo } from "react";
import { sortByUserPreferences, sortByUserPreferencesStrong, UserPreferences } from "@/lib/contentSorting";
import { logger } from "@/lib/logger";
import { Sparkles } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { fetchReactedContentKeys, reactedKey } from "@/lib/reactedContent";

/**
 * Map of language NAMES (as stored in profile preferences) to TMDB ISO 639-1
 * language codes. Used to translate the user's ranked language preferences
 * into the `with_original_language` filter understood by TMDB discover APIs.
 */
const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  Hindi: "hi", English: "en", Tamil: "ta", Telugu: "te", Malayalam: "ml",
  Kannada: "kn", Bengali: "bn", Marathi: "mr", Punjabi: "pa", Gujarati: "gu",
};

/**
 * Map of genre NAMES (as stored in profile preferences) to TMDB genre IDs.
 * Combines movie + TV genre IDs; TMDB accepts both ID spaces in discover.
 */
const GENRE_NAME_TO_ID: Record<string, number> = {
  Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80,
  Documentary: 99, Drama: 18, Family: 10751, Fantasy: 14, History: 36,
  Horror: 27, Music: 10402, Mystery: 9648, Romance: 10749,
  "Science Fiction": 878, Thriller: 53, War: 10752, Western: 37,
  "Action & Adventure": 10759, Kids: 10762, Reality: 10764,
  "Sci-Fi & Fantasy": 10765, "War & Politics": 10768,
};
import { SEO } from "@/components/SEO";

export const Home = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [genreIds, setGenreIds] = useState<number[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  // IDs of content the user has already liked/disliked or browsed — used to
  // exclude already-seen items from the "Recommended for You" ribbon so the
  // surface always feels fresh.
  const [excludedMovieIds, setExcludedMovieIds] = useState<Set<number>>(new Set());
  const [excludedTvIds, setExcludedTvIds] = useState<Set<number>>(new Set());
  // "type:id" keys of every title the user has liked or disliked. These are
  // hidden from ALL recommendation ribbons (feedback already given), but stay
  // visible in Search, Reminders and the Preferences page.
  const [reactedKeys, setReactedKeys] = useState<Set<string>>(new Set());
  // Browsing history items used to build the "Top Picks for You" ribbon.
  const [browsingHistory, setBrowsingHistory] = useState<Tables<'browsing_history'>[]>([]);
  
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

        // Load every liked/disliked title so recommendations can skip them.
        setReactedKeys(await fetchReactedContentKeys(user.id));

        // Fetch user preferences and extract genre IDs for recommendations
        const { data: preferences } = await supabase
          .from('user_preferences')
          .select('content_id, content_type')
          .eq('user_id', user.id);
        
        if (preferences && preferences.length > 0) {
          const genres = new Set<number>();
          // Track IDs of titles the user has already reacted to so the
          // "Recommended for You" ribbon can exclude them.
          const excludedMovies = new Set<number>();
          const excludedTv = new Set<number>();

          // Every reacted title is excluded from recommendations…
          preferences.forEach((pref) => {
            const numericId = Number(pref.content_id);
            if (pref.content_type === 'movie') excludedMovies.add(numericId);
            else if (pref.content_type === 'tv') excludedTv.add(numericId);
          });

          // …but only the first few are looked up on TMDB for genre signals,
          // to keep the number of API calls small.
          for (const pref of preferences.slice(0, 5)) {
            const numericId = Number(pref.content_id);
            try {
              if (pref.content_type === 'movie') {
                const details = await tmdbApi.getMovieDetails(numericId);
                details.genres.forEach(g => genres.add(g.id));
              } else if (pref.content_type === 'tv') {
                const details = await tmdbApi.getTVShowDetails(numericId);
                details.genres.forEach(g => genres.add(g.id));
              }
            } catch (error) {
              // Log error only in development to prevent info disclosure
              logger.error('Error fetching content details:', error);
            }
          }

          setGenreIds(Array.from(genres));
          // Also pull browsing history IDs so already-viewed titles don't
          // appear in the personalized ribbon.
          const { data: history } = await supabase
            .from('browsing_history')
            .select('content_id, content_type')
            .eq('user_id', user.id)
            .limit(200);
          history?.forEach((h) => {
            const n = Number(h.content_id);
            if (h.content_type === 'movie') excludedMovies.add(n);
            else if (h.content_type === 'tv') excludedTv.add(n);
          });

          setExcludedMovieIds(excludedMovies);
          setExcludedTvIds(excludedTv);
        }


        // Pull the user's recent browsing history to populate the
        // "Top Picks for You" ribbon on the home page.
        const { data: historyItems } = await supabase
          .from('browsing_history')
          .select('*')
          .eq('user_id', user.id)
          .order('viewed_at', { ascending: false })
          .limit(16);
        setBrowsingHistory(historyItems || []);
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

  /**
   * "Recommended for You" personalized ribbon.
   *
   * Builds a combined genre + top-language filter from:
   *   1. Genres derived from the user's liked content (genreIds)
   *   2. Profile language_preferences (top-ranked language) and
   *      genre_preferences (all ranked genres)
   * and then queries TMDB discover for both movies and TV shows so the
   * ribbon can mix formats. Results already seen (in browsing_history) or
   * already reacted to (user_preferences) are filtered out, and the final
   * list is preference-sorted before being interleaved movie/TV.
   */
  const personalizedFilters = useMemo(() => {
    // Combine genre IDs from liked content + ranked profile genre prefs.
    const allGenreIds = new Set<number>(genreIds);
    userPreferences?.genre_preferences?.forEach((g) => {
      const id = GENRE_NAME_TO_ID[g.name];
      if (id) allGenreIds.add(id);
    });

    // Pick the highest-ranked language (rank 1 = top preference).
    const topLang = [...(userPreferences?.language_preferences || [])]
      .sort((a, b) => a.rank - b.rank)[0]?.name;
    const langCode = topLang ? LANGUAGE_NAME_TO_CODE[topLang] : undefined;

    return {
      genres: Array.from(allGenreIds).slice(0, 6).join(','),
      language: langCode,
      hasSignal: allGenreIds.size > 0 || !!langCode,
    };
  }, [genreIds, userPreferences]);

  const {
    data: personalizedMovies,
    isLoading: personalizedMoviesLoading,
  } = useQuery({
    queryKey: ["personalized-movies", personalizedFilters.genres, personalizedFilters.language],
    queryFn: () => tmdbApi.discoverMovies({
      with_genres: personalizedFilters.genres || undefined,
      with_original_language: personalizedFilters.language,
      watch_region: 'IN',
    }),
    enabled: !!userId && personalizedFilters.hasSignal,
  });

  const {
    data: personalizedTVShows,
    isLoading: personalizedTVShowsLoading,
  } = useQuery({
    queryKey: ["personalized-tv", personalizedFilters.genres, personalizedFilters.language],
    queryFn: () => tmdbApi.discoverTVShows({
      with_genres: personalizedFilters.genres || undefined,
      with_original_language: personalizedFilters.language,
      watch_region: 'IN',
    }),
    enabled: !!userId && personalizedFilters.hasSignal,
  });

  // Merge movie + TV results, drop already-seen titles, sort by preference
  // score, then interleave movie/TV so the ribbon visually mixes formats.
  const personalizedRecommendations = useMemo(() => {
    const movies = (personalizedMovies?.results || []).filter(
      (m) => !excludedMovieIds.has(m.id)
    );
    const tvs = (personalizedTVShows?.results || []).filter(
      (t) => !excludedTvIds.has(t.id)
    );
    const sortedMovies = sortByUserPreferences(movies, userPreferences);
    const sortedTvs = sortByUserPreferences(tvs, userPreferences);

    // Interleave: movie, tv, movie, tv, ...
    const out: (typeof sortedMovies[number] | typeof sortedTvs[number])[] = [];
    const max = Math.max(sortedMovies.length, sortedTvs.length);
    for (let i = 0; i < max; i++) {
      if (sortedMovies[i]) out.push(sortedMovies[i]);
      if (sortedTvs[i]) out.push(sortedTvs[i]);
    }
    return out;
  }, [personalizedMovies, personalizedTVShows, excludedMovieIds, excludedTvIds, userPreferences]);


  
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

  // Sort recommended movies by user preferences.
  // Titles the user already liked/disliked are removed — feedback given.
  const sortedRecommendedMovies = useMemo(() => {
    if (!recommendedMovies?.results) return [];
    const fresh = recommendedMovies.results.filter(
      (m) => !reactedKeys.has(reactedKey('movie', m.id))
    );
    return sortByUserPreferences(fresh, userPreferences);
  }, [recommendedMovies, userPreferences, reactedKeys]);

  // Sort recommended TV shows by user preferences (same feedback filter).
  const sortedRecommendedTVShows = useMemo(() => {
    if (!recommendedTVShows?.results) return [];
    const fresh = recommendedTVShows.results.filter(
      (t) => !reactedKeys.has(reactedKey('tv', t.id))
    );
    return sortByUserPreferences(fresh, userPreferences);
  }, [recommendedTVShows, userPreferences, reactedKeys]);


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
        title="BingeGuide: Your OTT Content Tracker and Reminder System"
        description="Discover, track, and get release reminders for movies and TV shows across Netflix, Prime Video, Hotstar, JioCinema and other OTT platforms."
        path="/"
      />
      <div className="container mx-auto px-4 py-8">

        {/* Page H1 — describes the whole page and appears first in reading order. */}
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            BingeGuide: Your OTT Content Tracker and Reminder System
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse trending, upcoming, and recommended OTT releases — all in one place.
          </p>
          {/* Prominent "Download Android App" CTA — takes users to the
              dedicated /download page. Rendered on every homepage visit. */}
          <div className="mt-4">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/download" aria-label="Download BingeGuide Android app" className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Download Android App
              </Link>
            </Button>
          </div>
        </header>

        {/* "Top Picks for You" — surfaces recently viewed titles from the
            user's browsing history so they can quickly revisit content.
            Visible only when the user is logged in and has viewing history. */}
        {userId && topPicks.length > 0 && (
          <section className="mb-12">
            <SectionHeader
              icon={History}
              title="Top Picks for You"
              onViewMore={() => navigate('/dashboard')}
            />
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
              {topPicks
                .map((item) => (
                  <div
                    key={item.id}
                    className="cursor-pointer group"
                    onClick={() => navigate(`/${item.content_type}/${item.content_id}`)}
                  >
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                      <img
                        src={getImageUrl(item.poster_path, 'w500')}
                        alt={item.content_title ? `${item.content_title} poster` : 'Content poster'}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                      />
                      <div className="absolute top-1.5 left-1.5">
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                          {item.content_type === 'movie' ? 'Movie' : 'TV Show'}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs font-medium mt-1.5 line-clamp-1 text-foreground">
                      {item.content_title}
                    </p>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* "Recommended for You" — personalized blended ribbon (logged-in only).
            Mixes movies + TV shows derived from the user's liked content,
            browsing history exclusions, and ranked language/genre profile
            preferences. Hidden entirely for anonymous visitors. */}
        {userId && personalizedFilters.hasSignal && (
          <section className="mb-12">
            <SectionHeader
              icon={Sparkles}
              title="Recommended for You"
              onViewMore={() => navigate('/search?category=recommended')}
            />
            {personalizedMoviesLoading || personalizedTVShowsLoading ? (
              <LoadingCarousel />
            ) : personalizedRecommendations.length === 0 ? (
              <ErrorAlert message="We're still learning your taste — like a few titles to see personalized picks." />
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
                {personalizedRecommendations.slice(0, 16).map((item) => (
                  <MovieCard key={`${'title' in item ? 'm' : 't'}-${item.id}`} item={item} />
                ))}
              </div>
            )}
          </section>
        )}

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