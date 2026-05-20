import { useEffect, useState } from "react";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ------------------------------------------------------------------
// Props: the dialog only knows about the content to remind for.
// The parent decides when to open/close it.
// ------------------------------------------------------------------
interface ReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  contentTitle: string;
  contentType: "movie" | "tv";
  releaseDate: string; // ISO date string, used only to suggest a default
  onCreated?: () => void;
}

// Validation rules for the form. Channel/contact fields are checked
// together below because their requirement depends on each other.
const phoneRegex = /^\+[1-9]\d{7,14}$/; // E.164 format, e.g. +14155552671
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ReminderDialog = ({
  open,
  onOpenChange,
  contentId,
  contentTitle,
  contentType,
  releaseDate,
  onCreated,
}: ReminderDialogProps) => {
  // ---- Form state -------------------------------------------------
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState<string>("09:00"); // HH:mm in the user's local timezone
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);

  // Contact details currently on the user's profile (may be empty)
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [profilePhone, setProfilePhone] = useState<string | null>(null);

  // Inputs the user fills in when their profile is missing a detail
  const [emailInput, setEmailInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");

  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---- Defaults when the dialog opens -----------------------------
  useEffect(() => {
    if (!open) return;

    // Default reminder time: release date at 09:00 local time,
    // or "tomorrow 09:00" if the release date is already past.
    const release = new Date(releaseDate);
    const now = new Date();
    const initial =
      isNaN(release.getTime()) || release.getTime() < now.getTime()
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : release;

    setDate(initial);
    setTime("09:00");
    setNotifyEmail(true);
    setNotifyWhatsapp(false);
    setEmailInput("");
    setPhoneInput("");

    // Load the latest profile contact details so we can decide
    // whether to ask the user for any missing ones.
    (async () => {
      setIsLoadingProfile(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Please sign in to set reminders.");
          onOpenChange(false);
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("email, mobile_number")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        setProfileEmail(data?.email ?? null);
        setProfilePhone(data?.mobile_number ?? null);
      } catch (err) {
        logger.error("Failed to load profile for reminder dialog", err);
      } finally {
        setIsLoadingProfile(false);
      }
    })();
  }, [open, releaseDate, onOpenChange]);

  // Whether we need to prompt the user for a missing contact field
  const needsEmailInput = notifyEmail && !profileEmail;
  const needsPhoneInput = notifyWhatsapp && !profilePhone;

  // ---- Submit -----------------------------------------------------
  const handleSubmit = async () => {
    if (isSubmitting) return;

    // 1. Build the chosen delivery moment from the date + time pickers.
    if (!date) {
      toast.error("Please choose a reminder date.");
      return;
    }
    const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) {
      toast.error("Please choose a valid reminder time.");
      return;
    }
    const remindAt = new Date(date);
    remindAt.setHours(hh, mm, 0, 0);

    // 2. Validate the form as a whole using a single zod schema.
    const schema = z
      .object({
        remindAt: z.date().refine((d) => d.getTime() > Date.now(), {
          message: "Reminder time must be in the future.",
        }),
        notifyEmail: z.boolean(),
        notifyWhatsapp: z.boolean(),
        email: z.string().optional(),
        phone: z.string().optional(),
      })
      .refine((v) => v.notifyEmail || v.notifyWhatsapp, {
        message: "Pick at least one delivery channel (Email or WhatsApp).",
        path: ["notifyEmail"],
      })
      .refine(
        (v) => !needsEmailInput || emailRegex.test(v.email ?? ""),
        { message: "Enter a valid email address.", path: ["email"] }
      )
      .refine(
        (v) => !needsPhoneInput || phoneRegex.test(v.phone ?? ""),
        {
          message: "Enter a WhatsApp number in international format, e.g. +14155552671.",
          path: ["phone"],
        }
      );

    const parsed = schema.safeParse({
      remindAt,
      notifyEmail,
      notifyWhatsapp,
      email: emailInput.trim(),
      phone: phoneInput.trim(),
    });

    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Please fix the form.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // 3. Save any newly provided contact details to the profile so
      //    we don't have to ask again next time.
      const profileUpdates: { email?: string; mobile_number?: string } = {};
      if (needsEmailInput) profileUpdates.email = emailInput.trim();
      if (needsPhoneInput) profileUpdates.mobile_number = phoneInput.trim();
      if (Object.keys(profileUpdates).length > 0) {
        const { error: profErr } = await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("user_id", user.id);
        if (profErr) throw profErr;
      }

      // 4. Create the reminder row. release_date stays for display
      //    purposes; remind_at drives the delivery cron.
      const { error: insErr } = await supabase.from("reminders").insert({
        user_id: user.id,
        content_id: contentId,
        content_title: contentTitle,
        content_type: contentType,
        release_date: releaseDate.slice(0, 10),
        remind_at: remindAt.toISOString(),
        notify_email: notifyEmail,
        notify_whatsapp: notifyWhatsapp,
      });
      if (insErr) throw insErr;

      toast.success(
        `Reminder set for ${format(remindAt, "PPp")}.`
      );
      onCreated?.();
      onOpenChange(false);
    } catch (err: unknown) {
      logger.error("Failed to create reminder", err);
      const message = err instanceof Error ? err.message : "Failed to set reminder.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remind me about "{contentTitle}"</DialogTitle>
          <DialogDescription>
            Choose when and how you want to be reminded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date + time picker */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reminder-time">Time</Label>
              <Input
                id="reminder-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Delivery channel checkboxes */}
          <div className="space-y-2">
            <Label>Send via</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="ch-email"
                checked={notifyEmail}
                onCheckedChange={(v) => setNotifyEmail(v === true)}
              />
              <Label htmlFor="ch-email" className="font-normal cursor-pointer">
                Email
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="ch-wa"
                checked={notifyWhatsapp}
                onCheckedChange={(v) => setNotifyWhatsapp(v === true)}
              />
              <Label htmlFor="ch-wa" className="font-normal cursor-pointer">
                WhatsApp
              </Label>
            </div>
          </div>

          {/* Conditional contact prompts when details are missing */}
          {isLoadingProfile ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Checking your contact details…
            </div>
          ) : (
            <>
              {needsEmailInput && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email-input">Your email address</Label>
                  <Input
                    id="email-input"
                    type="email"
                    placeholder="you@example.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                  />
                </div>
              )}
              {needsPhoneInput && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone-input">Your WhatsApp number</Label>
                  <Input
                    id="phone-input"
                    type="tel"
                    placeholder="+14155552671"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Include country code, e.g. +14155552671.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isLoadingProfile}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Set reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
