import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image, ImageBackground } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
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
type Step = "welcome" | "personalize" | "features" | "partner";

const stepBg: Record<Step, any> = {
  welcome: welcomeBg,
  personalize: personalizeBg,
  features: tutorialBg,
  partner: tutorialBg,
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
  const [codeError, setCodeError] = useState("");
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(!!user?.partner_id);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY).then((v) => {
      if (v === "true") router.replace("/(tabs)");
    });
  }, []);

  useEffect(() => {
    if (user?.onboarding_complete) router.replace("/(tabs)");
  }, [user?.onboarding_complete]);

  useEffect(() => {
    if (user?.partner_id) setLinked(true);
  }, [user?.partner_id]);

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
    setLinked(true);
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
              onContinue={() => setStep("personalize")}
              onSkip={finish}
            />
          )}

          {step === "personalize" && (
            <PersonalizeStep
              colors={colors}
              gender={gender}
              setGender={setGender}
              lastName={lastName}
              setLastName={setLastName}
              onNext={() => setStep("features")}
              onSkip={() => setStep("features")}
            />
          )}

          {step === "features" && (
            <FeaturesStep colors={colors} onNext={() => setStep("partner")} />
          )}

          {step === "partner" && (
            <PartnerStep
              colors={colors}
              inviteCode={user?.invite_code ?? ""}
              partnerCode={partnerCode}
              setPartnerCode={setPartnerCode}
              codeError={codeError}
              linking={linking}
              linked={linked}
              onJoin={joinByCode}
              onDone={finish}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ["welcome", "personalize", "features", "partner"];
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
  return (
    <View
      style={[
        styles.glassCard,
        Platform.OS === "android" && {
          borderWidth: 2,
          borderColor: "rgba(255,255,255,0.85)",
          borderRadius: 28,
        },
      ]}
    >
      {children}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  color,
  disabled,
  compact,
}: {
  label: string;
  onPress: () => void;
  color: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.primaryBtn,
        compact && styles.primaryBtnCompact,
        {
          backgroundColor: color,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.primaryBtnText, compact && styles.primaryBtnTextCompact]}>
        {label}
      </Text>
    </Pressable>
  );
}

function WelcomeStep({
  colors,
  onContinue,
  onSkip,
}: {
  colors: ReturnType<typeof useColors>;
  onContinue: () => void;
  onSkip: () => void;
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

      <Pressable style={styles.secondaryBtn} onPress={onSkip}>
        <Text style={styles.secondaryBtnText}>Skip for now</Text>
      </Pressable>
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
        <Text style={styles.handLabel}>Which names are you looking for?</Text>
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

function FeaturesStep({
  colors,
  onNext,
}: {
  colors: ReturnType<typeof useColors>;
  onNext: () => void;
}) {
  const features: {
    icon: keyof typeof Feather.glyphMap;
    iconBg: string;
    iconColor: string;
    title: string;
    body: string;
  }[] = [
    {
      icon: "bookmark",
      iconBg: "rgba(197, 60, 90, 0.13)",
      iconColor: colors.girlPink,
      title: "Your Picks",
      body: "Every name you swipe right on is saved to your Names tab — browse and rank your shortlist any time.",
    },
    {
      icon: "star",
      iconBg: "rgba(217, 119, 6, 0.13)",
      iconColor: "#d97706",
      title: "Shared Matches",
      body: "When you and your partner both love the same name, it becomes a Match. A moment worth celebrating.",
    },
    {
      icon: "zap",
      iconBg: "#fef3c7",
      iconColor: "#d97706",
      title: "Premium",
      body: "Unlock 10,000+ more names, AI-powered suggestions, unlimited swipes, and advanced filters — upgrade any time in Settings.",
    },
  ];

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.heading, { color: colors.grass }]}>What's inside</Text>
      <Text style={[styles.partnerSubhead, { color: "hsl(25, 12%, 48%)" }]}>
        Here's everything waiting for you
      </Text>
      <View style={{ height: 20 }} />
      <GlassCard>
        <View style={{ gap: 20 }}>
          {features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={[styles.featureIconWrap, { backgroundColor: f.iconBg }]}>
                <Feather name={f.icon} size={20} color={f.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.featureTitle, { color: "hsl(25, 30%, 18%)" }]}>
                  {f.title}
                </Text>
                <Text style={[styles.featureBody, { color: "hsl(25, 12%, 48%)" }]}>
                  {f.body}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
      <View style={{ flex: 1, minHeight: 24 }} />
      <PrimaryButton label="Next" onPress={onNext} color={colors.grass} />
    </View>
  );
}

