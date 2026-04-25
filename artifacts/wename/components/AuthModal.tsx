import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Svg, Path } from "react-native-svg";

import { fonts } from "@/constants/fonts";
import { supabase } from "@/lib/supabase";
import { signInWithGoogle, signInWithEmailMagicLink } from "@/lib/authService";

const PARCHMENT = "#ede8dc";
const CARD_BG   = "#e8e0cf";
const FOREGROUND = "#3d2e20";
const MUTED_FG   = "#857d74";
const BORDER     = "#cec5b9";
const GRASS      = "#316b46";
const BOY_BLUE   = "#3a71b5";
const DESTRUCTIVE = "#d63030";

type Mode = "choose" | "email" | "email-sent" | "error";

type Props = {
  onClose: () => void;
  title?: string;
  body?: string;
  preHeader?: string;
};

type GoogleButtonProps = {
  href: string | null;
  loading: boolean;
  disabled: boolean;
  onWebClick: () => void;
  onNativePress: () => void;
};

// On web, render a real <a target="_blank"> so the browser opens a new tab
// natively — no JS popup blocker, no iframe-sandbox issues, no user-gesture
// timing problems.  On native, fall back to a Pressable that calls into the
// expo-web-browser flow.
function GoogleSignInButton({
  href,
  loading,
  disabled,
  onWebClick,
  onNativePress,
}: GoogleButtonProps) {
  const inner = loading ? (
    <Text style={[styles.providerBtnText, { opacity: 0.7 }]}>
      Connecting to Google…
    </Text>
  ) : (
    <>
      <GoogleIcon />
      <Text style={styles.providerBtnTextBold}>Continue with Google</Text>
    </>
  );

  if (Platform.OS === "web") {
    const isDisabled = disabled || !href;

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (isDisabled || !href) {
        e.preventDefault();
        return;
      }
      // Always handle navigation explicitly — never rely on the anchor's
      // default target="_blank" behavior, because some privacy-strict
      // browsers (Brave, Firefox-strict, Safari with popup blocker, certain
      // extensions) silently block BOTH window.open AND target="_blank"
      // anchor navigation.
      e.preventDefault();
      onWebClick();

      // Tier 1: open in a new tab (best UX — user keeps original tab).
      // Allowed by browsers because we're in a real user-gesture handler
      // and href is pre-generated (no async work between click and open).
      let popup: Window | null = null;
      try {
        popup = window.open(href, "_blank");
      } catch {
        // window.open may throw in sandboxed contexts; fall through.
      }

      if (popup && !popup.closed) {
        // Popup opened, original tab preserved. Supabase sync handles
        // SIGNED_IN propagation via BroadcastChannel.
        return;
      }

      // Tier 2 (bulletproof): popup blocked. Navigate current tab to the
      // OAuth URL. Sacrifices original tab state but guarantees sign-in
      // always works regardless of browser settings.
      window.location.href = href;
    };

    // Plain JSX <a> tag — React renders this as a real DOM <a> element.
    // RN-Web only intercepts its own primitive components (View, Text,
    // Pressable); it does NOT transform raw HTML element strings, so a
    // JSX <a> reliably produces an anchor in the DOM.
    return (
      <a
        href={href ?? "#"}
        target="_blank"
        // NOTE: deliberately NOT using rel="noopener" — the popup at
        // /auth/callback uses window.opener to auto-close itself.
        rel="noreferrer"
        onClick={handleClick}
        style={{
          textDecoration: "none",
          width: "100%",
          opacity: isDisabled ? 0.6 : 1,
          cursor: isDisabled ? "not-allowed" : "pointer",
          display: "block",
          color: "inherit",
        }}
      >
        {/* pointerEvents: "none" so child View can't intercept clicks */}
        <View
          style={[
            styles.providerBtn,
            { borderColor: BORDER + "99", backgroundColor: CARD_BG, pointerEvents: "none" },
          ]}
        >
          {inner}
        </View>
      </a>
    );
  }

  return (
    <Pressable
      onPress={onNativePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.providerBtn,
        { borderColor: BORDER + "99", backgroundColor: CARD_BG },
        disabled && { opacity: 0.6 },
        pressed && !disabled && { transform: [{ scale: 0.95 }] },
      ]}
    >
      {inner}
    </Pressable>
  );
}

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

