import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SubPageHeader } from "@/components/SubPageHeader";
import { useUser } from "@/components/UserContext";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/lib/revenuecat";

const grassBorder = require("../../../assets/images/grass-flower-border.png");
const butterfly = require("../../../assets/images/butterfly.png");

const GRASS = "#4a7c59";
const GRASS_LIGHT = "rgba(74,124,89,0.10)";
const GRASS_BORDER = "rgba(74,124,89,0.25)";
const TEXT_DARK = "#3e4a3d";
const TEXT_MID = "#6b7669";

const FEATURES = [
  {
    title: "Unlimited everything",
    body: "No limits on swipes, likes, or match reveals — keep discovering together.",
  },
  {
    title: "Smarter name suggestions",
    body: "Get AI-powered picks based on what you both love.",
  },
  {
    title: "Unlock all name packs",
    body: "Explore thousands more names across styles, cultures, and vibes.",
  },
];

export default function PremiumScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useUser();
  const { purchase, restore, isPurchasing, isRestoring, offerings } = useSubscription();

  if (!user) return null;
  const isPremium = user.plan_tier === "premium";

  const pkg = offerings?.current?.availablePackages?.[0];
  const priceString = pkg?.product?.priceString ?? "$7.99";

  async function handleUpgrade() {
    if (!pkg) return;
    try {
      await purchase(pkg);
      await updateUser({ plan_tier: "premium" });
    } catch (e: any) {
      if (e?.userCancelled) return;
      console.error("[PremiumScreen] purchase error", e);
    }
  }

  async function handleRestore() {
    try {
      const info = await restore();
      const isNowSubscribed = info?.entitlements?.active?.["premium"] !== undefined;
      if (isNowSubscribed) {
        await updateUser({ plan_tier: "premium" });
      }
    } catch (e) {
      console.error("[PremiumScreen] restore error", e);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f0e8" }}>
      <SubPageHeader title="Premium" subtitle="Unlock everything" />

      {/* Grass/flower decorative strip */}
      <View style={styles.grassWrap}>
        <Image source={grassBorder} style={styles.grassBorder} contentFit="cover" contentPosition="top" />
        <Image source={butterfly} style={styles.butterfly} contentFit="contain" />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 90, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Current plan status */}
        <View style={[styles.statusCard, { borderColor: isPremium ? GRASS_BORDER : colors.border + "55" }]}>
          <View style={[styles.statusIconWrap, { backgroundColor: isPremium ? GRASS_LIGHT : "rgba(0,0,0,0.05)" }]}>
            {isPremium ? (
              <Text style={{ fontSize: 20 }}>🌿</Text>
            ) : (
              <Feather name="lock" size={18} color={TEXT_MID} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: TEXT_DARK }]}>Current Plan</Text>
            <Text style={[styles.statusSub, { color: TEXT_MID }]}>
              {isPremium ? "Premium — all features unlocked" : "Free — basic features only"}
            </Text>
          </View>
        </View>

        {/* Feature list */}
        <View style={[styles.featuresCard, { borderColor: GRASS_BORDER }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Text style={{ fontSize: 18 }}>🌿</Text>
            <Text style={[styles.featuresHeading, { color: TEXT_DARK }]}>Premium Benefits</Text>
          </View>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <View style={[styles.leafDot, { backgroundColor: GRASS_LIGHT }]}>
                <Text style={{ fontSize: 11 }}>🌿</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.featureTitle, { color: TEXT_DARK }]}>{f.title}</Text>
                <Text style={[styles.featureBody, { color: TEXT_MID }]}>{f.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {isPremium ? (
          <View style={[styles.successRow, { backgroundColor: GRASS_LIGHT, borderColor: GRASS_BORDER }]}>
            <Text style={{ fontSize: 16 }}>🌿</Text>
            <Text style={[styles.successText, { color: GRASS }]}>
              You're on Premium — enjoy everything!
            </Text>
          </View>
        ) : (
          <>
            <Pressable
              onPress={handleUpgrade}
              disabled={isPurchasing || !pkg}
              style={({ pressed }) => [
                styles.upgradeBtn,
                { backgroundColor: GRASS, opacity: pressed || isPurchasing ? 0.82 : 1 },
              ]}
            >
              {isPurchasing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.upgradeBtnText}>
                  One-time purchase — {priceString}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleRestore}
              disabled={isRestoring}
              style={[styles.restoreBtn, { backgroundColor: colors.card, borderColor: GRASS_BORDER }]}
            >
              {isRestoring ? (
                <ActivityIndicator color={TEXT_MID} size="small" />
              ) : (
                <Text style={[styles.restoreBtnText, { color: TEXT_MID }]}>
                  Restore purchase
                </Text>
              )}
            </Pressable>

            <Text style={[styles.legal, { color: TEXT_MID }]}>
              No subscriptions. Pay once, use forever.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  grassWrap: {
    width: "100%",
    height: 80,
    position: "relative",
    overflow: "hidden",
  },
  grassBorder: {
    width: "100%",
    height: 80,
  },
  butterfly: {
    position: "absolute",
    right: 20,
    top: 10,
    width: 28,
    height: 28,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  statusIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTitle: {
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 14,
  },
  statusSub: {
    fontFamily: "Fredoka_500Medium",
    fontSize: 12,
    marginTop: 2,
  },
  featuresCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.65)",
  },
  featuresHeading: {
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  leafDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  featureTitle: {
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 14,
    marginBottom: 1,
  },
  featureBody: {
    fontFamily: "Fredoka_500Medium",
    fontSize: 12,
    lineHeight: 18,
  },
  successRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  successText: {
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 15,
  },
  upgradeBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  upgradeBtnText: {
    color: "#fff",
    fontFamily: "Fredoka_700Bold",
    fontSize: 17,
  },
  restoreBtn: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreBtnText: {
    fontFamily: "Fredoka_500Medium",
    fontSize: 14,
  },
  legal: {
    fontFamily: "Fredoka_500Medium",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 16,
  },
});
