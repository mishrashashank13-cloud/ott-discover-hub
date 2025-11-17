import { Movie, TVShow } from "./tmdb";

/**
 * Interface representing a ranked preference item (language or genre)
 * stored in the profiles table
 */
interface RankedPreference {
  name: string;
  rank: number;
}

/**
 * Interface for user preferences fetched from the profiles table
 */
export interface UserPreferences {
  language_preferences: RankedPreference[];
  genre_preferences: RankedPreference[];
}

/**
 * Maps TMDB language codes to language names
 * This helps match TMDB's original_language field with user's language preferences
 */
const LANGUAGE_CODE_MAP: Record<string, string> = {
  'hi': 'Hindi',
  'en': 'English',
  'ta': 'Tamil',
  'te': 'Telugu',
  'ml': 'Malayalam',
  'kn': 'Kannada',
  'bn': 'Bengali',
  'mr': 'Marathi',
  'pa': 'Punjabi',
  'gu': 'Gujarati',
};

/**
 * Maps TMDB genre IDs to genre names
 * This helps match TMDB's genre_ids with user's genre preferences
 */
const GENRE_ID_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
};

/**
 * Calculates a preference score for a content item based on user's language and genre rankings
 * 
 * Scoring logic:
 * - Language match: (total_languages - rank + 1) * 100
 * - Genre match: (total_genres - rank + 1) * 10
 * - Both language AND genre match: adds bonus of 1000
 * 
 * Higher scores = better match with user preferences
 * 
 * @param item - Movie or TV show to score
 * @param preferences - User's ranked language and genre preferences
 * @returns Numerical score (higher = better match)
 */
const calculatePreferenceScore = (
  item: Movie | TVShow,
  preferences: UserPreferences | null
): number => {
  if (!preferences) return 0;

  let score = 0;
  let hasLanguageMatch = false;
  let hasGenreMatch = false;

  // Get the content's language name from TMDB's original_language code
  const itemLanguage = LANGUAGE_CODE_MAP[item.original_language];

  // Check language preference match
  if (itemLanguage && preferences.language_preferences) {
    const langPreference = preferences.language_preferences.find(
      (pref) => pref.name?.toLowerCase() === itemLanguage.toLowerCase()
    );
    
    if (langPreference) {
      hasLanguageMatch = true;
      // Higher rank (lower number) = higher score
      // Example: rank 1 gets more points than rank 5
      const languageScore = (preferences.language_preferences.length - langPreference.rank + 1) * 100;
      score += languageScore;
    }
  }

  // Check genre preference matches
  if (item.genre_ids && preferences.genre_preferences) {
    const itemGenres = item.genre_ids
      .map((id) => GENRE_ID_MAP[id])
      .filter(Boolean);

    for (const itemGenre of itemGenres) {
      const genrePreference = preferences.genre_preferences.find(
        (pref) => pref.name?.toLowerCase() === itemGenre.toLowerCase()
      );

      if (genrePreference) {
        hasGenreMatch = true;
        // Higher rank (lower number) = higher score
        const genreScore = (preferences.genre_preferences.length - genrePreference.rank + 1) * 10;
        score += genreScore;
      }
    }
  }

  // Bonus for matching both language AND genre
  if (hasLanguageMatch && hasGenreMatch) {
    score += 1000;
  }

  return score;
};

/**
 * Sorts an array of movies or TV shows based on user preferences
 * 
 * Content is sorted in this priority order:
 * 1. Items matching both language AND genre (highest scores)
 * 2. Items matching language only
 * 3. Items matching genre only
 * 4. All other items (score = 0)
 * 
 * Within each category, items are sorted by their preference score
 * 
 * @param content - Array of movies or TV shows to sort
 * @param preferences - User's ranked language and genre preferences
 * @returns Sorted array with best matches first
 */
export const sortByUserPreferences = <T extends Movie | TVShow>(
  content: T[],
  preferences: UserPreferences | null
): T[] => {
  if (!preferences || !content) return content;

  return [...content].sort((a, b) => {
    const scoreA = calculatePreferenceScore(a, preferences);
    const scoreB = calculatePreferenceScore(b, preferences);
    
    // Sort in descending order (highest score first)
    return scoreB - scoreA;
  });
};
