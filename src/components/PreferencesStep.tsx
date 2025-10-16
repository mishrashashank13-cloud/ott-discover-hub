import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check } from 'lucide-react';
import { tmdbApi } from '@/lib/tmdb';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface Content {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type: 'movie' | 'tv';
}

export const PreferencesStep = () => {
  const [content, setContent] = useState<Content[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadClassicContent();
    
    // Wait for auth session to be established
    const checkSession = async () => {
      // Wait a bit for the session to establish after signup
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        toast({
          title: "Session Error",
          description: "Please try logging in again.",
          variant: "destructive",
        });
        navigate('/auth');
      }
    };
    
    checkSession();
  }, [navigate, toast]);

  const loadClassicContent = async () => {
    try {
      // Fetch classic/popular movies and TV shows
      const [moviesData, tvData] = await Promise.all([
        tmdbApi.getPopularMovies(),
        tmdbApi.getPopularTVShows(),
      ]);

      // Combine and take first 20 items
      const allContent: Content[] = [
        ...moviesData.results.slice(0, 10).map((m: any) => ({ ...m, media_type: 'movie' as const })),
        ...tvData.results.slice(0, 10).map((t: any) => ({ ...t, media_type: 'tv' as const })),
      ];

      setContent(allContent);
    } catch (error) {
      console.error('Error loading content:', error);
      toast({
        title: "Error",
        description: "Failed to load content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const savePreferences = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: "Selection required",
        description: "Please select at least one movie or TV show.",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "Error",
        description: "Please wait for authentication to complete.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Prepare preferences data
      const preferences = Array.from(selectedIds).map((id) => {
        const item = content.find((c) => c.id === id);
        return {
          user_id: userId,
          content_id: String(id),
          content_type: item?.media_type || 'movie',
          content_title: item?.title || item?.name || '',
          poster_path: item?.poster_path || null,
        };
      });

      // Insert preferences
      const { error } = await supabase
        .from('user_preferences')
        .insert(preferences);

      if (error) throw error;

      toast({
        title: "Preferences saved!",
        description: "Your account is all set up.",
      });

      navigate('/');
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save preferences.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">What do you like?</h2>
        <p className="text-muted-foreground">
          Select movies and TV shows you enjoy. This helps us personalize your experience.
        </p>
        <Badge variant="secondary" className="mt-2">
          {selectedIds.size} selected
        </Badge>
      </div>

      <ScrollArea className="h-[500px] pr-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {content.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const title = item.title || item.name || 'Untitled';

            return (
              <Card
                key={item.id}
                className={`cursor-pointer transition-all hover:scale-105 ${
                  isSelected ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => toggleSelection(item.id)}
              >
                <CardContent className="p-0 relative">
                  {item.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
                      alt={title}
                      className="w-full h-auto rounded-t-lg"
                    />
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center rounded-t-lg">
                      <span className="text-muted-foreground text-sm">No Image</span>
                    </div>
                  )}
                  
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                  
                  <div className="p-2">
                    <p className="text-xs font-medium line-clamp-2">{title}</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {item.media_type === 'movie' ? 'Movie' : 'TV Show'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => navigate('/')}
          disabled={isSaving}
          className="flex-1"
        >
          Skip for now
        </Button>
        <Button
          onClick={savePreferences}
          disabled={isSaving || selectedIds.size === 0}
          className="flex-1"
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </div>
    </div>
  );
};
