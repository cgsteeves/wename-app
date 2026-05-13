import { Feather } from "@expo/vector-icons";
import { ImageBackground } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as AppleAuthentication from "expo-apple-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
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
import { useSubscription, REVENUECAT_ENTITLEMENT_IDENTIFIER } from "@/lib/revenuecat";
import { PENDING_PREMIUM_PURCHASE_KEY } from "@/lib/supabase";
import {
  signInWithApple,
  signInWithGoogle,
  signInWithEmailMagicLink,
  isAppleAuthAvailable,
} from "@/lib/authService";

const paperTexture = require("../assets/images/paper-texture.jpg");
const girlBg = require("../assets/images/girl-card-bg.jpg");

type LimitType = "swipe" | "like" | "match" | "discover" | null;

// Two-step flow:
//   "purchase"             → purchase CTA (all users, no auth required)
//   "post-purchase-signup" → optional account creation prompt after guest purchase
type PurchaseStep = "purchase" | "post-purchase-signup";

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

const SHOW_PREMIUM_DEBUG = false;

const GRASS        = "hsl(145,45%,35%)";
const GRASS_BG     = "hsla(145,45%,35%,0.08)";
const GRASS_BORDER = "hsl(145,45%,60%)";
const TEXT_DARK    = "hsl(25,30%,20%)";
const TEXT_MID     = "hsl(25,12%,48%)";
const BORDER       = "hsl(35,22%,80%)";
const BOY_BLUE     = "hsl(214,55%,42%)";
const DESTRUCTIVE  = "hsl(0,72%,50%)";

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

