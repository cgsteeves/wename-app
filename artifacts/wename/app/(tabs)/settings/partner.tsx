import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
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

export default function PartnerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, removePartner, linkPartnerByCode } = useUser();
  const [code, setCode] = useState("");
  const [linking, setLinking] = useState(false);
  const isBoy = !user || user.baby_gender !== "girl";
  const accent = isBoy ? colors.boy : colors.girlPink;

  if (!user) return null;

  async function copy() {
    await Clipboard.setStringAsync(user!.invite_code);
    Alert.alert("Copied", `Code ${user!.invite_code} copied`);
  }

  async function share() {
    await Share.share({
      message: `Join me on WeName to pick a baby name together! My code is ${user!.invite_code}`,
    });
  }

  async function link() {
    setLinking(true);
    const res = await linkPartnerByCode(code);
    setLinking(false);
    if (!res.ok) return Alert.alert("Could not link", res.error ?? "Unknown error");
    setCode("");
    Alert.alert("Linked!", "You're now connected with your partner.");
  }

  async function unlink() {
    Alert.alert("Unlink partner?", "This will also delete all your matches.", [
      { text: "Cancel", style: "cancel" },
      { text: "Unlink", style: "destructive", onPress: () => removePartner() },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment }}>
      <SubPageHeader title="Partner" subtitle="Connect to swipe together" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90, gap: 16 }}>
        {user.partner_id ? (
          <View
            style={[
              styles.linkedCard,
              { backgroundColor: colors.grass + "1a", borderColor: colors.grass + "55" },
            ]}
          >
            <Feather name="check-circle" size={20} color={colors.grass} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.displayBold, color: colors.foreground, fontSize: 15 }}>
                Connected with your partner
              </Text>
              <Text style={{ fontFamily: fonts.display, color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                Matches will appear when you both like the same name.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border + "99" },
              ]}
            >
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Your invite code</Text>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <View style={[styles.codeBox, { borderColor: colors.border, backgroundColor: colors.parchment }]}>
                  <Text
                    style={{
                      fontSize: 24,
                      fontFamily: fonts.displayBold,
                      letterSpacing: 4,
                      color: colors.foreground,
                    }}
                  >
                    {user.invite_code}
                  </Text>
                </View>
                <Pressable onPress={copy} style={[styles.iconBtn, { backgroundColor: accent }]}>
                  <Feather name="copy" size={16} color="#fff" />
                </Pressable>
              </View>
              <Pressable
                onPress={share}
                style={[styles.shareBtn, { backgroundColor: accent }]}
              >
                <Feather name="share-2" size={15} color="#fff" />
                <Text style={{ color: "#fff", fontFamily: fonts.displayBold, fontSize: 14 }}>
                  Share Link
                </Text>
              </Pressable>
            </View>

            <Text style={{ textAlign: "center", color: colors.mutedForeground, fontFamily: fonts.display, fontSize: 12 }}>
              — or enter a code —
            </Text>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                placeholder="PARTNER CODE"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
                maxLength={8}
                style={[
                  styles.input,
                  {
                    borderColor: colors.border,
                    color: colors.foreground,
                    flex: 1,
                    letterSpacing: 4,
                    textAlign: "center",
                  },
                ]}
              />
              <Pressable
                onPress={link}
                disabled={linking || code.length === 0}
                style={[
                  styles.joinBtn,
                  {
                    backgroundColor: colors.boy,
                    opacity: linking || code.length === 0 ? 0.5 : 1,
                  },
                ]}
              >
                <Feather name="link-2" size={14} color="#fff" />
                <Text style={{ color: "#fff", fontFamily: fonts.displayBold, fontSize: 14 }}>
                  {linking ? "..." : "Join"}
                </Text>
              </Pressable>
            </View>

            <Text
              style={{
                textAlign: "center",
                color: colors.mutedForeground,
                fontFamily: fonts.display,
                fontSize: 12,
                paddingHorizontal: 16,
                marginTop: 4,
                lineHeight: 18,
              }}
            >
              You'll see a match whenever you and your partner both swipe right on the same name.
            </Text>
          </>
        )}

        {user.partner_id && (
          <Pressable
            onPress={unlink}
            style={[styles.unlinkBtn, { borderColor: colors.destructive + "55", backgroundColor: colors.destructive + "0d" }]}
          >
            <Feather name="user-x" size={16} color={colors.destructive} />
            <Text style={{ color: colors.destructive, fontFamily: fonts.displaySemibold, fontSize: 14 }}>
              Unlink partner
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  label: { fontSize: 12, fontFamily: fonts.display, marginBottom: 4 },
  codeBox: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtn: {
    flexDirection: "row",
    gap: 8,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    fontFamily: "monospace",
  },
  joinBtn: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    height: 48,
    borderRadius: 14,
  },
  linkedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  unlinkBtn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
});
