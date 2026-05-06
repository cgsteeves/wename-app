import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/constants/fonts";
import { supabase, PENDING_PREMIUM_PURCHASE_KEY } from "@/lib/supabase";

type Status = "loading" | "success" | "error";

function getProjectRef(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  return new URL(url).hostname.split(".")[0];
}

// Manual PKCE token exchange — bypasses @supabase/supabase-js entirely so the
// auth-js internal lock can never deadlock the popup. We talk straight to the
// Supabase REST endpoint, then write the session into the same localStorage
// key auth-js reads on next load. Opener tab picks it up via the storage
// event listener registered in _layout.tsx.
// Race an auth SDK call against a per-call timeout so a stalled auth-lock
// on cold start never hangs the callback screen beyond the window given.
function withAuthTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Auth timed out (${label}) — please try again`)),
        ms,
      ),
    ),
  ]);
}

async function exchangeCodeWeb(code: string): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  const projectRef = getProjectRef();
  const verifierKey = `sb-${projectRef}-auth-token-code-verifier`;
  const sessionKey = `sb-${projectRef}-auth-token`;

  const verifier = window.localStorage.getItem(verifierKey);
  if (!verifier) throw new Error("Code verifier missing — please try signing in again.");

  const res = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=pkce`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    },
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as Record<string, string>);
    throw new Error(
      body.error_description || body.msg || body.error || `Token exchange failed (${res.status})`,
    );
  }

  const session = await res.json();
  const expiresIn = Number(session.expires_in ?? 3600);
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

  const stored = {
    access_token: session.access_token,
    token_type: session.token_type || "bearer",
    expires_in: expiresIn,
    expires_at: expiresAt,
    refresh_token: session.refresh_token,
    user: session.user,
    provider_token: session.provider_token ?? null,
    provider_refresh_token: session.provider_refresh_token ?? null,
  };

  window.localStorage.setItem(sessionKey, JSON.stringify(stored));
  window.localStorage.removeItem(verifierKey);
}

