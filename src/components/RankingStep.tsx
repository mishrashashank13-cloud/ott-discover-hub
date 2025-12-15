import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, GripVertical, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

// Available languages and genres for OTT content in India
const AVAILABLE_LANGUAGES = [
  'Hindi', 'English', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 
  'Bengali', 'Marathi', 'Gujarati', 'Punjabi', 'Odia', 'Urdu'
];

const AVAILABLE_GENRES = [
  'Action', 'Comedy', 'Drama', 'Thriller', 'Romance', 'Horror',
  'Sci-Fi', 'Fantasy', 'Crime', 'Mystery', 'Documentary', 'Animation',
  'Musical', 'Adventure', 'Family', 'War', 'Biography', 'Sport'
];

interface RankingStepProps {
  onComplete: () => void;
  userId: string | null;
}

interface RankedItem {
  name: string;
  rank: number;
}

export const RankingStep: React.FC<RankingStepProps> = ({ onComplete, userId }) => {
  // State for selected languages and genres with their ranks
  const [selectedLanguages, setSelectedLanguages] = useState<RankedItem[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<RankedItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [currentSection, setCurrentSection] = useState<'languages' | 'genres'>('languages');
  const { toast } = useToast();

  // Handle adding a language or genre to the ranked list
  const handleAddItem = (item: string, type: 'languages' | 'genres') => {
    if (type === 'languages') {
      if (selectedLanguages.some(lang => lang.name === item)) return;
      setSelectedLanguages([...selectedLanguages, { name: item, rank: selectedLanguages.length + 1 }]);
    } else {
      if (selectedGenres.some(genre => genre.name === item)) return;
      setSelectedGenres([...selectedGenres, { name: item, rank: selectedGenres.length + 1 }]);
    }
  };

  // Handle removing an item from the ranked list
  const handleRemoveItem = (item: string, type: 'languages' | 'genres') => {
    if (type === 'languages') {
      const updated = selectedLanguages
        .filter(lang => lang.name !== item)
        .map((lang, index) => ({ ...lang, rank: index + 1 }));
      setSelectedLanguages(updated);
    } else {
      const updated = selectedGenres
        .filter(genre => genre.name !== item)
        .map((genre, index) => ({ ...genre, rank: index + 1 }));
      setSelectedGenres(updated);
    }
  };

  // Handle drag start
  const handleDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const items = currentSection === 'languages' ? [...selectedLanguages] : [...selectedGenres];
    const draggedItem = items[draggedItemIndex];
    items.splice(draggedItemIndex, 1);
    items.splice(index, 0, draggedItem);

    // Update ranks
    const reranked = items.map((item, idx) => ({ ...item, rank: idx + 1 }));

    if (currentSection === 'languages') {
      setSelectedLanguages(reranked);
    } else {
      setSelectedGenres(reranked);
    }
    setDraggedItemIndex(index);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  // Save rankings to the profiles table
  const handleSaveRankings = async () => {
    if (!userId) {
      toast({
        title: "Error",
        description: "User session not found. Please try logging in again.",
        variant: "destructive",
      });
      return;
    }

    if (selectedLanguages.length === 0 || selectedGenres.length === 0) {
      toast({
        title: "Incomplete Selection",
        description: "Please rank at least one language and one genre.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Save language and genre preferences to profiles table
      const { error } = await supabase
        .from('profiles')
        .update({
          language_preferences: selectedLanguages.map(lang => ({
            language: lang.name,
            rank: lang.rank
          })),
          genre_preferences: selectedGenres.map(genre => ({
            genre: genre.name,
            rank: genre.rank
          }))
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Preferences Saved",
        description: "Your language and genre preferences have been saved successfully!",
      });

      onComplete();
    } catch (error: any) {
      // Log error only in development to prevent info disclosure
      logger.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinue = () => {
    if (currentSection === 'languages') {
      if (selectedLanguages.length === 0) {
        toast({
          title: "Selection Required",
          description: "Please select and rank at least one language.",
          variant: "destructive",
        });
        return;
      }
      setCurrentSection('genres');
    } else {
      handleSaveRankings();
    }
  };

  const handleBack = () => {
    setCurrentSection('languages');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">
            {currentSection === 'languages' ? 'Rank Your Preferred Languages' : 'Rank Your Preferred Genres'}
          </CardTitle>
          <CardDescription>
            {currentSection === 'languages' 
              ? 'Select and arrange languages in order of preference. Lower rank = higher priority.'
              : 'Select and arrange genres in order of preference. Lower rank = higher priority.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Available items to select */}
          <div>
            <h3 className="text-sm font-medium mb-3">
              {currentSection === 'languages' ? 'Available Languages' : 'Available Genres'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {(currentSection === 'languages' ? AVAILABLE_LANGUAGES : AVAILABLE_GENRES).map((item) => {
                const isSelected = currentSection === 'languages'
                  ? selectedLanguages.some(lang => lang.name === item)
                  : selectedGenres.some(genre => genre.name === item);
                
                return (
                  <Badge
                    key={item}
                    variant={isSelected ? "default" : "outline"}
                    className={`cursor-pointer transition-all ${
                      isSelected ? 'opacity-50' : 'hover:bg-primary hover:text-primary-foreground'
                    }`}
                    onClick={() => !isSelected && handleAddItem(item, currentSection)}
                  >
                    {isSelected && <Check className="h-3 w-3 mr-1" />}
                    {item}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Ranked items (drag and drop) */}
          <div>
            <h3 className="text-sm font-medium mb-3">
              Your Ranked {currentSection === 'languages' ? 'Languages' : 'Genres'} 
              {' '}({currentSection === 'languages' ? selectedLanguages.length : selectedGenres.length} selected)
            </h3>
            <div className="space-y-2 min-h-[200px] border border-border rounded-md p-3 bg-muted/30">
              {(currentSection === 'languages' ? selectedLanguages : selectedGenres).length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No {currentSection} selected. Click items above to add them.
                </p>
              ) : (
                (currentSection === 'languages' ? selectedLanguages : selectedGenres).map((item, index) => (
                  <div
                    key={item.name}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className="flex items-center gap-3 bg-background border border-border rounded-md p-3 cursor-move hover:border-primary transition-colors"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-primary">#{item.rank}</span>
                    <span className="flex-1">{item.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item.name, currentSection)}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            {currentSection === 'genres' && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isSaving}
                className="flex-1"
              >
                Back to Languages
              </Button>
            )}
            <Button
              onClick={handleContinue}
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : currentSection === 'languages' ? (
                'Continue to Genres'
              ) : (
                'Save & Continue'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};