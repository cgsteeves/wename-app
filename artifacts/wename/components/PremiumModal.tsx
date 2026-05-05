import { Feather } from "@expo/vector-icons";
import { ImageBackground } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as AppleAuthentication from "expo-apple-authentication";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Svg, Path } from "react-native-svg";

import { useAuth } from "@/components/AuthContext";
import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { useSubscription } from "@/lib/revenuecat";
import {
  signInWithApple,
  signInWithGoogle,
  signInWithEmailMagicLink,
  isAppleAuthAvailable,
} from "@/lib/authService";

const paperTexture = require("../assets/images/paper-texture.jpg");
const girlBg = require("../assets/images/girl-card-bg.jpg");

type LimitType = "swipe" | "like" | "match" | "discover" | null;

const FEATURES: { icon: keyof typeof Feather.glyphMap; label: string; value: string }[] = [
  {
    icon: "refresh-cw",
    label: "UNLIMITED",
    value: "No limits on swipes, likes, or match reveals — keep discovering together.",
  },
  {
    icon: "zap",
    label: "AI SUGGESTIONS",
    value: "Get AI-powered picks based on what you both love.",
  },
  {
    icon: "book-open",
    label: "ALL NAME PACKS",
    value: "Explore thousands more names across styles, cultures, and vibes.",
  },
];

const GRASS       = "hsl(145,45%,35%)";
const GRASS_BG    = "hsla(145,45%,35%,0.08)";
const GRASS_BORDER = "hsl(145,45%,60%)";
const TEXT_DARK   = "hsl(25,30%,20%)";
const TEXT_MID    = "hsl(25,12%,48%)";
const BORDER      = "hsl(35,22%,80%)";
const BOY_BLUE    = "hsl(214,55%,42%)";
const DESTRUCTIVE = "hsl(0,72%,50%)";

function GoogleIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

