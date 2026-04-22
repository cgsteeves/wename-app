import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PremiumModal } from "@/components/PremiumModal";
import { SubPageHeader } from "@/components/SubPageHeader";
import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

const BENEFITS = [
  "Access to 10,000+ more names",
  "AI name suggestions tailored to you",
  "Unlimited daily swipes and likes",
  "More name filtering — trendy, celeb, traditional, religious, and more",
  "Recommendations based on your current children's names",
];

export default function PremiumScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const isPremium = user.plan_tier === "premium";

  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment }}>
      <SubPageHeader title="Premium" subtitle="Unlock everything" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90, gap: 16 }}>
        <View
          style={[
            styles.currentPlan,
            { backgroundColor: colors.card, borderColor: "#fcd34d99" },
          ]}
        >
          <View style={[styles.starBadge, { backgroundColor: "#fef3c7" }]}>
            <Feather name="star" size={20} color="#d97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.displayBold, fontSize: 14, color: colors.foreground }}>
              Current Plan
            </Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
              {isPremium ? "Premium — all features unlocked" : "Free — basic features"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.benefitsCard,
            { backgroundColor: "#fffbeb", borderColor: "#fcd34d99" },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Feather name="zap" size={18} color="#d97706" />
            <Text style={{ fontFamily: fonts.displayBold, fontSize: 16, color: colors.foreground }}>
              Premium Benefits
            </Text>
          </View>
          {BENEFITS.map((b) => (
            <View key={b} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
              <View style={[styles.checkBadge, { backgroundColor: "#fef3c7" }]}>
                <Feather name="check" size={11} color="#d97706" />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonts.display,
                  fontSize: 13,
                  color: colors.foreground + "cc",
                  lineHeight: 20,
                }}
              >
                {b}
              </Text>
            </View>
          ))}
        </View>

        {isPremium ? (
          <View style={[styles.successRow, { backgroundColor: "#fffbeb", borderColor: "#fcd34d99" }]}>
            <Feather name="star" size={16} color="#d97706" />
            <Text style={{ fontFamily: fonts.displayBold, color: "#92400e", fontSize: 14 }}>
              You are on Premium
            </Text>
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => setOpen(true)}
              style={({ pressed }) => [
                styles.upgradeBtn,
                { backgroundColor: "#f59e0b", opacity: pressed ? 0.92 : 1 },
              ]}
            >
              <Feather name="zap" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: fonts.displayBold, fontSize: 16 }}>
                Upgrade to Premium
              </Text>
            </Pressable>
            <Pressable
              style={[styles.restoreBtn, { backgroundColor: colors.card, borderColor: colors.border + "99" }]}
            >
              <Text style={{ color: colors.mutedForeground, fontFamily: fonts.displayMedium, fontSize: 14 }}>
                Restore purchase
              </Text>
            </Pressable>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 10,
                color: colors.mutedForeground,
                textAlign: "center",
                paddingHorizontal: 16,
                lineHeight: 16,
              }}
            >
              Purchases are processed securely. Subscriptions renew automatically unless cancelled.
            </Text>
          </>
        )}
      </ScrollView>
      <PremiumModal open={open} limitType={null} onClose={() => setOpen(false)} onUpgrade={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  currentPlan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  starBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitsCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  upgradeBtn: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreBtn: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  successRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
