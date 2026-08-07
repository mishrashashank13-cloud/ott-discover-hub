import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Helpers for "content the user has already given feedback on".
 *
 * A user can like or dislike a title (stored in the `user_preferences` table).
 * Once they have reacted, that title should no longer be suggested to them in
 * any personalized recommendation section — they have already told us what
 * they think about it. It still appears in Search, Watchlist, Reminders and
 * the Preferences page so the feedback can be reviewed or changed later.
 */

/** A "type:id" key, e.g. "movie:550" — unique per title across content types. */
export type ReactedKey = string;

/** Builds the lookup key used to check whether a title was reacted to. */
export const reactedKey = (
  contentType: string | null | undefined,
  contentId: string | number
): ReactedKey => `${(contentType || "").toLowerCase()}:${String(contentId)}`;

/**
 * Loads every title the signed-in user has liked or disliked.
 *
 * Returns a Set of "type:id" keys. If the user is not signed in, or the
 * lookup fails, an empty Set is returned so recommendations keep working
 * exactly as before (fail-open, never break the UI).
 */
export const fetchReactedContentKeys = async (
  userId: string | null | undefined
): Promise<Set<ReactedKey>> => {
  if (!userId) return new Set();

  try {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("content_id, content_type, reaction")
      .eq("user_id", userId);

    if (error) throw error;

    const keys = new Set<ReactedKey>();
    (data || []).forEach((row) => {
      // Only rows with an explicit like/dislike count as feedback.
      if (row.reaction === "like" || row.reaction === "dislike") {
        keys.add(reactedKey(row.content_type, row.content_id));
      }
    });
    return keys;
  } catch (error) {
    // Log only in development to avoid leaking data in production.
    logger.error("Error loading reacted content:", error);
    return new Set();
  }
};
