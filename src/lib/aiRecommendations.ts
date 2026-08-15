import { supabase } from "@/integrations/supabase/client";
import { tmdbApi, Movie, TVShow, isMovie } from "@/lib/tmdb";
import { logger } from "@/lib/logger";
import { reactedKey } from "@/lib/reactedContent";

/**
 * AI-powered recommendations (client side helper)
 * -----------------------------------------------
 * The heavy thinking happens on the server (the `ai-recommendations` edge
 * function), which reads the user's taste profile and asks an AI model for a
 * list of title names. This file does two simple jobs:
 *
 *   1. Call that edge function.
 *   2. Turn each suggested title NAME into a real TMDB item (poster, id,
 *      rating) by searching TMDB through the existing proxy, so the cards look
 *      identical to every other ribbon on the site.
 */

/** One raw suggestion as returned by the AI. */
export interface AiSuggestion {
  title: string;
  year: number | null;
  type: "movie" | "tv";
  reason: string;
}

/** A suggestion after it has been matched to a real TMDB title. */
export interface AiRecommendation {
  item: Movie | TVShow;
  reason: string;
}

/** Reads the release year of a TMDB item ("" when unknown). */
const itemYear = (item: Movie | TVShow): number | null => {
  const date = isMovie(item) ? item.release_date : item.first_air_date;
  return date ? new Date(date).getFullYear() : null;
};

/** Lower-cased, punctuation-free title used for loose name comparison. */
const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Finds the TMDB entry that best matches an AI suggestion.
 * Preference order: same media type + same title + same year, then
 * same media type + same title, then simply the first search result.
 */
const matchSuggestion = (
  suggestion: AiSuggestion,
  results: (Movie | TVShow)[],
): Movie | TVShow | null => {
  if (results.length === 0) return null;

  const wantedName = normalize(suggestion.title);
  const sameType = results.filter((r) =>
    suggestion.type === "movie" ? isMovie(r) : !isMovie(r),
  );
  const pool = sameType.length > 0 ? sameType : results;

  const exactNameAndYear = pool.find((r) => {
    const name = normalize(isMovie(r) ? r.title : r.name);
    return name === wantedName && (!suggestion.year || itemYear(r) === suggestion.year);
  });
  if (exactNameAndYear) return exactNameAndYear;

  const exactName = pool.find(
    (r) => normalize(isMovie(r) ? r.title : r.name) === wantedName,
  );
  return exactName ?? pool[0];
};

/**
 * Fetches AI recommendations and resolves them into displayable TMDB items.
 *
 * @param reactedKeys  "type:id" keys of titles the user already liked/disliked;
 *                     those are dropped so feedback is always respected.
 * @param refresh      When true, bypasses the 12-hour server-side cache.
 */
export const fetchAiRecommendations = async (
  reactedKeys: Set<string> = new Set(),
  refresh = false,
): Promise<AiRecommendation[]> => {
  // 1. Ask the secure edge function for suggested title names.
  const { data, error } = await supabase.functions.invoke<{
    recommendations?: AiSuggestion[];
    error?: string;
  }>(`ai-recommendations${refresh ? "?refresh=1" : ""}`, { body: {} });

  if (error) {
    logger.error("AI recommendations request failed:", error);
    throw new Error("Could not load AI recommendations right now.");
  }
  if (data?.error) throw new Error(data.error);

  const suggestions = data?.recommendations ?? [];
  if (suggestions.length === 0) return [];

  // 2. Resolve every suggestion to a real TMDB title (in parallel).
  const resolved = await Promise.all(
    suggestions.map(async (suggestion) => {
      try {
        const search = await tmdbApi.searchMulti(suggestion.title);
        const match = matchSuggestion(suggestion, search.results ?? []);
        return match ? { item: match, reason: suggestion.reason } : null;
      } catch (searchError) {
        logger.error("Could not resolve AI suggestion:", searchError);
        return null;
      }
    }),
  );

  // 3. Drop misses, duplicates and anything the user already reacted to.
  const seen = new Set<string>();
  return resolved.filter((entry): entry is AiRecommendation => {
    if (!entry) return false;
    const key = reactedKey(isMovie(entry.item) ? "movie" : "tv", entry.item.id);
    if (seen.has(key) || reactedKeys.has(key)) return false;
    seen.add(key);
    return true;
  });
};
