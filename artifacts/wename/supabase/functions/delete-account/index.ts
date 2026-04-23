// Supabase Edge Function: delete-account
//
// Required secrets:
//   SUPABASE_SERVICE_ROLE_KEY  — auto-available in Supabase Edge Functions
//
// Required env vars (auto-provided by Supabase):
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
//
// Auth: Requires a valid user JWT in Authorization header (not the anon key).
// The function verifies the user's identity before performing any deletion.

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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: "Missing Supabase configuration" }, 500);
  }

  // Extract the user's JWT from the Authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Missing or invalid Authorization header" }, 401);
  }
  const userJwt = authHeader.slice(7);

  // Create a client that uses the user's JWT to verify identity
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    console.error("[delete-account] getUser error:", userError);
    return json({ error: "Invalid or expired session" }, 401);
  }
  const userId = userData.user.id;

  // Admin client for privileged operations
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Get partner_id before deletion
  const { data: userRow } = await adminClient
    .from("users")
    .select("partner_id")
    .eq("id", userId)
    .maybeSingle();

  // 2. Clear partner's backlink if one exists
  if (userRow?.partner_id) {
    await adminClient
      .from("users")
      .update({ partner_id: null })
      .eq("id", userRow.partner_id);
  }

  // 3. Delete the public.users row (cascade deletes swipes/matches via FK)
  const { error: deleteRowError } = await adminClient
    .from("users")
    .delete()
    .eq("id", userId);

  if (deleteRowError) {
    console.error("[delete-account] delete users row error:", deleteRowError);
    return json({ error: "Failed to delete account data. Please try again." }, 500);
  }

  // 4. Delete the auth.users identity
  const { error: deleteAuthError } =
    await adminClient.auth.admin.deleteUser(userId);

  if (deleteAuthError) {
    console.error("[delete-account] deleteUser error:", deleteAuthError);
    return json(
      { error: "Account data deleted but auth identity removal failed. Contact support." },
      500,
    );
  }

  return json({ success: true });
});
