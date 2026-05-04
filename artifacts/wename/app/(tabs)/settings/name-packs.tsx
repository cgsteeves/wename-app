import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PremiumModal } from "@/components/PremiumModal";
import { SubPageHeader } from "@/components/SubPageHeader";
import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { getAllPacks, getUserSelectedPacks } from "@/lib/namePacks";
import { NamePack } from "@/lib/supabase";

export default function NamePacksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, changeSelectedPack } = useUser();
  const [packs, setPacks] = useState<NamePack[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [premiumOpen, setPremiumOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [all, sel] = await Promise.all([getAllPacks(), getUserSelectedPacks(user.id)]);
        if (cancelled) return;
        setPacks(all);
        setSelected(sel[0] ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;
  const isPremium = user.plan_tier === "premium";

  async function pick(slug: string) {
    const pack = packs.find((p) => p.slug === slug);
    if (pack?.is_premium && !isPremium) {
      setPremiumOpen(true);
      return;
    }
    setSelected(slug);
    await changeSelectedPack(slug);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment }}>
      <SubPageHeader title="Name Packs" subtitle="Pick your themes" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90, gap: 12 }}>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 14,
            color: colors.mutedForeground,
            textAlign: "center",
            lineHeight: 22,
            marginBottom: 8,
          }}
        >
          Choose name packs to customize which names appear in your swipe deck.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border + "99" },
            ]}
          >
            {packs.map((pack, i) => {
              const active = selected === pack.slug;
              const locked = pack.is_premium && !isPremium;
              return (
                <Pressable
                  key={pack.slug}
                  onPress={() => pick(pack.slug)}
                  style={[
                    styles.row,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border + "55",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      {
                        borderColor: active ? colors.grass : colors.border,
                        backgroundColor: active ? colors.grass : "transparent",
                      },
                    ]}
                  >
                    {active && <Feather name="check" size={11} color="#fff" />}
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: fonts.displayMedium,
                      fontSize: 14,
                      color: active ? colors.foreground : colors.foreground + "cc",
                    }}
                  >
                    {pack.display_name}
                  </Text>
                  {locked ? (
                    <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                      <Feather name="lock" size={12} color="#d97706" />
                      <Text style={{ color: "#d97706", fontFamily: fonts.displaySemibold, fontSize: 12 }}>
                        Premium
                      </Text>
                    </View>
                  ) : active ? (
                    <View style={[styles.activePill, { borderColor: "hsla(145,45%,35%,0.45)", backgroundColor: "hsla(145,45%,35%,0.1)" }]}>
                      <Feather name="check" size={11} color={colors.grass} />
                      <Text style={{ color: colors.grass, fontFamily: fonts.displaySemibold, fontSize: 11 }}>
                        Active
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        <View
          style={[
            styles.comingSoon,
            { backgroundColor: colors.card, borderColor: colors.border + "60" },
          ]}
        >
          <View style={[styles.iconBadge, { backgroundColor: colors.grass + "1a" }]}>
            <Feather name="package" size={15} color={colors.grass} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.displaySemibold, fontSize: 14, color: colors.foreground }}>
              More packs coming soon
            </Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 12, color: colors.mutedForeground, lineHeight: 18 }}>
              We're adding new themed packs every month.
            </Text>
          </View>
        </View>
      </ScrollView>

      <PremiumModal
        open={premiumOpen}
        limitType={null}
        onClose={() => setPremiumOpen(false)}
        onUpgrade={() => setPremiumOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    height: 52,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  comingSoon: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    alignItems: "center",
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
