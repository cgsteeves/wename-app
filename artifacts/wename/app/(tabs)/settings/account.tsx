import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Svg, Path } from "react-native-svg";

import { SubPageHeader } from "@/components/SubPageHeader";
import { useAuth } from "@/components/AuthContext";
import { fonts } from "@/constants/fonts";
import { signInWithGoogle, signInWithEmailMagicLink } from "@/lib/authService";

const PARCHMENT    = "hsl(38,45%,93%)";
const CARD_BG      = "hsl(40,40%,93%)";
const FOREGROUND   = "hsl(25,30%,20%)";
const MUTED_FG     = "hsl(25,12%,48%)";
const BORDER       = "hsl(35,22%,80%)";
const BORDER_60    = "rgba(206,197,185,0.60)";
const BORDER_50    = "rgba(206,197,185,0.50)";
const GRASS        = "hsl(145,45%,35%)";
const GRASS_10     = "rgba(49,107,70,0.10)";
const BOY_BLUE     = "hsl(214,55%,42%)";
const DESTRUCTIVE  = "hsl(0,72%,50%)";
const DESTRUCT_30  = "rgba(200,50,50,0.30)";
const DESTRUCT_05  = "rgba(200,50,50,0.05)";
const SLATE_100    = "#f1f5f9";
const SLATE_500    = "#64748b";

function GoogleIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, authUser, signOut, deleteAccount } = useAuth();

  // Guest state
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError,   setGoogleError]   = useState("");
  const [email,         setEmail]         = useState("");
  const [emailLoading,  setEmailLoading]  = useState(false);
  const [emailError,    setEmailError]    = useState("");
  const [emailSent,     setEmailSent]     = useState(false);

  // Signed-in state
  const [signingOut,    setSigningOut]    = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError,   setDeleteError]   = useState("");

  const anyLoading = googleLoading || emailLoading;

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setGoogleError("");
    try {
      const result = await signInWithGoogle();

      if (result.kind === "web-url") {
        // Web: open the OAuth URL in a popup (best UX). Allowed because
        // we're still inside the user-gesture stack frame from the press.
        let popup: Window | null = null;
        try {
          popup = window.open(result.url, "_blank");
        } catch {
          // window.open may throw in sandboxed contexts; fall through.
        }
        if (!popup || popup.closed) {
          // Tier 2 (bulletproof): popup blocked. Same-tab nav cannot be blocked.
          window.location.href = result.url;
        }
        // Loading stays true: SIGNED_IN auth state change closes it.
        return;
      }

      if (result.kind === "native-cancelled") {
        // User backed out of the in-app browser. Silent reset, no error.
        setGoogleLoading(false);
        return;
      }

      // native-success — SIGNED_IN listener will refresh the UI.
      setGoogleLoading(false);
    } catch {
      setGoogleError("Google sign-in failed. Please try again.");
      setGoogleLoading(false);
    }
  }

  async function handleEmailSubmit() {
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
      setEmailError(
        e instanceof Error ? e.message : "Something went wrong. Please try again.",
      );
    }
    setEmailLoading(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Delete account?",
      "This permanently deletes all your data and cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletePending(true);
            setDeleteError("");
            try {
              await deleteAccount();
            } catch (e) {
              setDeleteError(
                e instanceof Error ? e.message : "Account deletion is not yet available.",
              );
            }
            setDeletePending(false);
          },
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: PARCHMENT }}>
      <SubPageHeader title="Account" />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 100,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {!isAuthenticated ? (
          /* ─── GUEST MODE ─── */
          <View style={[styles.card, { borderColor: BORDER_60 }]}>
            {/* Header row */}
            <View style={styles.cardHeaderRow}>
              <View style={[styles.avatarCircle, { backgroundColor: SLATE_100 }]}>
                <Feather name="shield" size={18} color={SLATE_500} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: FOREGROUND }]}>Guest Mode</Text>
                <Text style={[styles.cardSubtitle, { color: MUTED_FG }]}>
                  Names saved on this device only
                </Text>
              </View>
            </View>

            <Text style={[styles.bodyText, { color: MUTED_FG }]}>
              Create a free account to back up your names, sync across devices, and never lose your matches.
            </Text>

            {/* Google button */}
            <Pressable
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
              style={({ pressed }) => [
                styles.providerBtn,
                { borderColor: BORDER_60, backgroundColor: CARD_BG },
                googleLoading && { opacity: 0.6 },
                pressed && !googleLoading && { transform: [{ scale: 0.95 }] },
              ]}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={MUTED_FG} />
              ) : (
                <GoogleIcon />
              )}
              <Text style={styles.providerBtnTextBold}>
                {googleLoading ? "Connecting to Google…" : "Continue with Google"}
              </Text>
            </Pressable>

            {!!googleError && (
              <Text style={[styles.microText, { color: DESTRUCTIVE, textAlign: "center" }]}>
                {googleError}
              </Text>
            )}

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: BORDER_60 }]} />
              <Text style={[styles.microText, { color: MUTED_FG }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: BORDER_60 }]} />
            </View>

            {/* Email form OR email-sent confirmation */}
            {emailSent ? (
              <View style={{ alignItems: "center", gap: 4, paddingVertical: 8 }}>
                <Text style={[styles.bodyText, { color: FOREGROUND, fontFamily: fonts.displaySemibold }]}>
                  Check your inbox
                </Text>
                <Text style={[styles.microText, { color: MUTED_FG, textAlign: "center" }]}>
                  We sent a sign-in link to{" "}
                  <Text style={{ fontFamily: fonts.displayBold, color: FOREGROUND }}>{email}</Text>
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <View style={{ position: "relative" }}>
                  <View style={styles.inputIconWrap}>
                    <Feather name="mail" size={15} color={MUTED_FG} />
                  </View>
                  <TextInput
                    value={email}
                    onChangeText={(v) => { setEmail(v); setEmailError(""); }}
                    placeholder="Enter your email"
                    placeholderTextColor={MUTED_FG + "99"}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!anyLoading}
                    style={[
                      styles.emailInput,
                      {
                        color: FOREGROUND,
                        borderColor: BORDER,
                        backgroundColor: CARD_BG,
                      },
                      anyLoading && { opacity: 0.6 },
                    ]}
                  />
                </View>

                {!!emailError && (
                  <View style={styles.errorRow}>
                    <Feather name="alert-circle" size={12} color={DESTRUCTIVE} />
                    <Text style={[styles.microText, { color: DESTRUCTIVE }]}>{emailError}</Text>
                  </View>
                )}

                <Pressable
                  onPress={handleEmailSubmit}
                  disabled={anyLoading || !email.trim()}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: BOY_BLUE },
                    (anyLoading || !email.trim()) && { opacity: 0.5 },
                    pressed && !anyLoading && email.trim() && { transform: [{ scale: 0.95 }] },
                  ]}
                >
                  {emailLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="mail" size={15} color="#fff" />
                      <Text style={styles.primaryBtnText}>Continue with Email</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          /* ─── SIGNED IN ─── */
          <>
            {/* Status card */}
            <View style={[styles.card, { borderColor: BORDER_60 }]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.avatarCircle, { backgroundColor: GRASS_10 }]}>
                  <Feather name="check-circle" size={18} color={GRASS} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: FOREGROUND }]}>Signed In</Text>
                  <Text style={[styles.cardSubtitle, { color: MUTED_FG }]} numberOfLines={1}>
                    {authUser?.email ?? ""}
                  </Text>
                </View>
              </View>
              <Text style={[styles.bodyText, { color: MUTED_FG }]}>
                Your progress is saved and synced across all your devices.
              </Text>
            </View>

            {/* Actions card */}
            <View style={[styles.actionsCard, { borderColor: BORDER_60 }]}>
              {/* Email row (info only) */}
              <View style={[styles.actionRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER_50 }]}>
                <Feather name="mail" size={15} color={MUTED_FG} style={{ flexShrink: 0 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionLabel, { color: FOREGROUND }]}>Email</Text>
                  <Text style={[styles.microText, { color: MUTED_FG }]} numberOfLines={1}>
                    {authUser?.email ?? ""}
                  </Text>
                </View>
              </View>

              {/* Sign Out */}
              <Pressable
                onPress={handleSignOut}
                disabled={signingOut}
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && { opacity: 0.7 },
                  signingOut && { opacity: 0.6 },
                ]}
              >
                <Feather name="log-out" size={16} color={MUTED_FG} style={{ flexShrink: 0 }} />
                <Text style={[styles.actionLabel, { color: FOREGROUND }]}>
                  {signingOut ? "Signing out…" : "Sign Out"}
                </Text>
              </Pressable>
            </View>

            {/* Danger zone */}
            <View style={{ gap: 8 }}>
              <Text style={styles.dangerLabel}>DANGER ZONE</Text>

              <Pressable
                onPress={handleDeleteAccount}
                disabled={deletePending}
                style={({ pressed }) => [
                  styles.dangerBtn,
                  { borderColor: DESTRUCT_30, backgroundColor: DESTRUCT_05 },
                  deletePending && { opacity: 0.6 },
                  pressed && !deletePending && { transform: [{ scale: 0.95 }] },
                ]}
              >
                <Feather name="trash-2" size={15} color={DESTRUCTIVE} />
                <Text style={[styles.actionLabel, { color: DESTRUCTIVE }]}>
                  {deletePending ? "Deleting…" : "Delete Account"}
                </Text>
              </Pressable>

              {deleteError ? (
                <Text style={[styles.microText, { color: MUTED_FG, textAlign: "center", paddingHorizontal: 8 }]}>
                  {deleteError}
                </Text>
              ) : (
                <Text style={[styles.microText, { color: MUTED_FG, textAlign: "center" }]}>
                  This permanently deletes all your data and cannot be undone
                </Text>
              )}

              <Pressable onPress={() => Linking.openURL("https://wename.app/delete-account")}>
                <Text style={[styles.microText, { color: MUTED_FG, textAlign: "center", paddingTop: 4 }]}>
                  You can also request deletion at{" "}
                  <Text style={{ color: "#0284c7", textDecorationLine: "underline" }}>
                    wename.app/delete-account
                  </Text>
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_50,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
  },
  cardSubtitle: {
    fontFamily: fonts.display,
    fontSize: 10,
    marginTop: 2,
  },
  bodyText: {
    fontFamily: fonts.display,
    fontSize: 14,
    lineHeight: 21,
  },
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
  providerBtnTextBold: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    color: FOREGROUND,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
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
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  primaryBtn: {
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
  primaryBtnText: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    color: "#fff",
  },
  actionsCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionLabel: {
    fontFamily: fonts.displaySemibold,
    fontSize: 14,
    flex: 1,
  },
  dangerLabel: {
    fontFamily: fonts.displaySemibold,
    fontSize: 10,
    color: MUTED_FG,
    letterSpacing: 1.4,
    paddingLeft: 4,
    marginBottom: 4,
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  microText: {
    fontFamily: fonts.display,
    fontSize: 10,
    lineHeight: 16,
  },
});