function SignInPanel({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleLoading,   setAppleLoading]   = useState(false);
  const [googleLoading,  setGoogleLoading]  = useState(false);
  const [email,          setEmail]          = useState("");
  const [emailLoading,   setEmailLoading]   = useState(false);
  const [emailError,     setEmailError]     = useState("");
  const [emailSent,      setEmailSent]      = useState(false);
  const [appleError,     setAppleError]     = useState("");
  const [googleError,    setGoogleError]    = useState("");

  useEffect(() => {
    isAppleAuthAvailable().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const anyLoading = appleLoading || googleLoading || emailLoading;

  async function handleApple() {
    setAppleLoading(true);
    setAppleError("");
    try {
      const result = await signInWithApple();
      if (result === "cancelled") setAppleLoading(false);
    } catch (e) {
      setAppleError(e instanceof Error ? e.message : "Apple sign-in failed. Please try again.");
      setAppleLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setGoogleError("");
    try {
      const result = await signInWithGoogle();
      if (result.kind === "native-cancelled") setGoogleLoading(false);
    } catch {
      setGoogleError("Google sign-in failed. Please try again.");
      setGoogleLoading(false);
    }
  }

  async function handleEmail() {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");
    setEmailLoading(true);
    try {
      await signInWithEmailMagicLink(trimmed);
      setEmailSent(true);
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
    setEmailLoading(false);
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 36 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.headline}>Create an account first</Text>
      <View style={styles.divider} />
      <Text style={styles.subText}>
        Sign in to purchase — your premium access will be linked to your account and restored on any device.
      </Text>

      {/* Feature preview */}
      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f.label} style={styles.featureRow}>
            <Feather name={f.icon} size={15} color={GRASS} style={styles.featureIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Text style={[styles.featureValue, { color: TEXT_DARK }]}>{f.value}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Apple */}
      {appleAvailable && Platform.OS === "ios" && (
        <>
          <View
            style={[
              { borderRadius: 12, overflow: "hidden", marginBottom: 10 },
              (googleLoading || emailLoading) && { opacity: 0.6 },
            ]}
            pointerEvents={(googleLoading || emailLoading) ? "none" : "auto"}
          >
            {appleLoading ? (
              <View style={[styles.providerBtn, { borderColor: "#00000033", backgroundColor: "#1a1a1a" }]}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={[styles.providerBtnText, { color: "#fff" }]}>Connecting to Apple…</Text>
              </View>
            ) : (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={{ width: "100%", height: 50 }}
                onPress={handleApple}
              />
            )}
          </View>
          {!!appleError && (
            <Text style={[styles.microError, { color: DESTRUCTIVE }]}>{appleError}</Text>
          )}
        </>
      )}

      {/* Google */}
      <Pressable
        onPress={handleGoogle}
        disabled={anyLoading}
        style={({ pressed }) => [
          styles.providerBtn,
          { borderColor: BORDER, backgroundColor: "rgba(255,255,255,0.55)", marginBottom: 10 },
          anyLoading && { opacity: 0.6 },
          pressed && !anyLoading && { transform: [{ scale: 0.97 }] },
        ]}
      >
        {googleLoading ? <ActivityIndicator size="small" color={TEXT_MID} /> : <GoogleIcon />}
        <Text style={[styles.providerBtnText, { color: TEXT_DARK }]}>
          {googleLoading ? "Connecting to Google…" : "Continue with Google"}
        </Text>
      </Pressable>
      {!!googleError && (
        <Text style={[styles.microError, { color: DESTRUCTIVE }]}>{googleError}</Text>
      )}

      {/* Divider */}
      <View style={styles.orRow}>
        <View style={[styles.orLine, { backgroundColor: BORDER }]} />
        <Text style={[styles.orText, { color: TEXT_MID }]}>or</Text>
        <View style={[styles.orLine, { backgroundColor: BORDER }]} />
      </View>

      {/* Email */}
      {emailSent ? (
        <View style={{ alignItems: "center", gap: 4, paddingVertical: 8 }}>
          <Text style={[styles.providerBtnText, { color: TEXT_DARK, fontFamily: fonts.displaySemibold }]}>
            Check your inbox
          </Text>
          <Text style={[styles.microError, { color: TEXT_MID, textAlign: "center" }]}>
            We sent a sign-in link to{" "}
            <Text style={{ fontFamily: fonts.displayBold, color: TEXT_DARK }}>{email}</Text>
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <View style={{ position: "relative" }}>
            <View style={styles.inputIconWrap}>
              <Feather name="mail" size={15} color={TEXT_MID} />
            </View>
            <TextInput
              value={email}
              onChangeText={(v) => { setEmail(v); setEmailError(""); }}
              placeholder="Enter your email"
              placeholderTextColor={TEXT_MID + "99"}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!anyLoading}
              style={[
                styles.emailInput,
                { color: TEXT_DARK, borderColor: BORDER, backgroundColor: "rgba(255,255,255,0.55)" },
                anyLoading && { opacity: 0.6 },
              ]}
            />
          </View>
          {!!emailError && (
            <Text style={[styles.microError, { color: DESTRUCTIVE }]}>{emailError}</Text>
          )}
          <Pressable
            onPress={handleEmail}
            disabled={anyLoading || !email.trim()}
            style={({ pressed }) => [
              styles.emailBtn,
              { backgroundColor: BOY_BLUE },
              (anyLoading || !email.trim()) && { opacity: 0.5 },
              pressed && !anyLoading && email.trim() && { transform: [{ scale: 0.97 }] },
            ]}
          >
            {emailLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="mail" size={15} color="#fff" />
                <Text style={styles.emailBtnText}>Continue with Email</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      <Text style={[styles.legal, { color: TEXT_MID, marginTop: 20 }]}>
        Free to create. Pay once for premium, no subscription.
      </Text>
    </ScrollView>
  );
}

export function PremiumModal({
  open,
  limitType,
  onClose,
  onUpgrade,
}: {
  open: boolean;
  limitType: LimitType;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const { updateUser } = useUser();
  const { purchase, restore, isPurchasing, isRestoring, offerings, offeringsError } = useSubscription();

  const pkg = offerings?.current?.availablePackages?.[0];
  const priceString = pkg?.product?.priceString ?? "$7.99";
  const isLoadingOfferings = !offerings && !offeringsError;
  const ctaDisabled = isPurchasing || isLoadingOfferings || !pkg;

  async function handleUpgrade() {
    if (!pkg) return;
    try {
      await purchase(pkg);
      await updateUser({ plan_tier: "premium" });
      onClose();
      onUpgrade();
    } catch (e: any) {
      if (e?.userCancelled) return;
      Alert.alert("Purchase Failed", e?.message ?? "Something went wrong. Please try again.");
    }
  }

  async function handleRestore() {
    try {
      const info = await restore();
      const isNowSubscribed = info?.entitlements?.active?.["premium"] !== undefined;
      if (isNowSubscribed) {
        await updateUser({ plan_tier: "premium" });
        onClose();
        onUpgrade();
      } else {
        Alert.alert("No Purchase Found", "We couldn't find a previous purchase on this Apple ID.");
      }
    } catch (e: any) {
      Alert.alert("Restore Failed", e?.message ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <Modal visible={open} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <ImageBackground source={girlBg} style={StyleSheet.absoluteFill} contentFit="cover" />
        <ImageBackground
          source={paperTexture}
          style={StyleSheet.absoluteFill}
          imageStyle={{ opacity: 0.12 }}
          contentFit="cover"
        />
        <LinearGradient
          colors={["rgba(255,248,242,0.05)", "rgba(255,248,242,0.55)", "rgba(255,248,242,0.92)"]}
          locations={[0, 0.3, 1]}
          style={StyleSheet.absoluteFill}
        />

        <Pressable
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          onPress={onClose}
          hitSlop={12}
        >
          <Feather name="x" size={14} color={TEXT_MID} />
        </Pressable>

        {/* Guest: show sign-in prompt */}
        {!isAuthenticated ? (
          <SignInPanel onClose={onClose} />
        ) : (
          /* Authenticated: show normal purchase UI */
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 36 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.headline}>Keep the momentum going</Text>
            <View style={styles.divider} />
            <Text style={styles.subText}>
              You're finding names you love — don't slow down now.
            </Text>

            <View style={styles.features}>
              {FEATURES.map((f) => (
                <View key={f.label} style={styles.featureRow}>
                  <Feather name={f.icon} size={15} color={GRASS} style={styles.featureIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featureLabel}>{f.label}</Text>
                    <Text style={[styles.featureValue, { color: TEXT_DARK }]}>{f.value}</Text>
                  </View>
                </View>
              ))}
            </View>

            {offeringsError && (
              <Text style={[styles.offeringsError, { color: "#dc2626" }]}>
                Could not load pricing. Check your connection and try again.
              </Text>
            )}

            <Pressable
              onPress={handleUpgrade}
              disabled={ctaDisabled}
              style={({ pressed }) => [
                styles.cta,
                { opacity: ctaDisabled || pressed ? 0.5 : 1 },
              ]}
            >
              <LinearGradient
                colors={["hsl(145,45%,38%)", "hsl(145,45%,27%)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {isPurchasing || isLoadingOfferings ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.ctaText}>
                  {pkg ? `One-time purchase — ${priceString}` : "Pricing unavailable"}
                </Text>
              )}
            </Pressable>

            <Pressable style={styles.restore} onPress={handleRestore} disabled={isRestoring}>
              {isRestoring ? (
                <ActivityIndicator color={TEXT_MID} size="small" />
              ) : (
                <Text style={[styles.restoreText, { color: TEXT_MID }]}>Restore purchase</Text>
              )}
            </Pressable>

            <Text style={[styles.legal, { color: TEXT_MID }]}>
              No subscriptions. Pay once, use forever.
            </Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  closeBtn: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { paddingHorizontal: 24 },
  headline: {
    fontFamily: fonts.hand,
    fontSize: 28,
    color: GRASS,
    fontStyle: "italic",
    textAlign: "center",
  },
  divider: {
    height: 1.5,
    width: 96,
    borderRadius: 999,
    backgroundColor: GRASS,
    opacity: 0.5,
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 14,
  },
  subText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: TEXT_MID,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  features: { gap: 10, marginBottom: 28 },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: GRASS_BG,
    borderWidth: 1,
    borderColor: GRASS_BORDER,
  },
  featureIcon: { opacity: 0.65, marginTop: 2 },
  featureLabel: {
    fontFamily: fonts.displaySemibold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: GRASS,
    opacity: 0.65,
    marginBottom: 2,
  },
  featureValue: {
    fontFamily: fonts.display,
    fontSize: 14,
    opacity: 0.85,
    lineHeight: 20,
  },
  // Purchase CTA
  cta: {
    height: 56,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.38)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  ctaText: { color: "#fff", fontFamily: fonts.displayBold, fontSize: 17 },
  offeringsError: { fontFamily: fonts.display, fontSize: 12, textAlign: "center", marginBottom: 8 },
  restore: { alignItems: "center", paddingVertical: 10, marginBottom: 12 },
  restoreText: { fontFamily: fonts.display, fontSize: 14 },
  // Sign-in panel
  providerBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  providerBtnText: { fontFamily: fonts.displayBold, fontSize: 14 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 10 },
  orLine: { flex: 1, height: 1 },
  orText: { fontFamily: fonts.display, fontSize: 12 },
  inputIconWrap: {
    position: "absolute",
    left: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: 1,
  },
  emailInput: {
    paddingLeft: 40,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: fonts.display,
    fontSize: 14,
  },
  emailBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  emailBtnText: { fontFamily: fonts.displayBold, fontSize: 14, color: "#fff" },
  microError: { fontFamily: fonts.display, fontSize: 10, lineHeight: 16, textAlign: "center" },
  legal: { fontFamily: fonts.display, fontSize: 10, textAlign: "center", lineHeight: 16, paddingHorizontal: 16 },
});
