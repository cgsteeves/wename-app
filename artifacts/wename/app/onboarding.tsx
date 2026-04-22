import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ImageBackground } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUser } from "@/components/UserContext";
import { useColors } from "@/hooks/useColors";
import { ONBOARDED_KEY } from "@/lib/supabase";

const onboardingBg = require("../assets/images/onboarding-bg.jpg");

type Gender = "boy" | "girl" | "either";
type Step = "welcome" | "personalize" | "tutorial";

export default function Onboarding() {
  const colors = useColors();
  const router = useRouter();
  const { user, updateUser, linkPartnerByCode } = useUser();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("welcome");
  const [gender, setGender] = useState<Gender>("either");
  const [lastName, setLastName] = useState("");
  const [partnerCode, setPartnerCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [linking, setLinking] = useState(false);

  async function finish() {
    if (user) {
      await updateUser({
        baby_gender: gender,
        baby_last_name: lastName.trim() || null,
        onboarding_complete: true,
      });
    }
    await AsyncStorage.setItem(ONBOARDED_KEY, "true");
    router.replace("/(tabs)");
  }

  async function joinByCode() {
    if (!partnerCode.trim()) return;
    setLinking(true);
    setCodeError("");
    const res = await linkPartnerByCode(partnerCode);
    setLinking(false);
    if (!res.ok) {
      setCodeError(res.error ?? "Could not link");
      return;
    }
    setStep("personalize");
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment }}>
      <ImageBackground source={onboardingBg} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(255,255,255,0.2)", "rgba(0,0,0,0.18)"]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepDots step={step} />

          {step === "welcome" && (
            <WelcomeStep
              colors={colors}
              showCode={showCode}
              setShowCode={setShowCode}
              partnerCode={partnerCode}
              setPartnerCode={setPartnerCode}
              codeError={codeError}
              linking={linking}
              onContinue={() => setStep("personalize")}
              onJoin={joinByCode}
            />
          )}

          {step === "personalize" && (
            <PersonalizeStep
              colors={colors}
              gender={gender}
              setGender={setGender}
              lastName={lastName}
              setLastName={setLastName}
              onNext={() => setStep("tutorial")}
              onSkip={() => setStep("tutorial")}
            />
          )}

          {step === "tutorial" && <TutorialStep colors={colors} onStart={finish} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ["welcome", "personalize", "tutorial"];
  const idx = order.indexOf(step);
  return (
    <View style={styles.dots}>
      {order.map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === idx
              ? { width: 24, backgroundColor: "#3a2e22" }
              : { width: 8, backgroundColor: "#d9c89c" },
          ]}
        />
      ))}
    </View>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.glassCard}>{children}</View>;
}

