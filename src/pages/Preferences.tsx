import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, ThumbsDown, Trash2, Film, Tv } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";

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

export const Preferences = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<UserPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

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

  // Delete a preference from the database
  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPreferences(preferences.filter(p => p.id !== id));
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
          View and manage your liked and disliked content
        </p>
      </div>

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
