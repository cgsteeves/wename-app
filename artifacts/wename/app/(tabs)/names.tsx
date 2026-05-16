import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { Image, ImageBackground } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

const listBg = require("../../assets/images/list-bg.png");
const grassBorder = require("../../assets/images/grass-flower-border.png");
const boyRowBg = require("../../assets/images/boy-card-bg.jpg");
const paperTexture = require("../../assets/images/paper-texture.jpg");

import { NameSuggestions } from "@/components/NameSuggestions";
import { PartnerConnectModal } from "@/components/PartnerConnectModal";
import { PremiumModal } from "@/components/PremiumModal";
import { useAuth } from "@/components/AuthContext";
import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/lib/revenuecat";
import { supabase } from "@/lib/supabase";

type SubTab = "liked" | "matches" | "suggestions";

interface NameItem {
  id: string;
  text: string;
  gender: string;
  rank?: number | null;
  origin?: string | null;
  meaning?: string | null;
  nickname?: string | null;
  pronunciation?: string | null;
  recordId: string;
  isManual?: boolean;
  addedByUserId?: string;
}

const BOY = "hsl(214,55%,42%)";
const GIRL = "hsl(345,55%,50%)";
const GRASS = "hsl(145,45%,35%)";
const GRASS_DASH = "hsl(145,45%,55%)";
const FOREGROUND = "hsl(25,30%,20%)";
const MUTED = "hsl(25,12%,48%)";
const BORDER = "hsl(35,22%,80%)";

// React Native does not support hex-alpha suffix on hsl(...) strings.
// These helpers return hsla(...) with the requested alpha (0-1).
const BOY_A = (a: number) => `hsla(214,55%,42%,${a})`;
const GIRL_A = (a: number) => `hsla(345,55%,50%,${a})`;
const BORDER_A = (a: number) => `hsla(35,22%,80%,${a})`;
const accentA = (accent: string, a: number) =>
  accent === GIRL ? GIRL_A(a) : BOY_A(a);

