import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { logger } from "@/lib/logger";

/**
 * RemindMeButtonSimple Component
 * 
 * A simple remind me button for content (movies/TV shows).
 * This is a simplified version that logs the action in development.
 * 
 * @param contentId - The ID of the content
 * @param contentTitle - The title of the content
 * @param contentType - Type of content ('movie' or 'tv')
 * @param releaseDate - The release date of the content
 */
interface RemindMeButtonSimpleProps {
  contentId: string;
  contentTitle: string;
  contentType: "movie" | "tv";
  releaseDate: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export const RemindMeButtonSimple = ({ 
  contentId, 
  contentTitle, 
  contentType, 
  releaseDate, 
  className,
  variant = "outline",
  size = "default"
}: RemindMeButtonSimpleProps) => {
  const handleClick = () => {
    // Log action only in development mode
    logger.log("Remind me clicked!", { contentId, contentTitle, contentType, releaseDate });
    alert(`Remind me for ${contentTitle} (${contentType}) releasing on ${releaseDate}`);
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={className}
    >
      <Bell className="h-4 w-4" />
      <span className="ml-2">Remind Me</span>
    </Button>
  );
};
