/**
 * Edge function to handle contact form submissions
 * Sends email notification to helpofbingeguide@gmail.com using Resend
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

// Initialize Resend with API key from environment
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Interface for contact form submission data
interface ContactFormData {
  email: string;
  phoneNumber?: string;
  comments: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Contact email function invoked");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body to get form data
    const { email, phoneNumber, comments }: ContactFormData = await req.json();
    
    console.log("Processing contact form submission from:", email);

    // Send email notification to BingeGuide support
    const emailResponse = await resend.emails.send({
      from: "BingeGuide Contact <onboarding@resend.dev>",
      to: ["helpofbingeguide@gmail.com"],
      subject: `New Contact Form Submission from ${email}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">New Contact Form Submission</h2>
          <hr style="border: 1px solid #e5e7eb;" />
          
          <div style="margin: 20px 0;">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone Number:</strong> ${phoneNumber || "Not provided"}</p>
          </div>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #374151;">Comments:</h3>
            <p style="color: #4b5563; white-space: pre-wrap;">${comments}</p>
          </div>
          
          <hr style="border: 1px solid #e5e7eb; margin-top: 20px;" />
          <p style="color: #9ca3af; font-size: 12px;">
            This message was sent from the BingeGuide Contact Form.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Contact form submitted successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-contact-email function:", error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
