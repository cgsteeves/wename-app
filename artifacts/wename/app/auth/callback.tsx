import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/constants/fonts";
import { supabase, PENDING_PREMIUM_PURCHASE_KEY } from "@/lib/supabase";
import { takeCapturedUrl } from "@/lib/warmStartUrl";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "loading" | "success" | "error" | "timeout";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProjectRef(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  return new URL(url).hostname.split(".")[0];
}

// Race an auth SDK call against a timeout so a stalled auth-lock on cold start
// never hangs the callback screen beyond the given window.
function withAuthTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Auth timed out (${label}) — please try again`)), ms),
    ),
  ]);
}

// Manual PKCE token exchange for web — bypasses @supabase/supabase-js so a
// stalled auth-lock in proxied/iframe environments can never deadlock the popup.
async function exchangeCodeWeb(code: string): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  const projectRef = getProjectRef();
  const verifierKey = `sb-${projectRef}-auth-token-code-verifier`;
  const sessionKey = `sb-${projectRef}-auth-token`;

  const verifier = window.localStorage.getItem(verifierKey);
  if (!verifier) throw new Error("Code verifier missing — please try signing in again.");

  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: supabaseAnonKey },
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as Record<string, string>);
    throw new Error(
      body.error_description || body.msg || body.error || `Token exchange failed (${res.status})`,
    );
  }

  const session = await res.json();
  const expiresIn = Number(session.expires_in ?? 3600);
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

  window.localStorage.setItem(
    sessionKey,
    JSON.stringify({
      access_token: session.access_token,
      token_type: session.token_type || "bearer",
      expires_in: expiresIn,
      expires_at: expiresAt,
      refresh_token: session.refresh_token,
      user: session.user,
      provider_token: session.provider_token ?? null,
      provider_refresh_token: session.provider_refresh_token ?? null,
    }),
  );
  window.localStorage.removeItem(verifierKey);
}

// Parse both query string and hash from a callback URL.
// Manual parse avoids new URL() failures on custom scheme URLs (wename://)
// in some React Native environments.
function parseCallbackUrl(urlStr: string): {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  errorDesc: string | null;
  callbackType: "pkce" | "implicit" | "none";
} {
  const qIdx = urlStr.indexOf("?");
  const hIdx = urlStr.indexOf("#");
  const queryStr = qIdx >= 0 ? urlStr.slice(qIdx + 1, hIdx >= 0 ? hIdx : undefined) : "";
  const hashStr = hIdx >= 0 ? urlStr.slice(hIdx + 1) : "";
  const q = new URLSearchParams(queryStr);
  const h = new URLSearchParams(hashStr);

  // Check all possible token locations — Supabase has used different formats
  // across SDK versions and flows (query vs hash, code vs tokens).
  const code = q.get("code") ?? h.get("code");
  const accessToken = h.get("access_token") ?? q.get("access_token");
  const refreshToken = h.get("refresh_token") ?? q.get("refresh_token");
  const errorDesc =
    q.get("error_description") ??
    h.get("error_description") ??
    q.get("error") ??
    h.get("error");

  const callbackType: "pkce" | "implicit" | "none" = code
    ? "pkce"
    : accessToken
      ? "implicit"
      : "none";

  return { code, accessToken, refreshToken, errorDesc, callbackType };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuthCallback() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [debugCode, setDebugCode] = useState<string | null>(null);

  // Set a named debug code + message and transition to error state.
  // The code appears on screen in TestFlight so the exact failure branch
  // can be reported without needing a device log capture.
  function fail(code: string, msg: string) {
    setDebugCode(code);
    setErrorMsg(msg);
    setStatus("error");
  }

  // Refs for values shared across async closures. Using refs (not closure vars)
  // ensures we always read the latest value regardless of which closure is
  // running — critical because the async exchange outlives a single render cycle.
  const cancelledRef = useRef(false);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevents both getInitialURL() and addEventListener() from handling the
  // same URL, and prevents any re-renders from re-triggering the exchange.
  const handledRef = useRef(false);

  // Keep a stable router ref so async callbacks use the latest router
  // without needing router in the effect dependency array.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // ── Utilities ──────────────────────────────────────────────────────────────

  function clearSafety() {
    if (safetyRef.current) {
      clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
  }

  async function navigateAfterAuth() {
    setStatus("success");
    let destination = "/";
    try {
      const pending = await AsyncStorage.getItem(PENDING_PREMIUM_PURCHASE_KEY);
      if (pending) {
        await AsyncStorage.removeItem(PENDING_PREMIUM_PURCHASE_KEY);
        destination = "/?openPremium=1";
      }
    } catch {
      /* ignore — worst case we navigate to "/" */
    }
    console.log("[callback] navigating to", destination);
    setTimeout(() => {
      if (!cancelledRef.current) routerRef.current.replace(destination as any);
    }, 400);
  }

  // ── Native callback handler ────────────────────────────────────────────────
  // Called once with the raw URL from either getInitialURL() or the url event.
  // handledRef prevents this from running twice if both sources fire.

  async function handleNativeUrl(urlStr: string, wasInitialUrlNull = false) {
    if (handledRef.current) {
      console.log("[callback] native: URL already handled — ignoring duplicate");
      return;
    }
    handledRef.current = true;

    // Log safely — never expose tokens
    const safeUrl = urlStr
      .replace(/(access_token|refresh_token)=[^&#]*/g, "$1=[redacted]")
      .slice(0, 150);
    console.log("[callback] native: processing URL", safeUrl || "(empty)");

    const { code, accessToken, refreshToken, errorDesc, callbackType } =
      parseCallbackUrl(urlStr);

    // Full URL shape log — safe to report in TestFlight / bug reports.
    // Token values are never logged; only their presence is recorded.
    const qIdx = urlStr.indexOf("?");
    const hIdx = urlStr.indexOf("#");
    const pathOnly = urlStr.split("?")[0].split("#")[0];
    console.log("[callback] native: URL shape", {
      getInitialURLReturned: !wasInitialUrlNull,
      path: pathOnly || "(none)",
      hasQuery: qIdx >= 0,
      hasHash: hIdx >= 0,
      hasCode: !!code,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      hasError: !!errorDesc,
      callbackType,
      error: errorDesc ?? null,
    });

    // Auth-level errors forwarded from Supabase / OAuth provider
    if (errorDesc) {
      console.warn("[callback] native: auth error in URL:", errorDesc);
      clearSafety();
      fail(
        "CALLBACK_ERROR_PARAM",
        "This sign-in link is invalid or has expired. Please request a new one.",
      );
      return;
    }

    try {
      if (code) {
        // ── PKCE flow (Google OAuth, or PKCE magic link) ──────────────────
        console.log("[callback] native: PKCE exchange started");
        const { data, error } = await withAuthTimeout(
          supabase.auth.exchangeCodeForSession(code),
          8_000,
          "exchangeCodeForSession",
        );
        if (error) {
          console.error("[callback] native: PKCE exchange failed:", error.message);
          clearSafety();
          fail("EXCHANGE_CODE_FAILED", error.message || "Code exchange failed. Please try again.");
          return;
        }
        console.log("[callback] native: PKCE exchange succeeded", {
          uid: data?.session?.user?.id?.slice(-6),
          email: data?.session?.user?.email,
        });
      } else if (accessToken && refreshToken) {
        // ── Implicit flow (magic link via admin.generateLink / Edge Function) ──
        // The send-magic-link Edge Function uses the Admin API which produces
        // implicit links (no PKCE code_challenge). The redirect delivers tokens
        // in the hash: wename://auth/callback#access_token=…&refresh_token=…
        console.log("[callback] native: setSession started (implicit flow)");
        const { data, error } = await withAuthTimeout(
          supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }),
          8_000,
          "setSession",
        );
        if (error) {
          console.error("[callback] native: setSession failed:", error.message);
          clearSafety();
          fail("SET_SESSION_FAILED", error.message || "Session setup failed. Please try again.");
          return;
        }
        console.log("[callback] native: setSession succeeded", {
          uid: data?.session?.user?.id?.slice(-6),
          email: data?.session?.user?.email,
        });
      } else {
        // ── No credentials in URL — try getSession() as fallback ──────────
        // This covers edge cases where:
        // a) The OS stripped the hash fragment from the URL before delivering it
        // b) The Supabase SDK already processed the link before this mounted
        // c) The user is already authenticated from a previous session
        const noCredCode = wasInitialUrlNull ? "INITIAL_URL_NULL" : "NO_CALLBACK_CREDENTIALS";
        console.log("[callback] native: no credentials in URL, trying getSession fallback", {
          debugCode: noCredCode,
        });
        const { data: { session }, error } = await withAuthTimeout(
          supabase.auth.getSession(),
          4_000,
          "getSession-fallback",
        );
        if (error || !session) {
          console.warn("[callback] native: getSession fallback returned no session", {
            debugCode: noCredCode,
            supabaseError: error?.message ?? null,
          });
          clearSafety();
          fail(
            noCredCode === "INITIAL_URL_NULL" ? "INITIAL_URL_NULL" : "SESSION_FALLBACK_EMPTY",
            "This sign-in link appears to be invalid or expired. Please request a new one.",
          );
          return;
        }
        console.log("[callback] native: getSession fallback found active session", {
          uid: session.user.id.slice(-6),
        });
      }

      if (cancelledRef.current) return;
      clearSafety();
      await navigateAfterAuth();
    } catch (e) {
      if (cancelledRef.current) return;
      clearSafety();
      const msg = e instanceof Error ? e.message : "Sign-in failed. Please try again.";
      console.error("[callback] native: exchange failed:", msg);
      fail("UNKNOWN_CALLBACK_ERROR", msg);
    }
  }

  // ── Web callback handler ───────────────────────────────────────────────────

  async function runWebCallback() {
    if (handledRef.current) {
      console.log("[callback] web: callback already handled — ignoring duplicate");
      return;
    }
    handledRef.current = true;

    const isWebPopup =
      typeof window !== "undefined" && !!window.opener && window.opener !== window;

    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const errorDesc = params.get("error_description") ?? params.get("error");

        if (errorDesc) throw new Error(errorDesc);

        if (code) {
          // PKCE flow (Google OAuth)
          console.log("[callback] web: PKCE exchange started");
          await exchangeCodeWeb(code);
          console.log("[callback] web: PKCE exchange succeeded");
        } else {
          // Implicit flow (magic link) — tokens in hash fragment
          const hash = window.location.hash.slice(1);
          const hashParams = new URLSearchParams(hash);
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          console.log("[callback] web: params parsed", {
            hasCode: !!code,
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            isPopup: isWebPopup,
          });

          if (accessToken && refreshToken) {
            console.log("[callback] web: setSession started (implicit flow)");
            const { error } = await withAuthTimeout(
              supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }),
              6_000,
              "setSession",
            );
            if (error) throw error;
            console.log("[callback] web: setSession succeeded");
          } else {
            // No credentials — check for an existing active session as fallback
            console.log("[callback] web: no credentials, trying getSession fallback");
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session) {
              throw new Error(
                "This sign-in link appears to be invalid or expired. Please request a new one.",
              );
            }
            console.log("[callback] web: getSession fallback found active session");
          }
        }
      }

      if (cancelledRef.current) return;
      clearSafety();

      if (isWebPopup) {
        setStatus("success");
        console.log("[callback] web: notifying opener and closing popup");
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
        setTimeout(() => {
          if (!cancelledRef.current) routerRef.current.replace("/");
        }, 250);
      } else {
        await navigateAfterAuth();
      }
    } catch (e) {
      if (cancelledRef.current) return;
      clearSafety();
      const msg = e instanceof Error ? e.message : "Sign-in failed. Please try again.";
      console.error("[callback] web: exchange failed:", msg);
      setErrorMsg(msg);
      setStatus("error");
    }
  }

  // ── Main effect ────────────────────────────────────────────────────────────
  //
  // CRITICAL: This effect has NO dependencies ([]) so it runs exactly once on
  // mount. Previous versions used `useEffect([url])` which depended on the
  // Linking.useURL() hook. That hook starts null then resolves to the real URL,
  // causing a second effect run whose cleanup set cancelled=true and cleared the
  // safety timer — all while the async exchange from the first run was still
  // in flight. Every `if (cancelled) return` guard then fired, setStatus was
  // never called, and the result was an infinite spinner.
  //
  // Fix: Get the URL imperatively via Linking.getInitialURL() inside the effect,
  // and subscribe to Linking events for warm starts. The cancelled/safety state
  // is managed via refs so it is never stale across async boundaries.

  useEffect(() => {
    cancelledRef.current = false;
    handledRef.current = false;
    console.log("[callback] screen mounted — starting auth callback handler");

    // Hard timeout — no matter what happens, never spin indefinitely.
    // 10 s is generous for any network call; if we're still loading after
    // that, something is fundamentally broken and the user needs a way out.
    safetyRef.current = setTimeout(() => {
      if (cancelledRef.current) return;
      console.warn("[callback] safety timeout fired — showing recovery UI");
      setStatus("timeout");
    }, 10_000);

    if (Platform.OS !== "web") {
      // Cold start: get the launch URL imperatively.
      // Warm start: getInitialURL() returns null — fall back to the URL that
      // was captured at module level in warmStartUrl.ts before this screen
      // mounted (the Linking url event fires before component mount on warm start).
      Linking.getInitialURL()
        .then((initialUrl) => {
          if (cancelledRef.current) return;
          const wasNull = initialUrl === null;

          // Recover the warm-start URL if getInitialURL came back empty.
          const resolvedUrl = initialUrl ?? takeCapturedUrl();
          const effectivelyNull = !resolvedUrl;

          console.log("[callback] native: getInitialURL resolved", {
            getInitialURLWasNull: wasNull,
            recoveredFromCapture: wasNull && !!resolvedUrl,
            hasResolvedUrl: !!resolvedUrl,
          });

          handleNativeUrl(resolvedUrl ?? "", effectivelyNull);
        })
        .catch((err) => {
          if (cancelledRef.current) return;
          console.error("[callback] native: getInitialURL failed", err);
          clearSafety();
          fail("INITIAL_URL_NULL", "Could not read sign-in link. Please try again.");
        });

      // Late warm start: URL arrives after this screen has already mounted.
      // handledRef prevents this from double-processing if the captured URL
      // was already handled by the getInitialURL path above.
      const sub = Linking.addEventListener("url", ({ url }) => {
        if (cancelledRef.current) return;
        console.log("[callback] native: late warm-start URL received");
        handleNativeUrl(url);
      });

      return () => {
        cancelledRef.current = true;
        clearSafety();
        sub.remove();
      };
    }

    // Web path
    runWebCallback();

    return () => {
      cancelledRef.current = true;
      clearSafety();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

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

      {(status === "error" || status === "timeout") && (
        <View style={{ alignItems: "center", gap: 14, width: "100%" }}>
          <View
            style={[
              styles.iconBox,
              { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
            ]}
          >
            <Text style={{ fontSize: 28, color: "#dc2626" }}>✕</Text>
          </View>

          <Text style={[styles.heading, { color: "#1a1a1a" }]}>
            {status === "timeout"
              ? "Sign-in is taking longer than expected"
              : "Sign-in failed"}
          </Text>

          <Text style={styles.subtext}>
            {status === "timeout"
              ? "Your link may have expired, or something went wrong loading your account."
              : errorMsg || "Your link may have expired. Please try again."}
          </Text>

          {/* Debug code — visible in TestFlight to identify the exact failure branch */}
          {!!debugCode && (
            <View style={styles.debugCodeBox}>
              <Text style={styles.debugCodeLabel}>Debug code</Text>
              <Text style={styles.debugCodeText}>{debugCode}</Text>
            </View>
          )}

          <Pressable
            onPress={() => {
              // Navigate home so the user can open the auth modal and request a fresh link.
              routerRef.current.replace("/");
            }}
            style={[styles.actionBtn, { backgroundColor: "#5aabdf", marginTop: 8 }]}
          >
            <Text style={styles.actionBtnPrimaryText}>Request a new link</Text>
          </Pressable>

          <Pressable
            onPress={() => routerRef.current.replace("/")}
            style={[styles.actionBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: "#d1c9b8" }]}
          >
            <Text style={styles.actionBtnSecondaryText}>Continue as guest</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  actionBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  actionBtnPrimaryText: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    color: "#fff",
  },
  actionBtnSecondaryText: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    color: "#7a6f60",
  },
  debugCodeBox: {
    width: "100%",
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 4,
  },
  debugCodeLabel: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  debugCodeText: {
    fontFamily: "monospace" as any,
    fontSize: 15,
    color: "#f87171",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
