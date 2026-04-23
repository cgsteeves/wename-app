// Supabase Edge Function: submit-deletion-request
//
// Required secrets (set via `supabase secrets set`):
//   SENDGRID_API_KEY  — must be set manually
//
// Auth: anon key only — no user session required (for unauthenticated deletion requests)
//
// Accepts: POST { email: string, reason?: string }
// Sends a notification email to the admin inbox and returns { success: true }

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_EMAIL = "admin@wename.app";
const MAX_REASON_LENGTH = 1000;

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

  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  if (!sendgridKey) {
    return json({ error: "Missing SendGrid API key" }, 500);
  }

  let email: string;
  let reason: string;

  try {
    const body = await req.json();
    email = (body.email ?? "").trim().toLowerCase();
    reason = (body.reason ?? "").trim().slice(0, MAX_REASON_LENGTH);
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Invalid email address" }, 400);
  }

  const requestedAt = new Date().toISOString();
  const reasonSection = reason
    ? `<p><strong>Reason:</strong> ${reason.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
    : "<p><em>No reason provided.</em></p>";

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Account Deletion Request</title></head>
<body style="font-family:sans-serif;background:#f9f9f9;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;border:1px solid #e5e7eb;">
    <h2 style="color:#c0392b;margin-top:0;">⚠️ Account Deletion Request</h2>
    <p><strong>From:</strong> ${email}</p>
    <p><strong>Requested at:</strong> ${requestedAt}</p>
    ${reasonSection}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
    <p style="color:#6b7280;font-size:13px;">
      Process this request within 30 days per GDPR/CCPA requirements.
      Send a confirmation email to the requester once completed.
    </p>
  </div>
</body>
</html>`;

  const plainText = `Account Deletion Request\n\nFrom: ${email}\nRequested at: ${requestedAt}\nReason: ${reason || "None provided"}\n\nProcess this request within 30 days.`;

  const sgPayload = {
    personalizations: [{ to: [{ email: ADMIN_EMAIL }] }],
    from: { email: ADMIN_EMAIL, name: "WeName System" },
    reply_to: { email },
    subject: `Account Deletion Request — ${email}`,
    content: [
      { type: "text/plain", value: plainText },
      { type: "text/html", value: htmlBody },
    ],
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
    console.error("[submit-deletion-request] SendGrid error:", sgError);
    return json(
      { error: "Failed to submit request. Please email admin@wename.app directly." },
      500,
    );
  }

  return json({ success: true });
});
