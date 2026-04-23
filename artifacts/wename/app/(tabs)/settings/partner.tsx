import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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

import type { EdgeInsets } from "react-native-safe-area-context";
import { SubPageHeader } from "@/components/SubPageHeader";
import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { supabase } from "@/lib/supabase";
import type { PartnerInvite, User } from "@/lib/supabase";
import {
  createInvite,
  getInviteByShortCode,
  acceptInvite,
  getInviteUrl,
} from "@/lib/inviteService";

// ─── Design tokens ────────────────────────────────────────────────────────────
const PARCHMENT    = "#ede0c8";
const CARD_BG      = "#ede5d4";
const INPUT_BG     = "#f2ece1";
const FOREGROUND   = "#3d2e20";
const MUTED_FG     = "#857d74";
const BORDER       = "#cec5b9";
const BORDER_60    = "rgba(206,197,185,0.60)";
const BORDER_50    = "rgba(206,197,185,0.50)";
const GRASS        = "#316b46";
const GRASS_10     = "rgba(49,107,70,0.10)";
const GRASS_20     = "rgba(49,107,70,0.20)";
const BOY_BLUE     = "#3a71b5";
const ROSE_50_BG   = "#fff1f2";
const AMBER_50_BG  = "#fffbeb";
const ROSE_100     = "#ffe4e6";
const ROSE_400     = "#fb7185";
const ROSE_500     = "#f43f5e";
const ROSE_100_BG  = "#ffe4e6";
const DESTRUCTIVE    = "#d63030";
const DESTRUCTIVE_30 = "rgba(214,48,48,0.30)";
const DESTRUCTIVE_05 = "rgba(214,48,48,0.05)";
const AMBER_50     = "#fffbeb";
const AMBER_200    = "#fde68a";
const AMBER_600    = "#d97706";
const AMBER_700    = "#b45309";

type SubView = "main" | "invite";

type PartnerInfo = {
  display_name: string;
  baby_gender: string | null;
} | null;

