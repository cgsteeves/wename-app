// Supabase Edge Function: send-magic-link
//
// Required secrets (set via `supabase secrets set`):
//   SUPABASE_SERVICE_ROLE_KEY  — auto-available in Supabase Edge Functions
//   SENDGRID_API_KEY           — must be set manually
//
// Required env vars (auto-provided by Supabase):
//   SUPABASE_URL               — project URL

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing Supabase configuration" }, 500);
  }
  if (!sendgridKey) {
    return json({ error: "Missing SendGrid API key" }, 500);
  }

  let email: string;
  let redirectTo: string;

  try {
    const body = await req.json();
    email = (body.email ?? "").trim().toLowerCase();
    redirectTo = body.redirectTo || "https://wename.app/auth/callback";
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Invalid email address" }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Generate a magic link via Supabase Admin API
  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[send-magic-link] generateLink error:", linkError);
    return json(
      { error: linkError?.message ?? "Failed to generate sign-in link" },
      500,
    );
  }

  const magicLink = linkData.properties.action_link;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Log in to WeName</title>
</head>
<body style="margin:0;padding:0;background-color:#f2ead8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2ead8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#ece4d0;border:1px solid #d9cbb9;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:28px;font-weight:700;color:#3d2e20;letter-spacing:-0.5px;">WeName</p>
              <p style="margin:0;font-size:13px;color:#857d74;">Baby name matching for couples</p>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background:#cec5b9;"></div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#3d2e20;line-height:1.3;">Sign Up or Log In</p>
              <p style="margin:0 0 24px;font-size:15px;color:#857d74;line-height:1.6;">
                Click the button below to sign in to WeName — no password needed.
                This link is magic ✨ and expires in <strong style="color:#3d2e20;">10 minutes</strong>.
              </p>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <a href="${magicLink}"
                 style="display:inline-block;background:#2e6aad;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:999px;letter-spacing:0.2px;">
                Log In to WeName
              </a>
            </td>
          </tr>
          <!-- Fallback link -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a89e94;">
                Or copy and paste this link into your browser:<br/>
                <a href="${magicLink}" style="color:#2e6aad;word-break:break-all;">${magicLink}</a>
              </p>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background:#cec5b9;"></div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a89e94;line-height:1.6;">
                If you didn't request this email, you can safely ignore it.<br/>
                Your account won't be affected.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const plainText = `Log in to WeName\n\nClick the link below to sign in. This link expires in 10 minutes.\n\n${magicLink}\n\nIf you didn't request this email, you can safely ignore it.`;

  const sgPayload = {
    personalizations: [{ to: [{ email }] }],
    from: { email: "admin@wename.app", name: "WeName" },
    subject: "Log in to WeName",
    content: [
      { type: "text/plain", value: plainText },
      { type: "text/html", value: htmlBody },
    ],
    // CRITICAL: click tracking MUST be disabled for magic link emails.
    // SendGrid's click-tracking wraps every URL in its redirect service
    // (https://u.sendgrid.net/…), which strips the hash fragment that carries
    // the access_token and refresh_token in the implicit flow. The app would
    // receive wename://auth/callback with no credentials and fail every time.
    // Open tracking is also disabled to prevent any link prefetch/consumption.
    tracking_settings: {
      click_tracking: { enable: false, enable_text: false },
      open_tracking: { enable: false },
    },
  };

  const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sendgridKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sgPayload),
  });

  if (!sgResponse.ok) {
    const sgError = await sgResponse.text().catch(() => "Unknown SendGrid error");
    console.error("[send-magic-link] SendGrid error:", sgError);
    return json({ error: "Failed to send email. Please try again." }, 500);
  }

  return json({ success: true });
});
