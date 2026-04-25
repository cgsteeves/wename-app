import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/constants/fonts";
import { supabase } from "@/lib/supabase";
import { finalizeLogin } from "@/lib/authService";
import { useUser } from "@/components/UserContext";

type Status = "loading" | "success" | "error";

const EMAIL_OTP_TYPES = [
  "signup",
  "recovery",
  "email_change",
  "email",
  "invite",
  "magiclink",
] as const;
type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];
function isEmailOtpType(value: string): value is EmailOtpType {
  return (EMAIL_OTP_TYPES as readonly string[]).includes(value);
}

export default function AuthCallback() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reload: reloadUser } = useUser();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      try {
        let session = null;

        if (typeof window !== "undefined") {
          const searchParams = new URLSearchParams(window.location.search);
          const code = searchParams.get("code");

          // 1. PKCE flow: ?code=... query param
          // Wrap in try/catch — if the code was already exchanged (race condition / double
          // render), fall through to the getSession fallbacks below rather than erroring.
          if (code) {
            try {
              const { data, error } = await supabase.auth.exchangeCodeForSession(code);
              if (!error && data.session) {
                session = data.session;
              }
              // error means the code was already consumed; session may still exist in storage
            } catch {
              // Unexpected throw from exchangeCodeForSession — session may still exist
            }
          }

          // 2. OTP / magic-link via token_hash (Supabase email template)
          if (!session) {
            const tokenHash = searchParams.get("token_hash");
            const type = searchParams.get("type");
            if (tokenHash && type && isEmailOtpType(type)) {
              const { data, error } = await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type,
              });
              if (!error && data.session) {
                session = data.session;
              }
            }
          }

          // 3. Implicit / hash-based tokens (#access_token=...&refresh_token=...)
          if (!session && window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = hashParams.get("access_token");
            const refreshToken = hashParams.get("refresh_token");
            if (accessToken && refreshToken) {
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (!error && data.session) {
                session = data.session;
              }
            }
          }
        }

        // 4. Fallback: Supabase client may already have the session persisted
        if (!session) {
          const { data } = await supabase.auth.getSession();
          session = data.session;
        }

        // 5. Retry once — session propagation can take a moment
        if (!session) {
          await new Promise<void>((r) => setTimeout(r, 800));
          const { data } = await supabase.auth.getSession();
          session = data.session;
        }

        if (!session) {
          throw new Error("No session found. Your sign-in link may have expired.");
        }

        // Upsert the user row and migrate any guest data. Wrap in a hard
        // timeout — if the network is slow or RLS blocks something, we MUST
        // NOT leave the user staring at a spinning popup forever. The
        // opener tab will sync session via SIGNED_IN event regardless.
        const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) =>
          Promise.race<T | "timeout">([
            p,
            new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms)),
          ]).then((v) => {
            if (v === "timeout") {
              console.warn(`[auth/callback] ${label} timed out after ${ms}ms`);
            }
            return v;
          });

        await withTimeout(
          finalizeLogin(session.user.id, session.user.email ?? ""),
          3000,
          "finalizeLogin",
        );

        // Force UserContext to reload with the authenticated user's ID
        await withTimeout(reloadUser(), 3000, "reloadUser");

        if (!cancelled) {
          setStatus("success");

          // If we were opened as a popup from the main app (target="_blank"
          // anchor for Google sign-in on web), close ourselves so the user
          // returns to the original tab — Supabase syncs the session across
          // tabs via storage events / BroadcastChannel.
          const isWebPopup =
            typeof window !== "undefined" &&
            !!window.opener &&
            window.opener !== window;

          if (isWebPopup) {
            try {
              window.opener.postMessage(
                { type: "wename:auth:signed_in" },
                window.location.origin,
              );
            } catch {
              // postMessage may throw cross-origin — best-effort only
            }
            setTimeout(() => {
              if (cancelled) return;
              try {
                window.close();
              } catch {
                // window.close may be blocked — fall back to redirect below
              }
              // Belt-and-suspenders: if close was blocked, navigate the popup
              // back to the app so the user sees something useful.
              setTimeout(() => router.replace("/"), 200);
            }, 600);
            return;
          }

          setTimeout(async () => {
            if (cancelled) return;

            // Consume any pending post-auth redirect stored before sign-in
            const redirect = await AsyncStorage.getItem("post_auth_redirect");
            await AsyncStorage.removeItem("post_auth_redirect");

            if (redirect) {
              router.replace(`/?redirect=${encodeURIComponent(redirect)}`);
            } else {
              router.replace("/");
            }
          }, 1000);
        }
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(
            e instanceof Error ? e.message : "Sign-in failed. Please try again.",
          );
          setStatus("error");
        }
      }
    }

    handleCallback();
    return () => {
      cancelled = true;
    };
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