export function AuthModal({ onClose, title, body, preHeader }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<"google" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  // Pre-generated OAuth URL — used as the href on a real <a target="_blank">
  // anchor so the browser handles the navigation natively.  This avoids all
  // popup-blocker / iframe-sandbox issues that JS-driven window.open hits.
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);

  const anyLoading = loading || loadingProvider !== null;
  // The web "Connecting to Google…" state is non-blocking — the user opened
  // a popup and may want to cancel and try again.  Disable the close button
  // only for native/email flows, where loading reflects an in-flight request.
  const lockClose = loading;

  // Pre-generate the Google OAuth URL once when the modal mounts (web only).
  // On native, signInWithGoogle drives its own in-app browser via expo.
  // We refresh the URL after each successful click so the next attempt has
  // a fresh PKCE verifier (the previous one was consumed by the popup).
  const [urlVersion, setUrlVersion] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;
    setGoogleUrl(null);
    signInWithGoogle()
      .then((result) => {
        if (cancelled) return;
        if (result.kind === "web-url") setGoogleUrl(result.url);
      })
      .catch(() => {
        // Silent — button stays disabled (href=null); user can close + reopen.
      });
    return () => {
      cancelled = true;
    };
  }, [urlVersion]);

  // After 90 seconds in the web "Connecting…" state with no SIGNED_IN, reset.
  // Covers: user closed the popup, popup blocked, network failure, etc.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (loadingProvider !== "google") return;
    const t = setTimeout(() => {
      setLoadingProvider(null);
      setUrlVersion((v) => v + 1);
    }, 90_000);
    return () => clearTimeout(t);
  }, [loadingProvider]);

  // Listen for SIGNED_IN globally on web so the modal closes when the user
  // finishes auth in the popup tab (Supabase syncs auth state across tabs
  // via BroadcastChannel).
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        setLoadingProvider(null);
        onClose();
      }
    });
    return () => subscription.unsubscribe();
  }, [onClose]);

  function handleGoogleNative() {
    // Native (Expo Go / standalone): signInWithGoogle drives the in-app
    // browser session itself and resolves with a kind discriminator.
    setLoadingProvider("google");
    setErrorMsg("");
    signInWithGoogle()
      .then((result) => {
        if (result.kind === "native-success") {
          // SIGNED_IN auth state change closes the modal via the listener
          // above; nothing more to do here.
          return;
        }
        if (result.kind === "native-cancelled") {
          // User backed out of the in-app browser. Silent reset — leave the
          // modal usable so they can retry without an angry red error.
          setLoadingProvider(null);
          return;
        }
      })
      .catch(() => {
        setErrorMsg("Google sign-in failed. Please try again.");
        setMode("error");
        setLoadingProvider(null);
      });
  }

  async function handleEmailSubmit() {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      await signInWithEmailMagicLink(trimmed);
      setMode("email-sent");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setMode("error");
    }
    setLoading(false);
  }

  function goBack() {
    setMode("choose");
    setEmail("");
    setErrorMsg("");
  }

  return (
    <Modal transparent animationType="slide" statusBarTranslucent onRequestClose={() => !lockClose && onClose()}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !lockClose && Keyboard.dismiss()} />

        {/* Backdrop */}
        <Pressable
          style={styles.backdrop}
          onPress={() => !lockClose && onClose()}
        />

        {/* Sheet */}
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {/* Close button — always available unless an in-flight request is
              actually blocking (email magic-link or native browser). The web
              "Connecting…" state must be cancellable since the user may have
              closed the popup or popup was blocked. */}
          {!lockClose && (
            <Pressable
              style={styles.closeBtn}
              onPress={() => {
                // Reset any in-flight web auth state on cancel
                if (loadingProvider === "google") {
                  setLoadingProvider(null);
                }
                onClose();
              }}
            >
              <Feather name="x" size={16} color={MUTED_FG} />
            </Pressable>
          )}

          {/* Back button (email mode only) */}
          {mode === "email" && !lockClose && (
            <Pressable style={styles.backBtn} onPress={goBack}>
              <Feather name="arrow-left" size={16} color={MUTED_FG} />
            </Pressable>
          )}

          {/* ── CHOOSE mode ─── */}
          {mode === "choose" && (
            <>
              <View style={styles.header}>
                <View style={[styles.iconBox, { backgroundColor: CARD_BG, borderColor: BORDER + "99" }]}>
                  <Feather name="star" size={24} color={BOY_BLUE} />
                </View>
                {!!preHeader && (
                  <Text style={styles.preHeader}>{preHeader.toUpperCase()}</Text>
                )}
                <Text style={[styles.modalTitle, { color: GRASS }]}>
                  {title ?? "Create your free account"}
                </Text>
                <Text style={styles.modalBody}>
                  {body ?? "Sign in to save your progress and sync your names across devices."}
                </Text>
              </View>

              <View style={{ gap: 12 }}>
                <GoogleSignInButton
                  href={googleUrl}
                  loading={loadingProvider === "google"}
                  disabled={anyLoading}
                  onWebClick={() => {
                    setLoadingProvider("google");
                    setErrorMsg("");
                  }}
                  onNativePress={handleGoogleNative}
                />

                <Divider />

                <Pressable
                  onPress={() => setMode("email")}
                  disabled={anyLoading}
                  style={({ pressed }) => [
                    styles.providerBtn,
                    { borderColor: BORDER + "99", backgroundColor: CARD_BG },
                    anyLoading && { opacity: 0.6 },
                    pressed && !anyLoading && { transform: [{ scale: 0.95 }] },
                  ]}
                >
                  <Feather name="mail" size={15} color={MUTED_FG} />
                  <Text style={styles.providerBtnText}>Continue with Email</Text>
                </Pressable>
              </View>

              <Text style={styles.legalText}>
                By continuing you agree to our terms and privacy policy.
              </Text>
            </>
          )}

          {/* ── EMAIL mode ─── */}
          {mode === "email" && (
            <>
              <View style={styles.header}>
                <View style={[styles.iconBox, { backgroundColor: CARD_BG, borderColor: BORDER + "99" }]}>
                  <Feather name="mail" size={22} color={BOY_BLUE} />
                </View>
                <Text style={[styles.modalTitle, { color: GRASS }]}>Sign in with email</Text>
                <Text style={styles.modalBody}>
                  Enter your email and we'll send you a magic sign-in link. No password needed.
                </Text>
              </View>

              <View style={{ gap: 12 }}>
                <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>

                <View style={{ position: "relative" }}>
                  <View style={styles.inputIconWrap}>
                    <Feather name="mail" size={15} color={MUTED_FG} />
                  </View>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="hello@example.com"
                    placeholderTextColor={MUTED_FG + "99"}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    editable={!loading}
                    style={[
                      styles.emailInput,
                      { color: FOREGROUND, borderColor: BORDER, backgroundColor: CARD_BG },
                      loading && { opacity: 0.6 },
                    ]}
                  />
                </View>

                {!!errorMsg && mode === "email" && (
                  <View style={styles.errorRow}>
                    <Feather name="alert-circle" size={12} color={DESTRUCTIVE} />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                )}

                <Pressable
                  onPress={handleEmailSubmit}
                  disabled={loading || !email.trim()}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: BOY_BLUE },
                    (loading || !email.trim()) && { opacity: 0.5 },
                    pressed && !loading && email.trim() && { transform: [{ scale: 0.95 }] },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="mail" size={15} color="#fff" />
                      <Text style={styles.primaryBtnText}>Email me a sign-in link</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}

          {/* ── EMAIL-SENT mode ─── */}
          {mode === "email-sent" && (
            <View style={{ alignItems: "center", paddingVertical: 8, gap: 16 }}>
              <View style={[styles.iconBox, styles.iconBoxLg, { backgroundColor: CARD_BG, borderColor: BORDER + "99" }]}>
                <Feather name="check-circle" size={28} color={GRASS} />
              </View>
              <Text style={[styles.modalTitle, { color: GRASS }]}>Check your inbox</Text>
              <Text style={[styles.modalBody, { textAlign: "center" }]}>
                We sent a magic sign-in link to{"\n"}
                <Text style={{ fontFamily: fonts.displayBold, color: FOREGROUND }}>{email}</Text>
              </Text>
              <Text style={[styles.legalText, { marginTop: 4 }]}>
                Tap the link in the email to sign in. The link expires after 1 hour.
              </Text>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.gotItBtn,
                  { borderColor: BORDER + "99", backgroundColor: CARD_BG },
                  pressed && { transform: [{ scale: 0.95 }] },
                ]}
              >
                <Text style={styles.providerBtnText}>Got it</Text>
              </Pressable>
            </View>
          )}

          {/* ── ERROR mode ─── */}
          {mode === "error" && (
            <View style={{ alignItems: "center", paddingVertical: 16, gap: 16 }}>
              <View
                style={[
                  styles.iconBox,
                  styles.iconBoxLg,
                  {
                    backgroundColor: DESTRUCTIVE + "1a",
                    borderColor: DESTRUCTIVE + "33",
                  },
                ]}
              >
                <Feather name="alert-circle" size={28} color={DESTRUCTIVE} />
              </View>
              <Text style={[styles.modalTitle, { color: FOREGROUND }]}>Something went wrong</Text>
              <Text style={[styles.modalBody, { textAlign: "center", marginBottom: 8 }]}>
                {errorMsg || "We couldn't complete that. Please try again."}
              </Text>
              <Pressable
                onPress={() => { setMode("choose"); setErrorMsg(""); }}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: BOY_BLUE, width: "100%" },
                  pressed && { transform: [{ scale: 0.95 }] },
                ]}
              >
                <Text style={styles.primaryBtnText}>Try again</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Divider() {
  return (
    <View style={styles.divider}>
      <View style={[styles.dividerLine, { backgroundColor: BORDER + "99" }]} />
      <Text style={styles.dividerText}>or</Text>
      <View style={[styles.dividerLine, { backgroundColor: BORDER + "99" }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.40)",
  },
  sheet: {
    backgroundColor: PARCHMENT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: BORDER,
    alignSelf: "center",
    marginBottom: 20,
  },
  closeBtn: {
    position: "absolute",
    top: 20,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CARD_BG + "cc",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    position: "absolute",
    top: 20,
    left: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CARD_BG + "cc",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
    paddingTop: 8,
    gap: 8,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  iconBoxLg: {
    width: 64,
    height: 64,
  },
  preHeader: {
    fontFamily: fonts.displaySemibold,
    fontSize: 10,
    color: MUTED_FG,
    letterSpacing: 1.2,
  },
  modalTitle: {
    fontFamily: fonts.hand,
    fontSize: 24,
    textAlign: "center",
  },
  modalBody: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: MUTED_FG,
    lineHeight: 21,
    textAlign: "center",
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
  },
  providerBtnText: {
    fontFamily: fonts.displaySemibold,
    fontSize: 14,
    color: FOREGROUND,
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
    paddingVertical: 4,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: MUTED_FG,
  },
  legalText: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: MUTED_FG,
    textAlign: "center",
    marginTop: 20,
    lineHeight: 16,
  },
  fieldLabel: {
    fontFamily: fonts.displaySemibold,
    fontSize: 10,
    color: MUTED_FG,
    letterSpacing: 1.2,
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
  errorText: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: DESTRUCTIVE,
    flex: 1,
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
  gotItBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
});
