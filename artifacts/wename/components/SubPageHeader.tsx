import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

export function SubPageHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 12,
          backgroundColor: colors.parchment,
          borderBottomColor: colors.border + "55",
        },
      ]}
    >
      <Pressable
        onPress={() => (onBack ? onBack() : router.back())}
        style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        hitSlop={10}
      >
        <Feather name="chevron-left" size={20} color={colors.foreground} />
      </Pressable>
      <View style={styles.titleWrap}>
        <Text
          style={{ fontFamily: fonts.displayBold, fontSize: 18, color: colors.foreground }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            style={{
              fontFamily: fonts.hand,
              fontSize: 13,
              color: colors.mutedForeground,
              marginTop: 1,
              ...(Platform.OS !== "android" && { fontStyle: "italic" as const }),
            }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <View style={{ width: 36 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: { flex: 1, alignItems: "center" },
});
