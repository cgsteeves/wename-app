import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

type Row = {
  key: string;
  label: string;
  hint: string;
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  iconColor: string;
  href: string;
};

export default function SettingsHub() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const isPremium = user?.plan_tier === "premium";
  const partnerHint = user?.partner_id ? "Connected" : "Not linked";
  const profileHint = user?.display_name ? user.display_name : "Set up your profile";

  const rows: Row[] = [
    {
      key: "profile",
      label: "Profile",
      hint: profileHint,
      icon: "user",
      iconBg: "#dbeafe",
      iconColor: "#2563eb",
      href: "/settings/profile",
    },
    {
      key: "partner",
      label: "Partner",
      hint: partnerHint,
      icon: "users",
      iconBg: "#ffe4e6",
      iconColor: "#e11d48",
      href: "/settings/partner",
    },
    {
      key: "name-packs",
      label: "Name Packs",
      hint: "Pick your name themes",
      icon: "package",
      iconBg: "#dcfce7",
      iconColor: "#16a34a",
      href: "/settings/name-packs",
    },
    {
      key: "premium",
      label: "Premium",
      hint: isPremium ? "Active" : "Unlock everything",
      icon: "star",
      iconBg: "#fef3c7",
      iconColor: "#d97706",
      href: "/settings/premium",
    },
    {
      key: "account",
      label: "Account",
      hint: "Reset or sign out",
      icon: "shield",
      iconBg: "#e2e8f0",
      iconColor: "#475569",
      href: "/settings/account",
    },
    {
      key: "support",
      label: "Support",
      hint: "Help, privacy, version",
      icon: "help-circle",
      iconBg: "#ccfbf1",
      iconColor: "#0d9488",
      href: "/settings/support",
    },
    {
      key: "feedback",
      label: "Leave Feedback",
      hint: "Tell us what you think",
      icon: "message-square",
      iconBg: "#ede9fe",
      iconColor: "#7c3aed",
      href: "/settings/feedback",
    },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.parchment }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 90,
        paddingHorizontal: 16,
      }}
    >
      <View style={styles.headerWrap}>
        <Text style={[styles.title, { color: colors.grass }]}>🌿 Settings ☀️</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Customize your experience
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border + "99" },
        ]}
      >
        {rows.map((row, i) => (
          <Pressable
            key={row.key}
            onPress={() => router.push(row.href as never)}
            style={({ pressed }) => [
              styles.row,
              i > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border + "60",
              },
              pressed && { backgroundColor: colors.muted + "55" },
            ]}
          >
            <View style={[styles.iconBadge, { backgroundColor: row.iconBg }]}>
              <Feather name={row.icon} size={18} color={row.iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: fonts.displaySemibold,
                  fontSize: 15,
                  color: colors.foreground,
                }}
              >
                {row.label}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: 12,
                  color: colors.mutedForeground,
                  marginTop: 1,
                }}
                numberOfLines={1}
              >
                {row.hint}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>

      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: 12,
          color: colors.mutedForeground,
          textAlign: "center",
          marginTop: 24,
        }}
      >
        WeName — made with love for growing families
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerWrap: { alignItems: "center", marginBottom: 18 },
  title: { fontSize: 30, fontFamily: fonts.hand, lineHeight: 38 },
  subtitle: { fontSize: 14, fontFamily: fonts.hand, marginTop: 2, fontStyle: "italic" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
