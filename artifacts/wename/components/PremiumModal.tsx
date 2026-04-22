import { Feather } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type LimitType = "swipe" | "like" | "match" | null;

const COPY: Record<NonNullable<LimitType>, { title: string; body: string }> = {
  swipe: {
    title: "Daily swipes used up",
    body: "You've used your 30 free swipes today. Upgrade to swipe unlimited names.",
  },
  like: {
    title: "Daily likes used up",
    body: "You've liked your 8 free names for today. Upgrade for unlimited likes.",
  },
  match: {
    title: "More matches waiting!",
    body: "You hit today's free match reveals. Upgrade to see them all.",
  },
};

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
  const copy = limitType ? COPY[limitType] : null;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.parchment, borderColor: colors.border },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.accent + "22" }]}>
            <Feather name="star" size={28} color={colors.accent} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {copy?.title ?? "Go Premium"}
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {copy?.body ?? "Unlock unlimited swipes, likes and matches."}
          </Text>
          <View style={styles.benefits}>
            {[
              "Unlimited swipes & likes",
              "Unlimited match reveals",
              "All premium name packs",
              "AI name suggestions",
            ].map((b) => (
              <View key={b} style={styles.benefit}>
                <Feather name="check" size={16} color={colors.grass} />
                <Text style={[styles.benefitText, { color: colors.foreground }]}>{b}</Text>
              </View>
            ))}
          </View>
          <Pressable
            style={[styles.cta, { backgroundColor: colors.accent }]}
            onPress={onUpgrade}
          >
            <Text style={styles.ctaText}>Upgrade to Premium</Text>
          </Pressable>
          <Pressable style={styles.dismiss} onPress={onClose}>
            <Text style={[styles.dismissText, { color: colors.mutedForeground }]}>
              Maybe later
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    alignItems: "center",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  body: { fontSize: 14, textAlign: "center", marginBottom: 16, lineHeight: 20 },
  benefits: { alignSelf: "stretch", gap: 8, marginBottom: 18 },
  benefit: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitText: { fontSize: 14 },
  cta: {
    alignSelf: "stretch",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  dismiss: { paddingVertical: 12 },
  dismissText: { fontSize: 14 },
});
