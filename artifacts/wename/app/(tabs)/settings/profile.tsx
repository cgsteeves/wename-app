import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SubPageHeader } from "@/components/SubPageHeader";
import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { FREE_LIMITS } from "@/hooks/useDailyLimits";

type Gender = "boy" | "girl" | "either";

export default function ProfileScreen() {
  const colors = useColors();
  const { user, updateUser } = useUser();
  const insets = useSafeAreaInsets();
  const [lastName, setLastName] = useState(user?.baby_last_name ?? "");

  useEffect(() => {
    setLastName(user?.baby_last_name ?? "");
  }, [user?.baby_last_name]);

  if (!user) return null;
  const isPremium = user.plan_tier === "premium";

  async function setGender(g: Gender) {
    await updateUser({ baby_gender: g });
  }

  async function saveLastName() {
    await updateUser({ baby_last_name: lastName.trim() || null });
    Alert.alert("Saved", "Last name updated");
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment }}>
      <SubPageHeader title="Profile" subtitle="About you and baby" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90, gap: 18 }}
      >
        <Card colors={colors} title="DAILY USAGE">
          <View style={styles.usageRow}>
            <Stat label="Swipes" value={user.daily_swipe_count ?? 0} max={FREE_LIMITS.swipes} pro={isPremium} c={colors.primary} />
            <Stat label="Likes" value={user.daily_like_count ?? 0} max={FREE_LIMITS.likes} pro={isPremium} c={colors.heart} />
            <Stat label="Matches" value={user.daily_match_count ?? 0} max={FREE_LIMITS.matches} pro={isPremium} c={colors.accent} />
          </View>
        </Card>

        <Card colors={colors} title="BABY GENDER PREFERENCE">
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["boy", "girl", "either"] as const).map((g) => {
              const active = user.baby_gender === g;
              const c = g === "boy" ? colors.boy : g === "girl" ? colors.girlPink : colors.either;
              const emoji = g === "boy" ? "👦" : g === "girl" ? "👧" : "✨";
              return (
                <Pressable
                  key={g}
                  onPress={() => setGender(g)}
                  style={[
                    styles.genderBtn,
                    {
                      backgroundColor: active ? c : "rgba(255,255,255,0.6)",
                      borderColor: active ? c : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? "#fff" : colors.mutedForeground,
                      fontFamily: fonts.displaySemibold,
                      fontSize: 14,
                    }}
                  >
                    {emoji} {g[0].toUpperCase() + g.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card colors={colors} title="BABY'S LAST NAME (OPTIONAL)">
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Enter or skip for now"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.foreground, flex: 1 },
              ]}
            />
            <Pressable
              onPress={saveLastName}
              style={[styles.btn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.btnText}>Save</Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

function Card({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontFamily: fonts.displaySemibold,
          fontSize: 11,
          letterSpacing: 1.4,
          color: colors.mutedForeground,
          marginLeft: 4,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border + "99",
          borderWidth: 1,
          borderRadius: 16,
          padding: 14,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Stat({ label, value, max, pro, c }: { label: string; value: number; max: number; pro: boolean; c: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: c, fontSize: 22, fontFamily: fonts.displayBold }}>
        {pro ? "∞" : `${value}/${max}`}
      </Text>
      <Text style={{ color: "#7a6a52", fontSize: 12, fontFamily: fonts.display }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  usageRow: { flexDirection: "row", justifyContent: "space-around" },
  genderBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fonts.display,
  },
  btn: {
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  btnText: { color: "#fff", fontFamily: fonts.displayBold, fontSize: 14 },
});