function PartnerStep({
  colors,
  inviteCode,
  partnerCode,
  setPartnerCode,
  codeError,
  linking,
  linked,
  onJoin,
  onDone,
}: {
  colors: ReturnType<typeof useColors>;
  inviteCode: string;
  partnerCode: string;
  setPartnerCode: (v: string) => void;
  codeError: string;
  linking: boolean;
  linked: boolean;
  onJoin: () => void;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(inviteCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // fallback: nothing to do, code is visible on screen
      }
      return;
    }
    try {
      await Share.share({
        message: `Join me on WeName! Use my invite code: ${inviteCode}`,
      });
    } catch {
      // user dismissed share sheet
    }
  }

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.heading, { color: colors.grass }]}>Connect with your partner</Text>
      <Text style={[styles.partnerSubhead, { color: "hsl(25, 12%, 48%)" }]}>
        Share your code so you can match on names together
      </Text>
      <View style={{ height: 16 }} />

      <GlassCard>
        <Text style={styles.handLabel}>Your invite code</Text>
        <View style={styles.codeDisplay}>
          <Text style={[styles.codeText, { color: colors.grass }]}>
            {inviteCode}
          </Text>
        </View>
        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [
            styles.shareBtn,
            {
              borderColor: "hsla(145, 45%, 35%, 0.33)",
              backgroundColor: "hsla(145, 45%, 35%, 0.07)",
            },
            pressed && { opacity: 0.75 },
          ]}
        >
          <Feather
            name={Platform.OS === "web" ? "copy" : "share-2"}
            size={15}
            color={colors.grass}
          />
          <Text style={[styles.shareBtnText, { color: colors.grass }]}>
            {copied ? "Copied!" : Platform.OS === "web" ? "Copy code" : "Share with partner"}
          </Text>
        </Pressable>
      </GlassCard>

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: "hsl(35,22%,78%)" }]} />
        <Text style={[styles.dividerText, { color: "hsl(25,12%,55%)" }]}>
          or join your partner
        </Text>
        <View style={[styles.dividerLine, { backgroundColor: "hsl(35,22%,78%)" }]} />
      </View>

      <GlassCard>
        <Text style={styles.handLabel}>Already have a code?</Text>
        {linked ? (
          <View style={styles.linkedRow}>
            <Feather name="check-circle" size={18} color={colors.grass} />
            <Text style={[styles.linkedText, { color: colors.grass }]}>
              Partner linked!
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={partnerCode}
                onChangeText={(v) => setPartnerCode(v.toUpperCase())}
                placeholder="ENTER CODE"
                placeholderTextColor="hsl(25, 12%, 60%)"
                autoCapitalize="characters"
                maxLength={8}
                editable={!linking}
                style={styles.codeInput}
              />
              <PrimaryButton
                label={linking ? "…" : "Join"}
                onPress={onJoin}
                color={colors.accent}
                disabled={linking || partnerCode.trim().length === 0}
                compact
              />
            </View>
            {!!codeError && (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {codeError}
              </Text>
            )}
          </View>
        )}
      </GlassCard>

      <View style={{ flex: 1, minHeight: 24 }} />

      <PrimaryButton
        label={linked ? "Start swiping together →" : "Done"}
        onPress={onDone}
        color={linked ? colors.accent : colors.grass}
      />
      {!linked && (
        <Text style={[styles.skipNote, { color: "hsl(25, 12%, 55%)" }]}>
          You can connect with your partner any time from Settings
        </Text>
      )}
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
  partnerSubhead: {
    fontSize: 14,
    fontFamily: fonts.display,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
  },
  handLabel: {
    fontSize: 17,
    fontFamily: "PatrickHand_400Regular",
    ...(Platform.OS !== "android" && { fontStyle: "italic" as const }),
    color: "hsl(25, 12%, 48%)",
    textAlign: "center",
    marginBottom: 12,
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
    borderWidth: Platform.OS === "android" ? 2 : 1,
    borderColor: Platform.OS === "android" ? "hsl(35, 22%, 72%)" : "hsl(35, 22%, 80%)",
    borderRadius: Platform.OS === "android" ? 16 : 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "hsl(25, 30%, 20%)",
    textAlign: "center",
    fontFamily: fonts.display,
  },
  codeDisplay: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: Platform.OS === "android" ? 2 : 1,
    borderColor: Platform.OS === "android" ? "hsl(35, 22%, 72%)" : "hsl(35, 22%, 80%)",
    borderRadius: Platform.OS === "android" ? 16 : 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  codeText: {
    fontSize: 28,
    fontFamily: fonts.displayBold,
    letterSpacing: 8,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  shareBtnText: {
    fontFamily: fonts.displaySemibold,
    fontSize: 14,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontFamily: fonts.display,
  },
  codeInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: Platform.OS === "android" ? 2 : 1,
    borderColor: Platform.OS === "android" ? "hsl(35, 22%, 72%)" : "hsl(35, 22%, 80%)",
    borderRadius: Platform.OS === "android" ? 16 : 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    letterSpacing: 4,
    textAlign: "center",
    color: "hsl(25, 30%, 20%)",
    fontFamily: fonts.displaySemibold,
  },
  errorText: {
    textAlign: "center",
    fontFamily: fonts.display,
    fontSize: 13,
  },
  linkedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  linkedText: {
    fontFamily: fonts.displaySemibold,
    fontSize: 16,
  },
  primaryBtn: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryBtnCompact: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: "#fff",
    fontFamily: fonts.displaySemibold,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  primaryBtnTextCompact: {
    fontSize: 14,
    letterSpacing: 0.1,
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
  skipNote: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: fonts.display,
    marginTop: 10,
    lineHeight: 17,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureTitle: {
    fontFamily: fonts.displaySemibold,
    fontSize: 15,
    marginBottom: 3,
  },
  featureBody: {
    fontFamily: fonts.display,
    fontSize: 13,
    lineHeight: 18,
  },
});
