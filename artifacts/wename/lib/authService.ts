import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase, USER_ID_KEY } from "@/lib/supabase";

function getOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "https://wename.app";
}

// ── Manual PKCE for web Google sign-in ─────────────────────────────────────
// We bypass supabase.auth.signInWithOAuth entirely on web because its
// internal lock + initialize sequence stalls in proxied/iframe environments
// (e.g. the Replit preview), leaving the user stuck on "Connecting to
// Google…" forever.  By generating the OAuth URL ourselves and writing the
// code_verifier into the same storage key that auth-js uses, the existing
// callback handler can still exchange the returned `code` for a session via
// supabase.auth.exchangeCodeForSession() with no other changes required.

function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const verifierBytes = new Uint8Array(56);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64UrlEncode(verifierBytes);
  const challengeBuf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = base64UrlEncode(new Uint8Array(challengeBuf));
  return { verifier, challenge };
}

function getProjectRef(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  return new URL(url).hostname.split(".")[0];
}

export async function signInWithGoogle(): Promise<string | null> {
  const redirectTo = `${getOrigin()}/auth/callback`;

  if (typeof window !== "undefined") {
    // Web: build the Supabase /authorize URL ourselves so we never touch the
    // auth-js lock that hangs in proxied iframes.
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const projectRef = getProjectRef();
    const storageKey = `sb-${projectRef}-auth-token-code-verifier`;

    const { verifier, challenge } = await generatePkce();
    // auth-js's exchangeCodeForSession reads this exact key from storage.
    window.localStorage.setItem(storageKey, verifier);

    const params = new URLSearchParams({
      provider: "google",
      redirect_to: redirectTo,
      code_challenge: challenge,
      code_challenge_method: "s256",
    });
    return `${supabaseUrl}/auth/v1/authorize?${params.toString()}`;
  }

  // Native: standard redirect (expo-web-browser handles it)
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
  return null;
}

export async function signInWithEmailMagicLink(email: string): Promise<void> {
  const redirectTo = `${getOrigin()}/auth/callback`;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  const res = await fetch(`${supabaseUrl}/functions/v1/send-magic-link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ email, redirectTo }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to send sign-in link. Please try again.");
  }
}

export async function authSignOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function authDeleteAccount(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body.error || "Account deletion failed. Please try again.");
  }

  await AsyncStorage.removeItem(USER_ID_KEY);
  await AsyncStorage.removeItem("post_auth_redirect");
  await supabase.auth.signOut();
}

export async function finalizeLogin(userId: string, email: string): Promise<void> {
  const updates: Record<string, unknown> = {
    id: userId,
    updated_at: new Date().toISOString(),
  };
  if (email) updates.email = email;

  const { data: existing } = await supabase
    .from("users")
    .select("display_name, invite_code")
    .eq("id", userId)
    .maybeSingle();

  if (!existing?.display_name) {
    const { data: authData } = await supabase.auth.getUser();
    const meta = authData?.user?.user_metadata;
    const name = meta?.full_name || meta?.name;
    if (name) updates.display_name = name;
  }

  if (!existing?.invite_code) {
    updates.invite_code = Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  await supabase.from("users").upsert(updates, { onConflict: "id" });

  const guestUserId = await AsyncStorage.getItem(USER_ID_KEY);
  if (guestUserId && guestUserId !== userId) {
    const { mergeGuestData } = await import("@/lib/guestDataMerge");
    await mergeGuestData(guestUserId, userId);
  }

  await AsyncStorage.setItem(USER_ID_KEY, userId);
}