export default function NamesScreen() {
  const colors = useColors();
  const { user } = useUser();
  const { isAuthenticated } = useAuth();
  const { hasPremiumEntitlement } = useSubscription();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [tab, setTab] = useState<SubTab>("liked");
  const [liked, setLiked] = useState<NameItem[]>([]);
  const [matches, setMatches] = useState<NameItem[]>([]);
  const [finalists, setFinalists] = useState<NameItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [newGender, setNewGender] = useState<"boy" | "girl">(
    user?.baby_gender === "girl" ? "girl" : "boy",
  );
  const [infoItem, setInfoItem] = useState<NameItem | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const activeDragIdx = useSharedValue(-1);
  const dragY = useSharedValue(0);

  // AI Suggestions state
  const [allSwipedNames, setAllSwipedNames] = useState<string[]>([]);
  const [partnerLikedNames, setPartnerLikedNames] = useState<string[]>([]);
  const [partnerDisplayName, setPartnerDisplayName] = useState<string | null>(null);
  const [discoverGateOpen, setDiscoverGateOpen] = useState(false);
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // isPremium must always come from RevenueCat, never from user.plan_tier.
  const isPremium = hasPremiumEntitlement;

  // Shared helpers for mapping an embedded `names` row to NameItem fields.
  // The `names!name_id(...)` PostgREST syntax joins name detail in the same
  // query, removing the separate fetchNamesByIds round trip entirely.
  //
  // IMPORTANT: PostgREST returns a plain OBJECT (not array) for many-to-one
  // joins at runtime, even though the Supabase TypeScript SDK types them as
  // EmbeddedNameRow[]. Using ns[0] on a plain object returns undefined, so
  // all name texts came back blank. We normalise to a single object here with
  // Array.isArray() so the code is robust to either runtime shape.
  const NAME_COLS =
    "name, gender, us_rank, origin_raw, meaning, nicknames, pronunciation";

  type EmbeddedNameRow = {
    name: string;
    gender: string;
    us_rank: unknown;
    origin_raw: string | null;
    meaning: string | null;
    nicknames: string | null;
    pronunciation: string | null;
  };
  // SDK types the embedded relation as array, but runtime shape may be object.
  type EmbeddedName = EmbeddedNameRow[] | EmbeddedNameRow | null;

  const cleanField = (val: string | null | undefined): string | null => {
    if (val == null || val === "\\N" || val === "" || val.trim() === "\\N")
      return null;
    return val;
  };

  // Normalise the runtime shape (object or array) to a single row.
  const toRow = (ns: EmbeddedName): EmbeddedNameRow | null => {
    if (!ns) return null;
    if (Array.isArray(ns)) return ns[0] ?? null;
    return ns;
  };

  const embeddedToFields = (ns: EmbeddedName) => {
    const n = toRow(ns);
    if (!n) return null;
    return {
      text: n.name,
      gender: n.gender,
      rank:
        n.us_rank != null && /^\d+$/.test(String(n.us_rank))
          ? Number(n.us_rank)
          : null,
      origin: cleanField(n.origin_raw),
      meaning: cleanField(n.meaning),
      nickname: cleanField(n.nicknames),
      pronunciation: cleanField(n.pronunciation),
    };
  };

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Each query now embeds name details via a FK join so there is no
      // separate fetchNamesByIds round trip — one Promise.all covers all data.
      // `names` is typed as an array because the Supabase SDK uses that shape
      // for embedded resources; embeddedToFields takes [0].
      type SwipeRow = {
        id: string;
        name_id: string;
        ranking: number | null;
        created_at: string;
        manually_added: boolean;
        names: EmbeddedName;
      };
      type MatchRow = SwipeRow & {
        manually_added_by_user_id: string | null;
      };
      type FinalistRow = {
        id: string;
        name_id: string;
        ranking: number | null;
        created_at: string;
        names: EmbeddedName;
      };

      const [swipeData, matchData, finData] = await Promise.all([
        supabase
          .from("swipes")
          .select(`id, name_id, ranking, created_at, manually_added, names!name_id(${NAME_COLS})`)
          .eq("user_id", user.id)
          .eq("liked", true)
          .order("ranking", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .then((r) => (r.data ?? []) as SwipeRow[]),
        user.partner_id
          ? supabase
              .from("matches")
              .select(`id, name_id, created_at, ranking, manually_added, manually_added_by_user_id, names!name_id(${NAME_COLS})`)
              .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
              .order("ranking", { ascending: true, nullsFirst: false })
              .order("created_at", { ascending: false })
              .then((r) => (r.data ?? []) as MatchRow[])
          : Promise.resolve([] as MatchRow[]),
        supabase
          .from("finalists")
          .select(`id, name_id, ranking, created_at, names!name_id(${NAME_COLS})`)
          .eq("user_id", user.id)
          .order("ranking", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .then((r) => (r.data ?? []) as FinalistRow[]),
      ]);

      setLiked(
        swipeData
          .filter((s) => s.names !== null)
          .map((s) => ({
            recordId: s.id,
            id: s.name_id,
            isManual: s.manually_added,
            ...embeddedToFields(s.names)!,
          })),
      );

      if (user.partner_id) {
        setMatches(
          matchData
            .filter((m) => m.names !== null)
            .map((m) => ({
              recordId: m.id,
              id: m.name_id,
              isManual: m.manually_added,
              addedByUserId: m.manually_added_by_user_id ?? undefined,
              ...embeddedToFields(m.names)!,
            })),
        );
      } else {
        setMatches([]);
      }

      setFinalists(
        finData
          .filter((f) => f.names !== null)
          .map((f) => ({
            recordId: f.id,
            id: f.name_id,
            ...embeddedToFields(f.names)!,
          })),
      );
    } catch (e) {
      console.error("[NamesScreen] load error", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadSuggestionContext = useCallback(async () => {
    if (!user) return;
    try {
      // All three fetches run in parallel. Embedded selects (names!name_id)
      // mean each query returns name text directly — no chained round trips.
      // SDK types the embedded resource as an array, but runtime is object for
      // many-to-one FKs. toNameStr handles both shapes.
      type SwipeNameRow = { names: { name: string }[] | { name: string } | null };
      const toNameStr = (ns: SwipeNameRow["names"]): string | null => {
        if (!ns) return null;
        if (Array.isArray(ns)) return ns[0]?.name ?? null;
        return ns.name ?? null;
      };

      const [mySwipes, partnerUserRow, partnerSwipes] = await Promise.all([
        supabase
          .from("swipes")
          .select("names!name_id(name)")
          .eq("user_id", user.id)
          .then((r) => (r.data ?? []) as SwipeNameRow[]),
        user.partner_id
          ? supabase
              .from("users")
              .select("display_name")
              .eq("id", user.partner_id)
              .single()
              .then((r) => r.data as { display_name: string | null } | null)
          : Promise.resolve(null),
        user.partner_id
          ? supabase
              .from("swipes")
              .select("names!name_id(name)")
              .eq("user_id", user.partner_id)
              .eq("liked", true)
              .then((r) => (r.data ?? []) as SwipeNameRow[])
          : Promise.resolve([] as SwipeNameRow[]),
      ]);

      setAllSwipedNames(
        mySwipes.map((r) => toNameStr(r.names)).filter((n): n is string => n != null),
      );

      if (user.partner_id) {
        setPartnerDisplayName(partnerUserRow?.display_name ?? null);
        setPartnerLikedNames(
          partnerSwipes
            .map((r) => toNameStr(r.names))
            .filter((n): n is string => n != null),
        );
      }
    } catch (e) {
      console.error("[NamesScreen] loadSuggestionContext error", e);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
      loadSuggestionContext();
    }, [loadAll, loadSuggestionContext]),
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleAddFromSuggestion(name: string, gender: string) {
    if (!user) return;

    // Dedup check
    const alreadyIn = liked.some(
      (n) => n.text.toLowerCase() === name.toLowerCase() && n.gender === gender,
    );
    if (!alreadyIn) {
      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const optimisticItem: NameItem = {
        recordId: optimisticId,
        id: optimisticId,
        text: name,
        gender,
        rank: null,
      };
      setLiked((p) => [...p, optimisticItem]);
      setAllSwipedNames((p) => [...p, name]);
      showToast(`${name} added to Your Picks!`);

      try {
        let { data: nameRow } = await supabase
          .from("names")
          .select("uuid, name, gender")
          .eq("name", name)
          .eq("gender", gender)
          .maybeSingle();

        if (!nameRow) {
          const { data: inserted, error: insertErr } = await supabase
            .from("names")
            .insert({ name, gender })
            .select("uuid, name, gender")
            .single();
          if (insertErr || !inserted) throw insertErr ?? new Error("insert failed");
          nameRow = inserted;
        }

        const nameUuid = (nameRow as { uuid: string }).uuid;
        const { data: swipe, error: swErr } = await supabase
          .from("swipes")
          .upsert(
            { user_id: user.id, name_id: nameUuid, liked: true },
            { onConflict: "user_id,name_id" },
          )
          .select("id")
          .single();

        if (swErr || !swipe) throw swErr ?? new Error("swipe failed");

        setLiked((p) =>
          p.map((i) =>
            i.recordId === optimisticId
              ? { ...optimisticItem, recordId: (swipe as { id: string }).id, id: nameUuid }
              : i,
          ),
        );
      } catch {
        // Rollback
        setLiked((p) => p.filter((i) => i.recordId !== optimisticId));
        setAllSwipedNames((p) => p.filter((n) => n !== name));
        showToast(`Failed to add ${name}`);
      }
    } else {
      showToast(`${name} added to Your Picks!`);
    }
  }

  async function deleteItem(item: NameItem, isFinalistRow: boolean) {
    if (!user) return;
    if (isFinalistRow) {
      const prev = finalists;
      setFinalists((p) => p.filter((i) => i.recordId !== item.recordId));
      const { error } = await supabase.from("finalists").delete().eq("id", item.recordId);
      if (error) {
        setFinalists(prev);
        Alert.alert("Could not remove", error.message);
      }
    } else if (tab === "liked") {
      const prev = liked;
      setLiked((p) => p.filter((i) => i.recordId !== item.recordId));
      const { error } = await supabase.from("swipes").update({ liked: false }).eq("id", item.recordId);
      if (error) {
        setLiked(prev);
        Alert.alert("Could not remove", error.message);
      }
    } else if (tab === "matches") {
      const prev = matches;
      setMatches((p) => p.filter((i) => i.recordId !== item.recordId));
      const { error } = await supabase.from("matches").delete().eq("id", item.recordId);
      if (error) {
        setMatches(prev);
        Alert.alert("Could not remove", error.message);
      }
    }
  }

  async function handleAddManual() {
    if (!user || !newName.trim()) {
      setAddError("Please enter a name.");
      return;
    }
    setAddError(null);
    const trimmed = newName.trim();
    const lower = trimmed.toLowerCase();
    const existingList = tab === "liked" ? liked : matches;
    if (existingList.some((n) => n.text.toLowerCase() === lower && n.gender === newGender)) {
      setAddError(
        `"${trimmed}" is already in your ${tab === "liked" ? "picks" : "matches"} as a ${newGender} name.`,
      );
      return;
    }

    // Optimistic insert: append a temporary row so the UI updates immediately.
    const optimisticId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimisticItem: NameItem = {
      recordId: optimisticId,
      id: optimisticId,
      text: trimmed,
      gender: newGender,
      rank: null,
      isManual: true,
      addedByUserId: user.id,
    };
    if (tab === "liked") setLiked((p) => [...p, optimisticItem]);
    else if (tab === "matches") setMatches((p) => [...p, optimisticItem]);
    const typedName = trimmed;
    const typedGender = newGender;
    setNewName("");
    setAdding(false);

    const friendlyError = (msg: string | undefined): string => {
      const m = (msg ?? "").toLowerCase();
      if (m.includes("duplicate") || m.includes("unique") || m.includes("already exists")) {
        return `"${typedName}" is already saved as a ${typedGender} name.`;
      }
      return msg ?? "Could not save";
    };

    const rollback = (errMsg: string) => {
      if (tab === "liked")
        setLiked((p) => p.filter((i) => i.recordId !== optimisticId));
      else if (tab === "matches")
        setMatches((p) => p.filter((i) => i.recordId !== optimisticId));
      setNewName(typedName);
      setNewGender(typedGender);
      setAdding(true);
      setAddError(errMsg);
    };

    try {
      let { data: nameRow } = await supabase
        .from("names")
        .select("uuid, name, gender")
        .eq("name", typedName)
        .eq("gender", typedGender)
        .maybeSingle();
      if (!nameRow) {
        const { data: inserted, error } = await supabase
          .from("names")
          .insert({
            name: typedName,
            gender: typedGender,
            user_created: true,
            created_by_user_id: user.id,
          })
          .select("uuid, name, gender")
          .single();
        if (error || !inserted) {
          rollback(friendlyError(error?.message));
          return;
        }
        nameRow = inserted;
      }
      const nameUuid = (nameRow as { uuid: string }).uuid;

      if (tab === "liked") {
        const { data: swipe, error: swErr } = await supabase
          .from("swipes")
          .upsert(
            { user_id: user.id, name_id: nameUuid, liked: true, manually_added: true },
            { onConflict: "user_id,name_id" },
          )
          .select("id")
          .single();
        if (swErr || !swipe) {
          rollback(friendlyError(swErr?.message));
          return;
        }
        setLiked((p) =>
          p.map((i) =>
            i.recordId === optimisticId
              ? { ...optimisticItem, recordId: (swipe as { id: string }).id, id: nameUuid }
              : i,
          ),
        );
      } else if (tab === "matches" && user.partner_id) {
        const [a, b] = [user.id, user.partner_id].sort();
        const { data: m, error } = await supabase
          .from("matches")
          .insert({
            name_id: nameUuid,
            user_a_id: a,
            user_b_id: b,
            gender: typedGender,
            manually_added: true,
            // Only set when authenticated — the FK references auth.users, so
            // a guest UUID (public.users only) would violate the constraint.
            manually_added_by_user_id: isAuthenticated ? user.id : null,
          })
          .select("id")
          .single();
        if (error || !m) {
          rollback(friendlyError(error?.message));
          return;
        }
        setMatches((p) =>
          p.map((i) =>
            i.recordId === optimisticId
              ? { ...optimisticItem, recordId: (m as { id: string }).id, id: nameUuid }
              : i,
          ),
        );
      }
    } catch (e) {
      rollback(friendlyError(e instanceof Error ? e.message : undefined));
    }
  }

  async function persistReorder(orderedItems: NameItem[], table: "swipes" | "matches") {
    for (let i = 0; i < orderedItems.length; i++) {
      await supabase
        .from(table)
        .update({ ranking: i + 1 })
        .eq("id", orderedItems[i].recordId);
    }
  }

  function handleReorder(fromIndex: number, toIndex: number) {
    const isLiked = tab === "liked";
    const setter = isLiked ? setLiked : setMatches;
    setter((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      persistReorder(next, isLiked ? "swipes" : "matches").catch(console.error);
      return next;
    });
  }

  async function shareList() {
    const list = tab === "liked" ? liked : matches;
    if (list.length === 0) return;
    const title = tab === "liked" ? "My Favorite Baby Names" : "Our Matched Baby Names";
    const accentHex = (user?.baby_gender === "girl") ? "#a83060" : "#2a5f9e";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; background: #fef9f0; padding: 32px 24px 40px; min-height: 100vh; }
    h1 { color: #5b3a29; font-size: 26px; text-align: center; margin-bottom: 6px; }
    .sub { text-align: center; color: #9c7b5e; font-size: 14px; margin-bottom: 28px; }
    .row { background: rgba(255,255,255,0.88); border-radius: 14px; padding: 14px 18px;
           margin-bottom: 10px; display: flex; align-items: center; gap: 14px;
           border: 1.5px solid rgba(180,150,110,0.25);
           box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
    .rank { color: #9c7b5e; font-size: 13px; min-width: 28px; font-style: italic; }
    .name { font-size: 22px; font-weight: bold; color: ${accentHex}; flex: 1; }
    .gender { font-size: 11px; color: #aaa; text-transform: capitalize; }
    .footer { text-align: center; margin-top: 28px; color: #c9a87c; font-size: 12px; letter-spacing: 0.5px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="sub">${list.length} ${list.length === 1 ? "name" : "names"}</p>
  ${list.map((n, i) => `
    <div class="row">
      <span class="rank">${i < 3 ? `#${i + 1}` : `${i + 1}`}</span>
      <span class="name">${n.text}</span>
      <span class="gender">${n.gender}</span>
    </div>`).join("")}
  <div class="footer">Made with WeName ✨</div>
</body>
</html>`;

    try {
      if (Platform.OS === "web") {
        await Share.share({ message: `${title}\n\n${list.map((n, i) => `${i + 1}. ${n.text}`).join("\n")}` });
        return;
      }
      const shareTitle = tab === "liked" ? "My Baby Name Short List" : "Our Baby Name Shortlist";
      const filename = tab === "liked" ? "My_Baby_Name_Short_List" : "Our_Baby_Name_Shortlist";
      const { uri } = await Print.printToFileAsync({ html, width: 390, height: Math.min(1200, 200 + list.length * 58) });
      // Attempt to copy to a named path so the share sheet shows a readable filename.
      // If this fails for any reason, fall back to the original URI (PDF still shares, just UUID name).
      let shareUri = uri;
      try {
        const namedUri = `${FileSystem.cacheDirectory}${filename}.pdf`;
        await FileSystem.copyAsync({ from: uri, to: namedUri });
        shareUri = namedUri;
      } catch (_) {
        // naming failed — proceed with the original URI
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(shareUri, { mimeType: "application/pdf", dialogTitle: shareTitle });
      } else {
        await Share.share({ title: shareTitle, message: `${shareTitle}\n\n${list.map((n, i) => `${i + 1}. ${n.text}`).join("\n")}` });
      }
    } catch (e) {
      await Share.share({ message: `${title}\n\n${list.map((n, i) => `${i + 1}. ${n.text}`).join("\n")}` });
    }
  }

  const items = tab === "liked" ? liked : tab === "matches" ? matches : [];
  const accentColor =
    user?.baby_gender === "girl" ? GIRL : BOY;
  const noPartner = tab === "matches" && !user?.partner_id;

  return (
    <View style={styles.root}>
      <ImageBackground
        source={listBg}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        pointerEvents="none"
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.30)" }]} />

      <View style={[styles.tabBar, { paddingTop: insets.top + 8 }]}>
        <TabButton
          label="Your Picks"
          icon={<Feather name="heart" size={14} color={tab === "liked" ? accentColor : MUTED} />}
          active={tab === "liked"}
          accent={accentColor}
          onPress={() => setTab("liked")}
        />
        <TabButton
          label="Shared Matches"
          icon={
            <FontAwesome5
              name="handshake"
              size={14}
              color={tab === "matches" ? accentColor : MUTED}
            />
          }
          active={tab === "matches"}
          accent={accentColor}
          onPress={() => setTab("matches")}
        />
        <TabButton
          label="AI Suggestions"
          icon={
            <FontAwesome5
              name="magic"
              size={14}
              color={tab === "suggestions" ? accentColor : MUTED}
            />
          }
          active={tab === "suggestions"}
          accent={accentColor}
          proBadge={!isPremium}
          onPress={() => {
            if (isPremium) {
              setTab("suggestions");
            } else {
              setDiscoverGateOpen(true);
            }
          }}
        />
      </View>

      <View style={styles.headerWrap}>
        {tab !== "suggestions" ? (
          <>
            <View style={styles.headerTitleRow}>
              <Text style={[styles.pageTitle, { color: FOREGROUND }]}>
                {tab === "liked" ? "Your Picks" : "Shared Matches"}
              </Text>
              <Text style={[styles.headerCount, { color: MUTED }]}>
                {items.length} {items.length === 1 ? "name" : "names"}
              </Text>
            </View>
            <Text style={[styles.headerHint, { color: MUTED }]}>
              Drag to reorder. See more information by tapping{" "}
              <Feather name="info" size={13} color={MUTED} />
            </Text>

            {!adding ? (
              <View style={styles.headerActions}>
                {!noPartner && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.addNameBtn,
                      { borderColor: GRASS_DASH, opacity: pressed ? 0.85 : 1 },
                    ]}
                    onPress={() => {
                      setAddError(null);
                      setAdding(true);
                    }}
                  >
                    <Text style={[styles.addNamePlus, { color: GRASS }]}>+</Text>
                    <Text style={[styles.addNameText, { color: GRASS }]}>Add name</Text>
                  </Pressable>
                )}
                <Pressable
                  disabled={items.length === 0}
                  style={({ pressed }) => [
                    styles.shareBtn,
                    {
                      opacity: items.length === 0 ? 0.4 : pressed ? 0.85 : 1,
                    },
                  ]}
                  onPress={shareList}
                >
                  <Feather name="share-2" size={15} color={FOREGROUND} />
                  <Text style={[styles.shareBtnText, { color: FOREGROUND }]}>Share</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.addCard}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Enter a name"
                    placeholderTextColor="rgba(120,108,90,0.5)"
                    style={[
                      styles.addInput,
                      { borderColor: accentA(accentColor, 0.3), color: FOREGROUND },
                    ]}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleAddManual}
                  />
                  <Pressable
                    onPress={() => {
                      setAdding(false);
                      setNewName("");
                      setAddError(null);
                    }}
                    hitSlop={6}
                    style={{ padding: 6 }}
                  >
                    <Feather name="x" size={16} color={MUTED} />
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <GenderPill
                    label="Boy"
                    accent={BOY}
                    active={newGender === "boy"}
                    onPress={() => setNewGender("boy")}
                  />
                  <GenderPill
                    label="Girl"
                    accent={GIRL}
                    active={newGender === "girl"}
                    onPress={() => setNewGender("girl")}
                  />
                </View>
                {addError && (
                  <View style={styles.addError}>
                    <Text style={{ color: "#f87171", fontSize: 14, fontFamily: fonts.display }}>!</Text>
                    <Text style={{ color: "#ef4444", fontSize: 12, fontFamily: fonts.display, flex: 1 }}>
                      {addError}
                    </Text>
                  </View>
                )}
                <Text style={styles.addHint}>
                  Manually added names in Your Picks will appear as swipable names for your partner
                </Text>
                <Pressable
                  onPress={handleAddManual}
                  style={[
                    styles.addSubmit,
                    {
                      backgroundColor: accentA(accentColor, 0.1),
                      borderColor: accentA(accentColor, 0.2),
                    },
                  ]}
                >
                  <Text style={{ color: accentColor, fontFamily: fonts.displayMedium, fontSize: 12 }}>
                    Add Name
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <View style={styles.headerTitleRow}>
            <Text style={[styles.pageTitle, { color: FOREGROUND }]}>AI Suggestions</Text>
            <FontAwesome5 name="magic" size={20} color={accentColor} />
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: tabBarHeight + 24 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isReordering}
      >
        {/* Always-mounted suggestions panel for premium users.
            display:"none" hides it without unmounting, so the auto-fetch
            starts in the background while the user is on other tabs. */}
        {user && isPremium && (
          <View style={tab === "suggestions" ? { paddingTop: 4 } : { display: "none" }}>
            <NameSuggestions
              user={user}
              likedNames={liked.map((n) => n.text)}
              matchedNames={matches.map((n) => n.text)}
              partnerLikedNames={partnerLikedNames}
              excludeNames={allSwipedNames.slice(0, 50)}
              onNameAdded={handleAddFromSuggestion}
            />
          </View>
        )}

        {noPartner ? (
          <View style={styles.bigEmpty}>
            <Feather name="users" size={64} color={colors.muted} />
            <Text style={[styles.bigEmptyTitle, { color: GRASS }]}>No Partner Yet</Text>
            <Text style={[styles.bigEmptyBody, { color: MUTED }]}>
              Invite your partner to start finding shared matches together!
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.connectBtn,
                { backgroundColor: GRASS, opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={() => setPartnerModalOpen(true)}
            >
              <Feather name="users" size={16} color="#fff" />
              <Text style={styles.connectBtnText}>Connect with Partner</Text>
            </Pressable>
          </View>
        ) : tab === "suggestions" ? null : loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={accentColor} />
          </View>
        ) : (
          <>
            {tab === "matches" && finalists.length > 0 && (
              <View style={{ marginBottom: 16, paddingTop: 8, gap: 6 }}>
                {finalists.map((f) => (
                  <FinalistRow
                    key={f.recordId}
                    item={f}
                    onRemove={() => deleteItem(f, true)}
                  />
                ))}
              </View>
            )}

            {items.length === 0 ? (
              tab === "matches" ? (
                <View style={{ alignItems: "center", paddingHorizontal: 24, paddingVertical: 40, gap: 12 }}>
                  <FontAwesome5 name="handshake" size={48} color={colors.muted} />
                  <Text
                    style={{
                      fontFamily: fonts.display,
                      fontSize: 14,
                      color: MUTED,
                      textAlign: "center",
                      lineHeight: 22,
                    }}
                  >
                    When you and your partner like the same name, it will appear here
                  </Text>
                </View>
              ) : (
                <Text style={[styles.simpleEmpty, { color: MUTED }]}>
                  No names yet! Start swiping to add some.
                </Text>
              )
            ) : (
              <View style={{ paddingTop: 8, gap: 0 }}>
                {items.map((item, index) => (
                  <DraggableNameRow
                    key={item.recordId}
                    item={item}
                    index={index}
                    totalCount={items.length}
                    showHash={tab === "liked"}
                    showMatchSubtitle={tab === "matches"}
                    activeDragIdx={activeDragIdx}
                    dragY={dragY}
                    onInfo={() => setInfoItem(item)}
                    onDelete={() => deleteItem(item, false)}
                    onDragStart={() => setIsReordering(true)}
                    onDragEnd={(from, to) => {
                      setIsReordering(false);
                      if (from !== to) handleReorder(from, to);
                    }}
                    currentUserId={user?.id}
                    partnerName={partnerDisplayName}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Image
        source={grassBorder}
        style={[styles.grassFooter, { bottom: tabBarHeight }]}
        contentFit="cover"
        pointerEvents="none"
      />

      <NameInfoSheet
        item={infoItem}
        onClose={() => setInfoItem(null)}
        currentUserId={user?.id}
        partnerName={partnerDisplayName}
      />

      <PremiumModal
        open={discoverGateOpen}
        limitType="discover"
        onClose={() => {
          setDiscoverGateOpen(false);
          if (tab === "suggestions") setTab("liked");
        }}
        onUpgrade={() => setDiscoverGateOpen(false)}
      />

      <PartnerConnectModal
        open={partnerModalOpen}
        onClose={() => setPartnerModalOpen(false)}
      />

      {!!toast && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: insets.bottom + 90,
            left: 20,
            right: 20,
            backgroundColor: "rgba(30,24,20,0.88)",
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 16,
            alignItems: "center",
            zIndex: 999,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontFamily: fonts.display,
              fontSize: 13,
            }}
          >
            {toast}
          </Text>
        </View>
      )}
    </View>
  );
}

function TabButton({
  label,
  icon,
  active,
  accent,
  proBadge,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  accent: string;
  proBadge?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        {
          backgroundColor: active ? accentA(accent, 0.35) : "rgba(244,235,212,0.95)",
          borderColor: active ? accentA(accent, 0.5) : BORDER_A(0.18),
          shadowColor: active ? accent : "#000",
          shadowOffset: { width: 0, height: active ? 2 : 1 },
          shadowOpacity: active ? 0.13 : 0.04,
          shadowRadius: active ? 4 : 2,
          elevation: 0,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon}
      <Text
        numberOfLines={1}
        style={[
          styles.tabLabel,
          { color: active ? accent : MUTED, fontFamily: active ? fonts.displayBold : fonts.displayMedium },
        ]}
      >
        {label}
      </Text>
      {proBadge && (
        <View
          style={{
            position: "absolute",
            top: 5,
            right: 7,
            backgroundColor: "hsl(38,85%,48%)",
            borderRadius: 4,
            paddingHorizontal: 4,
            paddingVertical: 1,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 9,
              fontFamily: fonts.displayMedium,
              letterSpacing: 0.5,
            }}
          >
            PRO
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function GenderPill({
  label,
  accent,
  active,
  onPress,
}: {
  label: string;
  accent: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.genderPill,
        {
          backgroundColor: active ? accentA(accent, 0.1) : "rgba(255,255,255,0.4)",
          borderColor: active ? accentA(accent, 0.2) : BORDER_A(0.3),
        },
      ]}
    >
      <Text
        style={{
          color: active ? accent : MUTED,
          fontFamily: fonts.displayMedium,
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const ROW_H = 54; // minHeight(48) + marginBottom(6)

function DraggableNameRow({
  item,
  index,
  totalCount,
  showHash,
  showMatchSubtitle,
  activeDragIdx,
  dragY,
  onInfo,
  onDelete,
  onDragStart,
  onDragEnd,
  currentUserId,
  partnerName,
}: {
  item: NameItem;
  index: number;
  totalCount: number;
  showHash: boolean;
  showMatchSubtitle?: boolean;
  activeDragIdx: { value: number };
  dragY: { value: number };
  onInfo: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: (from: number, to: number) => void;
  currentUserId?: string;
  partnerName?: string | null;
}) {
  const isBoy = item.gender !== "girl";
  const accent = isBoy ? BOY : GIRL;
  const borderColor = isBoy ? "hsl(214,50%,62%)" : "hsl(345,50%,68%)";
  const rankLabel = showHash && index < 3 ? `#${index + 1}` : `${index + 1}`;
  const offsetPct = (index * 17) % 60;

  const animStyle = useAnimatedStyle(() => {
    const ai = activeDragIdx.value;
    const isActive = ai === index;

    if (ai < 0) {
      return { transform: [{ translateY: 0 }], zIndex: 1, shadowOpacity: 0.1, elevation: 2 };
    }

    if (isActive) {
      return {
        transform: [{ translateY: dragY.value }],
        zIndex: 100,
        shadowOpacity: 0.28,
        elevation: 12,
        borderRadius: 10,
      };
    }

    // Compute where the dragged item would land
    const clamped = Math.min(
      Math.max(0, ai + Math.round(dragY.value / ROW_H)),
      totalCount - 1,
    );
    let shift = 0;
    if (ai < index && index <= clamped) shift = -ROW_H;
    if (ai > index && index >= clamped) shift = ROW_H;

    return {
      transform: [{ translateY: withTiming(shift, { duration: 150 }) }],
      zIndex: 1,
      shadowOpacity: 0.1,
      elevation: 2,
    };
  });

  const panGesture = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      activeDragIdx.value = index;
      dragY.value = 0;
      runOnJS(onDragStart)();
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
    })
    .onEnd(() => {
      const finalIdx = Math.min(
        Math.max(0, index + Math.round(dragY.value / ROW_H)),
        totalCount - 1,
      );
      const from = index;
      activeDragIdx.value = -1;
      dragY.value = withTiming(0, { duration: 80 });
      runOnJS(onDragEnd)(from, finalIdx);
    });

  return (
    <Animated.View style={[{ marginBottom: 6 }, animStyle]}>
      <View style={[styles.row, { borderColor, backgroundColor: isBoy ? "hsl(214,72%,88%)" : "hsl(350,75%,92%)" }]}>
        {isBoy ? (
          <>
            <Image
              source={boyRowBg}
              style={[StyleSheet.absoluteFillObject]}
              contentFit="cover"
              contentPosition={{ left: "50%", top: `${offsetPct}%` }}
            />
            <LinearGradient
              colors={["hsla(214,72%,88%,0.82)", "hsla(210,65%,86%,0.72)"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : (
          <LinearGradient
            colors={[
              "rgba(255,228,225,0.90)",
              "rgba(255,210,215,0.85)",
              "rgba(255,240,242,0.95)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        <GestureDetector gesture={panGesture}>
          <View style={[styles.rowGrip, { paddingHorizontal: 14 }]}>
            <Feather name="menu" size={18} color={accent} style={{ opacity: 0.65 }} />
          </View>
        </GestureDetector>
        <Text style={[styles.rowRank, { color: accent }]}>{rankLabel}</Text>
        <View style={{ flex: 1, paddingLeft: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
            <Text style={[styles.rowName, { color: accent, flexShrink: 1 }]} numberOfLines={1}>
              {item.text}
            </Text>
            {item.isManual && (
              <View
                style={{
                  flexShrink: 0,
                  backgroundColor: accentA(accent, 0.12),
                  borderColor: accentA(accent, 0.35),
                  borderWidth: 1,
                  borderRadius: 4,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontFamily: fonts.display, fontSize: 10, color: accent }}>
                  {item.addedByUserId && item.addedByUserId !== currentUserId
                    ? `Added by ${partnerName ?? "partner"}`
                    : "Added by you"}
                </Text>
              </View>
            )}
          </View>
          {showMatchSubtitle && (
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 10,
                color: accent,
                opacity: 0.7,
                marginTop: 1,
              }}
            >
              You both liked this
            </Text>
          )}
        </View>
        <View style={styles.rowActions}>
          <Pressable onPress={onInfo} hitSlop={8} style={styles.iconBtn}>
            <Feather name="info" size={16} color={MUTED} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8} style={styles.iconBtn}>
            <Feather name="trash-2" size={16} color={MUTED} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function FinalistRow({
  item,
  onRemove,
}: {
  item: NameItem;
  onRemove: () => void;
}) {
  const isBoy = item.gender !== "girl";
  const accent = isBoy ? "hsl(214,55%,40%)" : "hsl(345,55%,34%)";
  const borderColor = isBoy ? "hsl(214,55%,52%)" : "hsl(345,55%,58%)";
  return (
    <View style={[styles.finalistRow, { borderColor }]}>
      {isBoy ? (
        <LinearGradient
          colors={["hsla(214,72%,84%,0.98)", "hsla(210,65%,82%,0.92)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <LinearGradient
          colors={["rgba(255,210,200,0.98)", "rgba(255,190,185,0.92)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <FontAwesome5 name="star" size={13} color={accent} solid />
      <Text style={[styles.finalistName, { color: accent }]} numberOfLines={1}>
        {item.text}
      </Text>
      <Pressable onPress={onRemove} hitSlop={8} style={{ padding: 4 }}>
        <Feather name="x" size={14} color={MUTED} />
      </Pressable>
    </View>
  );
}

function NameInfoSheet({
  item,
  onClose,
  currentUserId,
  partnerName,
}: {
  item: NameItem | null;
  onClose: () => void;
  currentUserId?: string;
  partnerName?: string | null;
}) {
  const open = !!item;
  const isBoy = !item || item.gender !== "girl";
  const accent = isBoy ? "hsl(214,55%,40%)" : "hsl(345,55%,48%)";
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheetPanel, { paddingBottom: insets.bottom + 24 }]}>
        <LinearGradient
          colors={
            isBoy
              ? ["rgba(219,234,254,0.99)", "rgba(191,219,254,0.97)", "rgba(255,251,235,0.99)"]
              : ["rgba(254,228,232,0.99)", "rgba(251,207,215,0.97)", "rgba(255,251,235,0.99)"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ImageBackground
          source={paperTexture}
          style={StyleSheet.absoluteFill}
          imageStyle={{ opacity: 0.2 }}
          contentFit="cover"
          pointerEvents="none"
        />
        <View style={styles.sheetHandleBar} />
        <Pressable style={styles.sheetClose} onPress={onClose} hitSlop={8}>
          <Feather name="x" size={14} color={MUTED} />
        </Pressable>
        {item && (
          <ScrollView
            contentContainerStyle={{ padding: 24, paddingTop: 32 }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={{
                fontFamily: fonts.hand,
                fontSize: 20,
                color: accent,
                opacity: 0.8,
                ...(Platform.OS !== "android" && { fontStyle: "italic" as const }),
                textAlign: "center",
              }}
            >
              About this name
            </Text>
            <View
              style={{
                width: 96,
                height: 1.5,
                borderRadius: 999,
                backgroundColor: accent,
                opacity: 0.4,
                alignSelf: "center",
                marginTop: 6,
                marginBottom: 14,
              }}
            />
            <Text
              style={{
                fontFamily: fonts.displayBold,
                fontSize: 44,
                color: accent,
                textAlign: "center",
                letterSpacing: -1,
              }}
            >
              {item.text}
            </Text>
            {!!item.pronunciation && (
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: 14,
                  ...(Platform.OS !== "android" && { fontStyle: "italic" as const }),
                  color: accent,
                  opacity: 0.6,
                  textAlign: "center",
                  marginTop: 6,
                  letterSpacing: 0.4,
                }}
              >
                [{item.pronunciation}]
              </Text>
            )}
            {item.isManual && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  alignSelf: "center",
                  marginTop: 12,
                  backgroundColor: accentA(accent, 0.1),
                  borderColor: accentA(accent, 0.3),
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
              >
                <Feather name="edit-2" size={11} color={accent} />
                <Text style={{ fontFamily: fonts.display, fontSize: 12, color: accent }}>
                  {item.addedByUserId && item.addedByUserId !== currentUserId
                    ? `Manually added by ${partnerName ?? "partner"}`
                    : "Manually added by you"}
                </Text>
              </View>
            )}
            <View style={{ marginTop: 20, gap: 10 }}>
              <SheetInfoRow icon="map-pin" label="Origin" value={item.origin} accent={accent} isBoy={isBoy} />
              <SheetInfoRow icon="award" label="Meaning" value={item.meaning} accent={accent} isBoy={isBoy} />
              <SheetInfoRow icon="tag" label="Possible Nickname" value={item.nickname} accent={accent} isBoy={isBoy} />
              <SheetInfoRow
                icon="trending-up"
                label="Popularity"
                value={item.rank != null ? `#${item.rank} most popular` : null}
                accent={accent}
                isBoy={isBoy}
              />
            </View>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 12,
                color: accent,
                opacity: 0.4,
                textAlign: "center",
                marginTop: 20,
              }}
            >
              tap outside to close
            </Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function SheetInfoRow({
  icon,
  label,
  value,
  accent,
  isBoy,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string | null | undefined;
  accent: string;
  isBoy: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: isBoy ? "rgba(100,140,200,0.08)" : "rgba(255,160,170,0.08)",
        borderWidth: 1,
        borderColor: isBoy ? "hsl(214,50%,80%)" : "hsl(345,50%,82%)",
      }}
    >
      <Feather name={icon} size={15} color={accent} style={{ opacity: 0.65, marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: fonts.displaySemibold,
            fontSize: 10,
            letterSpacing: 1.5,
            color: accent,
            opacity: 0.6,
            marginBottom: 2,
          }}
        >
          {label.toUpperCase()}
        </Text>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 14,
            color: FOREGROUND,
            opacity: 0.85,
            lineHeight: 20,
          }}
        >
          {value || "—"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grassFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 80,
    opacity: 0.85,
    zIndex: 1,
  },

  tabBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_A(0.2),
    backgroundColor: "rgba(255,255,255,0.2)",
    zIndex: 10,
  },
  tab: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: Platform.OS === "android" ? 18 : 14,
    borderWidth: Platform.OS === "android" ? 2 : 1.5,
  },
  tabLabel: {
    fontFamily: fonts.displayMedium,
    fontSize: 12,
    letterSpacing: 0.1,
  },

  headerWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  pageTitle: { fontSize: 24, fontFamily: fonts.displayBold },
  headerCount: { fontSize: 14, fontFamily: fonts.display },
  headerHint: { fontSize: 14, fontFamily: fonts.display, marginBottom: 12 },
  headerActions: { flexDirection: "row", gap: 8 },
  addNameBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    backgroundColor: "transparent",
  },
  addNamePlus: { fontSize: 18, fontFamily: fonts.displaySemibold, lineHeight: 18 },
  addNameText: { fontSize: 14, fontFamily: fonts.displaySemibold },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: Platform.OS === "android" ? 20 : 16,
    borderWidth: Platform.OS === "android" ? 2 : 1,
    borderColor: BORDER,
    backgroundColor: "rgba(244,235,212,0.95)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 0,
  },
  shareBtnText: { fontSize: 14, fontFamily: fonts.displaySemibold },

  addCard: {
    backgroundColor: "rgba(244,235,212,0.7)",
    borderWidth: 1,
    borderColor: BORDER_A(0.5),
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.display,
    fontSize: 14,
  },
  genderPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addError: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "rgba(254,242,242,0.8)",
    borderWidth: 1,
    borderColor: "hsl(0,86%,85%)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addHint: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 16,
  },
  addSubmit: {
    width: "100%",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },

  simpleEmpty: {
    fontFamily: fonts.display,
    fontSize: 14,
    textAlign: "center",
    marginTop: 48,
  },
  empty: { alignItems: "center", padding: 32 },
  bigEmpty: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 8,
  },
  bigEmptyTitle: {
    fontFamily: fonts.hand,
    fontSize: 20,
    marginTop: 8,
  },
  bigEmptyBody: {
    fontFamily: fonts.display,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  connectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  connectBtnText: { color: "#fff", fontFamily: fonts.displaySemibold, fontSize: 14 },

  row: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Platform.OS === "android" ? 12 : 8,
    borderWidth: Platform.OS === "android" ? 2 : 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    minHeight: 48,
  },
  rowGrip: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    minWidth: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  rowRank: {
    fontFamily: fonts.displayBold,
    fontSize: 13,
    minWidth: 22,
  },
  rowName: {
    fontFamily: fonts.displayMedium,
    fontSize: 16,
  },
  rowActions: {
    flexDirection: "row",
    gap: 4,
    paddingRight: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  finalistRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  finalistName: {
    flex: 1,
    fontFamily: fonts.displaySemibold,
    fontSize: 14,
  },

  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "85%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    backgroundColor: "hsl(45,55%,94%)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  sheetHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignSelf: "center",
    marginTop: 12,
  },
  sheetClose: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
});
