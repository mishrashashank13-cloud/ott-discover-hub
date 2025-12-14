import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// ============================================================
// CORS headers for cross-origin requests from web application
// ============================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// Type definitions for database records
// ============================================================

/**
 * Reminder record from the 'reminders' table
 * Contains content release info and notification status
 */
interface Reminder {
  id: string;
  user_id: string;
  content_id: string;
  content_title: string;
  content_type: string;
  release_date: string;
  last_notified_on: string | null;
}

/**
 * User profile record from the 'profiles' table
 * Contains user contact information for notifications
 */
interface Profile {
  user_id: string;
  email: string | null;
  mobile_number: string | null;
}

// ============================================================
// Base64 encoding helper for SMTP authentication
// ============================================================
function base64Encode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return btoa(String.fromCharCode(...data));
}

// ============================================================
// SMTP Email Sending Function (Raw Socket Implementation)
// Uses direct TCP/TLS connection for Gmail SMTP
// ============================================================

/**
 * Sends an email using raw SMTP commands over TLS
 * Gmail requires port 465 with implicit TLS or 587 with STARTTLS
 * This uses port 465 with direct TLS connection for better compatibility
 * @param to - Recipient email address
 * @param subject - Email subject line  
 * @param htmlContent - HTML content of the email body
 * @returns Object with success status and optional error message
 */