function PrimaryButton({
  label,
  onPress,
  color,
  disabled,
}: {
  label: string;
  onPress: () => void;
  color: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.primaryBtn,
        {
          backgroundColor: color,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

function WelcomeStep({
  colors,
  showCode,
  setShowCode,
  partnerCode,
  setPartnerCode,
  codeError,
  linking,
  onContinue,
  onJoin,
}: {
  colors: ReturnType<typeof useColors>;
  showCode: boolean;
  setShowCode: (v: boolean) => void;
  partnerCode: string;
  setPartnerCode: (v: string) => void;
  codeError: string;
  linking: boolean;
  onContinue: () => void;
  onJoin: () => void;
}) {
  return (
    <View style={styles.stepContent}>
      <View style={{ height: 32 }} />
      <GlassCard>
        <View style={styles.logoCircle}>
          <Feather name="heart" size={32} color={colors.heart} />
        </View>
        <Text style={styles.welcomeTitle}>Welcome to WeName</Text>
        <Text style={[styles.welcomeSub, { color: colors.accent }]}>
          Find Your Baby Name Together
        </Text>
        <Text style={styles.welcomeBody}>
          Swipe names you love, match with your partner, and build a shortlist together.
        </Text>
      </GlassCard>

      <View style={{ flex: 1, minHeight: 24 }} />

      <PrimaryButton label="Get started" onPress={onContinue} color={colors.primary} />

      {!showCode ? (
        <Pressable style={styles.secondaryBtn} onPress={() => setShowCode(true)}>
          <Text style={styles.secondaryBtnText}>I already have a partner code</Text>
        </Pressable>
      ) : (
        <View style={{ marginTop: 12, gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={partnerCode}
              onChangeText={(v) => setPartnerCode(v.toUpperCase())}
              placeholder="PARTNER CODE"
              placeholderTextColor="#a89878"
              autoCapitalize="characters"
              maxLength={8}
              style={styles.codeInput}
            />
            <PrimaryButton
              label={linking ? "..." : "Join"}
              onPress={onJoin}
              color={colors.accent}
              disabled={linking || partnerCode.length === 0}
            />
          </View>
          {!!codeError && (
            <Text style={{ color: colors.destructive, textAlign: "center" }}>
              {codeError}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function PersonalizeStep({
  colors,
  gender,
  setGender,
  lastName,
  setLastName,
  onNext,
  onSkip,
}: {
  colors: ReturnType<typeof useColors>;
  gender: Gender;
  setGender: (g: Gender) => void;
  lastName: string;
  setLastName: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const opts: { value: Gender; label: string; bg: string }[] = [
    { value: "boy", label: "Boy", bg: colors.boy },
    { value: "girl", label: "Girl", bg: colors.girl },
    { value: "either", label: "Either", bg: colors.either },
  ];
  return (
    <View style={styles.stepContent}>
      <Text style={styles.heading}>Tell us a bit about your little one</Text>
      <View style={{ height: 24 }} />
      <GlassCard>
        <Text style={styles.label}>Baby gender preference</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {opts.map((o) => {
            const active = gender === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => setGender(o.value)}
                style={[
                  styles.genderBtn,
                  active
                    ? { backgroundColor: o.bg, borderColor: o.bg }
                    : { backgroundColor: "rgba(255,255,255,0.7)", borderColor: "#d9c89c" },
                ]}
              >
                <Text
                  style={{
                    color: active ? "#fff" : "#7a6a52",
                    fontWeight: "600",
                  }}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ height: 16 }} />
        <Text style={styles.label}>Baby's last name (optional)</Text>
        <TextInput
          value={lastName}
          onChangeText={setLastName}
          placeholder="Enter or skip for now"
          placeholderTextColor="#a89878"
          style={styles.textInput}
        />
      </GlassCard>
      <View style={{ flex: 1, minHeight: 24 }} />
      <PrimaryButton label="Next" onPress={onNext} color={colors.primary} />
      <Pressable style={styles.secondaryBtn} onPress={onSkip}>
        <Text style={styles.secondaryBtnText}>Skip</Text>
      </Pressable>
    </View>
  );
}

function TutorialStep({
  colors,
  onStart,
}: {
  colors: ReturnType<typeof useColors>;
  onStart: () => void;
}) {
  const items: {
    icon: keyof typeof Feather.glyphMap;
    text: string;
    color: string;
  }[] = [
    { icon: "arrow-right", text: "Swipe right to like", color: colors.grass },
    { icon: "arrow-left", text: "Swipe left to pass", color: colors.heart },
    {
      icon: "heart",
      text: "If your partner likes the same name, it becomes a match",
      color: colors.girl,
    },
    {
      icon: "list",
      text: "Add names manually and rank your favorites",
      color: colors.sun,
    },
    {
      icon: "settings",
      text: "Connect with your partner and tweak preferences",
      color: colors.mutedForeground,
    },
  ];
  return (
    <View style={styles.stepContent}>
      <Text style={styles.heading}>How it works</Text>
      <View style={{ height: 16 }} />
      <View style={{ gap: 10 }}>
        {items.map((it, i) => (
          <View key={i} style={styles.tutorialRow}>
            <View style={[styles.tutorialIcon, { backgroundColor: it.color + "22" }]}>
              <Feather name={it.icon} size={18} color={it.color} />
            </View>
            <Text style={styles.tutorialText}>{it.text}</Text>
          </View>
        ))}
      </View>
      <View style={{ flex: 1, minHeight: 24 }} />
      <PrimaryButton label="Start swiping" onPress={onStart} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    minHeight: "100%",
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 24 },
  dot: { height: 8, borderRadius: 4 },
  stepContent: { flex: 1, minHeight: 540 },
  glassCard: {
    backgroundColor: "rgba(255,255,255,0.78)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fdf7e6",
    borderWidth: 1,
    borderColor: "#d9c89c",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#3a2e22",
    textAlign: "center",
  },
  welcomeSub: { fontSize: 16, fontWeight: "600", textAlign: "center", marginTop: 4 },
  welcomeBody: {
    fontSize: 14,
    color: "#7a6a52",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#3a2e22",
    textAlign: "center",
  },
  label: {
    fontSize: 13,
    color: "#7a6a52",
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 8,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  textInput: {
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "#d9c89c",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#3a2e22",
    textAlign: "center",
  },
  codeInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "#d9c89c",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    letterSpacing: 4,
    textAlign: "center",
    color: "#3a2e22",
  },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d9c89c",
  },
  secondaryBtnText: { color: "#3a2e22", fontWeight: "500" },
  tutorialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  tutorialIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tutorialText: { flex: 1, fontSize: 14, color: "#3a2e22", lineHeight: 19 },
});
