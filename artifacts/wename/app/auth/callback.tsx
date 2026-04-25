import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/constants/fonts";

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

  useEffect(() => {
    let cancelled = false;
    let safety: ReturnType<typeof setTimeout> | null = null;

    // Native short-circuit: WebBrowser.openAuthSessionAsync intercepts the
    // deep-link redirect inside the in-app browser session, so this route
    // should never load on native via the normal sign-in flow. If it does
    // load (stray deep link, share intent, etc.) just send the user home —
    // there is no PKCE work to do here on native.
    if (Platform.OS !== "web") {
      router.replace("/");
      return;
    }

    const isWebPopup =
      typeof window !== "undefined" &&
      !!window.opener &&
      window.opener !== window;

    function notifyAndClose() {
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
        router.replace("/");
      }
    }

    // OUTER SAFETY: if the token exchange hasn't completed in 5 seconds we
    // surface an error rather than pretend success — pretending would close
    // the popup and leave the opener tab in a confusing half-signed-in
    // state.
    let exchangeCompleted = false;
    safety = setTimeout(() => {
      if (cancelled || exchangeCompleted) return;
      console.warn("[auth/callback v3] safety timer fired — exchange did not complete");
      setErrorMsg("Sign-in is taking longer than expected. Please close this window and try again.");
      setStatus("error");
    }, 5000);

    async function run() {
      try {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const code = params.get("code");
          const errorDesc = params.get("error_description");

          if (errorDesc) throw new Error(errorDesc);

          if (code) {
            await exchangeCodeWeb(code);
          }
        }

        exchangeCompleted = true;
        if (cancelled) return;
        if (safety) clearTimeout(safety);
        setStatus("success");

        // Small delay so the user briefly sees "You're signed in!" before close
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
  }, []);

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
