import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import * as WebBrowser from "expo-web-browser";

import { supabase, USER_ID_KEY } from "@/lib/supabase";
import { emitMergeComplete } from "@/lib/mergeEvents";

// Required on iOS so the in-app browser session is properly closed when the
// app returns to the foreground after the OAuth redirect. Safe no-op on web.
WebBrowser.maybeCompleteAuthSession();

function getOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  // Native fallback: use the canonical app URL env var or hard-coded production domain
  const appUrl = process.env.EXPO_PUBLIC_APP_URL;
  return appUrl ? appUrl.replace(/\/$/, "") : "https://wename.app";
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

export type GoogleSignInResult =
  | { kind: "web-url"; url: string }
  | { kind: "native-success" }
  | { kind: "native-cancelled" };

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  console.log("[signInWithGoogle] tapped — platform:", Platform.OS);

  if (Platform.OS === "web" && typeof window !== "undefined") {
    // Web: build the Supabase /authorize URL ourselves so we never touch the
    // auth-js lock that hangs in proxied iframes.
    const redirectTo = `${getOrigin()}/auth/callback`;
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
      // Force Google's account chooser so the user is never silently re-authed
      // with a cached session. Without this, browsers and ASWebAuthenticationSession
      // (which shares the Safari cookie jar) skip the picker entirely.
      prompt: "select_account",
    });
    const url = `${supabaseUrl}/auth/v1/authorize?${params.toString()}`;
    console.log("[signInWithGoogle] web: OAuth URL built", { redirectTo, prompt: "select_account" });
    return { kind: "web-url", url };
  }

  // Native (Expo Go / standalone): use the custom URL scheme directly so
  // ASWebAuthenticationSession can intercept the redirect. Linking.createURL
  // is intentionally avoided here — expo-router's `origin` config causes it
  // to return https://wename.app/auth/callback, which ASWebAuthenticationSession
  // cannot intercept (it only works with custom schemes, not https://).
  const redirectTo = "wename://auth/callback";

  console.log("[signInWithGoogle] native: calling signInWithOAuth", {
    redirectTo,
    prompt: "select_account",
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        // Force Google's account chooser so the user is never silently re-authed
        // with a cached session from the shared ASWebAuthenticationSession/Safari
        // cookie jar. This is the fix for "Google sign-in completes instantly
        // without showing any account selection sheet" on iOS TestFlight.
        prompt: "select_account",
      },
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Sign-in URL was not returned by Supabase.");

  console.log("[signInWithGoogle] native: opening ASWebAuthenticationSession");
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  console.log("[signInWithGoogle] native: browser session result:", result.type);

  if (result.type === "cancel" || result.type === "dismiss") {
    console.log("[signInWithGoogle] native: user cancelled");
    return { kind: "native-cancelled" };
  }
  if (result.type !== "success") {
    throw new Error("Google sign-in did not complete.");
  }

  // Supabase (PKCE flow) returns ?code=... on the redirect URL. Extract it
  // and exchange for a session — auth-js will read the code_verifier it
  // stored in AsyncStorage during signInWithOAuth above.
  const returned = new URL(result.url);
  const code =
    returned.searchParams.get("code") ??
    new URLSearchParams(returned.hash.replace(/^#/, "")).get("code");

  // Surface OAuth-level errors that Supabase forwards as ?error=...
  const oauthError =
    returned.searchParams.get("error_description") ??
    returned.searchParams.get("error");

  if (!code) {
    console.error("[signInWithGoogle] native: no code in redirect URL", { oauthError });
    throw new Error(oauthError || "No authorization code in redirect URL.");
  }

  console.log("[signInWithGoogle] native: exchanging code for session");
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("[signInWithGoogle] native: code exchange failed", exchangeError.message);
    throw exchangeError;
  }

  console.log("[signInWithGoogle] native: session exchange complete");
  return { kind: "native-success" };
}

export async function signInWithEmailMagicLink(email: string): Promise<void> {
  const emailRedirectTo =
    Platform.OS !== "web" ? "wename://auth/callback" : `${getOrigin()}/auth/callback`;

  const supabaseUrl    = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  console.log("[signInWithEmailMagicLink] sending OTP via edge function", {
    platform: Platform.OS,
    redirectTo: emailRedirectTo,
  });

  // Route through the send-magic-link Supabase Edge Function.
  // The Edge Function uses the Supabase Admin API to generate a magic link
  // and sends it via SendGrid using the branded WeName HTML template.
  //
  // Previously this called /auth/v1/otp directly, which bypassed the Edge
  // Function entirely and caused Supabase to fall back to its own SMTP sender
  // and default template (no SendGrid, no branded email).
  //
  // The Admin API generates an implicit-flow link (no PKCE code_challenge),
  // so the resulting redirect always uses hash tokens:
  //   wename://auth/callback#access_token=…&refresh_token=…   (native)
  //   https://…/auth/callback#access_token=…&refresh_token=…  (web)
  // Both callback handlers already support this format.
  const res = await fetch(`${supabaseUrl}/functions/v1/send-magic-link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ email, redirectTo: emailRedirectTo }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as Record<string, string>);
    const msg = body.error ?? "Failed to send sign-in link. Please try again.";
    console.warn("[signInWithEmailMagicLink] edge function error:", msg);
    throw new Error(msg);
  }

  console.log("[signInWithEmailMagicLink] email dispatched successfully");
}

// ── Apple Sign-In (iOS native only) ────────────────────────────────────────

export type AppleSignInResult = "success" | "cancelled";

/**
 * Perform a native Apple Sign-In and exchange the identity token for a
 * Supabase session. Only callable on iOS — guard with isAppleAuthAvailable()
 * before showing the button.
 */
export async function signInWithApple(): Promise<AppleSignInResult> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e: unknown) {
    // ERR_CANCELED is thrown when the user dismisses the native Apple sheet.
    if ((e as { code?: string })?.code === "ERR_CANCELED") return "cancelled";
    throw e;
  }

  if (!credential.identityToken) {
    throw new Error("Apple did not return an identity token. Please try again.");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
  });

  if (error) {
    console.error("[signInWithApple] Supabase error:", error.message, error.status, error.name);
    throw error;
  }
  return "success";
}

/**
 * Returns true only on iOS devices where Sign In with Apple is available.
 * Always false on Android, web, or simulators without the entitlement.
 */
export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function authSignOut(): Promise<void> {
  // Reset RevenueCat back to anonymous so the next user on this device starts
  // fresh. Fire-and-forget — a failure here must never block sign-out.
  if (Platform.OS !== "web") {
    Purchases.logOut().catch((e) =>
      console.warn("[authService] RevenueCat logOut failed", e),
    );
  }

  // supabase.auth.signOut() acquires the inProcessLock internally. If a
  // concurrent token-refresh or exchangeCodeForSession is still running (common
  // after Google OAuth), that lock never releases and signOut hangs forever.
  //
  // Fix: race signOut against a 3-second timeout. If it loses, we clear the
  // auth token from storage ourselves so the session is gone regardless. The
  // AuthContext.signOut() wrapper always calls setSession(null) after us, so
  // the UI unblocks either way.
  const projectRef = getProjectRef();
  const storageKey = `sb-${projectRef}-auth-token`;

  const signOutP = supabase.auth
    .signOut()
    .then(() => {})
    .catch(() => {});
  const timeoutP = new Promise<void>((resolve) => setTimeout(resolve, 3_000));

  await Promise.race([signOutP, timeoutP]);

  // Belt-and-suspenders: wipe the token from both storage layers so no stale
  // session survives even if the Supabase call didn't complete in time.
  try {
    await AsyncStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(storageKey);
      window.localStorage.removeItem(`${storageKey}-code-verifier`);
    }
  } catch {
    // ignore
  }
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

// Race a promise-like against a ms timeout. Accepts PromiseLike<T> (which
// covers Supabase PostgrestBuilder / PostgrestFilterBuilder) in addition to
// native Promises. Promise.resolve() promotes the thenable to a real Promise
// so it can be used with Promise.race.
function withStep<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[finalizeLogin] timeout: ${label}`)), ms),
    ),
  ]);
}

