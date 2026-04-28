import { Image } from "expo-image";
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
import { useSubscription } from "@/lib/revenuecat";

const grassBorder = require("../assets/images/grass-flower-border.png");
const butterfly = require("../assets/images/butterfly.png");

type LimitType = "swipe" | "like" | "match" | "discover" | null;

const COPY: Record<NonNullable<LimitType>, string> = {
  swipe:
    "You've used all your daily swipes. Upgrade to keep discovering names together.",
  like:
    "You've hit your daily like limit. Upgrade to keep liking names together.",
  match:
    "You've seen all your new matches today. Upgrade to reveal every match the moment it happens.",
  discover:
    "Get smarter name suggestions — our AI learns what you like and recommends names with a similar vibe.",
};

const FEATURES = [
  {
    title: "Unlimited Swipes",
    body: "Swipe on as many names as you want, every day",
  },
  {
    title: "All Name Packs",
    body: "Unlock Classic, Arabic, Spiritual, and more",
  },
  {
    title: "AI Suggestions",
    body: "Personalised names based on what you both love",
  },
];

const GRASS = "#4a7c59";
const GRASS_LIGHT = "rgba(74,124,89,0.12)";
const PARCHMENT = "#f5f0e8";
const TEXT_DARK = "#3e4a3d";
const TEXT_MID = "#6b7669";

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

  const body = limitType
    ? COPY[limitType]
    : "Unlock unlimited swipes, likes and matches.";

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
      <View style={[styles.screen, { backgroundColor: PARCHMENT }]}>
        {/* Grass/flower header strip */}
        <Image
          source={grassBorder}
          style={styles.grassBorder}
          contentFit="cover"
          contentPosition="top"
        />

        {/* Close button */}
        <Pressable
          style={[styles.closeBtn, { top: 130 + insets.top * 0.5 }]}
          onPress={onClose}
          hitSlop={12}
        >
          <Feather name="x" size={18} color={TEXT_MID} />
        </Pressable>

        {/* Butterfly decoration */}
        <Image
          source={butterfly}
          style={[styles.butterfly, { top: 130 }]}
          contentFit="contain"
        />

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Headline */}
          <Text style={styles.headline}>
            You're this close{"\n"}to your baby's name
          </Text>
          <Text style={styles.subText}>{body}</Text>

          {/* Feature list */}
          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.title} style={[styles.featureRow, { backgroundColor: GRASS_LIGHT }]}>
                <View style={styles.leafDot}>
                  <Text style={styles.leafEmoji}>🌿</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.featureTitle, { color: TEXT_DARK }]}>{f.title}</Text>
                  <Text style={[styles.featureBody, { color: TEXT_MID }]}>{f.body}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* CTA */}
          <Pressable
            onPress={handleUpgrade}
            disabled={isPurchasing || !pkg}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: GRASS, opacity: pressed || isPurchasing ? 0.82 : 1 },
            ]}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.ctaText}>
                Unlock Premium · {priceString}/mo
              </Text>
            )}
          </Pressable>

          {/* Restore */}
          <Pressable style={styles.restore} onPress={handleRestore} disabled={isRestoring}>
            {isRestoring ? (
              <ActivityIndicator color={TEXT_MID} size="small" />
            ) : (
              <Text style={[styles.restoreText, { color: TEXT_MID }]}>
                Restore purchase
              </Text>
            )}
          </Pressable>

          <Text style={[styles.legal, { color: TEXT_MID }]}>
            Purchases are processed securely. Subscriptions renew automatically unless cancelled.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  grassBorder: {
    width: "100%",
    height: 140,
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  butterfly: {
    position: "absolute",
    right: 56,
    width: 32,
    height: 32,
    zIndex: 5,
  },
  scroll: {
    paddingHorizontal: 28,
    paddingTop: 24,
    gap: 0,
  },
  headline: {
    fontFamily: "PatrickHand_400Regular",
    fontSize: 30,
    color: "#3e4a3d",
    textAlign: "center",
    lineHeight: 38,
    marginBottom: 12,
  },
  subText: {
    fontFamily: "Fredoka_500Medium",
    fontSize: 14,
    color: "#6b7669",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  features: {
    gap: 12,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  leafDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(74,124,89,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  leafEmoji: {
    fontSize: 13,
  },
  featureTitle: {
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 15,
    marginBottom: 2,
  },
  featureBody: {
    fontFamily: "Fredoka_500Medium",
    fontSize: 13,
    lineHeight: 19,
  },
  cta: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  ctaText: {
    color: "#fff",
    fontFamily: "Fredoka_700Bold",
    fontSize: 17,
  },
  restore: {
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 16,
  },
  restoreText: {
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
