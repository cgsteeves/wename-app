import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase, USER_ID_KEY } from "@/lib/supabase";

function getOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "https://wename.app";
}

export async function signInWithGoogle(): Promise<string | null> {
  const redirectTo = `${getOrigin()}/auth/callback`;

  if (typeof window !== "undefined") {
    // Web: use skipBrowserRedirect so the PKCE setup completes and the lock is
    // released before we navigate.  We drive the redirect ourselves, which
    // avoids the navigator.locks / window.location.assign interaction that
    // causes the spinner to hang in proxied preview environments.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    return data.url ?? null;
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
