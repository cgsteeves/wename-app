import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/components/AuthContext";
import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { supabase } from "@/lib/supabase";
import type { PartnerInvite } from "@/lib/supabase";
import {
  createInvite,
  getInviteByShortCode,
  acceptInvite,
  getInviteUrl,
} from "@/lib/inviteService";

// ─── Tokens ───────────────────────────────────────────────────────────────────
const PARCHMENT   = "#fdf6ef";
const CARD_BG     = "#f5ece0";
const FOREGROUND  = "#3d2e20";
const MUTED_FG    = "#857d74";
const BORDER      = "rgba(206,197,185,0.60)";
const GRASS       = "#316b46";
const BOY_BLUE    = "#3a71b5";
const ROSE_100    = "#ffe4e6";
const ROSE_400    = "#fb7185";
const ROSE_500    = "#f43f5e";
const ROSE_50_BG  = "#fff1f2";
const DESTRUCTIVE = "#d63030";

type SheetView = "main" | "invite";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PartnerConnectModal({ open, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useUser();
  const { isAuthenticated, openAuthModal } = useAuth();
  const [sheetView, setSheetView] = useState<SheetView>("main");

  // Reset to main view whenever the modal is re-opened.
  useEffect(() => {
    if (open) setSheetView("main");
  }, [open]);

  if (!user) return null;

  async function handleInvitePress() {
    if (!isAuthenticated) {
      await AsyncStorage.setItem("post_auth_redirect", "partner");
      openAuthModal({
        preHeader: "You're one step away from matching together",
        title: "Invite your partner & start matching",
        body: "Create your account to share your link and instantly see your matches together.",
      });
      onClose();
    } else {
      setSheetView("invite");
    }
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={() => { Keyboard.dismiss(); onClose(); }} />

      <View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 16 },
        ]}
      >
        {/* Handle bar */}
        <View style={styles.handle} />

        {/* Header row */}
        <View style={styles.headerRow}>
          {sheetView === "invite" && (
            <Pressable onPress={() => setSheetView("main")} style={styles.backBtn} hitSlop={8}>
              <Feather name="chevron-left" size={20} color={FOREGROUND} />
            </Pressable>
          )}
          <Text style={[styles.sheetTitle, sheetView === "main" && { marginLeft: 0 }]}>
            {sheetView === "main" ? "Connect with Partner" : "Invite Partner"}
          </Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Feather name="x" size={18} color={MUTED_FG} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {sheetView === "main" ? (
            <MainSheetView
              user={user}
              isAuthenticated={isAuthenticated}
              onInvitePress={handleInvitePress}
              updateUser={updateUser}
              onClose={onClose}
            />
          ) : (
            <InviteSheetView userId={user.id} />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main view: invite CTA + join with code ───────────────────────────────────
function MainSheetView({
  user,
  isAuthenticated,
  onInvitePress,
  updateUser,
  onClose,
}: {
  user: { id: string };
  isAuthenticated: boolean;
  onInvitePress: () => void;
  updateUser: (u: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [code,        setCode]        = useState("");
  const [linking,     setLinking]     = useState(false);
  const [linkError,   setLinkError]   = useState("");
  const [linkSuccess, setLinkSuccess] = useState(false);

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLinking(true);
    setLinkError("");
    try {
      const invite = await getInviteByShortCode(trimmed);

      if (!invite) {
        const { data: partner } = await supabase
          .from("users")
          .select("*")
          .eq("invite_code", trimmed)
          .maybeSingle();

        if (!partner) {
          setLinkError("Invalid code. Please check and try again.");
          return;
        }
        if ((partner as { id: string }).id === user.id) {
          setLinkError("You cannot link to yourself.");
          return;
        }
        if ((partner as { partner_id: string | null }).partner_id) {
          setLinkError("This user is already connected with someone else.");
          return;
        }
        await supabase.from("users").update({ partner_id: (partner as { id: string }).id }).eq("id", user.id);
        await supabase.from("users").update({ partner_id: user.id }).eq("id", (partner as { id: string }).id);
        await updateUser({ partner_id: (partner as { id: string }).id });
        setCode("");
        setLinkSuccess(true);
        return;
      }

      const result = await acceptInvite(invite, user.id);
      if (!result.success) {
        setLinkError(result.error ?? "Failed to link partner.");
        return;
      }
      await updateUser({ partner_id: result.inviter_id });
      setCode("");
      setLinkSuccess(true);
    } catch {
      setLinkError("Failed to link partner. Please try again.");
    } finally {
      setLinking(false);
    }
  }

  if (linkSuccess) {
    return (
      <View style={styles.successBlock}>
        <View style={styles.successIcon}>
          <Feather name="check-circle" size={40} color={GRASS} />
        </View>
        <Text style={styles.successTitle}>You're connected!</Text>
        <Text style={styles.successBody}>
          You'll see matches appear when you both like the same name.
        </Text>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.doneBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.doneBtnText}>Start Swiping</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      {/* Invite hero */}
      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Feather name="heart" size={26} color={ROSE_400} />
        </View>
        <Text style={styles.heroTitle}>Find names together</Text>
        <Text style={styles.heroBody}>
          Invite your partner to swipe on names and discover the ones you both love.
        </Text>

        {!isAuthenticated && (
          <View style={styles.authNotice}>
            <Feather name="lock" size={13} color="#d97706" />
            <Text style={styles.authNoticeText}>
              A free account is required to invite your partner via link.
            </Text>
          </View>
        )}

        <Pressable
          onPress={onInvitePress}
          style={({ pressed }) => [styles.inviteBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
        >
          <Feather name="heart" size={16} color="#fff" />
          <Text style={styles.inviteBtnText}>Invite Partner</Text>
        </Pressable>
      </View>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Join with code */}
      <View style={styles.joinCard}>
        <Text style={styles.sectionLabel}>Join with a code</Text>
        <Text style={styles.sectionHint}>Got a code from your partner? Enter it here.</Text>

        <View style={styles.codeRow}>
          <TextInput
            value={code}
            onChangeText={(v) => { setCode(v.toUpperCase()); setLinkError(""); }}
            placeholder="Enter code"
            placeholderTextColor={MUTED_FG}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            style={styles.codeInput}
            editable={!linking}
          />
          <Pressable
            onPress={handleJoin}
            disabled={linking || !code.trim()}
            style={({ pressed }) => [
              styles.joinBtn,
              {
                opacity: linking || !code.trim() ? 0.5 : 1,
                transform: [{ scale: pressed && !!code.trim() ? 0.97 : 1 }],
              },
            ]}
          >
            {linking ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="link-2" size={14} color="#fff" />
                <Text style={styles.joinBtnText}>Join</Text>
              </>
            )}
          </Pressable>
        </View>

        {!!linkError && (
          <View style={styles.errorRow}>
            <Feather name="alert-circle" size={12} color={DESTRUCTIVE} />
            <Text style={styles.errorText}>{linkError}</Text>
          </View>
        )}
      </View>
    </>
  );
}

// ─── Invite view: generate & share link / code ────────────────────────────────
function InviteSheetView({ userId }: { userId: string }) {
  const [invite,     setInvite]     = useState<PartnerInvite | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await createInvite(userId);
      setInvite(data);
    } catch {
      setError("Failed to create invite. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { generate(); }, [generate]);

  async function copyLink() {
    if (!invite) return;
    await Clipboard.setStringAsync(getInviteUrl(invite.token));
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  async function copyCode() {
    if (!invite) return;
    await Clipboard.setStringAsync(invite.short_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  }

  async function handleShare() {
    if (!invite) return;
    const url  = getInviteUrl(invite.token);
    const text = "Join me on WeName to find baby names we both love! Tap the link to connect instantly:";
    try {
      await Share.share({ message: `${text}\n${url}`, url });
    } catch {
      await copyLink();
    }
  }

  if (loading) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 40 }}>
        <ActivityIndicator color={ROSE_400} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorCard}>
        <Feather name="alert-circle" size={16} color={DESTRUCTIVE} />
        <View style={{ flex: 1 }}>
          <Text style={styles.errorCardText}>{error}</Text>
          <Pressable onPress={generate} style={{ marginTop: 6 }}>
            <Text style={[styles.errorCardText, { textDecorationLine: "underline", fontFamily: fonts.displaySemibold }]}>
              Try again
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!invite) return null;

  return (
    <>
      <Text style={styles.inviteIntro}>
        Share this link so your partner can join your baby name list instantly.
      </Text>

      {/* Invite link card */}
      <View style={styles.inviteCard}>
        <Text style={styles.sectionLabel}>Invite link</Text>
        <View style={styles.urlRow}>
          <Feather name="link-2" size={14} color={MUTED_FG} style={{ flexShrink: 0 }} />
          <Text style={styles.urlText} numberOfLines={1}>{getInviteUrl(invite.token)}</Text>
          <Pressable
            onPress={copyLink}
            hitSlop={8}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.88 : 1 }], marginLeft: 4 })}
          >
            <Feather name={copiedLink ? "check" : "copy"} size={16} color={copiedLink ? GRASS : MUTED_FG} />
          </Pressable>
        </View>
        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [styles.shareBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
        >
          <Feather name="share-2" size={16} color="#fff" />
          <Text style={styles.shareBtnText}>Share Invite Link</Text>
        </Pressable>
      </View>

      {/* Short code card */}
      <View style={styles.inviteCard}>
        <Text style={styles.sectionLabel}>Or use this code instead</Text>
        <Text style={styles.sectionHint}>Your partner can enter this code manually in the app.</Text>

        <View style={styles.codeDisplayRow}>
          <Text style={styles.codeDisplayText}>{invite.short_code}</Text>
          <Pressable
            onPress={copyCode}
            hitSlop={8}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.88 : 1 }] })}
          >
            <Feather name={copiedCode ? "check" : "copy"} size={18} color={copiedCode ? GRASS : MUTED_FG} />
          </Pressable>
        </View>

        <Pressable
          onPress={copyCode}
          style={({ pressed }) => [styles.copyCodeBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
        >
          <Feather name={copiedCode ? "check" : "copy"} size={15} color={copiedCode ? GRASS : FOREGROUND} />
          <Text style={[styles.copyCodeBtnText, copiedCode && { color: GRASS }]}>
            {copiedCode ? "Code copied!" : "Copy Code"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.expiryNote}>
        This link and code expire in 7 days. Generate a new one anytime.
      </Text>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: PARCHMENT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
    marginTop: 10,
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: CARD_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    flex: 1,
    fontFamily: fonts.displayBold,
    fontSize: 17,
    color: FOREGROUND,
    textAlign: "center",
    marginLeft: 32,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: CARD_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 14,
  },

  // Hero
  heroCard: {
    backgroundColor: ROSE_50_BG,
    borderColor: ROSE_100,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: "center",
    gap: 10,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heroTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 17,
    color: FOREGROUND,
    textAlign: "center",
  },
  heroBody: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: MUTED_FG,
    textAlign: "center",
    lineHeight: 20,
  },
  authNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#fde68a",
    alignSelf: "stretch",
  },
  authNoticeText: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 12,
    color: "#92400e",
    lineHeight: 17,
  },
  inviteBtn: {
    width: "100%",
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: ROSE_500,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  inviteBtnText: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    color: "#fff",
  },

  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(206,197,185,0.80)",
  },
  dividerText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: MUTED_FG,
  },

  // Join card
  joinCard: {
    backgroundColor: CARD_BG,
    borderColor: "rgba(206,197,185,0.60)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  sectionLabel: {
    fontFamily: fonts.displaySemibold,
    fontSize: 10,
    color: MUTED_FG,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  sectionHint: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: MUTED_FG,
    lineHeight: 18,
    marginTop: -4,
  },
  codeRow: {
    flexDirection: "row",
    gap: 8,
  },
  codeInput: {
    flex: 1,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 16,
    letterSpacing: 3,
    color: FOREGROUND,
    backgroundColor: "#ede5d4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(206,197,185,0.80)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    textTransform: "uppercase",
  },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: BOY_BLUE,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  joinBtnText: {
    fontFamily: fonts.displaySemibold,
    fontSize: 14,
    color: "#fff",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 12,
    color: DESTRUCTIVE,
  },

  // Success block
  successBlock: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 12,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(49,107,70,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    color: FOREGROUND,
  },
  successBody: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: MUTED_FG,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  doneBtn: {
    marginTop: 4,
    paddingVertical: 13,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: GRASS,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  doneBtnText: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    color: "#fff",
  },

  // Invite view
  inviteIntro: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: MUTED_FG,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  inviteCard: {
    backgroundColor: CARD_BG,
    borderColor: "rgba(206,197,185,0.60)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ede5d4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(206,197,185,0.80)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  urlText: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 12,
    color: MUTED_FG,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ROSE_500,
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  shareBtnText: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    color: "#fff",
  },
  codeDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ede5d4",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  codeDisplayText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 5,
    color: FOREGROUND,
  },
  copyCodeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ede5d4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(206,197,185,0.80)",
    paddingVertical: 10,
  },
  copyCodeBtnText: {
    fontFamily: fonts.displaySemibold,
    fontSize: 13,
    color: FOREGROUND,
  },
  expiryNote: {
    fontFamily: fonts.display,
    fontSize: 11,
    color: MUTED_FG,
    textAlign: "center",
    lineHeight: 16,
  },

  // Error card
  errorCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(214,48,48,0.20)",
    padding: 14,
    alignItems: "flex-start",
  },
  errorCardText: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: DESTRUCTIVE,
    lineHeight: 18,
  },
});
