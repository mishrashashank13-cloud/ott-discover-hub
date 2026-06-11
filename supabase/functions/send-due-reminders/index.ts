import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// ------------------------------------------------------------------
// CORS — open access; the function itself is gated by X-Function-Key.
// ------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-function-key",
};

// ------------------------------------------------------------------
// Database record shapes (only the fields we use).
// ------------------------------------------------------------------
interface Reminder {
  id: string;
  user_id: string;
  content_id: string;
  content_title: string;
  content_type: string;
  release_date: string;
  remind_at: string;
  notify_email: boolean;
  notify_whatsapp: boolean;
  notified_at: string | null;
  retry_count: number;
}

interface Profile {
  user_id: string;
  email: string | null;
  mobile_number: string | null;
}

// Stop retrying after this many failed delivery attempts so we don't
// hammer SMTP / WhatsApp forever for a permanently broken contact.
const MAX_RETRIES = 5;

// ------------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------------
function base64Encode(str: string): string {
  const data = new TextEncoder().encode(str);
  return btoa(String.fromCharCode(...data));
}

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

// ------------------------------------------------------------------
// Email delivery — raw TCP/TLS SMTP on port 465 (project convention).
// ------------------------------------------------------------------
async function sendEmailViaSMTP(
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string }> {
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  const smtpFrom = Deno.env.get("SMTP_FROM_EMAIL");

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    return { success: false, error: "SMTP not configured" };
  }

  try {
    const conn = await Deno.connectTls({ hostname: smtpHost, port: smtpPort });
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function send(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + "\r\n"));
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return n === null ? "" : decoder.decode(buf.subarray(0, n));
    }
    async function read(): Promise<string> {
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return n === null ? "" : decoder.decode(buf.subarray(0, n));
    }

    await read(); // greeting
    await send(`EHLO ${smtpHost}`);
    await send("AUTH LOGIN");
    await send(base64Encode(smtpUser));
    const passResp = await send(base64Encode(smtpPass));
    if (!passResp.startsWith("235")) {
      conn.close();
      return { success: false, error: `SMTP auth failed: ${passResp.trim()}` };
    }

    const fromEmail = smtpFrom.includes("<")
      ? smtpFrom.match(/<(.+)>/)?.[1] || smtpFrom
      : smtpFrom;

    await send(`MAIL FROM:<${fromEmail}>`);
    await send(`RCPT TO:<${to}>`);
    await send("DATA");

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
      `Your BingeGuide reminder — view in HTML email client`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      htmlContent,
      ``,
      `--${boundary}--`,
      `.`,
    ].join("\r\n");

    const contentResp = await send(emailContent);
    if (!contentResp.startsWith("250")) {
      conn.close();
      return { success: false, error: `SMTP send failed: ${contentResp.trim()}` };
    }
    await send("QUIT");
    conn.close();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ------------------------------------------------------------------
