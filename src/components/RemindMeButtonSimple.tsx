import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

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
    console.log("Remind me clicked!", { contentId, contentTitle, contentType, releaseDate });
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
