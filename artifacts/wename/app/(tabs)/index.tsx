import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue } from "react-native-reanimated";

import { useAuth } from "@/components/AuthContext";
import { DebugLoadingScreen } from "@/components/DebugLoadingScreen";
import { FirstLikePartnerModal } from "@/components/FirstLikePartnerModal";
import { MatchCelebrationModal } from "@/components/MatchCelebrationModal";
import { PackCompleteModal } from "@/components/PackCompleteModal";
import { PackSwitcherSheet } from "@/components/PackSwitcherSheet";
import NameCard, { NameCardHandle } from "@/components/NameCard";
import { PremiumModal } from "@/components/PremiumModal";
import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { FREE_LIMITS, useDailyLimits } from "@/hooks/useDailyLimits";
import { authSignOut } from "@/lib/authService";
import { getAllPacks, getPartnerCreatedNames, getSwipeableNames } from "@/lib/namePacks";
import { useSubscription } from "@/lib/revenuecat";
import { DEFAULT_PACK_SLUG, Name, NamePack, supabase, USER_ID_KEY, ONBOARDED_KEY } from "@/lib/supabase";

type LimitType = "swipe" | "like" | "match" | "discover" | null;

export default function SwipeScreen() {
  const colors = useColors();
  const router = useRouter();
  const {
    user,
    updateUser,
    selectedPackSlug,
    changeSelectedPack,
    loading: userLoading,
    loadError: userLoadError,
    packLoading,
    signOutLocal,
  } = useUser();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();

  // Android: the custom tab bar is position:absolute so React Navigation gives
  // the screen the full window height. We use onLayout to measure the exact
  // root view height, then derive the paddingBottom that makes the card
  // fill all available space (leaving only a small gap above the tab bar).
  const [rootViewH, setRootViewH] = useState(0);
  const rootPaddingBottom = useMemo(() => {
    if (Platform.OS !== "android") return 8;
    if (rootViewH === 0) return 8; // before first layout
    const SCREEN_H = Dimensions.get("window").height;
    const CARD_H = Math.min(SCREEN_H * 0.83, 720);
    const paddingTop = insets.top + 4;
    // Fill the space: paddingBottom absorbs everything below the card.
    const pb = Math.max(8, rootViewH - paddingTop - CARD_H - 8);
    return pb;
  }, [rootViewH, insets.top]);

  const { redirect, openPremium } = useLocalSearchParams<{ redirect?: string; openPremium?: string }>();

  // Consume post-auth redirect params (e.g. after signing in from partner invite gate)
  useEffect(() => {
    if (redirect === "partner" && user) {
      router.replace("/(tabs)/settings/partner?autoInvite=1");
    }
  }, [redirect, user]);

  // Re-open PremiumModal after returning from an email magic-link sign-in.
  // The auth/callback screen sets ?openPremium=1 when it finds a pending
  // purchase intent in AsyncStorage (set by PremiumModal before sending OTP).
  const openPremiumHandledRef = useRef(false);
  useEffect(() => {
    if (openPremium === "1" && user && !openPremiumHandledRef.current) {
      openPremiumHandledRef.current = true;
      setPremiumOpen(true);
    }
  }, [openPremium, user]);

  const [names, setNames] = useState<Name[]>([]);
  const [partnerPickIds, setPartnerPickIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  // Tracks whether the swipe tab is currently focused so the partner-pick poll
  // skips cycles when the user is on a different tab.
  const isFocusedRef = useRef(false);
  const [namesLoading, setNamesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchedName, setMatchedName] = useState<Name | null>(null);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [limitType, setLimitType] = useState<LimitType>(null);
  const [history, setHistory] = useState<{ nameId: string; liked: boolean }[]>([]);
  const [firstLikeOpen, setFirstLikeOpen] = useState(false);
  const [packCompleteOpen, setPackCompleteOpen] = useState(false);
  const [packSwitcherOpen, setPackSwitcherOpen] = useState(false);
  const [allPacks, setAllPacks] = useState<NamePack[]>([]);
  const cardRef = useRef<NameCardHandle>(null);
  const dragProgress = useSharedValue(0);
  const undoInProgress = useRef(false);
  // Monotonic counter — incremented each time loadNames starts a fresh load.
  // Any in-flight Supabase result from an older generation is discarded, so a
  // slow load kicked off for authUser never overwrites state for a new guest.
  const loadGenRef = useRef(0);
  // Cards currently flying off-screen. Their React instances stay mounted
  // (with `isOutgoing=true`) under stable keys so their withDecay
  // animations continue uninterrupted from the moment of release. Each id
  // is removed from this set when its own withDecay completion fires.
  // Using a Set so rapid-fire swipes don't cut each other's flights short.
  const [outgoingIds, setOutgoingIds] = useState<Set<string>>(new Set());

  const { hasPremiumEntitlement } = useSubscription();
  const limits = useDailyLimits(user, updateUser, hasPremiumEntitlement);

  const firstLikeKey = user ? `first_like_partner_shown_${user.id}` : "";
  const maybeShowFirstLike = useCallback(async () => {
    if (!user || !firstLikeKey) return;
    if (user.partner_id) return;
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
      // If there's no user yet (e.g. immediately after sign-out while UserContext
      // is creating a fresh guest), clear the spinner and bail. Without this,
      // `loading` stays `true` forever because the finally block never runs.
      if (!userId) {
        setNamesLoading(false);
        return;
      }
      const gen = ++loadGenRef.current;
      setNamesLoading(true);
      setError(null);
      setPackCompleteOpen(false);
      // Safety net: if any Supabase call hangs (common when the auth client is in
      // a transient bad state right after sign-out), unblock the UI after 10 s.
      const safetyTimer = setTimeout(() => {
        if (gen === loadGenRef.current) setNamesLoading(false);
      }, 10_000);
      try {
        const gender = userGender ?? "either";
        // When activePack is null (pack preference not yet loaded), use the
        // free default directly instead of passing undefined, which causes
        // getSwipeableNames to call getUserSelectedPacks internally — a raw
        // Supabase query with no timeout that can hang on a stalled auth lock.
        const packOverride = activePack ? [activePack] : [DEFAULT_PACK_SLUG];
        // Hard 5 s timeout on the entire names-fetch. If getSwipeableNames or
        // the swipes query hangs (e.g. stalled auth lock after Apple Sign-In),
        // we reject immediately so the catch block sets an error and the
        // useFocusEffect !error guard stops the infinite-retry loop.
        const NAMES_TIMEOUT_MS = 5_000;
        const timeoutReject = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Names took too long to load — tap Retry")), NAMES_TIMEOUT_MS),
        );
        // The RPC excludes already-swiped names server-side when !includeAlready,
        // eliminating the separate swipes pre-fetch that used to block this step.
        // Partner swipes are fetched in parallel only when a partner exists.
        const [all, partner, swipeResult] = await Promise.race([
          Promise.all([
            getSwipeableNames(userId, gender, packOverride, !includeAlready),
            partnerId
              ? getPartnerCreatedNames(partnerId, gender)
              : Promise.resolve([] as Name[]),
            // Only fetch swipes when needed to filter partner-created names
            partnerId
              ? supabase.from("swipes").select("name_id").eq("user_id", userId)
              : Promise.resolve({ data: null as { name_id: string }[] | null }),
          ]),
          timeoutReject,
        ]);
        // Discard if a newer load has already started (userId changed mid-flight).
        if (gen !== loadGenRef.current) return;
        // Filter partner picks against already-swiped so the user never sees a
        // duplicate they already acted on (partner picks are not reset by "Start Over").
        const swiped = new Set(
          (swipeResult.data ?? []).map((s: { name_id: string }) => s.name_id),
        );
        const partnerFiltered = partner.filter((n) => !swiped.has(n.id));
        // If the RPC returned nothing the user has swiped every catalog name in this pack.
        // Instead of auto-recycling, show the PackCompleteModal. Partner-created names
        // that haven't been swiped yet are still surfaced first.
        if (all.length === 0 && !includeAlready) {
          if (gen !== loadGenRef.current) return;
          if (partnerFiltered.length === 0) {
            // Nothing at all — open the completion modal immediately.
            setPackCompleteOpen(true);
            setNames([]);
            setCurrentIndex(0);
            setHistory([]);
          } else {
            // Still have partner-created names — show those; the modal will
            // appear via the deck-exhaustion effect when they're all swiped.
            setPartnerPickIds(new Set(partnerFiltered.map((n) => n.id)));
            const shuffled = [...partnerFiltered].sort(() => Math.random() - 0.5);
            setNames(shuffled);
            setCurrentIndex(0);
            setHistory([]);
          }
          return;
        }
        if (all.length === 0 && partnerFiltered.length === 0) {
          throw new Error("No names available in the selected packs");
        }
        setPartnerPickIds(new Set(partnerFiltered.map((n) => n.id)));
        const combined = [...all, ...partnerFiltered];
        const shuffled = [...combined].sort(() => Math.random() - 0.5);
        setNames(shuffled);
        setCurrentIndex(0);
        setHistory([]);
      } catch (e) {
        if (gen !== loadGenRef.current) return;
        console.error("[SwipeScreen] loadNames error", e);
        setError(e instanceof Error ? e.message : "Failed to load names");
      } finally {
        clearTimeout(safetyTimer);
        if (gen === loadGenRef.current) setNamesLoading(false);
      }
    },
    [userId, userGender, partnerId, activePack],
  );

  useEffect(() => {
    getAllPacks()
      .then(setAllPacks)
      .catch((e) => console.warn("[SwipeScreen] failed to load pack list", e));
  }, []);

  useEffect(() => {
    loadNames();
  }, [loadNames]);

  // When the user swipes through every card in the deck, show the pack-complete modal.
  useEffect(() => {
    if (!namesLoading && !error && names.length > 0 && currentIndex >= names.length) {
      setPackCompleteOpen(true);
    }
  }, [namesLoading, error, names.length, currentIndex]);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      // Refresh on focus only if empty AND not already loading AND no error.
      // The !error guard is critical: without it, when the 5s timeout fires and
      // sets namesLoading=false with names=[], this callback re-triggers loadNames
      // on every dep change, creating an infinite retry loop. Once error is set
      // the user must explicitly tap Retry to re-attempt.
      if (names.length === 0 && !namesLoading && !error) loadNames();
      return () => { isFocusedRef.current = false; };
    }, [names.length, namesLoading, error, loadNames]),
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

    // Advance index IMMEDIATELY. Because each NameCard is keyed by its
    // stable `card.id`, React preserves the previously-active instance in
    // the outgoing slot (its withDecay keeps running) AND the previously-
    // next instance in the active slot (its gesture just enables). The
    // user can grab the new active card the very next frame — no waiting
    // for the outgoing flight to finish.
    setOutgoingIds((prev) => {
      const next = new Set(prev);
      next.add(current.id);
      return next;
    });
    setHistory((p) => [...p, { nameId: current.id, liked }]);
    setCurrentIndex((i) => i + 1);
    // The previously-next card was scaled up to nearly 1 by dragProgress
    // during the user's drag; now that it's the active card it uses
    // cardStyle (no scale dep), and the brand-new card mounting behind
    // needs to start at scale 0.92, so reset to 0 in the same tick.
    dragProgress.value = 0;

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
    // Cancel any in-flight outgoing for this card so undoing a card mid-
    // flight doesn't leave a ghost mounted off-screen.
    setOutgoingIds((prev) => {
      if (!prev.has(last.nameId)) return prev;
      const nextSet = new Set(prev);
      nextSet.delete(last.nameId);
      return nextSet;
    });
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

  // Derive the current initialisation step for the debug loading screen.
  // This is always visible (not gated by __DEV__) so TestFlight builds show it.
  const isSpinning = !user || namesLoading;
  if (isSpinning) {
    let step: string;
    if (!user && (userLoading || (!userLoadError && !user))) {
      step = "Loading profile";
    } else if (!user && userLoadError) {
      step = "Profile failed";
    } else if (user && packLoading) {
      step = "Loading pack";
    } else {
      step = "Loading names";
    }

    const handleRetry = () => {
      if (!user) {
        // UserContext will create/find a guest and eventually set user,
        // which then triggers loadNames automatically.
        return;
      }
      loadNames();
    };

    const handleSignOut = async () => {
      try { await signOut(); } catch {}
    };

    const handleReset = async () => {
      try {
        await AsyncStorage.multiRemove([USER_ID_KEY, ONBOARDED_KEY]);
        await authSignOut();
      } catch {}
      // signOutLocal clears remaining local keys and calls load() to create
      // a fresh guest — no explicit navigation needed.
      await signOutLocal();
    };

    return (
      <DebugLoadingScreen
        step={step}
        userIdSuffix={user?.id?.slice(-6) ?? undefined}
        packSlug={selectedPackSlug}
        isPremium={hasPremiumEntitlement}
        namesCount={names.length}
        errorMsg={error ?? undefined}
        onRetry={handleRetry}
        onSignOut={handleSignOut}
        onReset={handleReset}
      />
    );
  }
  if (error) {
    const isPremiumUser = hasPremiumEntitlement;
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.parchment, padding: 24 },
        ]}
      >
        <Feather name="alert-triangle" size={32} color={colors.destructive} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>
          Couldn't load names
        </Text>
        <Text style={[styles.errorBody, { color: colors.mutedForeground }]}>{error}</Text>

        <View style={[styles.debugBox, { borderColor: colors.border }]}>
          <Text style={[styles.debugLine, { color: colors.mutedForeground }]}>
            pack: {activePack ?? "null"}
          </Text>
          <Text style={[styles.debugLine, { color: colors.mutedForeground }]}>
            uid: …{user.id.slice(-6)}
          </Text>
          <Text style={[styles.debugLine, { color: colors.mutedForeground }]}>
            premium: {isPremiumUser ? "yes" : "no"}
          </Text>
          <Text style={[styles.debugLine, { color: colors.mutedForeground }]}>
            names: {names.length}
          </Text>
          <Text style={[styles.debugLine, { color: colors.destructive }]}>
            err: {error}
          </Text>
        </View>

        <Pressable
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={() => loadNames()}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
        <Pressable
          style={[styles.retryBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginTop: 8 }]}
          onPress={async () => {
            await changeSelectedPack(DEFAULT_PACK_SLUG);
            loadNames();
          }}
        >
          <Text style={[styles.retryBtnText, { color: colors.foreground }]}>
            Reset pack to default
          </Text>
        </Pressable>
      </View>
    );
  }
  const remaining = Math.max(0, names.length - currentIndex - 1);
  const current = names[currentIndex];
  const next = names[currentIndex + 1] ?? null;


  const activePackName =
    allPacks.find((p) => p.slug === activePack)?.display_name ??
    activePack ??
    "Names";
  // isPremium must always come from RevenueCat, never from user.plan_tier.
  const isPremium = hasPremiumEntitlement;


  const undoEnabled = history.length > 0 && currentIndex > 0;
  return (
    <View
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0) setRootViewH(h);
      }}
      style={[
        styles.root,
        {
          backgroundColor: colors.parchment,
          paddingTop: insets.top + 4,
          paddingBottom: rootPaddingBottom,
        },
      ]}
    >

      <View style={styles.cardArea}>
        {/*
          Render order, back to front: next → outgoing(s) → active.
          STABLE per-card keys (card.id) are critical: when a card moves
          from `next` slot to `active` slot, or from `active` to
          `outgoing`, React reconciles by key and PRESERVES the same
          component instance. SharedValues keep their values, withDecay
          keeps running, gestures just toggle on/off via props. That's
          what eliminates the dead period at the end of a swipe — the
          previously-next card IS the new active card, instantly.
        */}
        {next && !outgoingIds.has(next.id) && (
          <NameCard
            key={next.id}
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
        {Array.from(outgoingIds).map((id) => {
          const card = names.find((n) => n.id === id);
          if (!card) return null;
          return (
            <NameCard
              key={card.id}
              name={card.text}
              pronunciation={card.pronunciation}
              origin={card.origin}
              meaning={card.meaning}
              nickname={card.nickname}
              rank={card.rank}
              gender={card.gender}
              remaining={remaining}
              lastName={user.baby_last_name ?? undefined}
              isPartnerPick={partnerPickIds.has(card.id)}
              isOutgoing
              onSwipe={() => {}}
              onExitComplete={() => {
                setOutgoingIds((prev) => {
                  if (!prev.has(card.id)) return prev;
                  const nextSet = new Set(prev);
                  nextSet.delete(card.id);
                  return nextSet;
                });
              }}
            />
          );
        })}
        {current && (
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
            onSwipe={handleSwipe}
            onUndo={handleUndo}
          />
        )}
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

      <PackCompleteModal
        open={packCompleteOpen}
        packName={activePackName}
        onStartOver={() => {
          setPackCompleteOpen(false);
          loadNames(true);
        }}
        onSwitchPack={() => {
          setPackCompleteOpen(false);
          setPackSwitcherOpen(true);
        }}
      />

      <PackSwitcherSheet
        open={packSwitcherOpen}
        packs={allPacks}
        selectedSlug={activePack}
        isPremium={isPremium}
        onSelect={(slug) => changeSelectedPack(slug)}
        onClose={() => setPackSwitcherOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  packHeader: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  packPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "65%",
  },
  packPillText: {
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 13,
    flexShrink: 1,
  },
  remainingText: {
    fontFamily: "Fredoka_500Medium",
    fontSize: 13,
  },
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
  debugBox: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
    marginBottom: 8,
  },
  debugLine: { fontSize: 12 },
});
