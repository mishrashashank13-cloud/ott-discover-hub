import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { ReminderDialog } from "@/components/ReminderDialog";

interface RemindMeButtonProps {
  contentId: string;
  contentTitle: string;
  contentType: "movie" | "tv";
  releaseDate: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

/**
 * Button shown on movie/TV cards and detail pages.
 * - If no reminder exists: opens the ReminderDialog (date+time + channels).
 * - If a reminder exists: lets the user remove it with a single click.
 */
export const RemindMeButton = ({
  contentId,
  contentTitle,
  contentType,
  releaseDate,
  className,
  variant = "outline",
  size = "default",
}: RemindMeButtonProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Look up whether the current user already has a reminder for this content.
  const { data: reminder, isLoading: checkingReminder } = useQuery({
    queryKey: ["reminder", contentId],
    queryFn: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
          .from("reminders")
          .select("id")
          .eq("content_id", contentId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          logger.warn("Reminder lookup error", error);
          return null;
        }
        return data;
      } catch (err) {
        logger.warn("Reminder lookup failed", err);
        return null;
      }
    },
    enabled: !!contentId,
    retry: false,
  });

  // Removing an existing reminder.
  const deleteReminder = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("reminders")
        .delete()
        .eq("content_id", contentId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminder", contentId] });
      toast.success("Reminder removed.");
    },
    onError: (err) => {
      logger.error("Delete reminder failed", err);
      toast.error("Failed to remove reminder.");
    },
  });

  const handleClick = async () => {
    // Make sure the user is signed in before opening the dialog.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to set reminders.");
      return;
    }
    if (reminder) {
      deleteReminder.mutate();
    } else {
      setDialogOpen(true);
    }
  };

  if (checkingReminder) {
    return (
      <Button variant={variant} size={size} disabled className={className}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="ml-2">Loading...</span>
      </Button>
    );
  }

  const reminderActive = !!reminder;
  const busy = deleteReminder.isPending;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={busy}
        className={className}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : reminderActive ? (
          <BellOff className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        <span className="ml-2">{reminderActive ? "Remove Reminder" : "Remind Me"}</span>
      </Button>

      <ReminderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contentId={contentId}
        contentTitle={contentTitle}
        contentType={contentType}
        releaseDate={releaseDate}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["reminder", contentId] })}
      />
    </>
  );
};
