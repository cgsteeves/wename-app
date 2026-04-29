import { Feather } from "@expo/vector-icons";
import { Image, ImageBackground } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { useSubscription } from "@/lib/revenuecat";

const grassBorder = require("../assets/images/grass-flower-border.png");
const butterfly = require("../assets/images/butterfly.png");
const paperTexture = require("../assets/images/paper-texture.jpg");

type LimitType = "swipe" | "like" | "match" | "discover" | null;

// Feature rows match the InfoRow pattern from the name cards exactly —
// Feather icon, uppercase label, value text.
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

// Colour tokens — mirrors colors.ts grass / foreground / muted
const GRASS = "hsl(145,45%,35%)";
const GRASS_BG = "hsla(145,45%,35%,0.08)";
const GRASS_BORDER = "hsl(145,45%,60%)";
const TEXT_DARK = "hsl(25,30%,20%)";
const TEXT_MID = "hsl(25,12%,48%)";

export function PremiumModal({
  open,
  limitType,
  onClose,
  onUpgrade,
}: {
  open: boolean;
  limitType: LimitType;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { updateUser } = useUser();
  const { purchase, restore, isPurchasing, isRestoring, offerings } = useSubscription();

  const pkg = offerings?.current?.availablePackages?.[0];
  const priceString = pkg?.product?.priceString ?? "$7.99";

  async function handleUpgrade() {
    if (!pkg) return;
    try {
      await purchase(pkg);
      await updateUser({ plan_tier: "premium" });
      onClose();
      onUpgrade();
    } catch (e: any) {
      if (e?.userCancelled) return;
      console.error("[PremiumModal] purchase error", e);
    }
  }

  async function handleRestore() {
    try {
      const info = await restore();
      const isNowSubscribed = info?.entitlements?.active?.["premium"] !== undefined;
      if (isNowSubscribed) {
        await updateUser({ plan_tier: "premium" });
        onClose();
        onUpgrade();
      }
    } catch (e) {
      console.error("[PremiumModal] restore error", e);
    }
  }

  return (
    <Modal visible={open} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        {/* Same green-parchment gradient used in the name card's info sheet */}
        <LinearGradient
          colors={[
            "rgba(219,240,225,0.99)",
            "rgba(200,228,210,0.97)",
            "rgba(255,251,235,0.99)",
          ]}
          style={StyleSheet.absoluteFill}
        />
        {/* Paper texture overlay — same opacity as name card (0.18) */}
        <ImageBackground
          source={paperTexture}
          style={StyleSheet.absoluteFill}
          imageStyle={{ opacity: 0.18 }}
          contentFit="cover"
        />

        {/* Grass/flower header strip */}
        <Image
          source={grassBorder}
          style={styles.grassBorder}
          contentFit="cover"
          contentPosition="top"
        />

        {/* Close X — styled like name card's sheetClose button */}
        <Pressable
          style={[styles.closeBtn, { top: 112 + insets.top * 0.3 }]}
          onPress={onClose}
          hitSlop={12}
        >
          <Feather name="x" size={14} color={TEXT_MID} />
        </Pressable>

        {/* Butterfly accent */}
        <Image
          source={butterfly}
          style={[styles.butterfly, { top: 112 }]}
          contentFit="contain"
        />

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 36 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* PatrickHand italic headline — exactly like the card's "Boy Name" / "Girl Name" label */}
          <Text style={styles.headline}>Keep the momentum going</Text>

          {/* Thin divider — same as labelDivider in NameCard */}
          <View style={styles.divider} />

          <Text style={styles.subText}>
            You're finding names you love — don't slow down now.
          </Text>

          {/* InfoRow-style feature list — mirrors the name card's info sheet rows */}
          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.featureRow}>
                <Feather
                  name={f.icon}
                  size={15}
                  color={GRASS}
                  style={styles.featureIcon}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                  <Text style={[styles.featureValue, { color: TEXT_DARK }]}>{f.value}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* CTA — ActionButton aesthetic: gradient fill, white border, heavy shadow */}
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

          {/* Restore purchase */}
          <Pressable style={styles.restore} onPress={handleRestore} disabled={isRestoring}>
            {isRestoring ? (
              <ActivityIndicator color={TEXT_MID} size="small" />
            ) : (
              <Text style={[styles.restoreText, { color: TEXT_MID }]}>Restore purchase</Text>
            )}
          </Pressable>

          <Text style={[styles.legal, { color: TEXT_MID }]}>
            No subscriptions. Pay once, use forever.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  grassBorder: { width: "100%", height: 110 },
  closeBtn: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  butterfly: {
    position: "absolute",
    right: 52,
    width: 28,
    height: 28,
    zIndex: 5,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  headline: {
    fontFamily: fonts.hand,
    fontSize: 28,
    color: GRASS,
    fontStyle: "italic",
    textAlign: "center",
  },
  divider: {
    height: 1.5,
    width: 96,
    borderRadius: 999,
    backgroundColor: GRASS,
    opacity: 0.5,
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 14,
  },
  subText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: TEXT_MID,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  features: { gap: 10, marginBottom: 28 },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: GRASS_BG,
    borderWidth: 1,
    borderColor: GRASS_BORDER,
  },
  featureIcon: { opacity: 0.65, marginTop: 2 },
  featureLabel: {
    fontFamily: fonts.displaySemibold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: GRASS,
    opacity: 0.65,
    marginBottom: 2,
  },
  featureValue: {
    fontFamily: fonts.display,
    fontSize: 14,
    opacity: 0.85,
    lineHeight: 20,
  },
  cta: {
    height: 56,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.38)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  ctaText: {
    color: "#fff",
    fontFamily: fonts.displayBold,
    fontSize: 17,
  },
  restore: {
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 12,
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
