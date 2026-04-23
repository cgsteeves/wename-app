import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/constants/fonts";
import { supabase } from "@/lib/supabase";
import { finalizeLogin } from "@/lib/authService";

type Status = "loading" | "success" | "error";

export default function AuthCallback() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      try {
        let session = null;

        // For web: try PKCE code exchange first (query param ?code=...)
        if (typeof window !== "undefined") {
          const searchParams = new URLSearchParams(window.location.search);
          const code = searchParams.get("code");
          if (code) {
            const { data, error } = await supabase.auth.exchangeCodeForSession(
              window.location.href,
            );
            if (!error && data.session) {
              session = data.session;
            }
          }
        }

        // Fallback: get session already stored by Supabase client
        if (!session) {
          const { data } = await supabase.auth.getSession();
          session = data.session;
        }

        // Retry once after 800 ms (magic link may take a moment)
        if (!session) {
          await new Promise((r) => setTimeout(r, 800));
          const { data } = await supabase.auth.getSession();
          session = data.session;
        }

        if (!session) {
          throw new Error("No session found. Your sign-in link may have expired.");
        }

        await finalizeLogin(session.user.id, session.user.email ?? "");

        if (!cancelled) {
          setStatus("success");
          setTimeout(async () => {
            if (cancelled) return;
            const redirect = await AsyncStorage.getItem("post_auth_redirect");
            if (redirect) {
              await AsyncStorage.removeItem("post_auth_redirect");
              router.replace(`/?redirect=${redirect}` as any);
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
    return () => { cancelled = true; };
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
          <View style={[styles.iconBox, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
            <Text style={{ fontSize: 28, color: "#dc2626" }}>✕</Text>
          </View>
          <Text style={[styles.heading, { color: "#1a1a1a" }]}>Sign-in failed</Text>
          <Text style={styles.subtext}>
            {errorMsg || "Your link may have expired. Please try again."}
          </Text>
          <Pressable
            onPress={() => router.replace("/")}
            style={styles.backBtn}
          >
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