// ── Sign-in panel ──────────────────────────────────────────────────────────
// Used in the post-purchase account-creation prompt.
// postPurchase=true changes the headline/subtext and skips writing the
// PENDING_PREMIUM_PURCHASE_KEY (the user has already purchased).
function SignInPanel({
  onClose,
  onMagicLinkSent,
  postPurchase = false,
}: {
  onClose: () => void;
  onMagicLinkSent?: () => void;
  postPurchase?: boolean;
}) {
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
      // On success: onAuthStateChange fires → isAuthenticated becomes true
      // → PremiumModal useEffect handles any post-purchase Supabase sync.
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
      if (!postPurchase) {
        // Only write the pending-purchase intent for the pre-purchase email flow
        // (so auth/callback can re-open the modal on cold start after magic-link).
        await AsyncStorage.setItem(PENDING_PREMIUM_PURCHASE_KEY, "1");
      }
      await signInWithEmailMagicLink(trimmed);
      setEmailSent(true);
      onMagicLinkSent?.();
    } catch (e) {
      if (!postPurchase) {
        await AsyncStorage.removeItem(PENDING_PREMIUM_PURCHASE_KEY).catch(() => {});
      }
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
      <Text style={styles.headline}>
        {postPurchase ? "Back up your Premium" : "Upgrade to Premium"}
      </Text>
      <View style={styles.divider} />
      <Text style={styles.subText}>
        {postPurchase
          ? "Create a free account to sync your names, connect with a partner, and restore Premium on any device."
          : "Create a free account to back up your names and restore Premium across devices."}
      </Text>

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

      <View style={styles.orRow}>
        <View style={[styles.orLine, { backgroundColor: BORDER }]} />
        <Text style={[styles.orText, { color: TEXT_MID }]}>or</Text>
        <View style={[styles.orLine, { backgroundColor: BORDER }]} />
      </View>

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
        {postPurchase
          ? "Your Premium is already active on this device — an account is optional."
          : "Free to create. Pay once for premium, no subscription."}
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
  const { user, updateUser } = useUser();
  const {
    purchase,
    restore,
    isPurchasing,
    isRestoring,
    offerings,
    offeringsError,
    hasPremiumEntitlement,
    customerInfo,
  } = useSubscription();

  const [step, setStep] = useState<PurchaseStep>("purchase");
  const [lastEvent, setLastEvent] = useState("—");
  // True when a guest successfully purchased — signals that we should call
  // updateUser once they subsequently create an account.
  const purchasedAsGuestRef = useRef(false);
  // Prevents the post-purchase Supabase sync from firing more than once.
  const hasPostPurchaseSyncedRef = useRef(false);
  // Controls whether the sign-in panel is shown inside the post-purchase step.
  const [showSignInInPostPurchase, setShowSignInInPostPurchase] = useState(false);

  // Reset state when modal opens/closes.
  useEffect(() => {
    if (open) {
      setStep("purchase");
      setShowSignInInPostPurchase(false);
      hasPostPurchaseSyncedRef.current = false;
    } else {
      purchasedAsGuestRef.current = false;
      hasPostPurchaseSyncedRef.current = false;
      setShowSignInInPostPurchase(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // When a guest creates an account after purchasing, isAuthenticated flips to
  // true. At that point, sync their premium status to Supabase and close.
  useEffect(() => {
    if (
      !open ||
      !isAuthenticated ||
      !purchasedAsGuestRef.current ||
      hasPostPurchaseSyncedRef.current
    ) return;

    if (!hasPremiumEntitlement) return; // entitlement not confirmed yet — wait

    hasPostPurchaseSyncedRef.current = true;
    console.log("[PremiumModal] guest signed in after purchase — syncing premium to Supabase");
    updateUser({ plan_tier: "premium" })
      .then(() => {
        console.log("[PremiumModal] post-purchase Supabase sync complete");
        onClose();
        onUpgrade();
      })
      .catch((e) => {
        console.warn("[PremiumModal] post-purchase Supabase sync failed:", e);
        // Non-fatal: RC is source of truth; close anyway.
        onClose();
        onUpgrade();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, hasPremiumEntitlement, open]);

  const pkg = offerings?.current?.availablePackages?.[0];
  const priceString = pkg?.product?.priceString ?? "$7.99";
  const isLoadingOfferings = !offerings && !offeringsError;
  const ctaDisabled = isPurchasing || isLoadingOfferings || !pkg;

  async function handleUpgrade() {
    if (!pkg) return;

    // If the entitlement is already active, never call purchasePackage.
    if (hasPremiumEntitlement) {
      console.log("PURCHASE_SKIPPED_ALREADY_ENTITLED", {
        caller: "PremiumModal/handleUpgrade",
        rcAppUserId: customerInfo?.originalAppUserId,
        activeEntitlements: Object.keys(customerInfo?.entitlements?.active ?? {}),
        note: "User tapped Buy but entitlement was already active — purchase skipped.",
      });
      setLastEvent("PURCHASE_SKIPPED_ALREADY_ENTITLED");
      return;
    }

    console.log("[PremiumModal] upgrade tapped", {
      pkg: pkg.identifier,
      productId: pkg.product.identifier,
      price: pkg.product.priceString,
      isAuthenticated,
      hasPremiumEntitlementBefore: hasPremiumEntitlement,
      supabaseUserId: user?.id?.slice(-8),
      rcAppUserId: customerInfo?.originalAppUserId,
      activeEntitlementsBefore: Object.keys(customerInfo?.entitlements?.active ?? {}),
      offeringId: offerings?.current?.identifier,
      purchasePackageWillBeCalled: true,
      applePaymentSheetExpected: true,
    });
    setLastEvent("PURCHASE_PACKAGE_CALLED");

    try {
      const purchasedCustomerInfo = await purchase(pkg);
      if (!purchasedCustomerInfo) {
        console.log("[PremiumModal] purchase cancelled (test-store dismissed)");
        setLastEvent("PURCHASE_CANCELLED");
        return;
      }
      const hasPremiumEntitlementAfterPurchase =
        purchasedCustomerInfo.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
      if (!hasPremiumEntitlementAfterPurchase) {
        console.warn(
          "BLOCKED_PREMIUM_UNLOCK_WITHOUT_ENTITLEMENT",
          {
            caller: "PremiumModal/handleUpgrade",
            currentPlanTier: user?.plan_tier,
            hasPremiumEntitlementBefore: hasPremiumEntitlement,
            activeEntitlementsAfter: purchasedCustomerInfo.entitlements.active,
          },
        );
        setLastEvent("PURCHASE_RETURNED_NO_ENTITLEMENT");
        Alert.alert(
          "Purchase Incomplete",
          "Your payment was received but the premium entitlement hasn't activated yet. Please tap Restore Purchase in a moment.",
        );
        return;
      }
      setLastEvent("PURCHASE_SUCCEEDED_WITH_ENTITLEMENT");
      console.log("[PremiumModal] premium entitlement confirmed after purchase");

      if (isAuthenticated) {
        // Signed-in user: sync to Supabase and close immediately.
        console.log("[PremiumModal] updateUser: start", { plan_tier: "premium", caller: "handleUpgrade" });
        await updateUser({ plan_tier: "premium" });
        console.log("[PremiumModal] updateUser: success", { unlockApplied: true, caller: "handleUpgrade" });
        onClose();
        onUpgrade();
      } else {
        // Guest user: unlock premium via RC entitlement (RC is source of truth).
        // Show the optional account creation prompt — do NOT require sign-in.
        console.log("[PremiumModal] guest purchase complete — showing post-purchase signup prompt");
        purchasedAsGuestRef.current = true;
        setStep("post-purchase-signup");
        // Signal to the parent that premium is now active so daily limits clear.
        onUpgrade();
      }
    } catch (e: any) {
      if (e?.userCancelled) {
        console.log("[PremiumModal] purchase cancelled by user");
        setLastEvent("PURCHASE_CANCELLED");
        return;
      }
      console.error("[PremiumModal] purchase failed:", e?.message);
      setLastEvent("PURCHASE_FAILED");
      Alert.alert("Purchase Failed", e?.message ?? "Something went wrong. Please try again.");
    }
  }

  async function handleRestore() {
    console.log("[PremiumModal] restore tapped", {
      isAuthenticated,
      hasPremiumEntitlement,
      rcAppUserId: customerInfo?.originalAppUserId,
    });
    setLastEvent("RESTORE_CALLED");
    try {
      const restoredInfo = await restore();
      const hasPremiumEntitlementAfterRestore =
        restoredInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
      console.log("[PremiumModal] restore result", {
        hasPremiumEntitlementAfterRestore,
        activeEntitlements: Object.keys(restoredInfo?.entitlements?.active ?? {}),
      });
      if (hasPremiumEntitlementAfterRestore) {
        setLastEvent("PURCHASE_SUCCEEDED_WITH_ENTITLEMENT");
        console.log("[PremiumModal] premium entitlement confirmed after restore");

        if (isAuthenticated) {
          await updateUser({ plan_tier: "premium" });
          console.log("[PremiumModal] updateUser: success", { unlockApplied: true, caller: "handleRestore" });
          onClose();
          onUpgrade();
        } else {
          // Guest restore: premium active via RC. Show optional account prompt.
          console.log("[PremiumModal] guest restore complete — showing post-purchase signup prompt");
          purchasedAsGuestRef.current = true;
          setStep("post-purchase-signup");
          onUpgrade();
        }
      } else {
        console.warn(
          "BLOCKED_PREMIUM_UNLOCK_WITHOUT_ENTITLEMENT",
          {
            caller: "PremiumModal/handleRestore",
            currentPlanTier: user?.plan_tier,
            activeEntitlementsAfter: restoredInfo?.entitlements?.active,
          },
        );
        setLastEvent("PURCHASE_RETURNED_NO_ENTITLEMENT");
        Alert.alert("No Purchase Found", "We couldn't find a previous purchase on this Apple ID.");
      }
    } catch (e: any) {
      console.error("[PremiumModal] restore failed:", e?.message);
      setLastEvent("PURCHASE_FAILED");
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

        {/* Step: purchase — all users, no auth required */}
        {step === "purchase" && (
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 36 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.headline}>
              {limitType === "swipe"
                ? "Upgrade to Premium for unlimited swipes"
                : limitType === "like"
                ? "Upgrade to Premium for unlimited likes"
                : limitType === "match"
                ? "Upgrade to Premium to reveal all matches"
                : "Keep the momentum going"}
            </Text>
            <View style={styles.divider} />

            {hasPremiumEntitlement ? (
              <>
                <Text style={styles.subText}>
                  Your premium access is already active — enjoy everything!
                </Text>
                <View style={styles.alreadyActiveBox}>
                  <Text style={{ fontSize: 28 }}>🌿</Text>
                  <Text style={styles.alreadyActiveTitle}>Premium Active</Text>
                  <Text style={styles.alreadyActiveBody}>
                    A previous purchase was found and restored to your account.
                    No new payment is needed.
                  </Text>
                </View>
                <Pressable onPress={onClose} style={styles.cta}>
                  <LinearGradient
                    colors={["hsl(145,45%,38%)", "hsl(145,45%,27%)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={styles.ctaText}>Got it — start exploring</Text>
                </Pressable>
              </>
            ) : (
              <>
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
                  No account required to purchase. Create an account anytime to sync across devices.
                </Text>
              </>
            )}

            {/* ── Debug overlay (remove before App Store release) ─────────── */}
            {SHOW_PREMIUM_DEBUG && (
              <View style={styles.debugPanel}>
                <Text style={styles.debugTitle}>⚙ PREMIUM DEBUG — remove before release</Text>
                <Text style={styles.debugLine}>hasPremiumEntitlement: <Text style={styles.debugVal}>{String(hasPremiumEntitlement)}</Text></Text>
                <Text style={styles.debugLine}>isAuthenticated: <Text style={styles.debugVal}>{String(isAuthenticated)}</Text></Text>
                <Text style={styles.debugLine}>RC user: <Text style={styles.debugVal}>{customerInfo?.originalAppUserId?.slice(-10) ?? "—"}</Text></Text>
                <Text style={styles.debugLine}>Supabase: <Text style={styles.debugVal}>{user?.id?.slice(-10) ?? "—"}</Text></Text>
                <Text style={styles.debugLine}>offering: <Text style={styles.debugVal}>{offerings?.current?.identifier ?? "—"}</Text></Text>
                <Text style={styles.debugLine}>package: <Text style={styles.debugVal}>{pkg?.identifier ?? "—"}</Text></Text>
                <Text style={styles.debugLine}>lastEvent: <Text style={styles.debugVal}>{lastEvent}</Text></Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Step: post-purchase-signup — optional account creation after guest purchase */}
        {step === "post-purchase-signup" && (
          showSignInInPostPurchase ? (
            <SignInPanel
              onClose={onClose}
              postPurchase
            />
          ) : (
            <ScrollView
              contentContainerStyle={[
                styles.scroll,
                { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 36 },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {/* Success confirmation */}
              <View style={styles.postPurchaseSuccessBox}>
                <View style={styles.signedInIconBox}>
                  <Feather name="check" size={28} color={GRASS} />
                </View>
                <Text style={[styles.headline, { marginTop: 16 }]}>Premium is active!</Text>
                <View style={styles.divider} />
                <Text style={[styles.subText, { marginBottom: 0 }]}>
                  You now have unlimited swipes, likes, match reveals, and access to all name packs.
                </Text>
              </View>

              {/* Account creation invite */}
              <View style={styles.postPurchaseCard}>
                <Text style={styles.postPurchaseCardTitle}>Want to back up your names?</Text>
                <Text style={styles.postPurchaseCardBody}>
                  Create a free account to:
                </Text>
                {[
                  "Restore Premium on any device",
                  "Sync your liked names and matches",
                  "Connect with your partner",
                  "Back up your names so they're never lost",
                ].map((benefit) => (
                  <View key={benefit} style={styles.postPurchaseBenefitRow}>
                    <Feather name="check" size={13} color={GRASS} />
                    <Text style={styles.postPurchaseBenefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => setShowSignInInPostPurchase(true)}
                style={({ pressed }) => [
                  styles.cta,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <LinearGradient
                  colors={["hsl(145,45%,38%)", "hsl(145,45%,27%)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.ctaText}>Create account</Text>
              </Pressable>

              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.restore, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.restoreText, { color: TEXT_MID }]}>Maybe later</Text>
              </Pressable>

              <Text style={[styles.legal, { color: TEXT_MID }]}>
                Premium is already active on this device. An account is optional.
              </Text>

              {SHOW_PREMIUM_DEBUG && (
                <View style={styles.debugPanel}>
                  <Text style={styles.debugTitle}>⚙ PREMIUM DEBUG — remove before release</Text>
                  <Text style={styles.debugLine}>hasPremiumEntitlement: <Text style={styles.debugVal}>{String(hasPremiumEntitlement)}</Text></Text>
                  <Text style={styles.debugLine}>isAuthenticated: <Text style={styles.debugVal}>{String(isAuthenticated)}</Text></Text>
                  <Text style={styles.debugLine}>RC user: <Text style={styles.debugVal}>{customerInfo?.originalAppUserId?.slice(-10) ?? "—"}</Text></Text>
                  <Text style={styles.debugLine}>lastEvent: <Text style={styles.debugVal}>{lastEvent}</Text></Text>
                </View>
              )}
            </ScrollView>
          )
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
  // Post-purchase panels
  postPurchaseSuccessBox: {
    alignItems: "center",
    marginBottom: 24,
  },
  signedInIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: GRASS_BG,
    borderWidth: 1.5,
    borderColor: GRASS_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  postPurchaseCard: {
    backgroundColor: "rgba(255,255,255,0.60)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    marginBottom: 24,
    gap: 8,
  },
  postPurchaseCardTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 15,
    color: TEXT_DARK,
    marginBottom: 2,
  },
  postPurchaseCardBody: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: TEXT_MID,
    marginBottom: 4,
  },
  postPurchaseBenefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  postPurchaseBenefitText: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: TEXT_DARK,
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
  alreadyActiveBox: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderRadius: 14,
    backgroundColor: "hsla(145,45%,35%,0.08)",
    borderWidth: 1,
    borderColor: "hsl(145,45%,60%)",
  },
  alreadyActiveTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: GRASS,
  },
  alreadyActiveBody: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: TEXT_MID,
    textAlign: "center",
    lineHeight: 20,
  },
  debugPanel: {
    marginTop: 20,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.07)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
    gap: 4,
  },
  debugTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 9,
    color: "#b45309",
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  debugLine: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: TEXT_DARK,
    opacity: 0.8,
  },
  debugVal: {
    fontFamily: fonts.displayBold,
    color: TEXT_DARK,
  },
});