export async function finalizeLogin(userId: string, email: string): Promise<void> {
  console.log("[finalizeLogin] started", { uid: userId.slice(-6), email });

  // ── Step 1: profile upsert ───────────────────────────────────────────────
  // Each step is in its own try/catch so one failure never prevents the rest
  // from running — and emitMergeComplete() always fires at the end.
  try {
    const updates: Record<string, unknown> = {
      id: userId,
      updated_at: new Date().toISOString(),
    };
    if (email) updates.email = email;

    const existingResult = await withStep(
      supabase.from("users").select("display_name, invite_code").eq("id", userId).maybeSingle(),
      4_000,
      "profile select",
    );
    const existing = existingResult?.data;

    if (!existing?.display_name) {
      const { data: authData } = await supabase.auth.getUser();
      const meta = authData?.user?.user_metadata;
      const name = meta?.full_name || meta?.name;
      if (name) updates.display_name = name;
    }

    if (!existing?.invite_code) {
      updates.invite_code = Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    await withStep(
      supabase.from("users").upsert(updates, { onConflict: "id" }),
      4_000,
      "profile upsert",
    );
    console.log("[finalizeLogin] profile upserted");
  } catch (e) {
    console.warn("[finalizeLogin] profile step failed (continuing):", e);
  }

  // ── Step 2: guest data merge ─────────────────────────────────────────────
  try {
    const guestUserId = await AsyncStorage.getItem(USER_ID_KEY);
    if (guestUserId && guestUserId !== userId) {
      console.log("[finalizeLogin] merging guest", guestUserId.slice(-6), "→", userId.slice(-6));
      const { mergeGuestData } = await import("@/lib/guestDataMerge");
      await withStep(mergeGuestData(guestUserId, userId), 6_000, "guest merge");
      console.log("[finalizeLogin] guest merge complete");
    }
  } catch (e) {
    console.warn("[finalizeLogin] guest merge failed (continuing):", e);
  }

  // ── Step 3: persist authenticated user ID ───────────────────────────────
  try {
    await AsyncStorage.setItem(USER_ID_KEY, userId);
  } catch (e) {
    console.warn("[finalizeLogin] AsyncStorage.setItem failed:", e);
  }

  // ── Step 4: RevenueCat login (fire-and-forget) ───────────────────────────
  // Failures are swallowed so a RevenueCat outage never blocks sign-in.
  // Not called on web (RevenueCat is native-only).
  if (Platform.OS !== "web") {
    Purchases.logIn(userId)
      .then(({ customerInfo, created }) => {
        console.log("[finalizeLogin] RevenueCat logIn succeeded", {
          uid: userId.slice(-6),
          created,
          entitlements: Object.keys(customerInfo.entitlements.active),
        });
      })
      .catch((e) => console.warn("[finalizeLogin] RevenueCat logIn failed", e));
  }

  // Always signal completion — even if earlier steps failed.
  // UserContext waits for this signal before calling loadById.
  console.log("[finalizeLogin] complete, emitting mergeComplete");
  emitMergeComplete();
}
