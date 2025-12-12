import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Reminder {
  id: string;
  user_id: string;
  content_id: string;
  content_title: string;
  content_type: string;
  release_date: string;
  last_notified_on: string | null;
}

interface Profile {
  user_id: string;
  email: string | null;
  mobile_number: string | null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting send-due-reminders function");

    // Parse request body for force mode and specific reminder ID
    let forceMode = false;
    let specificReminderId: string | null = null;
    
    try {
      const body = await req.json();
      forceMode = body?.force === true;
      specificReminderId = body?.reminderId || null;
      console.log(`Force mode: ${forceMode}, Specific reminder ID: ${specificReminderId}`);
    } catch {
      // No body or invalid JSON, continue with defaults
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@bingeguide.app";

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get today's date in ISO format (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    console.log(`Checking for reminders due on: ${today}`);

    let reminders;
    let remindersError;

    // Force mode: fetch specific reminder or all reminders regardless of date/notification status
    if (forceMode) {
      console.log("Force mode enabled - bypassing date and notification checks");
      
      if (specificReminderId) {
        // Fetch specific reminder by ID
        const result = await supabase
          .from("reminders")
          .select("*")
          .eq("id", specificReminderId);
        reminders = result.data;
        remindersError = result.error;
      } else {
        // Fetch all reminders that haven't been notified today
        const result = await supabase
          .from("reminders")
          .select("*")
          .or(`last_notified_on.is.null,last_notified_on.neq.${today}`);
        reminders = result.data;
        remindersError = result.error;
      }
    } else {
      // Normal mode: fetch reminders due today that haven't been notified yet
      const result = await supabase
        .from("reminders")
        .select("*")
        .eq("release_date", today)
        .or(`last_notified_on.is.null,last_notified_on.neq.${today}`);
      reminders = result.data;
      remindersError = result.error;
    }

    if (remindersError) {
      console.error("Error fetching reminders:", remindersError);
      throw remindersError;
    }

    console.log(`Found ${reminders?.length || 0} reminders to process`);

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ message: "No reminders to process", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique user IDs
    const userIds = [...new Set(reminders.map((r: Reminder) => r.user_id))];
    console.log(`Processing reminders for ${userIds.length} users`);

    // Fetch user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, mobile_number")
      .in("user_id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    // Create a map of userId to profile
    const profileMap = new Map(
      profiles?.map((p: Profile) => [p.user_id, p]) || []
    );

    let sentCount = 0;
    let errorCount = 0;

    // Group reminders by user
    const remindersByUser = reminders.reduce((acc: Record<string, Reminder[]>, reminder: Reminder) => {
      if (!acc[reminder.user_id]) {
        acc[reminder.user_id] = [];
      }
      acc[reminder.user_id].push(reminder);
      return acc;
    }, {});

    // Send notifications for each user
    for (const [userId, userReminders] of Object.entries(remindersByUser)) {
      const profile = profileMap.get(userId);

      if (!profile?.email) {
        console.log(`No email found for user ${userId}, skipping`);
        continue;
      }

      try {
        // Create email content
        const contentList = userReminders
          .map((r: Reminder) => `• ${r.content_title} (${r.content_type})`)
          .join("\n");

        const subject = userReminders.length === 1
          ? `Reminder: ${userReminders[0].content_title} releases today!`
          : `Reminder: ${userReminders.length} shows/movies release today!`;

        const bodyHtml = `
          <h2>Your BingeGuide Reminders for Today</h2>
          <p>The following content is releasing today:</p>
          <ul>
            ${userReminders.map((r: Reminder) => 
              `<li><strong>${r.content_title}</strong> (${r.content_type})</li>`
            ).join("")}
          </ul>
          <p>Don't miss out! Visit BingeGuide to watch now.</p>
        `;

        // Send email using Resend
        const emailResponse = await resend.emails.send({
          from: resendFromEmail,
          to: [profile.email],
          subject: subject,
          html: bodyHtml,
        });

        console.log(`Email sent to ${profile.email}:`, emailResponse);

        // Update last_notified_on for all reminders
        const reminderIds = userReminders.map((r: Reminder) => r.id);
        const { error: updateError } = await supabase
          .from("reminders")
          .update({ last_notified_on: today })
          .in("id", reminderIds);

        if (updateError) {
          console.error(`Error updating reminders for user ${userId}:`, updateError);
          errorCount++;
        } else {
          sentCount += userReminders.length;
        }
      } catch (error) {
        console.error(`Error sending notification to user ${userId}:`, error);
        errorCount++;
      }
    }

    console.log(`Processed ${sentCount} reminders successfully, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        message: "Reminders processed",
        sent: sentCount,
        errors: errorCount,
        total: reminders.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-due-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