async function sendEmailViaSMTP(
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string }> {
  // Read SMTP configuration from environment variables
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  const smtpFrom = Deno.env.get("SMTP_FROM_EMAIL");

  // Validate all required SMTP settings are present
  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    console.error("Missing SMTP configuration. Required: SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL");
    return { success: false, error: "SMTP not configured properly" };
  }

  console.log(`Attempting to send email via SMTP to: ${to}`);
  console.log(`SMTP Config - Host: ${smtpHost}, Port: ${smtpPort}, User: ${smtpUser}`);

  try {
    // Connect to SMTP server using TLS (port 465 for Gmail)
    const conn = await Deno.connectTls({
      hostname: smtpHost,
      port: smtpPort,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Helper function to send command and read response
    async function sendCommand(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + "\r\n"));
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      if (n === null) return "";
      return decoder.decode(buf.subarray(0, n));
    }

    // Helper function to just read response (for initial greeting)
    async function readResponse(): Promise<string> {
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      if (n === null) return "";
      return decoder.decode(buf.subarray(0, n));
    }

    // Read server greeting
    const greeting = await readResponse();
    console.log("SMTP Greeting:", greeting.trim());

    // Send EHLO
    const ehloResp = await sendCommand(`EHLO ${smtpHost}`);
    console.log("EHLO Response:", ehloResp.substring(0, 100));

    // Authenticate using AUTH LOGIN
    const authResp = await sendCommand("AUTH LOGIN");
    console.log("AUTH Response:", authResp.trim());

    // Send base64 encoded username
    const userResp = await sendCommand(base64Encode(smtpUser));
    console.log("User Response:", userResp.trim());

    // Send base64 encoded password
    const passResp = await sendCommand(base64Encode(smtpPass));
    console.log("Pass Response:", passResp.substring(0, 50));

    // Check authentication success (235 = auth successful)
    if (!passResp.startsWith("235")) {
      conn.close();
      return { success: false, error: `Authentication failed: ${passResp.trim()}` };
    }

    // Extract sender email from format like "Name <email>" or plain email
    const fromEmail = smtpFrom.includes("<") 
      ? smtpFrom.match(/<(.+)>/)?.[1] || smtpFrom 
      : smtpFrom;

    // MAIL FROM
    const mailFromResp = await sendCommand(`MAIL FROM:<${fromEmail}>`);
    console.log("MAIL FROM Response:", mailFromResp.trim());

    // RCPT TO
    const rcptToResp = await sendCommand(`RCPT TO:<${to}>`);
    console.log("RCPT TO Response:", rcptToResp.trim());

    // DATA command
    const dataResp = await sendCommand("DATA");
    console.log("DATA Response:", dataResp.trim());

    // Build and send email content
    const boundary = "----=_Part_" + Date.now();
    const emailContent = [
      `From: ${smtpFrom}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      `Your BingeGuide Reminders - View in HTML email client`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      htmlContent,
      ``,
      `--${boundary}--`,
      `.`,
    ].join("\r\n");

    const contentResp = await sendCommand(emailContent);
    console.log("Content Response:", contentResp.trim());

    // Check if email was accepted (250 = OK)
    if (!contentResp.startsWith("250")) {
      conn.close();
      return { success: false, error: `Email send failed: ${contentResp.trim()}` };
    }

    // QUIT
    await sendCommand("QUIT");
    conn.close();

    console.log(`Email sent successfully to ${to} via SMTP`);
    return { success: true };
  } catch (error) {
    console.error(`SMTP email sending failed for ${to}:`, error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// Main Edge Function Handler
// Processes due reminders and sends email notifications
// ============================================================
serve(async (req) => {
  // Handle CORS preflight requests (OPTIONS method)
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting send-due-reminders function");

    // --------------------------------------------------------
    // Parse request body for optional parameters
    // - force: boolean - bypass date/notification checks
    // - reminderId: string - process specific reminder only
    // --------------------------------------------------------
    let forceMode = false;
    let specificReminderId: string | null = null;
    
    try {
      const body = await req.json();
      console.log("Request body received:", JSON.stringify(body));
      forceMode = body?.force === true;
      specificReminderId = body?.reminderId || null;
      console.log(`Parsed - Force mode: ${forceMode}, Specific reminder ID: ${specificReminderId}`);
    } catch (parseError) {
      // No body or invalid JSON is acceptable, continue with defaults
      console.log("No body or invalid JSON, using defaults. Error:", parseError?.message);
    }

    // --------------------------------------------------------
    // Initialize Supabase client with service role key
    // Service role bypasses RLS for admin operations
    // --------------------------------------------------------
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in ISO format (YYYY-MM-DD) for filtering
    const today = new Date().toISOString().split('T')[0];
    console.log(`Checking for reminders due on: ${today}`);

    // --------------------------------------------------------
    // Fetch reminders based on mode
    // Normal: only reminders due today that haven't been notified
    // Force: all reminders (or specific one) regardless of status
    // --------------------------------------------------------
    let reminders;
    let remindersError;

    if (forceMode) {
      console.log("Force mode enabled - bypassing date and notification checks");
      
      if (specificReminderId) {
        // Fetch specific reminder by ID for targeted testing
        const result = await supabase
          .from("reminders")
          .select("*")
          .eq("id", specificReminderId);
        reminders = result.data;
        remindersError = result.error;
      } else {
        // Fetch ALL reminders for bulk testing
        // This allows retesting even if already marked as notified
        const result = await supabase
          .from("reminders")
          .select("*");
        reminders = result.data;
        remindersError = result.error;
      }
    } else {
      // Normal mode: fetch reminders due today that haven't been notified
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

    // Early return if no reminders to process
    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ message: "No reminders to process", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --------------------------------------------------------
    // Fetch user profiles for all affected users
    // Needed to get email addresses for notifications
    // --------------------------------------------------------
    const userIds = [...new Set(reminders.map((r: Reminder) => r.user_id))];
    console.log(`Processing reminders for ${userIds.length} users`);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, mobile_number")
      .in("user_id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    // Create lookup map for efficient profile access by user_id
    const profileMap = new Map(
      profiles?.map((p: Profile) => [p.user_id, p]) || []
    );

    // Counters for tracking processing results
    let sentCount = 0;
    let errorCount = 0;

    // --------------------------------------------------------
    // Group reminders by user for batch processing
    // This allows sending one email per user with all their reminders
    // --------------------------------------------------------
    const remindersByUser = reminders.reduce((acc: Record<string, Reminder[]>, reminder: Reminder) => {
      if (!acc[reminder.user_id]) {
        acc[reminder.user_id] = [];
      }
      acc[reminder.user_id].push(reminder);
      return acc;
    }, {});

    // --------------------------------------------------------
    // Process each user's reminders and send notifications
    // --------------------------------------------------------
    for (const [userId, userReminders] of Object.entries(remindersByUser)) {
      const profile = profileMap.get(userId);

      // Skip users without email addresses
      if (!profile?.email) {
        console.log(`No email found for user ${userId}, skipping`);
        continue;
      }

      try {
        // Build email subject based on number of releases
        const subject = userReminders.length === 1
          ? `Reminder: ${userReminders[0].content_title} releases today!`
          : `Reminder: ${userReminders.length} shows/movies release today!`;

        // Build HTML email body with list of content
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

        // Send email using SMTP
        const emailResult = await sendEmailViaSMTP(profile.email, subject, bodyHtml);

        // Check if email was sent successfully
        if (!emailResult.success) {
          console.error(`Email sending failed for ${profile.email}:`, emailResult.error);
          errorCount += userReminders.length;
          // Don't update last_notified_on if email failed - allows retry
          continue;
        }

        console.log(`Email sent successfully to ${profile.email} via SMTP`);

        // --------------------------------------------------------
        // Update last_notified_on for all reminders of this user
        // This prevents duplicate notifications on same day
        // --------------------------------------------------------
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

    // Return summary of processing results
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
    // Handle any unexpected errors in the function
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
