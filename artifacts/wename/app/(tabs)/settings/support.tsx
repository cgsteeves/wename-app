import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SubPageHeader } from "@/components/SubPageHeader";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

export default function SupportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment }}>
      <SubPageHeader title="Support" subtitle="Help & legal" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90, gap: 16 }}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border + "99" },
          ]}
        >
          <Row
            icon="mail"
            label="Contact Support"
            colors={colors}
            onPress={() => Linking.openURL("mailto:wenameapp@gmail.com")}
          />
        </View>

        <Text
          style={{
            fontFamily: fonts.displaySemibold,
            fontSize: 11,
            letterSpacing: 1.4,
            color: colors.mutedForeground,
            marginTop: 8,
            marginLeft: 4,
          }}
        >
          LEGAL
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border + "99" },
          ]}
        >
          <Row
            icon="lock"
            label="Privacy Policy"
            url="wename.app/privacy"
            colors={colors}
            onPress={() => router.push("/privacy")}
          />
          <View style={[styles.divider, { backgroundColor: colors.border + "60" }]} />
          <Row
            icon="file-text"
            label="Terms of Service"
            url="wename.app/terms"
            colors={colors}
            onPress={() => router.push("/terms")}
          />
        </View>

        <View
          style={[
            styles.versionCard,
            { backgroundColor: colors.card, borderColor: colors.border + "99" },
          ]}
        >
          <View style={[styles.iconBadge, { backgroundColor: colors.muted }]}>
            <Feather name="info" size={16} color={colors.mutedForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.displaySemibold, fontSize: 14, color: colors.foreground }}>
              App Version
            </Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
              1.0.0
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 12,
            color: colors.mutedForeground,
            textAlign: "center",
            marginTop: 8,
          }}
        >
          WeName — made with love for growing families
        </Text>
      </ScrollView>
    </View>
  );
}

function Row({
  icon,
  label,
  url,
  colors,
  onPress,
}: {
  icon: keyof typeof import("@expo/vector-icons").Feather.glyphMap;
  label: string;
  url?: string;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.row, url ? { height: 60 } : {}]}>
      <Feather name={icon} size={16} color={colors.mutedForeground} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.displaySemibold, fontSize: 14, color: colors.foreground }}>
          {label}
        </Text>
        {url && (
          <Text style={{ fontFamily: fonts.display, fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>
            {url}
          </Text>
        )}
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    height: 52,
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 44 },
  versionCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
