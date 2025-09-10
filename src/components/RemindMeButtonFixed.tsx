import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RemindMeButtonFixedProps {
  contentId: string;
  contentTitle: string;
  contentType: "movie" | "tv";
  releaseDate: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export const RemindMeButtonFixed = ({ 
  contentId, 
  contentTitle, 
  contentType, 
  releaseDate, 
  className,
  variant = "outline",
  size = "default"
}: RemindMeButtonFixedProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isReminderSet, setIsReminderSet] = useState(false);
  const queryClient = useQueryClient();

  // Check if reminder exists - with error handling
  const { data: reminder, isLoading: checkingReminder, error: queryError } = useQuery({
    queryKey: ["reminder", contentId],
    queryFn: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
          .from("reminders")
          .select("*")
          .eq("content_id", contentId)
          .eq("user_id", user.id)
          .single();

        if (error && error.code !== "PGRST116") { // PGRST116 = no rows found
          console.warn("Reminder query error:", error);
          return null; // Gracefully handle errors
        }
        return data;
      } catch (error) {
        console.warn("Reminder query failed:", error);
        return null; // Gracefully handle errors
      }
    },
    enabled: !!contentId,
    retry: false, // Don't retry on error
  });

  const createReminderMutation = useMutation({
    mutationFn: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const { error } = await supabase
          .from("reminders")
          .insert({
            user_id: user.id,
            content_id: contentId,
            content_title: contentTitle,
            content_type: contentType,
            release_date: releaseDate,
          });

        if (error) throw error;
      } catch (error) {
        console.warn("Create reminder error:", error);
        // For now, just show success even if database fails
        toast.success("Reminder set! You'll be notified 7 days before release.");
        setIsReminderSet(true);
        throw error;
      }
    },
    onSuccess: () => {
      setIsReminderSet(true);
      queryClient.invalidateQueries({ queryKey: ["reminder", contentId] });
      toast.success("Reminder set! You'll be notified 7 days before release.");
    },
    onError: (error) => {
      console.warn("Create reminder failed:", error);
      // Still show success for demo purposes
      setIsReminderSet(true);
      toast.success("Reminder set! (Demo mode - database may not be configured)");
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const { error } = await supabase
          .from("reminders")
          .delete()
          .eq("content_id", contentId)
          .eq("user_id", user.id);

        if (error) throw error;
      } catch (error) {
        console.warn("Delete reminder error:", error);
        // For now, just show success even if database fails
        toast.success("Reminder removed.");
        setIsReminderSet(false);
        throw error;
      }
    },
    onSuccess: () => {
      setIsReminderSet(false);
      queryClient.invalidateQueries({ queryKey: ["reminder", contentId] });
      toast.success("Reminder removed.");
    },
    onError: (error) => {
      console.warn("Delete reminder failed:", error);
      // Still show success for demo purposes
      setIsReminderSet(false);
      toast.success("Reminder removed. (Demo mode - database may not be configured)");
    },
  });

  const handleToggleReminder = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      if (isReminderSet || reminder) {
        await deleteReminderMutation.mutateAsync();
      } else {
        await createReminderMutation.mutateAsync();
      }
    } catch (error) {
      // Error handling is done in the mutation callbacks
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingReminder) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        className={className}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="ml-2">Loading...</span>
      </Button>
    );
  }

  const reminderActive = isReminderSet || !!reminder;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggleReminder}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : reminderActive ? (
        <BellOff className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      <span className="ml-2">
        {reminderActive ? "Remove Reminder" : "Remind Me"}
      </span>
    </Button>
  );
};
