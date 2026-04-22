import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUser } from "@/components/UserContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

type SubTab = "liked" | "matches" | "finalists";

interface NameItem {
  id: string;
  text: string;
  gender: string;
  rank?: number | null;
  recordId: string; // swipe id, match id, or finalist id
}

export default function NamesScreen() {
  const colors = useColors();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<SubTab>("liked");
  const [liked, setLiked] = useState<NameItem[]>([]);
  const [matches, setMatches] = useState<NameItem[]>([]);
  const [finalists, setFinalists] = useState<NameItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState<"boy" | "girl">(
    user?.baby_gender === "girl" ? "girl" : "boy",
  );

  const fetchNamesByIds = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return new Map<string, { text: string; gender: string; rank: number | null }>();
    const { data } = await supabase
      .from("names")
      .select("uuid, name, gender, us_rank")
      .in("uuid", ids);
    return new Map(
      (data ?? []).map((n: { uuid: string; name: string; gender: string; us_rank: unknown }) => [
        n.uuid,
        {
          text: n.name,
          gender: n.gender,
          rank:
            n.us_rank != null && /^\d+$/.test(String(n.us_rank))
              ? Number(n.us_rank)
              : null,
        },
      ]),
    );
  }, []);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Liked
      const { data: swipeData } = await supabase
        .from("swipes")
        .select("id, name_id, ranking, created_at")
        .eq("user_id", user.id)
        .eq("liked", true)
        .order("ranking", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      const swipeIds = (swipeData ?? []).map((s: { name_id: string }) => s.name_id);
      const swipeMap = await fetchNamesByIds(swipeIds);
      setLiked(
        (swipeData ?? [])
          .filter((s: { name_id: string }) => swipeMap.has(s.name_id))
          .map((s: { id: string; name_id: string }) => ({
            recordId: s.id,
            id: s.name_id,
            ...swipeMap.get(s.name_id)!,
          })),
      );

      // Matches
      if (user.partner_id) {
        const { data: matchData } = await supabase
          .from("matches")
          .select("id, name_id, created_at, ranking")
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
          .order("ranking", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });
        const ids = (matchData ?? []).map((m: { name_id: string }) => m.name_id);
        const map = await fetchNamesByIds(ids);
        setMatches(
          (matchData ?? [])
            .filter((m: { name_id: string }) => map.has(m.name_id))
            .map((m: { id: string; name_id: string }) => ({
              recordId: m.id,
              id: m.name_id,
              ...map.get(m.name_id)!,
            })),
        );
      } else {
        setMatches([]);
      }

      // Finalists
      const { data: finData } = await supabase
        .from("finalists")
        .select("id, name_id, ranking, created_at")
        .eq("user_id", user.id)
        .order("ranking", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      const fIds = (finData ?? []).map((f: { name_id: string }) => f.name_id);
      const fMap = await fetchNamesByIds(fIds);
      setFinalists(
        (finData ?? [])
          .filter((f: { name_id: string }) => fMap.has(f.name_id))
          .map((f: { id: string; name_id: string }) => ({
            recordId: f.id,
            id: f.name_id,
            ...fMap.get(f.name_id)!,
          })),
      );
    } catch (e) {
      console.error("[NamesScreen] load error", e);
    } finally {
      setLoading(false);
    }
  }, [user, fetchNamesByIds]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  async function deleteItem(item: NameItem) {
    if (!user) return;
    if (tab === "liked") {
      await supabase.from("swipes").update({ liked: false }).eq("id", item.recordId);
      setLiked((p) => p.filter((i) => i.recordId !== item.recordId));
    } else if (tab === "matches") {
      await supabase.from("matches").delete().eq("id", item.recordId);
      setMatches((p) => p.filter((i) => i.recordId !== item.recordId));
    } else {
      await supabase.from("finalists").delete().eq("id", item.recordId);
      setFinalists((p) => p.filter((i) => i.recordId !== item.recordId));
    }
  }

  async function addToFinalists(item: NameItem) {
    if (!user) return;
    if (finalists.some((f) => f.id === item.id)) {
      Alert.alert("Already a finalist", `${item.text} is already in your finalists.`);
      return;
    }
    const { data, error } = await supabase
      .from("finalists")
      .insert({ user_id: user.id, name_id: item.id })
      .select("id")
      .single();
    if (error || !data) {
      Alert.alert("Error", error?.message ?? "Could not add to finalists");
      return;
    }
    setFinalists((p) => [
      ...p,
      { ...item, recordId: (data as { id: string }).id },
    ]);
    Alert.alert("Added", `${item.text} added to Finalists`);
  }

  async function handleAddManual() {
    if (!user || !newName.trim()) return;
    const trimmed = newName.trim();
    let { data: nameRow } = await supabase
      .from("names")
      .select("uuid, name, gender")
      .eq("name", trimmed)
      .eq("gender", newGender)
      .maybeSingle();
    if (!nameRow) {
      const { data: inserted, error } = await supabase
        .from("names")
        .insert({
          name: trimmed,
          gender: newGender,
          user_created: true,
          created_by_user_id: user.id,
        })
        .select("uuid, name, gender")
        .single();
      if (error || !inserted) {
        Alert.alert("Error", error?.message ?? "Could not add name");
        return;
      }
      nameRow = inserted;
    }
    if (tab === "liked") {
      const { data: swipe, error: swErr } = await supabase
        .from("swipes")
        .insert({
          user_id: user.id,
          name_id: (nameRow as { uuid: string }).uuid,
          liked: true,
        })
        .select("id")
        .single();
      if (swErr || !swipe) {
        Alert.alert("Error", swErr?.message ?? "Could not save");
        return;
      }
      setLiked((p) => [
        ...p,
        {
          recordId: (swipe as { id: string }).id,
          id: (nameRow as { uuid: string }).uuid,
          text: trimmed,
          gender: newGender,
          rank: null,
        },
      ]);
    } else if (tab === "matches" && user.partner_id) {
      const [a, b] = [user.id, user.partner_id].sort();
      const { data: m, error } = await supabase
        .from("matches")
        .insert({
          name_id: (nameRow as { uuid: string }).uuid,
          user_a_id: a,
          user_b_id: b,
          gender: newGender,
        })
        .select("id")
        .single();
      if (error || !m) {
        Alert.alert("Error", error?.message ?? "Could not save");
        return;
      }
      setMatches((p) => [
        ...p,
        {
          recordId: (m as { id: string }).id,
          id: (nameRow as { uuid: string }).uuid,
          text: trimmed,
          gender: newGender,
          rank: null,
        },
      ]);
    }
    setNewName("");
    setAdding(false);
  }

  async function shareList() {
    const list = tab === "liked" ? liked : tab === "matches" ? matches : finalists;
    if (list.length === 0) return;
    const title =
      tab === "liked"
        ? "My Favorite Baby Names"
        : tab === "matches"
          ? "Our Matched Baby Names"
          : "Our Finalists";
    const body = list.map((n) => `• ${n.text}`).join("\n");
    await Share.share({ message: `${title}\n\n${body}` });
  }

  const items =
    tab === "liked" ? liked : tab === "matches" ? matches : finalists;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.parchment,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 70,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.foreground }]}>Names</Text>
        <Pressable onPress={shareList} hitSlop={12}>
          <Feather name="share-2" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.muted }]}>
        {(["liked", "matches", "finalists"] as const).map((t) => {
          const active = tab === t;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[
                styles.tab,
                active && { backgroundColor: colors.parchment },
              ]}
            >
              <Text
                style={{
                  color: active ? colors.foreground : colors.mutedForeground,
                  fontWeight: active ? "700" : "500",
                  textTransform: "capitalize",
                }}
              >
                {t}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "matches" && !user?.partner_id ? (
        <View style={styles.empty}>
          <Feather name="users" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No partner linked
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            Connect with your partner from Settings to see matches.
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.recordId}
          contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather
                name={tab === "finalists" ? "star" : "heart"}
                size={28}
                color={colors.mutedForeground}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {tab === "liked"
                  ? "No liked names yet"
                  : tab === "matches"
                    ? "No matches yet"
                    : "No finalists yet"}
              </Text>
              <Text
                style={[styles.emptyBody, { color: colors.mutedForeground }]}
              >
                {tab === "liked"
                  ? "Swipe right on names you love."
                  : tab === "matches"
                    ? "When you and your partner both like a name, it appears here."
                    : "Tap the star on a name to add it to your shortlist."}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <NameRow
              item={item}
              index={index}
              tab={tab}
              isFinalist={finalists.some((f) => f.id === item.id)}
              onDelete={() => deleteItem(item)}
              onStar={() => addToFinalists(item)}
            />
          )}
        />
      )}

      {tab !== "finalists" && !adding && (
        <Pressable
          onPress={() => setAdding(true)}
          style={[styles.fab, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={22} color="#fff" />
        </Pressable>
      )}

      {adding && (
        <View style={[styles.addBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="New name"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
            autoFocus
          />
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["boy", "girl"] as const).map((g) => {
              const active = newGender === g;
              const c = g === "boy" ? colors.boy : colors.girl;
              return (
                <Pressable
                  key={g}
                  onPress={() => setNewGender(g)}
                  style={[
                    styles.genderPill,
                    {
                      backgroundColor: active ? c : "transparent",
                      borderColor: c,
                    },
                  ]}
                >
                  <Text style={{ color: active ? "#fff" : c, fontWeight: "600" }}>
                    {g}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={[styles.addAction, { borderColor: colors.border }]}
              onPress={() => {
                setAdding(false);
                setNewName("");
              }}
            >
              <Text style={{ color: colors.mutedForeground }}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.addAction, { backgroundColor: colors.primary }]}
              onPress={handleAddManual}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Add</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function NameRow({
  item,
  index,
  tab,
  isFinalist,
  onDelete,
  onStar,
}: {
  item: NameItem;
  index: number;
  tab: SubTab;
  isFinalist: boolean;
  onDelete: () => void;
  onStar: () => void;
}) {
  const colors = useColors();
  const isBoy = item.gender !== "girl";
  const accent = isBoy ? colors.boy : colors.girlRed;
  return (
    <View
      style={[
        styles.row,
        { borderColor: accent + "55", backgroundColor: isBoy ? colors.boyLight : "#ffe4e8" },
      ]}
    >
      <Text style={[styles.rank, { color: accent }]}>{index + 1}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowName, { color: accent }]}>{item.text}</Text>
        {item.rank != null && (
          <Text style={styles.rowMeta}>#{item.rank} most popular</Text>
        )}
      </View>
      {tab !== "finalists" && (
        <Pressable onPress={onStar} hitSlop={10} style={styles.rowAction}>
          <Feather
            name="star"
            size={18}
            color={isFinalist ? colors.accent : colors.mutedForeground}
            style={isFinalist ? { opacity: 1 } : { opacity: 0.6 }}
          />
        </Pressable>
      )}
      <Pressable onPress={onDelete} hitSlop={10} style={styles.rowAction}>
        <Feather name="trash-2" size={18} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  title: { fontSize: 28, fontWeight: "800" },
  tabs: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginVertical: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  empty: { alignItems: "center", justifyContent: "center", padding: 32, gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  emptyBody: { fontSize: 14, textAlign: "center", paddingHorizontal: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  rank: { fontSize: 14, fontWeight: "700", width: 22 },
  rowName: { fontSize: 18, fontWeight: "700" },
  rowMeta: { fontSize: 12, color: "#7a6a52" },
  rowAction: { padding: 6 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  addBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 90,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  genderPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  addAction: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
  },
});
