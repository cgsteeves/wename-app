import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { SubPageHeader } from "@/components/SubPageHeader";
import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { supabase } from "@/lib/supabase";

// ─── Design tokens ───────────────────────────────────────────────────────────
const PARCHMENT      = "#ede0c8";
const CARD_BG        = "#ede5d4";
const INPUT_BG       = "#f2ece1";
const FOREGROUND     = "#3d2e20";
const MUTED_FG       = "#857d74";
const MUTED_BG       = "#dfd6c8";
const BORDER         = "#cec5b9";
const BORDER_60      = "rgba(206,197,185,0.6)";
const BORDER_50      = "rgba(206,197,185,0.5)";
const BOY_BLUE       = "#3a71b5";
const GIRL_PINK      = "#c04070";
const EITHER_ORANGE  = "#f07e29";
const DESTRUCTIVE    = "#d63030";
const DESTRUCTIVE_30 = "rgba(214,48,48,0.30)";
const DESTRUCTIVE_05 = "rgba(214,48,48,0.05)";

type Gender = "boy" | "girl" | "either";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useUser();

  const [displayName, setDisplayName]   = useState(user?.display_name    ?? "");
  const [babyLastName, setBabyLastName] = useState(user?.baby_last_name  ?? "");
  const [babyGender, setBabyGender]     = useState<Gender>((user?.baby_gender as Gender) ?? "either");
  const [saving, setSaving]             = useState(false);
  const [saved,  setSaved]              = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state in sync if user object refreshes (e.g. partner updates)
  useEffect(() => {
    setDisplayName(user?.display_name   ?? "");
    setBabyLastName(user?.baby_last_name ?? "");
    setBabyGender((user?.baby_gender as Gender) ?? "either");
  }, [user?.display_name, user?.baby_last_name, user?.baby_gender]);

  if (!user) return null;

  const hasChanges =
    displayName   !== (user.display_name    ?? "")  ||
    babyLastName  !== (user.baby_last_name  ?? "")  ||
    babyGender    !==  user.baby_gender;

  // ─── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!hasChanges || saving) return;
    setSaving(true);
    try {
      await updateUser({
        display_name:    displayName    || null,
        baby_last_name:  babyLastName   || null,
        baby_gender:     babyGender,
      });
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("[Profile] save error", e);
    } finally {
      setSaving(false);
    }
  }

  // ─── Reset swipes ─────────────────────────────────────────────────────────
  async function handleResetSwipes() {
    Alert.alert(
      "Reset All Swipes",
      "Are you sure you want to reset all your swipes? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "OK",
          style: "destructive",
          onPress: async () => {
            if (!user) return;
            try {
              const { error } = await supabase
                .from("swipes")
                .delete()
                .eq("user_id", user.id)
                .eq("liked", false);
              if (error) throw error;
              // Clear local swipe session cache
              await AsyncStorage.removeItem(`swipe_session_v2_${user.id}`);
              Alert.alert("Done", "Swipes reset successfully!", [
                {
                  text: "OK",
                  onPress: () => router.replace("/(tabs)"),
                },
              ]);
            } catch (e) {
              console.error("[Profile] reset swipes error", e);
              Alert.alert("Error", "Failed to reset swipes");
            }
          },
        },
      ],
    );
  }

  // ─── Derived button label ──────────────────────────────────────────────────
  const saveLabel = saved ? "Saved!" : saving ? "Saving…" : "Save Changes";
  const saveDisabled = !hasChanges || saving || saved;

  return (
    <View style={[styles.root, { backgroundColor: PARCHMENT }]}>
      <SubPageHeader title="Profile" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 100,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Form card ───────────────────────────────────────────────────── */}
        <View style={styles.formCard}>
          {/* Your Name */}
          <View style={styles.fieldWrap}>
            <FieldLabel text="Your Name" />
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your name"
              placeholderTextColor={MUTED_FG}
              style={[styles.input, { color: FOREGROUND }]}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>

          {/* Baby's Last Name */}
          <View style={styles.fieldWrap}>
            <FieldLabel text="Baby's Last Name" />
            <TextInput
              value={babyLastName}
              onChangeText={setBabyLastName}
              placeholder="Optional"
              placeholderTextColor={MUTED_FG}
              style={[styles.input, { color: FOREGROUND }]}
              autoCapitalize="words"
              returnKeyType="done"
            />
            <Text style={styles.inputHint}>Shown alongside names as you swipe</Text>
          </View>

          {/* Baby Gender */}
          <View style={styles.fieldWrap}>
            <FieldLabel text="Baby Gender" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["boy", "girl", "either"] as const).map((g) => {
                const active = babyGender === g;
                return (
                  <GenderButton
                    key={g}
                    label={g[0].toUpperCase() + g.slice(1)}
                    gender={g}
                    active={active}
                    onPress={() => setBabyGender(g)}
                  />
                );
              })}
            </View>
          </View>
        </View>

        {/* ── Save button ──────────────────────────────────────────────────── */}
        <Pressable
          onPress={handleSave}
          disabled={saveDisabled}
          style={({ pressed }) => [
            styles.saveBtn,
            {
              backgroundColor: saveDisabled ? MUTED_BG : BOY_BLUE,
              opacity: pressed && !saveDisabled ? 0.9 : 1,
              transform: [{ scale: pressed && !saveDisabled ? 0.97 : 1 }],
            },
          ]}
        >
          <Text
            style={[
              styles.saveBtnText,
              { color: saveDisabled ? MUTED_FG : "#fff" },
            ]}
          >
            {saveLabel}
          </Text>
        </Pressable>

        {/* ── Share Code ──────────────────────────────────────────────────── */}
        {!!user.invite_code && (
          <ShareCodeCard code={user.invite_code} />
        )}

        {/* ── Danger Zone ─────────────────────────────────────────────────── */}
        <View style={styles.dangerZone}>
          <SectionLabel text="Danger Zone" />
          <Pressable
            onPress={handleResetSwipes}
            style={({ pressed }) => [
              styles.dangerBtn,
              { transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <Feather name="rotate-ccw" size={15} color={DESTRUCTIVE} />
            <Text style={styles.dangerBtnText}>Reset All Swipes</Text>
          </Pressable>
          <Text style={styles.dangerHint}>
            This will clear all your previous swipe choices
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ShareCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <View style={styles.shareCodeCard}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.shareCodeLabel}>YOUR SHARE CODE</Text>
        <Text style={styles.shareCodeValue}>{code}</Text>
        <Text style={styles.shareCodeHint}>
          Share this with your partner so they can join you.
        </Text>
      </View>
      <Pressable
        onPress={handleCopy}
        hitSlop={10}
        style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.88 : 1 }] })}
      >
        <Feather
          name={copied ? "check" : "copy"}
          size={18}
          color={copied ? "#316b46" : MUTED_FG}
        />
      </Pressable>
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <Text style={styles.sectionLabel}>{text}</Text>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.fieldLabel}>{text}</Text>;
}

