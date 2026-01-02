import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, ThumbsDown, Trash2, Film, Tv, ThumbsUp, Sparkles, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { logger } from "@/lib/logger";
import { toast as sonnerToast } from "sonner";

// Interface for user preference data from the database
interface UserPreference {
  id: string;
  content_id: string;
  content_type: string;
  content_title: string | null;
  poster_path: string | null;
  reaction: string | null;
  created_at: string;
}

// Interface for classic content from taste_classics table
interface TasteClassic {
  id: number;
  title: string;
  genre: string;
  language: string;
  year?: number;
  poster_url?: string;
  description?: string;
  ott_platform?: string;
}

export const Preferences = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<UserPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // State for classics section - allows users to discover and rate new content
  const [classics, setClassics] = useState<TasteClassic[]>([]);
  const [allClassics, setAllClassics] = useState<TasteClassic[]>([]);
  const [classicsLoading, setClassicsLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [languages, setLanguages] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [classicReactions, setClassicReactions] = useState<Record<string, "like" | "dislike" | null>>({});
  const [savingClassicId, setSavingClassicId] = useState<number | null>(null);

  // Check authentication and fetch user session
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      setUser(session.user);
    };

    checkAuth();
  }, [navigate]);

  // Fetch user preferences from the database
  useEffect(() => {
    const fetchPreferences = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPreferences(data || []);
        
        // Build map of existing reactions for classics (content_type = 'Classics')
        const reactionsMap: Record<string, "like" | "dislike" | null> = {};
        (data || []).forEach((pref) => {
          if (pref.content_type === 'Classics') {
            reactionsMap[pref.content_id] = pref.reaction as "like" | "dislike" | null;
          }
        });
        setClassicReactions(reactionsMap);
      } catch (error) {
        // Log error only in development to prevent info disclosure
        logger.error('Error fetching preferences:', error);
        toast({
          title: "Error loading preferences",
          description: "Failed to load your preferences. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [user, toast]);

  // Fetch classics content from taste_classics table
  useEffect(() => {
    const loadClassics = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('taste_classics')
          .select('*')
          .order('popularity_score', { ascending: false });

        if (error) throw error;

        if (data) {
          const classicsData = data as TasteClassic[];
          setAllClassics(classicsData);
          setClassics(classicsData);
          
          // Extract unique languages and genres for filter dropdowns
          const uniqueLanguages = [...new Set(classicsData.map(item => item.language))].filter(Boolean) as string[];
          const uniqueGenres = [...new Set(classicsData.map(item => item.genre))].filter(Boolean) as string[];
          
          setLanguages(uniqueLanguages);
          setGenres(uniqueGenres);
        }
      } catch (error) {
        logger.error('Error loading classics:', error);
      } finally {
        setClassicsLoading(false);
      }
    };

    loadClassics();
  }, []);

  // Apply language and genre filters to classics
  useEffect(() => {
    let filtered = allClassics;
    
    if (selectedLanguage !== 'all') {
      filtered = filtered.filter(item => item.language === selectedLanguage);
    }
    
    if (selectedGenre !== 'all') {
      filtered = filtered.filter(item => item.genre === selectedGenre);
    }
    
    setClassics(filtered);
  }, [selectedLanguage, selectedGenre, allClassics]);

  // Delete a preference from the database
  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update local preferences state
      const deletedPref = preferences.find(p => p.id === id);
      setPreferences(preferences.filter(p => p.id !== id));
      
      // Also update classicReactions if this was a classic
      if (deletedPref?.content_type === 'Classics') {
        setClassicReactions(prev => ({
          ...prev,
          [deletedPref.content_id]: null
        }));
      }
      
      toast({
        title: "Preference removed",
        description: "Your preference has been deleted.",
      });
    } catch (error) {
      // Log error only in development to prevent info disclosure
      logger.error('Error deleting preference:', error);
      toast({
        title: "Error",
        description: "Failed to delete preference. Please try again.",
        variant: "destructive",
      });
    }
  };

  /**
   * Handles like/dislike reaction for a classic content
   * Implements toggle behavior: clicking the same button removes the reaction
   */
  const handleClassicReaction = async (classic: TasteClassic, reaction: "like" | "dislike") => {
    if (!user) {
      sonnerToast.error("Please log in to react to content");
      return;
    }

    setSavingClassicId(classic.id);
    const contentId = String(classic.id);
    const currentReaction = classicReactions[contentId];

    try {
      // If clicking the same reaction, remove it (toggle off)
      if (currentReaction === reaction) {
        const { error } = await supabase
          .from("user_preferences")
          .delete()
          .eq("user_id", user.id)
          .eq("content_id", contentId)
          .eq("content_type", "Classics");

        if (error) throw error;

        // Update local state
        setClassicReactions(prev => ({ ...prev, [contentId]: null }));
        setPreferences(prev => prev.filter(p => !(p.content_id === contentId && p.content_type === 'Classics')));
        sonnerToast.success("Reaction removed");
      } else {
        // If there's an existing reaction, update it
        if (currentReaction) {
          const { error: updateError } = await supabase
            .from("user_preferences")
            .update({ reaction: reaction })
            .eq("user_id", user.id)
            .eq("content_id", contentId)
            .eq("content_type", "Classics");

          if (updateError) throw updateError;

          // Update local state
          setClassicReactions(prev => ({ ...prev, [contentId]: reaction }));
          setPreferences(prev => prev.map(p => 
            p.content_id === contentId && p.content_type === 'Classics' 
              ? { ...p, reaction } 
              : p
          ));
        } else {
          // Insert new reaction
          const { data, error: insertError } = await supabase
            .from("user_preferences")
            .insert({
              user_id: user.id,
              content_id: contentId,
              content_type: "Classics",
              content_title: classic.title,
              poster_path: classic.poster_url || null,
              reaction: reaction,
            })
            .select()
            .single();

          if (insertError) throw insertError;

          // Update local state
          setClassicReactions(prev => ({ ...prev, [contentId]: reaction }));
          if (data) {
            setPreferences(prev => [data as UserPreference, ...prev]);
          }
        }

        sonnerToast.success(reaction === "like" ? "Added to liked content" : "Added to disliked content");
      }
    } catch (error) {
      logger.error("Error updating reaction:", error);
      sonnerToast.error("Failed to update reaction");
    } finally {
      setSavingClassicId(null);
    }
  };

  // Navigate to content details page
  const handleContentClick = (contentType: string, contentId: string) => {
    if (contentType === 'movie') {
      navigate(`/movie/${contentId}`);
    } else if (contentType === 'tv') {
      navigate(`/tv/${contentId}`);
    }
  };

  // Filter preferences by reaction type
  const likedContent = preferences.filter(p => p.reaction === 'like');
  const dislikedContent = preferences.filter(p => p.reaction === 'dislike');

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Your Preferences</h1>
        <p className="text-muted-foreground">
          Discover new classics and manage your liked/disliked content
        </p>
      </div>

      {/* Discover Classics Section - Browse and rate new content */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Discover Classics
          </CardTitle>
          <CardDescription>
            Browse classic movies and shows. Like or dislike to personalize your recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter controls for language and genre */}
          <div className="flex gap-3 flex-wrap">
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {languages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedGenre} onValueChange={setSelectedGenre}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                {genres.map((genre) => (
                  <SelectItem key={genre} value={genre}>
                    {genre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Classics grid with like/dislike buttons */}
          {classicsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : classics.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No classics found matching your filters.
            </p>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {classics.map((classic) => {
                  const contentId = String(classic.id);
                  const currentReaction = classicReactions[contentId];
                  const isSaving = savingClassicId === classic.id;

                  return (
                    <Card 
                      key={classic.id}
                      className="overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      {/* Poster image or placeholder */}
                      {classic.poster_url ? (
                        <img
                          src={classic.poster_url}
                          alt={classic.title}
                          className="w-full h-32 object-cover"
                        />
                      ) : (
                        <div className="w-full h-32 bg-muted flex items-center justify-center">
                          <Film className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      
                      <CardContent className="p-2 space-y-2">
                        {/* Title and metadata */}
                        <p className="text-xs font-medium line-clamp-2">{classic.title}</p>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            {classic.genre}
                          </Badge>
                          <Badge variant="secondary" className="text-xs px-1 py-0">
                            {classic.language}
                          </Badge>
                        </div>
                        
                        {/* Like/Dislike buttons */}
                        <div className="flex gap-1">
                          <Button
                            variant={currentReaction === "like" ? "default" : "outline"}
                            size="sm"
                            className="flex-1 h-7 px-1"
                            onClick={() => handleClassicReaction(classic, "like")}
                            disabled={isSaving}
                            title="Like this content"
                          >
                            {isSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ThumbsUp className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant={currentReaction === "dislike" ? "default" : "outline"}
                            size="sm"
                            className="flex-1 h-7 px-1"
                            onClick={() => handleClassicReaction(classic, "dislike")}
                            disabled={isSaving}
                            title="Dislike this content"
                          >
                            {isSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ThumbsDown className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Liked Content Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Liked Content ({likedContent.length})
          </CardTitle>
          <CardDescription>
            Content you've shown interest in
          </CardDescription>
        </CardHeader>
        <CardContent>
          {likedContent.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No liked content yet. Start exploring and like content you enjoy!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {likedContent.map((preference) => (
                <Card 
                  key={preference.id}
                  className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <div 
                    onClick={() => handleContentClick(preference.content_type, preference.content_id)}
                  >
                    {preference.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w500${preference.poster_path}`}
                        alt={preference.content_title || 'Content poster'}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-muted flex items-center justify-center">
                        {preference.content_type === 'movie' ? (
                          <Film className="h-16 w-16 text-muted-foreground" />
                        ) : (
                          <Tv className="h-16 w-16 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <CardContent className="p-4">
                      <h3 className="font-semibold line-clamp-2 mb-2">
                        {preference.content_title || 'Unknown Title'}
                      </h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {preference.content_type}
                      </p>
                    </CardContent>
                  </div>
                  <div className="px-4 pb-4">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(preference.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disliked Content Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ThumbsDown className="h-5 w-5 text-muted-foreground" />
            Disliked Content ({dislikedContent.length})
          </CardTitle>
          <CardDescription>
            Content you're not interested in
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dislikedContent.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No disliked content yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dislikedContent.map((preference) => (
                <Card 
                  key={preference.id}
                  className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <div 
                    onClick={() => handleContentClick(preference.content_type, preference.content_id)}
                  >
                    {preference.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w500${preference.poster_path}`}
                        alt={preference.content_title || 'Content poster'}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-muted flex items-center justify-center">
                        {preference.content_type === 'movie' ? (
                          <Film className="h-16 w-16 text-muted-foreground" />
                        ) : (
                          <Tv className="h-16 w-16 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <CardContent className="p-4">
                      <h3 className="font-semibold line-clamp-2 mb-2">
                        {preference.content_title || 'Unknown Title'}
                      </h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {preference.content_type}
                      </p>
                    </CardContent>
                  </div>
                  <div className="px-4 pb-4">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(preference.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