// ─── Main export ──────────────────────────────────────────────────────────────
export default function PartnerScreen() {
  const [subView, setSubView] = useState<SubView>("main");
  const insets = useSafeAreaInsets();
  const { user, updateUser, removePartner } = useUser();

  if (!user) return null;

  const title       = subView === "main" ? "Partner" : "Invite Partner";
  const handleBack  = subView === "main" ? undefined : () => setSubView("main");

  return (
    <View style={[styles.root, { backgroundColor: PARCHMENT }]}>
      <SubPageHeader title={title} onBack={handleBack} />

      {subView === "main" ? (
        <MainView
          user={user}
          insets={insets}
          onInvite={() => setSubView("invite")}
          onRemovePartner={removePartner}
          onUpdate={updateUser}
        />
      ) : (
        <InviteView userId={user.id} insets={insets} />
      )}
    </View>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
function MainView({
  user,
  insets,
  onInvite,
  onRemovePartner,
  onUpdate,
}: {
  user: User;
  insets: EdgeInsets;
  onInvite: () => void;
  onRemovePartner: () => Promise<void>;
  onUpdate: (u: Partial<User>) => Promise<void>;
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: insets.bottom + 100,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      {user.partner_id ? (
        <ConnectedView
          user={user}
          onRemovePartner={onRemovePartner}
        />
      ) : (
        <UnconnectedView
          user={user}
          onInvite={onInvite}
          onUpdate={onUpdate}
        />
      )}
    </ScrollView>
  );
}

// ─── Connected state ──────────────────────────────────────────────────────────
function ConnectedView({
  user,
  onRemovePartner,
}: {
  user: User;
  onRemovePartner: () => Promise<void>;
}) {
  const [partnerInfo, setPartnerInfo] = useState<PartnerInfo>(null);

  useEffect(() => {
    if (!user.partner_id) return;
    supabase
      .from("users")
      .select("display_name, baby_gender")
      .eq("id", user.partner_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPartnerInfo({
            display_name: (data as any).display_name || "Partner",
            baby_gender:  (data as any).baby_gender ?? null,
          });
        }
      });
  }, [user.partner_id]);

  const genderLabel = (g: string | null) => {
    if (g === "boy") return "Boy";
    if (g === "girl") return "Girl";
    if (g === "either") return "Either";
    return "—";
  };

  return (
    <>
      {/* Partner info card */}
      <View style={styles.infoCard}>
        {/* Top row */}
        <View style={styles.infoTopRow}>
          <View style={styles.avatarCircle}>
            <Feather name="heart" size={22} color="#f43f5e" />
          </View>
          <View>
            <Text style={styles.partnerName}>
              {partnerInfo?.display_name ?? "Partner"}
            </Text>
            <Text style={styles.connectedBadge}>Connected</Text>
          </View>
        </View>

        {/* Preference row */}
        {partnerInfo && (
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Partner's preference</Text>
            <Text style={styles.prefValue}>{genderLabel(partnerInfo.baby_gender)}</Text>
          </View>
        )}
      </View>

      {/* Info text */}
      <Text style={styles.infoText}>
        You and your partner will see matches when you both like the same name.
      </Text>

      {/* Unlink */}
      <View style={styles.dangerSep}>
        <Pressable
          onPress={() => onRemovePartner()}
          style={({ pressed }) => [
            styles.unlinkBtn,
            { transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
        >
          <Feather name="user-minus" size={16} color={DESTRUCTIVE} />
          <Text style={styles.unlinkText}>Unlink Partner</Text>
        </Pressable>
      </View>
    </>
  );
}

// ─── Unconnected state ────────────────────────────────────────────────────────
function UnconnectedView({
  user,
  onInvite,
  onUpdate,
}: {
  user: User;
  onInvite: () => void;
  onUpdate: (u: Partial<User>) => Promise<void>;
}) {
  const [partnerCode, setPartnerCode]   = useState("");
  const [linking,     setLinking]       = useState(false);
  const [linkError,   setLinkError]     = useState("");
  const [linkSuccess, setLinkSuccess]   = useState(false);

  async function handleJoinWithCode() {
    const code = partnerCode.trim().toUpperCase();
    if (!code) return;
    setLinking(true);
    setLinkError("");
    try {
      // 1. Try modern invite system first
      const invite = await getInviteByShortCode(code);

      if (!invite) {
        // 2. Legacy fallback: look up users.invite_code
        const { data: partner } = await supabase
          .from("users")
          .select("*")
          .eq("invite_code", code)
          .maybeSingle();

        if (!partner) {
          setLinkError("Invalid code. Please check and try again.");
          return;
        }
        if ((partner as any).id === user.id) {
          setLinkError("You cannot link to yourself.");
          return;
        }
        if ((partner as any).partner_id) {
          setLinkError("This user is already connected with someone else.");
          return;
        }
        await supabase.from("users").update({ partner_id: (partner as any).id }).eq("id", user.id);
        await supabase.from("users").update({ partner_id: user.id }).eq("id", (partner as any).id);
        await onUpdate({ partner_id: (partner as any).id });
        setPartnerCode("");
        setLinkSuccess(true);
        return;
      }

      // Modern invite path
      const result = await acceptInvite(invite, user.id);
      if (!result.success) {
        setLinkError(result.error ?? "Failed to link partner.");
        return;
      }
      await onUpdate({ partner_id: result.inviter_id! });
      setPartnerCode("");
      setLinkSuccess(true);
    } catch (e) {
      setLinkError("Failed to link partner. Please try again.");
    } finally {
      setLinking(false);
    }
  }

  return (
    <>
      {/* Hero / invite CTA */}
      <View style={styles.heroCard}>
        <View style={styles.heroIconCircle}>
          <Feather name="heart" size={26} color={ROSE_400} />
        </View>
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text style={styles.heroTitle}>Find names together</Text>
          <Text style={styles.heroBody}>
            Invite your partner to swipe on names and discover the ones you both love.
          </Text>
        </View>
        <Pressable
          onPress={onInvite}
          style={({ pressed }) => [
            styles.inviteBtn,
            { transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
        >
          <Feather name="heart" size={16} color="#fff" />
          <Text style={styles.inviteBtnText}>Invite Partner</Text>
        </Pressable>
      </View>

      {/* Join with code */}
      <View style={styles.joinCard}>
        <View style={{ gap: 2 }}>
          <Text style={styles.joinCardLabel}>Join with code</Text>
          <Text style={styles.joinCardHint}>
            Got a code from your partner? Enter it here.
          </Text>
        </View>

        {linkSuccess ? (
          <View style={styles.successRow}>
            <Feather name="check-circle" size={16} color={GRASS} />
            <Text style={styles.successText}>You're connected!</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={partnerCode}
                onChangeText={(v) => {
                  setPartnerCode(v.toUpperCase());
                  setLinkError("");
                }}
                placeholder="Enter code"
                placeholderTextColor={MUTED_FG}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
                style={[styles.codeInput, { flex: 1, color: FOREGROUND }]}
                editable={!linking}
              />
              <Pressable
                onPress={handleJoinWithCode}
                disabled={linking || !partnerCode.trim()}
                style={({ pressed }) => [
                  styles.joinBtn,
                  {
                    opacity: linking || !partnerCode.trim() ? 0.5 : 1,
                    transform: [{ scale: pressed && !!partnerCode.trim() ? 0.97 : 1 }],
                  },
                ]}
              >
                <Feather name="link-2" size={14} color="#fff" />
                <Text style={styles.joinBtnText}>
                  {linking ? "Joining…" : "Join"}
                </Text>
              </Pressable>
            </View>

            {!!linkError && (
              <View style={styles.errorRow}>
                <Feather name="alert-circle" size={12} color={DESTRUCTIVE} style={{ flexShrink: 0 }} />
                <Text style={styles.errorText}>{linkError}</Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.joinFooter}>
          You'll see a match whenever you and your partner both swipe right on the same name.
        </Text>
      </View>
    </>
  );
}

// ─── Invite view (sub-view='invite') ──────────────────────────────────────────
function InviteView({
  userId,
  insets,
}: {
  userId: string;
  insets: EdgeInsets;
}) {
  const [invite,      setInvite]      = useState<PartnerInvite | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [copiedLink,  setCopiedLink]  = useState(false);
  const [copiedCode,  setCopiedCode]  = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await createInvite(userId);
      setInvite(data);
    } catch (e) {
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

  async function handleShareLink() {
    if (!invite) return;
    const url  = getInviteUrl(invite.token);
    const text = "Join me on WeName to find baby names we both love! Tap the link to connect instantly:";
    try {
      await Share.share({ message: `${text}\n${url}`, url });
    } catch {
      await copyLink();
    }
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: insets.bottom + 100,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Invite your partner</Text>
        <Text style={styles.heroBody}>
          Share this link so your partner can join your baby name list instantly.
        </Text>
      </View>

      {loading && (
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <ActivityIndicator color={ROSE_400} size="large" />
        </View>
      )}

      {!loading && !!error && (
        <View style={styles.errorCard}>
          <Feather name="alert-circle" size={16} color={DESTRUCTIVE} style={{ marginTop: 2, flexShrink: 0 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.errorCardText}>{error}</Text>
            <Pressable onPress={generate} style={{ marginTop: 6 }}>
              <Text style={[styles.errorCardText, { textDecorationLine: "underline", fontFamily: fonts.displaySemibold }]}>
                Try again
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {!loading && invite && (
        <>
          {/* Invite link card */}
          <View style={styles.infoCard}>
            <Text style={styles.joinCardLabel}>Invite link</Text>

            <View style={styles.urlRow}>
              <Feather name="link-2" size={14} color={MUTED_FG} style={{ flexShrink: 0 }} />
              <Text style={styles.urlText} numberOfLines={1}>
                {getInviteUrl(invite.token)}
              </Text>
              <Pressable
                onPress={copyLink}
                style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.9 : 1 }], marginLeft: 4 })}
              >
                <Feather
                  name={copiedLink ? "check" : "copy"}
                  size={16}
                  color={copiedLink ? GRASS : MUTED_FG}
                />
              </Pressable>
            </View>

            <Pressable
              onPress={handleShareLink}
              style={({ pressed }) => [
                styles.shareBtn,
                { transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <Feather name="share-2" size={16} color="#fff" />
              <Text style={styles.shareBtnText}>Share Invite Link</Text>
            </Pressable>
          </View>

          {/* Short code card */}
          <View style={styles.infoCard}>
            <View style={{ gap: 2 }}>
              <Text style={styles.joinCardLabel}>Or use this code instead</Text>
              <Text style={styles.joinCardHint}>
                Your partner can enter this code manually in the app.
              </Text>
            </View>

            <View style={styles.codeDisplayRow}>
              <Text style={styles.codeDisplayText}>{invite.short_code}</Text>
              <Pressable
                onPress={copyCode}
                style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.9 : 1 }] })}
              >
                <Feather
                  name={copiedCode ? "check" : "copy"}
                  size={18}
                  color={copiedCode ? GRASS : MUTED_FG}
                />
              </Pressable>
            </View>

            <Pressable
              onPress={copyCode}
              style={({ pressed }) => [
                styles.copyCodeBtn,
                { transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <Feather
                name={copiedCode ? "check" : "copy"}
                size={15}
                color={copiedCode ? GRASS : FOREGROUND}
              />
              <Text style={[styles.copyCodeBtnText, copiedCode && { color: GRASS }]}>
                {copiedCode ? "Code copied!" : "Copy Code"}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.expiryNote}>
            This link and code expire in 7 days. Generate a new one anytime.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  // Connected
  infoCard: {
    backgroundColor: CARD_BG,
    borderColor: BORDER_60,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  infoTopRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: ROSE_100_BG,
    alignItems: "center", justifyContent: "center",
  },
  partnerName: { fontFamily: fonts.displayBold, fontSize: 16, color: FOREGROUND },
  connectedBadge: {
    fontFamily: fonts.displaySemibold, fontSize: 10,
    color: GRASS, textTransform: "uppercase", letterSpacing: 0.5,
  },
  prefRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#dfd6c8", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  prefLabel: { fontFamily: fonts.display, fontSize: 10, color: MUTED_FG },
  prefValue: { fontFamily: fonts.displaySemibold, fontSize: 10, color: FOREGROUND },
  infoText: {
    fontFamily: fonts.display, fontSize: 10, color: MUTED_FG,
    textAlign: "center", paddingHorizontal: 16,
  },
  dangerSep: { borderTopWidth: 1, borderTopColor: BORDER_50, paddingTop: 16 },
  unlinkBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 16,
    borderWidth: 1, borderColor: DESTRUCTIVE_30, backgroundColor: DESTRUCTIVE_05,
  },
  unlinkText: { fontFamily: fonts.displaySemibold, fontSize: 14, color: DESTRUCTIVE },

  // Hero
  heroCard: {
    backgroundColor: ROSE_50_BG,
    borderColor: ROSE_100,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 24,
    alignItems: "center",
    gap: 12,
  },
  heroIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  heroTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: FOREGROUND, textAlign: "center" },
  heroBody:  { fontFamily: fonts.display, fontSize: 14, color: MUTED_FG, textAlign: "center", lineHeight: 21 },
  inviteBtn: {
    width: "100%", paddingVertical: 14, borderRadius: 12,
    backgroundColor: ROSE_500,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  inviteBtnText: { fontFamily: fonts.displayBold, fontSize: 14, color: "#fff" },

  // Join card
  joinCard: {
    backgroundColor: CARD_BG, borderColor: BORDER_60, borderWidth: 1,
    borderRadius: 16, padding: 16, gap: 12,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  joinCardLabel: {
    fontFamily: fonts.displaySemibold, fontSize: 10, color: MUTED_FG,
    textTransform: "uppercase", letterSpacing: 1.2,
  },
  joinCardHint: { fontFamily: fonts.display, fontSize: 10, color: MUTED_FG },
  codeInput: {
    backgroundColor: INPUT_BG, borderColor: BORDER, borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: "monospace", fontSize: 14,
    textTransform: "uppercase", letterSpacing: 2,
  },
  joinBtn: {
    backgroundColor: BOY_BLUE, borderRadius: 12,
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  joinBtnText: { fontFamily: fonts.displaySemibold, fontSize: 14, color: "#fff" },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { fontFamily: fonts.display, fontSize: 10, color: DESTRUCTIVE, flex: 1 },
  successRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: GRASS_10, borderColor: GRASS_20, borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
  },
  successText: { fontFamily: fonts.displaySemibold, fontSize: 14, color: GRASS },
  joinFooter: {
    fontFamily: fonts.display, fontSize: 10, color: MUTED_FG,
    textAlign: "center", paddingHorizontal: 16,
  },

  // Invite view
  errorCard: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    backgroundColor: "rgba(214,48,48,0.10)", borderColor: "rgba(214,48,48,0.20)",
    borderWidth: 1, borderRadius: 16, padding: 16,
  },
  errorCardText: { fontFamily: fonts.display, fontSize: 14, color: DESTRUCTIVE },
  urlRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: INPUT_BG, borderColor: BORDER, borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  urlText: { fontFamily: fonts.display, fontSize: 10, color: MUTED_FG, flex: 1 },
  shareBtn: {
    width: "100%", paddingVertical: 14, borderRadius: 12,
    backgroundColor: ROSE_500,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  shareBtnText: { fontFamily: fonts.displayBold, fontSize: 14, color: "#fff" },
  codeDisplayRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: INPUT_BG, borderColor: BORDER, borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  codeDisplayText: {
    flex: 1, fontFamily: "monospace", fontWeight: "700",
    fontSize: 24, color: FOREGROUND, letterSpacing: 8, textAlign: "center",
  },
  copyCodeBtn: {
    width: "100%", paddingVertical: 12, borderRadius: 12,
    backgroundColor: INPUT_BG, borderColor: BORDER_60, borderWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  copyCodeBtnText: { fontFamily: fonts.displaySemibold, fontSize: 14, color: FOREGROUND },
  expiryNote: {
    fontFamily: fonts.display, fontSize: 10, color: MUTED_FG,
    textAlign: "center", paddingHorizontal: 16,
  },
});
