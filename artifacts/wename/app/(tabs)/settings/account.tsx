import { Feather } from "@expo/vector-icons";
import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SubPageHeader } from "@/components/SubPageHeader";
import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOutLocal } = useUser();
  if (!user) return null;

  function reset() {
    Alert.alert(
      "Reset device data?",
      "This clears your stored device ID. Your data on the server is kept, but you'll start fresh on this device.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: () => signOutLocal() },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment }}>
      <SubPageHeader title="Account" subtitle="Manage your data" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90, gap: 16 }}>
        <View
          style={[
            styles.guestCard,
            { backgroundColor: colors.card, borderColor: colors.border + "99" },
          ]}
        >
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={[styles.iconBadge, { backgroundColor: "#e2e8f0" }]}>
              <Feather name="shield" size={18} color="#475569" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 14, color: colors.foreground }}>
                Guest Mode
              </Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                Your names are saved on this device
              </Text>
            </View>
          </View>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 13,
              color: colors.mutedForeground,
              lineHeight: 20,
              marginTop: 12,
            }}
          >
            Your invite code is {user.invite_code}. Share it with your partner to swipe together.
          </Text>
        </View>

        <View style={[styles.sectionLabel]}>
          <Text
            style={{
              fontFamily: fonts.displaySemibold,
              fontSize: 11,
              letterSpacing: 1.4,
              color: colors.mutedForeground,
            }}
          >
            DEVICE
          </Text>
        </View>
        <View
          style={[
            styles.actionsCard,
            { backgroundColor: colors.card, borderColor: colors.border + "99" },
          ]}
        >
          <Pressable onPress={reset} style={styles.actionRow}>
            <Feather name="rotate-ccw" size={16} color={colors.mutedForeground} />
            <Text style={{ flex: 1, fontFamily: fonts.displaySemibold, fontSize: 14, color: colors.foreground }}>
              Reset device data
            </Text>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <Text
          style={{
            fontFamily: fonts.displaySemibold,
            fontSize: 11,
            letterSpacing: 1.4,
            color: colors.mutedForeground,
            marginLeft: 4,
            marginTop: 8,
          }}
        >
          DANGER ZONE
        </Text>
        <Pressable
          style={[
            styles.dangerBtn,
            { borderColor: colors.destructive + "55", backgroundColor: colors.destructive + "0d" },
          ]}
          onPress={() =>
            Alert.alert("Delete account?", "Account deletion is currently handled via support. Email hello@wename.app to request deletion.")
          }
        >
          <Feather name="trash-2" size={14} color={colors.destructive} />
          <Text style={{ color: colors.destructive, fontFamily: fonts.displaySemibold, fontSize: 14 }}>
            Delete Account
          </Text>
        </Pressable>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 11,
            color: colors.mutedForeground,
            lineHeight: 18,
            paddingHorizontal: 4,
          }}
        >
          This will permanently delete your account and all associated data.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  guestCard: { padding: 16, borderRadius: 16, borderWidth: 1 },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: { paddingHorizontal: 4 },
  actionsCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    height: 52,
  },
  dangerBtn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
  },
});
