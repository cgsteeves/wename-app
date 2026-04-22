import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

const sunImg = require("../assets/images/like_sun.png");
const paperTexture = require("../assets/images/paper-texture.jpg");

type LimitType = "swipe" | "like" | "match" | "discover" | null;

const COPY: Record<NonNullable<LimitType>, string> = {
  swipe:
    "You've used all 30 of your daily swipes. Upgrade to keep discovering names together.",
  like:
    "You've liked 8 names today — that's your daily limit. Upgrade to keep liking names together.",
  match:
    "You've seen 3 new matches today. Upgrade to reveal every match the moment it happens.",
  discover:
    "Get smarter name suggestions—our AI learns what you like and recommends names with a similar style and vibe.",
};

const FEATURES: { icon: keyof typeof Feather.glyphMap; text: string }[] = [
  { icon: "refresh-cw", text: "Unlimited daily swipes, likes and matches" },
  {
    icon: "package",
    text: "Access to themed name packs (Classic, Arabic, Spiritual, and more)",
  },
  { icon: "zap", text: "AI name suggestions based on your likes" },
];

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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const body = limitType
    ? COPY[limitType]
    : "Unlock unlimited swipes, likes and matches.";

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetWrap}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <LinearGradient
              colors={["rgba(255,251,235,0.99)", "rgba(255,245,220,0.98)", "rgba(255,237,200,0.99)"]}
              style={StyleSheet.absoluteFill}
            />
            <Image
              source={paperTexture}
              style={[StyleSheet.absoluteFill, { opacity: 0.22 }]}
              contentFit="cover"
            />
            <View style={styles.handle} />
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>

            <View style={styles.sunBadge}>
              <Image source={sunImg} style={styles.sunImg} contentFit="contain" />
            </View>

            <Text style={[styles.title, { color: colors.foreground }]}>Keep going</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text>

            <View style={styles.features}>
              {FEATURES.map((f) => (
                <View key={f.text} style={styles.featureRow}>
                  <Feather name={f.icon} size={16} color="#a16207" />
                  <Text style={[styles.featureText, { color: colors.foreground + "cc" }]}>
                    {f.text}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={onUpgrade}
              style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.9 : 1 }]}
            >
              <LinearGradient
                colors={["#f59e0b", "#d97706"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Feather name="zap" size={16} color="#fff" />
              <Text style={styles.ctaText}>Upgrade to Premium</Text>
            </Pressable>

            <Pressable
              style={[
                styles.dismiss,
                { backgroundColor: "rgba(255,255,255,0.65)", borderColor: colors.border + "55" },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.dismissText, { color: colors.mutedForeground }]}>
                Come back tomorrow
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheetWrap: { width: "100%", maxWidth: 480, alignSelf: "center" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    overflow: "hidden",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(120,90,40,0.25)",
    alignSelf: "center",
    marginBottom: 16,
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  sunBadge: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignSelf: "center",
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(252,211,77,0.35)",
  },
  sunImg: { width: 56, height: 56 },
  title: {
    fontSize: 26,
    fontFamily: fonts.hand,
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    fontFamily: fonts.display,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
    marginBottom: 22,
  },
  features: { gap: 10, marginBottom: 24 },
  featureRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(180,140,60,0.08)",
    borderWidth: 1,
    borderColor: "rgba(252,211,77,0.45)",
  },
  featureText: { flex: 1, fontFamily: fonts.display, fontSize: 14, lineHeight: 20 },
  cta: {
    height: 52,
    borderRadius: 14,
    overflow: "hidden",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ctaText: { color: "#fff", fontFamily: fonts.displayBold, fontSize: 15 },
  dismiss: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  dismissText: { fontFamily: fonts.displaySemibold, fontSize: 14 },
});
