import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { supabase, USER_ID_KEY, PartnerInvite } from "@/lib/supabase";
import { getInviteByToken, acceptInvite } from "@/lib/inviteService";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Design tokens ────────────────────────────────────────────────────────────
const PARCHMENT  = "#ede0c8";
const CARD_BG    = "#ede5d4";
const FOREGROUND = "#3d2e20";
const MUTED_FG   = "#857d74";
const BORDER_60  = "rgba(206,197,185,0.60)";
const GRASS      = "#316b46";
const GRASS_BG   = "#d1fae5";
const BOY_BLUE   = "#3a71b5";
const ROSE_500   = "#f43f5e";
const ROSE_100   = "#ffe4e6";
const DESTRUCTIVE    = "#d63030";
const DESTRUCTIVE_10 = "rgba(214,48,48,0.10)";
const DESTRUCTIVE_20 = "rgba(214,48,48,0.20)";

type Phase =
  | "loading"
  | "invalid"
  | "confirm"
  | "joining"
  | "success"
  | "error";

type State = {
  phase: Phase;
  message: string;
  inviterName: string;
  invite: PartnerInvite | null;
};

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const { user, updateUser } = useUser();

  const [state, setState] = useState<State>({
    phase: "loading",
    message: "",
    inviterName: "",
    invite: null,
  });

  const goHome = useCallback(() => {
    router.replace("/(tabs)/");
  }, [router]);

  // ── Phase 1: validate token ────────────────────────────────────────────────
  const validateToken = useCallback(async () => {
    setState({ phase: "loading", message: "", inviterName: "", invite: null });

    if (!token) {
      setState({ phase: "invalid", message: "No invite token provided.", inviterName: "", invite: null });
      return;
    }

    const invite = await getInviteByToken(String(token));
    if (!invite) {
      setState({
        phase: "invalid",
        message: "This invite link is invalid or has already been used.",
        inviterName: "",
        invite: null,
      });
      return;
    }

    // Fetch inviter name
    const { data: inviterRow } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", invite.inviter_id)
      .maybeSingle();

    const inviterName = (inviterRow as any)?.display_name || "Your partner";

    setState({ phase: "confirm", message: "", inviterName, invite });
  }, [token]);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  // ── Phase 4: join ──────────────────────────────────────────────────────────
  async function handleJoin() {
    if (!state.invite) return;
    setState((s) => ({ ...s, phase: "joining" }));

    try {
      // Get or create user ID
      let userId = user?.id;
      if (!userId) {
        userId = (await AsyncStorage.getItem(USER_ID_KEY)) ?? undefined;
      }
      if (!userId) {
        // Brand-new visitor — create a user row
        const { data, error } = await supabase
          .from("users")
          .insert({ invite_code: generateInviteCode() })
          .select()
          .single();
        if (error || !data) {
          setState((s) => ({
            ...s,
            phase: "error",
            message: "Could not create your account. Please try again.",
          }));
          return;
        }
        userId = (data as any).id as string;
        await AsyncStorage.setItem(USER_ID_KEY, userId);
      }

      const result = await acceptInvite(state.invite, userId);
      if (!result.success) {
        setState((s) => ({
          ...s,
          phase: "error",
          message: result.error ?? "Something went wrong.",
        }));
        return;
      }

      // Update global user state if we have a live user object
      if (user) {
        await updateUser({ partner_id: result.inviter_id! });
      }

      setState((s) => ({ ...s, phase: "success" }));
    } catch (e) {
      setState((s) => ({
        ...s,
        phase: "error",
        message: "Something went wrong. Please try again.",
      }));
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: PARCHMENT, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {state.phase === "loading" && (
          <View style={styles.centeredGroup}>
            <ActivityIndicator color={ROSE_500} size="large" />
            <Text style={styles.loadingText}>Checking your invite…</Text>
          </View>
        )}

        {/* ── Joining ──────────────────────────────────────────────────────── */}
        {state.phase === "joining" && (
          <View style={styles.centeredGroup}>
            <ActivityIndicator color={ROSE_500} size="large" />
            <Text style={styles.loadingText}>Connecting you…</Text>
          </View>
        )}

        {/* ── Invalid ──────────────────────────────────────────────────────── */}
        {state.phase === "invalid" && (
          <View style={styles.card}>
            <View style={[styles.iconBlock, { backgroundColor: DESTRUCTIVE_10, borderColor: DESTRUCTIVE_20 }]}>
              <Feather name="alert-circle" size={28} color={DESTRUCTIVE} />
            </View>
            <Text style={[styles.cardTitle, { color: FOREGROUND }]}>Link not valid</Text>
            <Text style={styles.cardBody}>{state.message}</Text>
            <Pressable
              onPress={goHome}
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: BOY_BLUE, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            >
              <Text style={styles.primaryBtnText}>Go to app</Text>
            </Pressable>
          </View>
        )}

        {/* ── Confirm ──────────────────────────────────────────────────────── */}
        {state.phase === "confirm" && (
          <View style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: ROSE_100 }]}>
              <Feather name="heart" size={28} color={ROSE_500} />
            </View>
            <Text style={[styles.cardTitle, { color: GRASS, fontFamily: fonts.hand }]}>
              You're invited!
            </Text>
            <Text style={styles.cardBody}>
              <Text style={{ fontFamily: fonts.displaySemibold, color: FOREGROUND }}>
                {state.inviterName}
              </Text>
              {" wants to find baby names together with you."}
            </Text>
            <Pressable
              onPress={handleJoin}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: ROSE_500, transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <Feather name="heart" size={15} color="#fff" />
              <Text style={styles.primaryBtnText}>Join and connect</Text>
            </Pressable>
            <Pressable
              onPress={goHome}
              style={({ pressed }) => [styles.ghostBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={styles.ghostBtnText}>Maybe later</Text>
            </Pressable>
          </View>
        )}

        {/* ── Success ──────────────────────────────────────────────────────── */}
        {state.phase === "success" && (
          <View style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: GRASS_BG }]}>
              <Feather name="check-circle" size={28} color={GRASS} />
            </View>
            <Text style={[styles.cardTitle, { color: GRASS, fontFamily: fonts.hand }]}>
              You're connected!
            </Text>
            <Text style={styles.cardBody}>
              {"You and "}
              <Text style={{ fontFamily: fonts.displaySemibold, color: FOREGROUND }}>
                {state.inviterName}
              </Text>
              {" are now linked. Start swiping to find names you both love."}
            </Text>
            <Pressable
              onPress={goHome}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: GRASS, transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <Text style={styles.primaryBtnText}>Start swiping</Text>
            </Pressable>
          </View>
        )}

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {state.phase === "error" && (
          <View style={styles.card}>
            <View style={[styles.iconBlock, { backgroundColor: DESTRUCTIVE_10, borderColor: DESTRUCTIVE_20 }]}>
              <Feather name="alert-circle" size={28} color={DESTRUCTIVE} />
            </View>
            <Text style={[styles.cardTitle, { color: FOREGROUND, fontFamily: fonts.hand }]}>
              Something went wrong
            </Text>
            <Text style={styles.cardBody}>{state.message}</Text>
            <View style={{ gap: 8, width: "100%" }}>
              <Pressable
                onPress={validateToken}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: ROSE_500, transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
              >
                <Text style={styles.primaryBtnText}>Try again</Text>
              </Pressable>
              <Pressable
                onPress={goHome}
                style={({ pressed }) => [styles.ghostBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={styles.ghostBtnText}>Go to app</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  centeredGroup: { alignItems: "center", gap: 12 },
  loadingText: { fontFamily: fonts.display, fontSize: 14, color: MUTED_FG },

  card: {
    width: "100%",
    backgroundColor: CARD_BG,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER_60,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  iconBlock: {
    width: 64, height: 64, borderRadius: 16,
    borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center",
  },

  cardTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    color: FOREGROUND,
    textAlign: "center",
  },
  cardBody: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: MUTED_FG,
    textAlign: "center",
    lineHeight: 21,
  },

  primaryBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  primaryBtnText: { fontFamily: fonts.displayBold, fontSize: 14, color: "#fff" },

  ghostBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
  },
  ghostBtnText: { fontFamily: fonts.display, fontSize: 14, color: MUTED_FG },
});
