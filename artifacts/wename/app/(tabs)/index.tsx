import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import NameCard, { NameCardHandle } from "@/components/NameCard";
import { PremiumModal } from "@/components/PremiumModal";
import { useUser } from "@/components/UserContext";
import { useColors } from "@/hooks/useColors";
import { useDailyLimits } from "@/hooks/useDailyLimits";
import { getPartnerCreatedNames, getSwipeableNames } from "@/lib/namePacks";
import { Name, supabase } from "@/lib/supabase";

type LimitType = "swipe" | "like" | "match" | null;

export default function SwipeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, updateUser } = useUser();
  const insets = useSafeAreaInsets();
  const [names, setNames] = useState<Name[]>([]);
  const [partnerPickIds, setPartnerPickIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchedName, setMatchedName] = useState<Name | null>(null);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [limitType, setLimitType] = useState<LimitType>(null);
  const [history, setHistory] = useState<{ nameId: string; liked: boolean }[]>([]);
  const cardRef = useRef<NameCardHandle>(null);

  const limits = useDailyLimits(user!, updateUser);

  const loadNames = useCallback(
    async (includeAlready = false) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const { data: swipes } = await supabase
          .from("swipes")
          .select("name_id")
          .eq("user_id", user.id);
        const swiped = new Set((swipes ?? []).map((s: { name_id: string }) => s.name_id));
        const gender = user.baby_gender ?? "either";
        const [all, partner] = await Promise.all([
          getSwipeableNames(user.id, gender),
          user.partner_id
            ? getPartnerCreatedNames(user.partner_id, gender)
            : Promise.resolve([] as Name[]),
        ]);
        if (all.length === 0 && partner.length === 0) {
          throw new Error("No names available in the selected packs");
        }
        setPartnerPickIds(new Set(partner.map((n) => n.id)));
        let filtered = includeAlready ? all : all.filter((n) => !swiped.has(n.id));
        if (filtered.length === 0 && !includeAlready) filtered = all;
        const combined = [...filtered, ...partner];
        const shuffled = [...combined].sort(() => Math.random() - 0.5);
        setNames(shuffled);
        setCurrentIndex(0);
        setHistory([]);
      } catch (e) {
        console.error("[SwipeScreen] loadNames error", e);
        setError(e instanceof Error ? e.message : "Failed to load names");
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    loadNames();
  }, [loadNames, user?.baby_gender, user?.partner_id]);

  useFocusEffect(
    useCallback(() => {
      // refresh on focus only if we're empty
      if (names.length === 0 && !loading) loadNames();
    }, [names.length, loading, loadNames]),
  );

  async function checkForMatch(name: Name) {
    if (!user?.partner_id) return;
    const { data: partnerSwipe } = await supabase
      .from("swipes")
      .select("*")
      .eq("user_id", user.partner_id)
      .eq("name_id", name.id)
      .eq("liked", true)
      .maybeSingle();
    if (!partnerSwipe) return;
    const [a, b] = [user.id, user.partner_id].sort();
    await supabase
      .from("matches")
      .insert({ name_id: name.id, user_a_id: a, user_b_id: b, gender: name.gender });
    const canReveal = await limits.checkCanRevealMatch();
    if (canReveal) setMatchedName(name);
    else {
      setLimitType("match");
      setPremiumOpen(true);
    }
  }

  async function handleSwipe(liked: boolean) {
    const current = names[currentIndex];
    if (!current || !user) return;
    const { allowed, limitType: lt } = await limits.checkCanSwipe(liked);
    if (!allowed) {
      setLimitType(lt);
      setPremiumOpen(true);
      return;
    }
    setHistory((p) => [...p, { nameId: current.id, liked }]);
    setCurrentIndex((i) => i + 1);
    try {
      await supabase
        .from("swipes")
        .upsert(
          { user_id: user.id, name_id: current.id, liked },
          { onConflict: "user_id,name_id" },
        );
      if (liked && user.partner_id) await checkForMatch(current);
    } catch (e) {
      console.error("[SwipeScreen] save swipe error", e);
    }
  }

  async function handleUndo() {
    if (history.length === 0 || currentIndex === 0 || !user) return;
    const last = history[history.length - 1];
    setHistory((p) => p.slice(0, -1));
    setCurrentIndex((i) => i - 1);
    try {
      await supabase
        .from("swipes")
        .delete()
        .eq("user_id", user.id)
        .eq("name_id", last.nameId);
    } catch (e) {
      console.error("[SwipeScreen] undo error", e);
    }
  }

  useEffect(() => {
    if (matchedName) {
      const t = setTimeout(() => setMatchedName(null), 4000);
      return () => clearTimeout(t);
    }
  }, [matchedName]);

  if (!user || loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.parchment }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.parchment, padding: 24 },
        ]}
      >
        <Feather name="alert-triangle" size={32} color={colors.destructive} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>Oops</Text>
        <Text style={[styles.errorBody, { color: colors.mutedForeground }]}>{error}</Text>
        <Pressable
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={() => loadNames()}
        >
          <Text style={styles.retryBtnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  const remaining = Math.max(0, names.length - currentIndex - 1);
  const current = names[currentIndex];
  const next = names[currentIndex + 1] ?? null;

  if (!current) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.parchment, padding: 24 },
        ]}
      >
        <Feather name="check-circle" size={36} color={colors.grass} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>All done!</Text>
        <Text style={[styles.errorBody, { color: colors.mutedForeground }]}>
          You've swiped through every available name.
        </Text>
        <Pressable
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={() => loadNames(true)}
        >
          <Text style={styles.retryBtnText}>Start over</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.parchment,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 70,
        },
      ]}
    >
      <View style={styles.cardArea}>
        {next && (
          <NameCard
            key={`next-${next.id}`}
            name={next.text}
            pronunciation={next.pronunciation}
            origin={next.origin}
            meaning={next.meaning}
            nickname={next.nickname}
            rank={next.rank}
            gender={next.gender}
            remaining={Math.max(0, remaining - 1)}
            lastName={user.baby_last_name ?? undefined}
            isPartnerPick={partnerPickIds.has(next.id)}
            isNext
            onSwipe={() => {}}
          />
        )}
        <NameCard
          key={current.id}
          ref={cardRef}
          name={current.text}
          pronunciation={current.pronunciation}
          origin={current.origin}
          meaning={current.meaning}
          nickname={current.nickname}
          rank={current.rank}
          gender={current.gender}
          remaining={remaining}
          lastName={user.baby_last_name ?? undefined}
          isPartnerPick={partnerPickIds.has(current.id)}
          canUndo={history.length > 0 && currentIndex > 0}
          onSwipe={handleSwipe}
          onUndo={handleUndo}
        />
      </View>

      <Modal
        visible={!!matchedName}
        transparent
        animationType="fade"
        onRequestClose={() => setMatchedName(null)}
      >
        <View style={styles.matchBackdrop}>
          <View style={[styles.matchCard, { backgroundColor: colors.parchment }]}>
            <Feather name="heart" size={56} color={colors.heart} />
            <Text style={[styles.matchTitle, { color: colors.grass }]}>
              It's a Match!
            </Text>
            <Text style={[styles.matchBody, { color: colors.mutedForeground }]}>
              You both love the name
            </Text>
            <Text
              style={[
                styles.matchName,
                {
                  color:
                    matchedName?.gender === "boy" ? colors.boy : colors.girlRed,
                },
              ]}
            >
              {matchedName?.text}
            </Text>
            {!!user.baby_last_name && (
              <Text style={[styles.matchLastName, { color: colors.foreground }]}>
                {user.baby_last_name}
              </Text>
            )}
            <Pressable
              style={[styles.matchBtn, { backgroundColor: colors.primary }]}
              onPress={() => setMatchedName(null)}
            >
              <Text style={styles.matchBtnText}>Keep swiping</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMatchedName(null);
                router.push("/(tabs)/names");
              }}
            >
              <Text style={[styles.matchSecondary, { color: colors.primary }]}>
                See all matches
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <PremiumModal
        open={premiumOpen}
        limitType={limitType}
        onClose={() => setPremiumOpen(false)}
        onUpgrade={() => setPremiumOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  cardArea: { flex: 1, position: "relative" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  errorTitle: { fontSize: 22, fontWeight: "700", marginTop: 8 },
  errorBody: { fontSize: 14, textAlign: "center", marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  retryBtnText: { color: "#fff", fontWeight: "700" },
  matchBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  matchCard: {
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
  },
  matchTitle: { fontSize: 30, fontWeight: "800", marginTop: 8 },
  matchBody: { fontSize: 14, marginTop: 4 },
  matchName: { fontSize: 44, fontWeight: "800", marginTop: 12 },
  matchLastName: { fontSize: 20, fontWeight: "600", marginTop: 4 },
  matchBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  matchBtnText: { color: "#fff", fontWeight: "700" },
  matchSecondary: { marginTop: 12, fontSize: 14, fontWeight: "500" },
});
