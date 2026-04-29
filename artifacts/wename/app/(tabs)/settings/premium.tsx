import { Feather } from "@expo/vector-icons";
import { Image, ImageBackground } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/lib/revenuecat";

const grassBorder = require("../../../assets/images/grass-flower-border.png");
const paperTexture = require("../../../assets/images/paper-texture.jpg");
const girlBg = require("../../../assets/images/girl-card-bg.jpg");

const GRASS = "hsl(145,45%,35%)";
const GRASS_BG = "hsla(145,45%,35%,0.08)";
const GRASS_BORDER = "hsl(145,45%,60%)";
const GRASS_LIGHT_BG = "hsla(145,45%,35%,0.10)";
const GRASS_BORDER_STRONG = "hsl(145,45%,52%)";
const TEXT_DARK = "hsl(25,30%,20%)";
const TEXT_MID = "hsl(25,12%,48%)";

const FEATURES: { icon: keyof typeof Feather.glyphMap; label: string; value: string }[] = [
  {
    icon: "refresh-cw",
    label: "UNLIMITED",
    value: "No limits on swipes, likes, or match reveals — keep discovering together.",
  },
  {
    icon: "zap",
    label: "AI SUGGESTIONS",
    value: "Get AI-powered picks based on what you both love.",
  },
  {
    icon: "book-open",
    label: "ALL NAME PACKS",
    value: "Explore thousands more names across styles, cultures, and vibes.",
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
    <View style={styles.root}>
      {/* Colorful card background — same image as the swipe cards */}
      <ImageBackground
        source={girlBg}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <ImageBackground
        source={paperTexture}
        style={StyleSheet.absoluteFill}
        imageStyle={{ opacity: 0.12 }}
        contentFit="cover"
      />
      {/* Fade the image to readable parchment in the lower scroll area */}
      <LinearGradient
        colors={[
          "rgba(255,248,242,0.05)",
          "rgba(255,248,242,0.55)",
          "rgba(255,248,242,0.92)",
        ]}
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SubPageHeader title="Premium" subtitle="Keep the momentum going" />

      {/* Grass/flower decorative strip */}
      <View style={styles.grassWrap}>
        <Image source={grassBorder} style={styles.grassBorder} contentFit="cover" contentPosition="top" />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Plan status card — InfoRow aesthetic */}
        <View style={[styles.statusCard, { borderColor: isPremium ? GRASS_BORDER_STRONG : colors.border + "55" }]}>
          <View style={[styles.statusIcon, { backgroundColor: isPremium ? GRASS_LIGHT_BG : "rgba(0,0,0,0.04)" }]}>
            {isPremium ? (
              <Text style={{ fontSize: 20 }}>🌿</Text>
            ) : (
              <Feather name="lock" size={17} color={TEXT_MID} style={{ opacity: 0.65 }} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: GRASS }]}>CURRENT PLAN</Text>
            <Text style={[styles.statusValue, { color: TEXT_DARK }]}>
              {isPremium ? "Premium — all features unlocked" : "Free — basic features only"}
            </Text>
          </View>
        </View>

        {/* Features section — PatrickHand italic header + divider + InfoRow items */}
        <View style={[styles.featuresCard, { borderColor: GRASS_BORDER }]}>
          <Text style={styles.sectionLabel}>Premium Benefits</Text>
          <View style={styles.sectionDivider} />

          {FEATURES.map((f) => (
            <View key={f.label} style={[styles.featureRow, { backgroundColor: GRASS_BG, borderColor: GRASS_BORDER }]}>
              <Feather name={f.icon} size={15} color={GRASS} style={styles.featureIcon} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.featureLabel, { color: GRASS }]}>{f.label}</Text>
                <Text style={[styles.featureValue, { color: TEXT_DARK }]}>{f.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {isPremium ? (
          <View style={[styles.successRow, { backgroundColor: GRASS_LIGHT_BG, borderColor: GRASS_BORDER_STRONG }]}>
            <Text style={{ fontSize: 16 }}>🌿</Text>
            <Text style={[styles.successText, { color: GRASS }]}>You're on Premium — enjoy everything!</Text>
          </View>
        ) : (
          <>
            {/* CTA — ActionButton gradient style */}
            <Pressable
              onPress={handleUpgrade}
              disabled={isPurchasing || !pkg}
              style={({ pressed }) => [
                styles.cta,
                { opacity: pressed || isPurchasing ? 0.82 : 1 },
              ]}
            >
              <LinearGradient
                colors={["hsl(145,45%,38%)", "hsl(145,45%,27%)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {isPurchasing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.ctaText}>One-time purchase — {priceString}</Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleRestore}
              disabled={isRestoring}
              style={[styles.restoreBtn, { backgroundColor: "rgba(255,255,255,0.5)", borderColor: GRASS_BORDER }]}
            >
              {isRestoring ? (
                <ActivityIndicator color={TEXT_MID} size="small" />
              ) : (
                <Text style={[styles.restoreText, { color: TEXT_MID }]}>Restore purchase</Text>
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
  root: { flex: 1 },
  grassWrap: { width: "100%", height: 72, overflow: "hidden" },
  grassBorder: { width: "100%", height: 72 },
  scroll: { paddingHorizontal: 20, gap: 14 },
  statusCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.55)",
    marginTop: 4,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statusLabel: {
    fontFamily: fonts.displaySemibold,
    fontSize: 10,
    letterSpacing: 1.5,
    opacity: 0.65,
    marginBottom: 2,
  },
  statusValue: {
    fontFamily: fonts.display,
    fontSize: 14,
    opacity: 0.85,
    lineHeight: 20,
  },
  featuresCard: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.5)",
    gap: 10,
  },
  sectionLabel: {
    fontFamily: fonts.hand,
    fontSize: 22,
    color: GRASS,
    fontStyle: "italic",
    textAlign: "center",
  },
  sectionDivider: {
    height: 1.5,
    width: 80,
    borderRadius: 999,
    backgroundColor: GRASS,
    opacity: 0.45,
    alignSelf: "center",
    marginBottom: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  featureIcon: { opacity: 0.65, marginTop: 2 },
  featureLabel: {
    fontFamily: fonts.displaySemibold,
    fontSize: 10,
    letterSpacing: 1.5,
    opacity: 0.65,
    marginBottom: 2,
  },
  featureValue: {
    fontFamily: fonts.display,
    fontSize: 13,
    opacity: 0.85,
    lineHeight: 19,
  },
  successRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  successText: { fontFamily: fonts.displaySemibold, fontSize: 15 },
  cta: {
    height: 56,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.38)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  ctaText: { color: "#fff", fontFamily: fonts.displayBold, fontSize: 17 },
  restoreBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreText: { fontFamily: fonts.display, fontSize: 14 },
  legal: {
    fontFamily: fonts.display,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 16,
  },
});