function GenderButton({
  label,
  gender,
  active,
  onPress,
}: {
  label: string;
  gender: Gender;
  active: boolean;
  onPress: () => void;
}) {
  const inactiveStyle = {
    backgroundColor: INPUT_BG,
    borderColor: BORDER,
    borderWidth: 1,
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.genderBtn,
        active ? {} : inactiveStyle,
        { transform: [{ scale: pressed ? 0.96 : 1 }] },
      ]}
    >
      {active && gender === "either" ? (
        <LinearGradient
          colors={[BOY_BLUE, GIRL_PINK, EITHER_ORANGE]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
        />
      ) : active ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: gender === "boy" ? BOY_BLUE : GIRL_PINK,
              borderRadius: 12,
            },
          ]}
        />
      ) : null}
      <Text
        style={[
          styles.genderBtnText,
          { color: active ? "#fff" : MUTED_FG },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  formCard: {
    backgroundColor: CARD_BG,
    borderColor: BORDER_60,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  sectionLabel: {
    fontFamily: fonts.displaySemibold,
    fontSize: 10,
    color: MUTED_FG,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginLeft: 4,
  },

  fieldWrap: { gap: 6 },

  fieldLabel: {
    fontFamily: fonts.displaySemibold,
    fontSize: 10,
    color: MUTED_FG,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  input: {
    backgroundColor: INPUT_BG,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.display,
    fontSize: 14,
  },

  inputHint: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: MUTED_FG,
  },

  genderBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  genderBtnText: {
    fontFamily: fonts.displaySemibold,
    fontSize: 14,
  },

  saveBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  saveBtnText: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
  },

  dangerZone: {
    borderTopWidth: 1,
    borderTopColor: BORDER_50,
    paddingTop: 16,
    gap: 8,
  },

  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DESTRUCTIVE_30,
    backgroundColor: DESTRUCTIVE_05,
  },

  dangerBtnText: {
    fontFamily: fonts.displaySemibold,
    fontSize: 14,
    color: DESTRUCTIVE,
  },

  dangerHint: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: MUTED_FG,
    textAlign: "center",
  },

  shareCodeCard: {
    backgroundColor: CARD_BG,
    borderColor: BORDER_60,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  shareCodeLabel: {
    fontFamily: fonts.displaySemibold,
    fontSize: 10,
    color: MUTED_FG,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  shareCodeValue: {
    fontFamily: "monospace",
    fontWeight: "700",
    fontSize: 20,
    color: FOREGROUND,
    letterSpacing: 4,
    marginTop: 2,
  },
  shareCodeHint: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: MUTED_FG,
    marginTop: 2,
  },

});
