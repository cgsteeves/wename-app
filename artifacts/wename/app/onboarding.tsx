import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image, ImageBackground } from "expo-image";
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
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { ONBOARDED_KEY } from "@/lib/supabase";

const welcomeBg = require("../assets/images/onboarding-welcome-bg.jpg");
const personalizeBg = require("../assets/images/onboarding-personalize-bg.jpg");
const tutorialBg = require("../assets/images/onboarding-tutorial-bg.jpg");
const logo = require("../assets/images/wename-logo.png");

type Gender = "boy" | "girl" | "either";
type Step = "welcome" | "personalize" | "tutorial";

const stepBg: Record<Step, any> = {
  welcome: welcomeBg,
  personalize: personalizeBg,
  tutorial: tutorialBg,
};

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
      <ImageBackground source={stepBg[step]} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(249,241,222,0.35)", "rgba(249,241,222,0.55)"]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
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
              ? { width: 28, backgroundColor: "hsl(25, 30%, 20%)" }
              : { width: 8, backgroundColor: "hsl(35, 22%, 70%)" },
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
      <View style={{ height: 16 }} />
      <GlassCard>
        <Image source={logo} style={styles.logo} contentFit="contain" />
        <Text style={[styles.welcomeTitle, { color: colors.grass }]}>Welcome to WeName</Text>
        <Text style={[styles.welcomeSub, { color: colors.accent }]}>
          Find Your Baby Name Together
        </Text>
        <Text style={styles.welcomeBody}>
          Swipe names you love, match with your partner, and build a shortlist together.
        </Text>
      </GlassCard>

      <View style={{ flex: 1, minHeight: 24 }} />

      <PrimaryButton label="Get started" onPress={onContinue} color={colors.grass} />

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
              placeholderTextColor="hsl(25, 12%, 60%)"
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
            <Text
              style={{
                color: colors.destructive,
                textAlign: "center",
                fontFamily: fonts.display,
              }}
            >
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
    { value: "girl", label: "Girl", bg: colors.girlPink },
    { value: "either", label: "Either", bg: colors.either },
  ];
  return (
    <View style={styles.stepContent}>
      <Text style={[styles.heading, { color: colors.grass }]}>
        Tell us about your little one
      </Text>
      <View style={{ height: 18 }} />
      <GlassCard>
        <Text style={styles.handLabel}>Baby gender preference</Text>
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
                    : { backgroundColor: "rgba(255,255,255,0.7)", borderColor: colors.border },
                ]}
              >
                <Text
                  style={{
                    color: active ? "#fff" : "hsl(25, 12%, 48%)",
                    fontFamily: fonts.displaySemibold,
                    fontSize: 15,
                  }}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ height: 16 }} />
        <Text style={styles.handLabel}>Baby's last name (optional)</Text>
        <TextInput
          value={lastName}
          onChangeText={setLastName}
          placeholder="Enter or skip for now"
          placeholderTextColor="hsl(25, 12%, 60%)"
          style={styles.textInput}
        />
      </GlassCard>
      <View style={{ flex: 1, minHeight: 24 }} />
      <PrimaryButton label="Next" onPress={onNext} color={colors.grass} />
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
      color: colors.girlPink,
    },
    {
      icon: "list",
      text: "Add names manually and rank your favorites",
      color: colors.sun,
    },
    {
      icon: "settings",
      text: "Connect with your partner and tweak preferences",
      color: colors.boy,
    },
  ];
  return (
    <View style={styles.stepContent}>
      <Text style={[styles.heading, { color: colors.grass }]}>How it works</Text>
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
      <PrimaryButton label="Start swiping" onPress={onStart} color={colors.grass} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 22, minHeight: "100%" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 18 },
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
  logo: {
    width: 110,
    height: 110,
    alignSelf: "center",
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 30,
    fontFamily: fonts.displayBold,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  welcomeSub: {
    fontSize: 16,
    fontFamily: fonts.displaySemibold,
    textAlign: "center",
    marginTop: 4,
  },
  welcomeBody: {
    fontSize: 14,
    color: "hsl(25, 12%, 48%)",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
    fontFamily: fonts.display,
  },
  heading: {
    fontSize: 24,
    fontFamily: fonts.displayBold,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  handLabel: {
    fontSize: 17,
    fontFamily: "PatrickHand_400Regular",
    fontStyle: "italic",
    color: "hsl(25, 12%, 48%)",
    textAlign: "center",
    marginBottom: 8,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  textInput: {
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: "hsl(35, 22%, 80%)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "hsl(25, 30%, 20%)",
    textAlign: "center",
    fontFamily: fonts.display,
  },
  codeInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: "hsl(35, 22%, 80%)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    letterSpacing: 4,
    textAlign: "center",
    color: "hsl(25, 30%, 20%)",
    fontFamily: fonts.displaySemibold,
  },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryBtnText: {
    color: "#fff",
    fontFamily: fonts.displaySemibold,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  secondaryBtnText: {
    color: "hsl(25, 30%, 25%)",
    fontFamily: fonts.displayMedium,
    fontSize: 14,
  },
  tutorialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderRadius: 14,
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
  tutorialText: {
    flex: 1,
    fontSize: 14,
    color: "hsl(25, 30%, 25%)",
    lineHeight: 19,
    fontFamily: fonts.display,
  },
});
