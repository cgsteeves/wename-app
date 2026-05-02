import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue, withSpring } from "react-native-reanimated";

import { FirstLikePartnerModal } from "@/components/FirstLikePartnerModal";
import { MatchCelebrationModal } from "@/components/MatchCelebrationModal";
import NameCard, { NameCardHandle } from "@/components/NameCard";
import { PremiumModal } from "@/components/PremiumModal";
import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { FREE_LIMITS, useDailyLimits } from "@/hooks/useDailyLimits";
import { getPartnerCreatedNames, getSwipeableNames } from "@/lib/namePacks";
import { Name, supabase } from "@/lib/supabase";

type LimitType = "swipe" | "like" | "match" | "discover" | null;

export default function SwipeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, updateUser, selectedPackSlug } = useUser();
  const insets = useSafeAreaInsets();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  // Consume post-auth redirect params (e.g. after signing in from partner invite gate)
  useEffect(() => {
    if (redirect === "partner" && user) {
      router.replace("/(tabs)/settings/partner?autoInvite=1");
    }
  }, [redirect, user]);

  const [names, setNames] = useState<Name[]>([]);
  const [partnerPickIds, setPartnerPickIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  // Tracks whether the swipe tab is currently focused so the partner-pick poll
  // skips cycles when the user is on a different tab.
  const isFocusedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchedName, setMatchedName] = useState<Name | null>(null);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [limitType, setLimitType] = useState<LimitType>(null);
  const [history, setHistory] = useState<{ nameId: string; liked: boolean }[]>([]);
  const [firstLikeOpen, setFirstLikeOpen] = useState(false);
  const cardRef = useRef<NameCardHandle>(null);
  const dragProgress = useSharedValue(0);
  const undoInProgress = useRef(false);

  const limits = useDailyLimits(user, updateUser);

  const firstLikeKey = user ? `first_like_partner_shown_${user.id}` : "";
  const maybeShowFirstLike = useCallback(async () => {
    if (!user || !firstLikeKey) return;
    const seen = await AsyncStorage.getItem(firstLikeKey);
    if (seen) return;
    await AsyncStorage.setItem(firstLikeKey, "1");
    setFirstLikeOpen(true);
  }, [user, firstLikeKey]);

  const userId = user?.id;
  const userGender = user?.baby_gender;
  const partnerId = user?.partner_id;
  const activePack = selectedPackSlug;

  const loadNames = useCallback(
    async (includeAlready = false) => {
      if (!userId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: swipes } = await supabase
          .from("swipes")
          .select("name_id")
          .eq("user_id", userId);
        const swiped = new Set((swipes ?? []).map((s: { name_id: string }) => s.name_id));
        const gender = userGender ?? "either";
        const packOverride = activePack ? [activePack] : undefined;
        const [all, partner] = await Promise.all([
          getSwipeableNames(userId, gender, packOverride),
          partnerId
            ? getPartnerCreatedNames(partnerId, gender)
            : Promise.resolve([] as Name[]),
        ]);
        if (all.length === 0 && partner.length === 0) {
          throw new Error("No names available in the selected packs");
        }
        // Filter partner picks against already-swiped so the user never sees a
        // duplicate they already acted on (partner picks are not reset by "Start Over").
        const partnerFiltered = partner.filter((n) => !swiped.has(n.id));
        setPartnerPickIds(new Set(partnerFiltered.map((n) => n.id)));
        let filtered = includeAlready ? all : all.filter((n) => !swiped.has(n.id));
        if (filtered.length === 0 && !includeAlready) filtered = all;
        const combined = [...filtered, ...partnerFiltered];
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
    [userId, userGender, partnerId, activePack],
  );

  useEffect(() => {
    loadNames();
  }, [loadNames]);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      // refresh on focus only if we're empty
      if (names.length === 0 && !loading) loadNames();
      return () => { isFocusedRef.current = false; };
    }, [names.length, loading, loadNames]),
  );

  // Poll for new partner custom names every 15 seconds.
  // Uses a timestamp cursor so most polls return 0 rows (cheap).
  // Name details are only fetched when the partner actually added something new.
  // New names are appended after the current card — the active swipe is never interrupted.
  useEffect(() => {
    if (!partnerId || !userId) return;
    let lastChecked = new Date().toISOString();

    const poll = async () => {
      // Skip if the user is on a different tab — no point fetching while off-screen.
      if (!isFocusedRef.current) return;
      const since = lastChecked;
      lastChecked = new Date().toISOString();
      try {
        // Only look at partner swipes newer than the last check
        const { data: newSwipes } = await supabase
          .from("swipes")
          .select("name_id")
          .eq("user_id", partnerId)
          .eq("liked", true)
          .gt("created_at", since);
        if (!newSwipes || newSwipes.length === 0) return;

        const nameIds = (newSwipes as Array<{ name_id: string }>).map(
          (s) => s.name_id,
        );
        const gender = userGender ?? "either";

        // Fetch name details — must be user-created (privacy: catalog names are
        // already in both users' decks via get_swipeable_names)
        let q = supabase
          .from("names")
          .select(
            "uuid, name, gender, pronunciation, origin, meaning, nickname, rank, created_by_user_id",
          )
          .in("uuid", nameIds)
          .eq("user_created", true);
        if (gender !== "either") q = q.eq("gender", gender);
        const { data: nameRows } = await q;
        if (!nameRows || nameRows.length === 0) return;

        // Filter out names the current user already swiped
        const { data: mySwipes } = await supabase
          .from("swipes")
          .select("name_id")
          .eq("user_id", userId);
        const swiped = new Set(
          (mySwipes ?? []).map((s: { name_id: string }) => s.name_id),
        );

        const str = (v: unknown): string | null => {
          const s = v == null ? "" : String(v).trim();
          return s === "" || s === "\\N" || s === "Unknown" ? null : s;
        };

        const incoming: Name[] = (nameRows as Array<Record<string, unknown>>)
          .map((r) => ({
            id: r.uuid as string,
            text: r.name as string,
            gender: r.gender as "boy" | "girl",
            pronunciation: str(r.pronunciation),
            origin: str(r.origin),
            meaning: str(r.meaning),
            nickname: str(r.nickname),
            rank: r.rank != null ? Number(r.rank) : null,
            created_at: "",
            created_by_user_id: (r.created_by_user_id as string) ?? null,
          }))
          .filter((n) => !swiped.has(n.id));

        if (incoming.length === 0) return;

        // Append to deck (deduplicated) — does not reset currentIndex
        setNames((prev) => {
          const seen = new Set(prev.map((n) => n.id));
          const toAdd = incoming.filter((n) => !seen.has(n.id));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
        setPartnerPickIds((prev) => {
          const next = new Set(prev);
          incoming.forEach((n) => next.add(n.id));
          return next;
        });
      } catch (e) {
        console.warn("[SwipeScreen] partner-pick poll error:", e);
      }
    };

    // Fire once immediately so the first check happens as soon as the partner
    // is known — subsequent checks run on the 15-second interval.
    poll();
    const timer = setInterval(poll, 15_000);
    return () => clearInterval(timer);
  }, [partnerId, userId, userGender]);

  async function checkForMatch(name: Name): Promise<boolean> {
    if (!user?.partner_id) return false;
    const { data: partnerSwipe } = await supabase
      .from("swipes")
      .select("*")
      .eq("user_id", user.partner_id)
      .eq("name_id", name.id)
      .eq("liked", true)
      .maybeSingle();
    if (!partnerSwipe) return false;
    const [a, b] = [user.id, user.partner_id].sort();
    const { error: matchErr } = await supabase
      .from("matches")
      .upsert(
        { name_id: name.id, user_a_id: a, user_b_id: b, gender: name.gender },
        { onConflict: "name_id,user_a_id,user_b_id", ignoreDuplicates: true },
      );
    if (matchErr) {
      console.warn("[SwipeScreen] match insert ignored:", matchErr.message);
    }
    const canReveal = await limits.checkCanRevealMatch();
    if (canReveal) setMatchedName(name);
    else {
      setLimitType("match");
      setPremiumOpen(true);
    }
    return true;
  }

  async function handleSwipe(liked: boolean) {
    const current = names[currentIndex];
    if (!current || !user) return;

    // Always advance the card first so the UI never stalls.
    setHistory((p) => [...p, { nameId: current.id, liked }]);
    setCurrentIndex((i) => i + 1);
    // Smoothly slide the new next card into its stacked position rather than
    // snapping — eliminates the brief visual gap between swipes.
    // Match the card's snap-back spring so the next-card "settle" feels
    // like one continuous motion with the outgoing card's flick.
    dragProgress.value = withSpring(0, {
      damping: 14,
      stiffness: 240,
      mass: 0.5,
    });

    // Check limits after updating UI — if blocked, show the modal but do not
    // roll back the card (the name will reappear on next deck load if not saved).
    let allowed = true;
    let lt: "swipe" | "like" | null = null;
    try {
      const result = await limits.checkCanSwipe(liked);
      allowed = result.allowed;
      lt = result.limitType;
    } catch (e) {
      console.warn("[SwipeScreen] limit check error (swipe allowed):", e);
    }
    if (!allowed) {
      setLimitType(lt);
      setPremiumOpen(true);
      return;
    }
    try {
      await supabase
        .from("swipes")
        .upsert(
          { user_id: user.id, name_id: current.id, liked },
          { onConflict: "user_id,name_id" },
        );
      if (liked) {
        let didMatch = false;
        if (user.partner_id) didMatch = await checkForMatch(current);
        if (!didMatch && !premiumOpen) await maybeShowFirstLike();
      }
    } catch (e) {
      console.error("[SwipeScreen] save swipe error", e);
    }
  }

  async function handleUndo() {
    if (undoInProgress.current || history.length === 0 || currentIndex === 0 || !user) return;
    undoInProgress.current = true;
    const last = history[history.length - 1];
    setHistory((p) => p.slice(0, -1));
    setCurrentIndex((i) => i - 1);
    dragProgress.value = 0;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await supabase
        .from("swipes")
        .delete()
        .eq("user_id", user.id)
        .eq("name_id", last.nameId);
    } catch (e) {
      console.error("[SwipeScreen] undo error", e);
    } finally {
      undoInProgress.current = false;
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

  const undoEnabled = history.length > 0 && currentIndex > 0;
  const isPremium = user.plan_tier === "premium";
  const swipeLeft = Math.max(0, FREE_LIMITS.swipes - (user.daily_swipe_count ?? 0));
  const showLimitBanner = !isPremium && swipeLeft <= Math.ceil(FREE_LIMITS.swipes * 0.2);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.parchment,
          paddingTop: insets.top + 4,
          paddingBottom: 8,
        },
      ]}
    >
      {showLimitBanner && (
        <Pressable
          style={styles.limitBanner}
          onPress={() => {
            setLimitType("swipe");
            setPremiumOpen(true);
          }}
        >
          <Feather name="zap" size={13} color="#d97706" />
          <Text style={[styles.limitText, { fontFamily: fonts.displaySemibold }]}>
            {swipeLeft} swipes left today
          </Text>
        </Pressable>
      )}

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
            dragProgress={dragProgress}
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
          canUndo={undoEnabled}
          dragProgress={dragProgress}
          onSwipe={(liked) => {
            handleSwipe(liked);
          }}
          onUndo={handleUndo}
        />
      </View>

      <MatchCelebrationModal
        open={!!matchedName}
        name={matchedName?.text ?? null}
        gender={(matchedName?.gender as "boy" | "girl") ?? null}
        lastName={user.baby_last_name}
        onClose={() => setMatchedName(null)}
        onSeeAll={() => {
          setMatchedName(null);
          router.push("/(tabs)/names");
        }}
      />

      <PremiumModal
        open={premiumOpen}
        limitType={limitType}
        onClose={() => setPremiumOpen(false)}
        onUpgrade={() => setPremiumOpen(false)}
      />

      <FirstLikePartnerModal
        open={firstLikeOpen}
        hasPartner={!!user.partner_id}
        onPrimary={() => {
          setFirstLikeOpen(false);
          if (!user.partner_id) router.push("/settings/partner");
        }}
        onClose={() => setFirstLikeOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { fontSize: 26, fontWeight: "700" },
  partnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  invitePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  limitBanner: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 4,
  },
  limitText: { color: "#b45309", fontSize: 12 },
  actionBar: {
    height: 90,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 24,
  },
  actionBtn: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  actionBtnLg: { width: 64, height: 64, borderRadius: 32 },
  actionBtnSm: { width: 52, height: 52, borderRadius: 26 },
  cardArea: { flex: 1, position: "relative" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  errorTitle: { fontSize: 22, fontWeight: "700", marginTop: 8 },
  errorBody: { fontSize: 14, textAlign: "center", marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  retryBtnText: { color: "#fff", fontWeight: "700" },
});
