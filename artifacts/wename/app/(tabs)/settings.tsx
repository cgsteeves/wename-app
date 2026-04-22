import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PremiumModal } from "@/components/PremiumModal";
import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { FREE_LIMITS } from "@/hooks/useDailyLimits";
import {
  getAllPacks,
  getUserSelectedPacks,
  setUserPack,
} from "@/lib/namePacks";
import { NamePack } from "@/lib/supabase";

type Gender = "boy" | "girl" | "either";

export default function SettingsScreen() {
  const colors = useColors();
  const { user, updateUser, removePartner, linkPartnerByCode, signOutLocal } =
    useUser();
  const insets = useSafeAreaInsets();
  const [lastName, setLastName] = useState(user?.baby_last_name ?? "");
  const [partnerCode, setPartnerCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [packs, setPacks] = useState<NamePack[]>([]);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLastName(user?.baby_last_name ?? "");
  }, [user?.baby_last_name]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [allPacks, sel] = await Promise.all([
          getAllPacks(),
          getUserSelectedPacks(user.id),
        ]);
        if (cancelled) return;
        setPacks(allPacks);
        setSelectedPack(sel[0] ?? null);
      } catch (e) {
        console.error("[Settings] load packs", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.parchment }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  async function setGender(g: Gender) {
    await updateUser({ baby_gender: g });
  }

  async function saveLastName() {
    await updateUser({ baby_last_name: lastName.trim() || null });
    Alert.alert("Saved", "Last name updated");
  }

  async function copyInvite() {
    if (!user) return;
    await Clipboard.setStringAsync(user.invite_code);
    Alert.alert("Copied", `Code ${user.invite_code} copied to clipboard`);
  }

  async function shareInvite() {
    if (!user) return;
    await Share.share({
      message: `Join me on WeName to pick a baby name together! My code is ${user.invite_code}`,
    });
  }

  async function handleLink() {
    setLinking(true);
    const res = await linkPartnerByCode(partnerCode);
    setLinking(false);
    if (!res.ok) {
      Alert.alert("Could not link", res.error ?? "Unknown error");
      return;
    }
    setPartnerCode("");
    Alert.alert("Linked!", "You're now connected with your partner.");
  }

  async function handleUnlink() {
    Alert.alert("Unlink partner?", "This will also delete all your matches.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unlink",
        style: "destructive",
        onPress: () => removePartner(),
      },
    ]);
  }

  async function selectPack(slug: string) {
    if (!user) return;
    const pack = packs.find((p) => p.slug === slug);
    if (pack?.is_premium && user.plan_tier !== "premium") {
      setPremiumOpen(true);
      return;
    }
    setSelectedPack(slug);
    try {
      await setUserPack(user.id, slug);
    } catch (e) {
      console.error("[Settings] setUserPack", e);
    }
  }

  async function handleSignOut() {
    Alert.alert(
      "Reset device data?",
      "This clears your stored device ID. Your data on the server is kept, but you'll start fresh as a new user on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => signOutLocal(),
        },
      ],
    );
  }

  const isPremium = user.plan_tier === "premium";

  return (
    <ScrollView
      style={{ backgroundColor: colors.parchment }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 90,
        },
      ]}
    >
      <View style={styles.headerWrap}>
        <Text style={[styles.title, { color: colors.grass }]}>
          🌿 Settings ☀️
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Customize your experience
        </Text>
      </View>

      <Section title="Daily usage" colors={colors}>
        <View style={styles.usageRow}>
          <UsageStat
            label="Swipes"
            value={user.daily_swipe_count ?? 0}
            max={FREE_LIMITS.swipes}
            isPremium={isPremium}
            color={colors.primary}
          />
          <UsageStat
            label="Likes"
            value={user.daily_like_count ?? 0}
            max={FREE_LIMITS.likes}
            isPremium={isPremium}
            color={colors.heart}
          />
          <UsageStat
            label="Matches"
            value={user.daily_match_count ?? 0}
            max={FREE_LIMITS.matches}
            isPremium={isPremium}
            color={colors.accent}
          />
        </View>
      </Section>

      <Section title="Baby preferences" colors={colors}>
        <Text style={[styles.smallLabel, { color: colors.mutedForeground }]}>
          Gender
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["boy", "girl", "either"] as const).map((g) => {
            const active = user.baby_gender === g;
            const c = g === "boy" ? colors.boy : g === "girl" ? colors.girl : colors.either;
            return (
              <Pressable
                key={g}
                onPress={() => setGender(g)}
                style={[
                  styles.genderBtn,
                  {
                    backgroundColor: active ? c : "transparent",
                    borderColor: c,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? "#fff" : c,
                    fontWeight: "600",
                    textTransform: "capitalize",
                  }}
                >
                  {g}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text
          style={[styles.smallLabel, { color: colors.mutedForeground, marginTop: 16 }]}
        >
          Baby's last name
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="Optional"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.foreground, flex: 1 },
            ]}
          />
          <Pressable
            onPress={saveLastName}
            style={[styles.btn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.btnText}>Save</Text>
          </Pressable>
        </View>
      </Section>

      <Section title="Partner" colors={colors}>
        {user.partner_id ? (
          <View style={{ gap: 12 }}>
            <View
              style={[
                styles.linkedBox,
                { backgroundColor: colors.grass + "1a", borderColor: colors.grass + "55" },
              ]}
            >
              <Feather name="check-circle" size={18} color={colors.grass} />
              <Text style={{ color: colors.foreground, flex: 1, fontWeight: "500" }}>
                Connected with your partner
              </Text>
            </View>
            <Pressable
              onPress={handleUnlink}
              style={[styles.btn, { backgroundColor: colors.destructive }]}
            >
              <Text style={styles.btnText}>Unlink partner</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View>
              <Text style={[styles.smallLabel, { color: colors.mutedForeground }]}>
                Your invite code
              </Text>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <View
                  style={[
                    styles.codeBox,
                    { borderColor: colors.border, backgroundColor: colors.card },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "800",
                      letterSpacing: 4,
                      color: colors.foreground,
                    }}
                  >
                    {user.invite_code}
                  </Text>
                </View>
                <Pressable onPress={copyInvite} style={styles.iconBtn}>
                  <Feather name="copy" size={18} color={colors.primary} />
                </Pressable>
                <Pressable onPress={shareInvite} style={styles.iconBtn}>
                  <Feather name="share-2" size={18} color={colors.primary} />
                </Pressable>
              </View>
            </View>
            <View>
              <Text style={[styles.smallLabel, { color: colors.mutedForeground }]}>
                Or enter your partner's code
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  value={partnerCode}
                  onChangeText={(v) => setPartnerCode(v.toUpperCase())}
                  placeholder="PARTNER CODE"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="characters"
                  maxLength={8}
                  style={[
                    styles.input,
                    {
                      borderColor: colors.border,
                      color: colors.foreground,
                      flex: 1,
                      letterSpacing: 4,
                      textAlign: "center",
                    },
                  ]}
                />
                <Pressable
                  onPress={handleLink}
                  disabled={linking || partnerCode.length === 0}
                  style={[
                    styles.btn,
                    {
                      backgroundColor: colors.primary,
                      opacity: linking || partnerCode.length === 0 ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text style={styles.btnText}>{linking ? "..." : "Link"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Section>

      <Section title="Name pack" colors={colors}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : packs.length === 0 ? (
          <Text style={{ color: colors.mutedForeground }}>No packs available</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {packs.map((pack) => {
              const active = selectedPack === pack.slug;
              const locked = pack.is_premium && !isPremium;
              return (
                <Pressable
                  key={pack.slug}
                  onPress={() => selectPack(pack.slug)}
                  style={[
                    styles.packRow,
                    {
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary + "15" : colors.card,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontWeight: "700", color: colors.foreground }}>
                        {pack.display_name}
                      </Text>
                      {pack.is_premium && (
                        <View
                          style={[
                            styles.premiumChip,
                            { backgroundColor: colors.accent + "22" },
                          ]}
                        >
                          <Feather name="star" size={10} color={colors.accent} />
                          <Text style={{ color: colors.accent, fontSize: 10, fontWeight: "700" }}>
                            PREMIUM
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                      {pack.category}
                    </Text>
                  </View>
                  {locked ? (
                    <Feather name="lock" size={18} color={colors.mutedForeground} />
                  ) : active ? (
                    <Feather name="check-circle" size={18} color={colors.primary} />
                  ) : (
                    <Feather name="circle" size={18} color={colors.mutedForeground} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </Section>

      <Section title="Plan" colors={colors}>
        <View
          style={[
            styles.planCard,
            {
              backgroundColor: isPremium ? colors.accent + "1a" : colors.card,
              borderColor: isPremium ? colors.accent : colors.border,
            },
          ]}
        >
          <Feather
            name={isPremium ? "star" : "user"}
            size={22}
            color={isPremium ? colors.accent : colors.mutedForeground}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700", color: colors.foreground }}>
              {isPremium ? "Premium" : "Free"}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              {isPremium ? "Unlimited everything" : "30 swipes / 8 likes / 3 matches per day"}
            </Text>
          </View>
          {!isPremium && (
            <Pressable
              style={[styles.btn, { backgroundColor: colors.accent }]}
              onPress={() => setPremiumOpen(true)}
            >
              <Text style={styles.btnText}>Upgrade</Text>
            </Pressable>
          )}
        </View>
      </Section>

      <Section title="Account" colors={colors}>
        <Pressable
          onPress={handleSignOut}
          style={[
            styles.btn,
            { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
          ]}
        >
          <Text style={{ color: colors.foreground, fontWeight: "600" }}>
            Reset device data
          </Text>
        </Pressable>
      </Section>

      <PremiumModal
        open={premiumOpen}
        limitType={null}
        onClose={() => setPremiumOpen(false)}
        onUpgrade={() => setPremiumOpen(false)}
      />
    </ScrollView>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        {title.toUpperCase()}
      </Text>
      <View
        style={[styles.sectionBody, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {children}
      </View>
    </View>
  );
}

function UsageStat({
  label,
  value,
  max,
  isPremium,
  color,
}: {
  label: string;
  value: number;
  max: number;
  isPremium: boolean;
  color: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color, fontSize: 22, fontWeight: "800" }}>
        {isPremium ? "∞" : `${value}/${max}`}
      </Text>
      <Text style={{ color: "#7a6a52", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerWrap: { alignItems: "center", marginBottom: 4 },
  title: { fontSize: 30, fontFamily: fonts.hand, lineHeight: 38 },
  subtitle: { fontSize: 14, fontFamily: fonts.hand, marginTop: 2 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 11, fontFamily: fonts.displaySemibold, letterSpacing: 1.4, marginLeft: 4 },
  sectionBody: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  smallLabel: { fontSize: 12, marginBottom: 6 },
  usageRow: { flexDirection: "row", justifyContent: "space-around" },
  genderBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  linkedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  codeBox: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d9c89c",
    backgroundColor: "#fdf7e6",
  },
  packRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  premiumChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
});