export default function AuthCallback() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // useURL() covers both cold-start (getInitialURL) and warm-start
  // (Linking event) deep links. On web it returns the current window URL.
  // null means "not yet resolved" — we wait before acting.
  const url = Linking.useURL();
  const handledRef = useRef(false);

  useEffect(() => {
    // Prevent double-handling if the hook fires multiple times
    if (handledRef.current) return;

    let cancelled = false;
    let safety: ReturnType<typeof setTimeout> | null = null;

    // ── NATIVE ─────────────────────────────────────────────────────────────
    // signInWithOtp() uses the client's PKCE flow — the magic link redirects
    // to wename://auth/callback?code=XXX. We exchange the code here using the
    // verifier that supabase.auth stored in AsyncStorage when signInWithOtp
    // was called. We also keep the legacy implicit-flow path (hash tokens) as
    // a fallback for any links sent by older code.
    if (Platform.OS !== "web") {
      // url===null means not yet resolved; wait for the next effect run
      if (url === null) return;

      handledRef.current = true;

      // Safety timer — if the session exchange hangs (e.g. auth-lock contention
      // on cold start), surface an error after 8 s instead of spinning forever.
      let exchangeCompleted = false;
      safety = setTimeout(() => {
        if (cancelled || exchangeCompleted) return;
        setErrorMsg("Sign-in timed out. Please close this screen and try again.");
        setStatus("error");
      }, 8_000);

      async function handleNative() {
        try {
          const urlStr = url!;
          console.log("[callback] native: app opened from callback URL", urlStr.slice(0, 100));

          // Parse query string and hash manually — new URL() chokes on
          // custom schemes like wename:// on some RN environments.
          const qIdx = urlStr.indexOf("?");
          const hIdx = urlStr.indexOf("#");
          const queryStr =
            qIdx >= 0 ? urlStr.slice(qIdx + 1, hIdx >= 0 ? hIdx : undefined) : "";
          const hashStr = hIdx >= 0 ? urlStr.slice(hIdx + 1) : "";

          const queryParams = new URLSearchParams(queryStr);
          const hashParams  = new URLSearchParams(hashStr);

          const code         = queryParams.get("code");
          const accessToken  = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          console.log("[callback] native: params parsed", {
            hasCode: !!code,
            hasTokens: !!(accessToken && refreshToken),
          });

          if (code) {
            // PKCE flow — only reached for links sent before the implicit-flow
            // switch; exchangeCodeForSession reads the verifier from AsyncStorage.
            console.log("[callback] native: exchanging PKCE code");
            const { data: exchangeData, error } = await withAuthTimeout(
              supabase.auth.exchangeCodeForSession(code),
              6_000,
              "exchangeCodeForSession",
            );
            if (error) throw error;
            console.log("[callback] native: PKCE exchange complete", {
              uid: exchangeData?.session?.user?.id?.slice(-6),
              email: exchangeData?.session?.user?.email,
            });
          } else if (accessToken && refreshToken) {
            // Implicit flow — tokens come in the hash fragment.
            // The send-magic-link edge function (admin.generateLink) produces
            // this format since it doesn't include a PKCE code_challenge.
            console.log("[callback] native: calling setSession with hash tokens");
            const { data: sessionData, error } = await withAuthTimeout(
              supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              }),
              6_000,
              "setSession",
            );
            if (error) throw error;
            console.log("[callback] native: setSession complete", {
              uid: sessionData?.session?.user?.id?.slice(-6),
              email: sessionData?.session?.user?.email,
            });
          } else {
            throw new Error("No sign-in credentials found in the link. It may have expired — please request a new one.");
          }

          exchangeCompleted = true;
          if (cancelled) return;
          if (safety) clearTimeout(safety);
          setStatus("success");

          // Check for a pending premium purchase intent written by PremiumModal
          // before the user tapped "Continue with Email". If found, navigate
          // back to the swipe screen with ?openPremium=1 so the modal re-opens
          // at the purchase step instead of the sign-in step.
          let destination: string = "/";
          try {
            const pending = await AsyncStorage.getItem(PENDING_PREMIUM_PURCHASE_KEY);
            if (pending) {
              await AsyncStorage.removeItem(PENDING_PREMIUM_PURCHASE_KEY);
              destination = "/?openPremium=1";
            }
          } catch { /* ignore — worst case we navigate to "/" */ }

          console.log("[callback] native: navigating to", destination);
          setTimeout(() => {
            if (!cancelled) router.replace(destination as any);
          }, 400);
        } catch (e) {
          if (cancelled) return;
          if (safety) clearTimeout(safety);
          setErrorMsg(e instanceof Error ? e.message : "Sign-in failed.");
          setStatus("error");
        }
      }

      handleNative();
      return () => {
        cancelled = true;
        if (safety) clearTimeout(safety);
      };
    }

    // ── WEB ────────────────────────────────────────────────────────────────
    handledRef.current = true;

    const isWebPopup =
      typeof window !== "undefined" &&
      !!window.opener &&
      window.opener !== window;

    async function notifyAndClose() {
      if (Platform.OS !== "web" || typeof window === "undefined") return;
      if (isWebPopup) {
        try {
          window.opener.postMessage(
            { type: "wename:auth:signed_in" },
            window.location.origin,
          );
        } catch {
          /* cross-origin — best effort */
        }
        try {
          window.close();
        } catch {
          /* may be blocked */
        }
        // If close was blocked, send the popup home so the user sees something useful.
        setTimeout(() => {
          if (!cancelled) router.replace("/");
        }, 250);
      } else {
        // Direct navigation (e.g. email magic link). Check for a pending
        // premium purchase intent so we can re-open PremiumModal at the
        // purchase step instead of the sign-in step.
        let destination: string = "/";
        try {
          const pending = await AsyncStorage.getItem(PENDING_PREMIUM_PURCHASE_KEY);
          if (pending) {
            await AsyncStorage.removeItem(PENDING_PREMIUM_PURCHASE_KEY);
            destination = "/?openPremium=1";
          }
        } catch { /* ignore */ }
        console.log("[callback] web: navigating to", destination);
        router.replace(destination as any);
      }
    }

    // OUTER SAFETY: if the token exchange hasn't completed in 5 seconds we
    // surface an error rather than pretend success.
    let exchangeCompleted = false;
    safety = setTimeout(() => {
      if (cancelled || exchangeCompleted) return;
      console.warn("[auth/callback] safety timer fired — exchange did not complete");
      setErrorMsg("Sign-in is taking longer than expected. Please close this window and try again.");
      setStatus("error");
    }, 5000);

    async function run() {
      try {
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const code = params.get("code");
          const errorDesc = params.get("error_description");

          if (errorDesc) throw new Error(errorDesc);

          if (code) {
            // PKCE flow (Google OAuth)
            await exchangeCodeWeb(code);
          } else {
            // Implicit flow (magic link) — tokens in hash fragment
            const hash = window.location.hash.slice(1);
            const hashParams = new URLSearchParams(hash);
            const accessToken = hashParams.get("access_token");
            const refreshToken = hashParams.get("refresh_token");

            if (accessToken && refreshToken) {
              // supabase.auth.setSession writes the session to localStorage
              // and fires onAuthStateChange so the opener tab picks it up.
              console.log("[callback] web: calling setSession with hash tokens");
              const { error } = await withAuthTimeout(
                supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                }),
                6_000,
                "setSession",
              );
              if (error) throw error;
              console.log("[callback] web: setSession complete");
            }
          }
        }

        exchangeCompleted = true;
        if (cancelled) return;
        if (safety) clearTimeout(safety);
        setStatus("success");

        setTimeout(() => {
          if (!cancelled) notifyAndClose();
        }, 400);
      } catch (e) {
        if (cancelled) return;
        if (safety) clearTimeout(safety);
        setErrorMsg(e instanceof Error ? e.message : "Sign-in failed.");
        setStatus("error");
      }
    }

    run();

    return () => {
      cancelled = true;
      if (safety) clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      {status === "loading" && (
        <View style={{ alignItems: "center", gap: 20 }}>
          <View style={styles.iconBox}>
            <ActivityIndicator size="large" color="#38bdf8" />
          </View>
          <Text style={styles.heading}>Signing you in…</Text>
          <Text style={styles.subtext}>Just a moment while we set things up.</Text>
        </View>
      )}

      {status === "success" && (
        <View style={{ alignItems: "center", gap: 20 }}>
          <View style={styles.iconBox}>
            <Text style={{ fontSize: 32 }}>✓</Text>
          </View>
          <Text style={[styles.heading, { color: "#2d5a1b" }]}>You're signed in!</Text>
          <Text style={styles.subtext}>Taking you back to the app…</Text>
        </View>
      )}

      {status === "error" && (
        <View style={{ alignItems: "center", gap: 20 }}>
          <View
            style={[
              styles.iconBox,
              { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
            ]}
          >
            <Text style={{ fontSize: 28, color: "#dc2626" }}>✕</Text>
          </View>
          <Text style={[styles.heading, { color: "#1a1a1a" }]}>Sign-in failed</Text>
          <Text style={styles.subtext}>
            {errorMsg || "Your link may have expired. Please try again."}
          </Text>
          <Pressable onPress={() => router.replace("/")} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Back to app</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#faf6f0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heading: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    color: "#2d5a1b",
    textAlign: "center",
  },
  subtext: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 21,
  },
  backBtn: {
    marginTop: 8,
    width: "100%",
    paddingVertical: 14,
    backgroundColor: "#5aabdf",
    borderRadius: 12,
    alignItems: "center",
  },
  backBtnText: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    color: "#fff",
  },
});
