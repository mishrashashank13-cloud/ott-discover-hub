import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

export const PreferencesStep = () => {
  const [content, setContent] = useState<TasteClassic[]>([]);
  const [allContent, setAllContent] = useState<TasteClassic[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [languages, setLanguages] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
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

  useEffect(() => {
    // Apply filters
    let filtered = allContent;
    
    if (selectedLanguage !== 'all') {
      filtered = filtered.filter(item => item.language === selectedLanguage);
    }
    
    if (selectedGenre !== 'all') {
      filtered = filtered.filter(item => item.genre === selectedGenre);
    }
    
    setContent(filtered);
  }, [selectedLanguage, selectedGenre, allContent]);

  const loadClassicContent = async () => {
    try {
      // Fetch classics from taste_classics table
      // Note: taste_classics table exists but types need regeneration
      const { data, error } = await (supabase as any)
        .from('taste_classics')
        .select('*')
        .order('popularity_score', { ascending: false });

      if (error) throw error;

      if (data) {
        const classicsData = data as TasteClassic[];
        setAllContent(classicsData);
        setContent(classicsData);
        
        // Extract unique languages and genres for filters
        const uniqueLanguages = [...new Set(classicsData.map(item => item.language))].filter(Boolean) as string[];
        const uniqueGenres = [...new Set(classicsData.map(item => item.genre))].filter(Boolean) as string[];
        
        setLanguages(uniqueLanguages);
        setGenres(uniqueGenres);
      }
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
        description: "Please select at least one classic.",
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
      // Prepare preferences data for classics
      const preferences = Array.from(selectedIds).map((id) => {
        const item = allContent.find((c) => c.id === id);
        return {
          user_id: userId,
          content_id: String(id),
          content_type: 'Classics',
          content_title: item?.title || '',
          poster_path: item?.poster_url || null,
          reaction: 'Like',
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
        <h2 className="text-2xl font-bold">What classics do you like?</h2>
        <p className="text-muted-foreground">
          Select classic movies and TV shows you enjoy. This helps us personalize your experience.
        </p>
        <Badge variant="secondary" className="mt-2">
          {selectedIds.size} selected
        </Badge>
      </div>

      <div className="flex gap-3">
        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
          <SelectTrigger className="w-full">
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
          <SelectTrigger className="w-full">
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

      <ScrollArea className="h-[500px] pr-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {content.map((item) => {
            const isSelected = selectedIds.has(item.id);

            return (
              <Card
                key={item.id}
                className={`cursor-pointer transition-all hover:scale-105 ${
                  isSelected ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => toggleSelection(item.id)}
              >
                <CardContent className="p-0 relative">
                  {item.poster_url ? (
                    <img
                      src={item.poster_url}
                      alt={item.title}
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
                    <p className="text-xs font-medium line-clamp-2">{item.title}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {item.genre}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {item.language}
                      </Badge>
                    </div>
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
