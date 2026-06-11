/**
 * Edge function to handle contact form submissions.
 *
 * Security notes:
 * - JWT verification is enabled in supabase/config.toml so the Supabase
 *   gateway rejects requests without a valid anon/user token. This blocks
 *   random external bots from hammering this endpoint directly.
 * - All user-supplied values are HTML-escaped before being interpolated
 *   into the outgoing email body, preventing HTML/phishing injection.
 * - Internal SDK errors are logged server-side but never returned in the
 *   HTTP response, to avoid leaking configuration/quota state.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

// Initialize Resend with API key from environment
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Interface for contact form submission data
interface ContactFormData {
  email: string;
  phoneNumber?: string;
  comments: string;
}

/**
 * Escape characters that would otherwise be interpreted as HTML.
 * Applied to every user-supplied value before it lands in the email body.
 */
const escapeHtml = (value: string): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Escape, then convert newlines to <br> so multi-line comments render
 * correctly in HTML email clients without allowing tag injection.
 */
const escapeMultiline = (value: string): string =>
  escapeHtml(value).replace(/\r?\n/g, "<br>");

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request body.
    const { email, phoneNumber, comments }: ContactFormData = await req.json();

    if (
      typeof email !== "string" ||
      typeof comments !== "string" ||
      email.trim().length === 0 ||
      comments.trim().length === 0
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid request" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Length caps mirror the client-side zod schema so an attacker cannot
    // submit huge payloads that would balloon outgoing emails.
    const safeEmail = escapeHtml(email.slice(0, 255));
    const safePhone = escapeHtml((phoneNumber ?? "").slice(0, 50)) || "Not provided";
    const safeComments = escapeMultiline(comments.slice(0, 2000));

    // Send email notification to BingeGuide support
    await resend.emails.send({
      from: "BingeGuide Contact <onboarding@resend.dev>",
      to: ["helpofbingeguide@gmail.com"],
      subject: `New Contact Form Submission from ${safeEmail}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">New Contact Form Submission</h2>
          <hr style="border: 1px solid #e5e7eb;" />

          <div style="margin: 20px 0;">
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Phone Number:</strong> ${safePhone}</p>
          </div>

          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #374151;">Comments:</h3>
            <p style="color: #4b5563;">${safeComments}</p>
          </div>

          <hr style="border: 1px solid #e5e7eb; margin-top: 20px;" />
          <p style="color: #9ca3af; font-size: 12px;">
            This message was sent from the BingeGuide Contact Form.
          </p>
        </div>
      `,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Contact form submitted successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    // Detailed error stays server-side; the caller only sees a generic message
    // so we don't leak Resend SDK / API-key / quota state.
    console.error("send-contact-email error:", error);

    return new Response(
      JSON.stringify({ error: "Failed to send message" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