// WhatsApp delivery — Meta WhatsApp Cloud API.
// Tries the named template first (works outside the 24h session);
// falls back to a plain text message if the template is missing.
// ------------------------------------------------------------------
async function sendWhatsApp(
  toPhone: string,
  contentTitle: string,
  contentType: string
): Promise<{ success: boolean; error?: string }> {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) {
    return { success: false, error: "WhatsApp not configured" };
  }

  // WhatsApp expects phone numbers without the leading "+".
  const cleanPhone = toPhone.replace(/^\+/, "").replace(/\D/g, "");
  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;

  // Attempt 1: pre-approved template "bingeguide_reminder" with title param.
  const templateBody = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: "template",
    template: {
      name: "bingeguide_reminder",
      language: { code: "en_US" },
      components: [
        { type: "body", parameters: [{ type: "text", text: contentTitle }] },
      ],
    },
  };

  try {
    let res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(templateBody),
    });

    if (res.ok) return { success: true };

    // If template is unknown / not approved, fall back to a text message.
    // This only works for users currently in a 24h session with the number.
    const errBody = await res.text();
    console.warn("WhatsApp template send failed, trying text fallback:", errBody);

    const textBody = {
      messaging_product: "whatsapp",
      to: cleanPhone,
      type: "text",
      text: {
        body: `BingeGuide reminder: "${contentTitle}" (${contentType}) is here. Enjoy!`,
      },
    };
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(textBody),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `WhatsApp API ${res.status}: ${text}` };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ------------------------------------------------------------------
// Main handler
// ------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create privileged Supabase client (service role) — used both for
    // validating the function key against `internal_secrets` and for
    // reading/updating reminders below.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Function key auth — accept either the REMINDER_FUNCTION_SECRET env
    // var OR the value stored in `internal_secrets.reminder_function_key`
    // (which is what the pg_cron job uses). Whichever matches is fine; this
    // keeps cron and manual invocations in sync without a redeploy.
    const requestKey =
      req.headers.get("X-Function-Key") || req.headers.get("x-function-key");
    const envSecret = Deno.env.get("REMINDER_FUNCTION_SECRET") || "";

    let dbSecret = "";
    const { data: secretRow } = await supabase
      .from("internal_secrets")
      .select("key_value")
      .eq("key_name", "reminder_function_key")
      .maybeSingle();
    if (secretRow?.key_value) dbSecret = secretRow.key_value as string;

    const validKey =
      !!requestKey &&
      ((envSecret && secureCompare(requestKey, envSecret)) ||
        (dbSecret && secureCompare(requestKey, dbSecret)));

    // ALWAYS require a valid function key. If neither secret is configured
    // (envSecret and dbSecret both empty), reject every request — failing
    // closed prevents an auth-bypass window during initial setup.
    if (!validKey) {
      if (!envSecret && !dbSecret) {
        console.error(
          "send-due-reminders: no REMINDER_FUNCTION_SECRET or internal_secrets row configured — rejecting request."
        );
      }
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional body for force/test mode.
    let forceMode = false;
    let specificReminderId: string | null = null;
    try {
      const body = await req.json();
      forceMode = body?.force === true;
      specificReminderId = body?.reminderId || null;
    } catch (_) {
      /* empty body is fine */
    }


    // Fetch reminders that are due now and haven't been delivered yet.
    let query = supabase.from("reminders").select("*");
    if (specificReminderId) {
      query = query.eq("id", specificReminderId);
    } else if (!forceMode) {
      const nowIso = new Date().toISOString();
      query = query
        .is("notified_at", null)
        .lte("remind_at", nowIso)
        .lt("retry_count", MAX_RETRIES);
    }

    const { data: reminders, error: remErr } = await query;
    if (remErr) throw remErr;

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ message: "No reminders due", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch contact details for the affected users.
    const userIds = [...new Set(reminders.map((r: Reminder) => r.user_id))];
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("user_id, email, mobile_number")
      .in("user_id", userIds);
    if (profErr) throw profErr;
    const profileMap = new Map<string, Profile>(
      (profiles || []).map((p: Profile) => [p.user_id, p])
    );

    let sentCount = 0;
    let failureCount = 0;

    // Process each reminder individually so partial failures only
    // affect that one row.
    for (const r of reminders as Reminder[]) {
      const profile = profileMap.get(r.user_id);
      const subject = `Reminder: ${r.content_title}`;
      const html = `
        <h2>Your BingeGuide reminder</h2>
        <p><strong>${r.content_title}</strong> (${r.content_type}) is ready for you.</p>
        <p>Open BingeGuide to start watching.</p>
      `;

      const results: string[] = [];
      let allOk = true;

      // Email channel
      if (r.notify_email) {
        if (!profile?.email) {
          allOk = false;
          results.push("email: no address on file");
        } else {
          const out = await sendEmailViaSMTP(profile.email, subject, html);
          if (!out.success) {
            allOk = false;
            results.push(`email: ${out.error}`);
          } else {
            results.push("email: ok");
          }
        }
      }

      // WhatsApp channel
      if (r.notify_whatsapp) {
        if (!profile?.mobile_number) {
          allOk = false;
          results.push("whatsapp: no number on file");
        } else {
          const out = await sendWhatsApp(
            profile.mobile_number,
            r.content_title,
            r.content_type
          );
          if (!out.success) {
            allOk = false;
            results.push(`whatsapp: ${out.error}`);
          } else {
            results.push("whatsapp: ok");
          }
        }
      }

      console.log(`Reminder ${r.id}: ${results.join("; ")}`);

      if (allOk) {
        await supabase
          .from("reminders")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", r.id);
        sentCount++;
      } else {
        await supabase
          .from("reminders")
          .update({ retry_count: (r.retry_count ?? 0) + 1 })
          .eq("id", r.id);
        failureCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: "Reminders processed",
        sent: sentCount,
        failed: failureCount,
        total: reminders.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-due-reminders error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
