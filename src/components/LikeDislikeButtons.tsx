import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

/**
 * LikeDislikeButtons Component
 * 
 * Displays like and dislike buttons for content (movies/TV shows).
 * Only enabled when user is authenticated.
 * Stores user reactions in the user_preferences table.
 * 
 * @param contentId - The ID of the content (movie or TV show)
 * @param contentTitle - The title of the content
 * @param contentType - Type of content ('movie' or 'tv')
 * @param posterPath - Optional poster path for the content
 */
interface LikeDislikeButtonsProps {
  contentId: string;
  contentTitle: string;
  contentType: "movie" | "tv";
  posterPath?: string;
}

export const LikeDislikeButtons = ({
  contentId,
  contentTitle,
  contentType,
  posterPath,
}: LikeDislikeButtonsProps) => {
  // State to track user authentication and current reaction
  const [userId, setUserId] = useState<string | null>(null);
  const [currentReaction, setCurrentReaction] = useState<"like" | "dislike" | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check authentication status and fetch existing preference on component mount
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      // Debug logging only in development mode
      logger.log("[LikeDislikeButtons] Checking auth for content:", contentId);
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        // Log authentication errors only in development
        logger.error("[LikeDislikeButtons] Auth error:", error);
      }
      
      logger.log("[LikeDislikeButtons] Session:", session?.user?.id || "No user");
      
      if (!isMounted) return;
      
      setUserId(session?.user?.id || null);

      // If user is logged in, fetch their existing preference for this content
      if (session?.user?.id) {
        await fetchUserPreference(session.user.id);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.log("[LikeDislikeButtons] Auth state changed:", event);
        if (!isMounted) return;
        
        setUserId(session?.user?.id || null);
        if (session?.user?.id) {
          await fetchUserPreference(session.user.id);
        } else {
          setCurrentReaction(null);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [contentId]);

  /**
   * Fetches the user's existing preference for this content
   */
  const fetchUserPreference = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("reaction")
        .eq("user_id", uid)
        .eq("content_id", contentId)
        .eq("content_type", contentType)
        .maybeSingle();

      if (error) throw error;

      if (data?.reaction) {
        setCurrentReaction(data.reaction as "like" | "dislike");
      } else {
        setCurrentReaction(null);
      }
    } catch (error) {
      // Log error only in development to prevent info disclosure
      logger.error("Error fetching user preference:", error);
    }
  };

  /**
   * Handles like/dislike button clicks
   * Implements toggle behavior: clicking the same button removes the reaction
   */
  const handleReaction = async (reaction: "like" | "dislike") => {
    if (!userId) {
      toast.error("Please log in to react to content");
      return;
    }

    setIsLoading(true);

    try {
      // If clicking the same reaction, remove it (toggle off)
      if (currentReaction === reaction) {
        const { error } = await supabase
          .from("user_preferences")
          .delete()
          .eq("user_id", userId)
          .eq("content_id", contentId)
          .eq("content_type", contentType);

        if (error) throw error;

        setCurrentReaction(null);
        toast.success("Reaction removed");
      } else {
        // If there's an existing reaction, use UPDATE for efficiency (single atomic operation)
        if (currentReaction) {
          // Update existing preference - more efficient and preserves created_at timestamp
          const { error: updateError } = await supabase
            .from("user_preferences")
            .update({ reaction: reaction })
            .eq("user_id", userId)
            .eq("content_id", contentId)
            .eq("content_type", contentType);

          if (updateError) throw updateError;
        } else {
          // Insert new reaction for first-time preference
          const { error: insertError } = await supabase
            .from("user_preferences")
            .insert({
              user_id: userId,
              content_id: contentId,
              content_type: contentType,
              content_title: contentTitle,
              poster_path: posterPath,
              reaction: reaction,
            });

          if (insertError) throw insertError;
        }

        setCurrentReaction(reaction);
        toast.success(reaction === "like" ? "Added to liked content" : "Added to disliked content");
      }
    } catch (error) {
      // Log error only in development to prevent info disclosure
      logger.error("Error updating reaction:", error);
      toast.error("Failed to update reaction");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-3">
      {/* Like Button */}
      <Button
        variant={currentReaction === "like" ? "default" : "outline"}
        size="lg"
        onClick={() => handleReaction("like")}
        disabled={!userId || isLoading}
        className="flex-1"
        title={!userId ? "Please log in to like" : "Like this content"}
      >
        <ThumbsUp className="h-5 w-5 mr-2" />
        Like
      </Button>

      {/* Dislike Button */}
      <Button
        variant={currentReaction === "dislike" ? "default" : "outline"}
        size="lg"
        onClick={() => handleReaction("dislike")}
        disabled={!userId || isLoading}
        className="flex-1"
        title={!userId ? "Please log in to dislike" : "Dislike this content"}
      >
        <ThumbsDown className="h-5 w-5 mr-2" />
        Dislike
      </Button>
    </div>
  );
};
