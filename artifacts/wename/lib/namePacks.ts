import { supabase, NamePack, Name, DEFAULT_PACK_SLUG } from "./supabase";

const clean = (val: unknown): string | null => {
  if (val == null || val === "\\N" || val === "Unknown") return null;
  const s = String(val).trim();
  return s === "" ? null : s;
};

export async function getAllPacks(): Promise<NamePack[]> {
  const { data, error } = await supabase
    .from("name_packs")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as NamePack[]) ?? [];
}

export async function getUserSelectedPacks(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_selected_packs")
    .select("pack_slug")
    .eq("user_id", userId);
  if (error) throw error;
  const slugs = data?.map((r: { pack_slug: string }) => r.pack_slug) ?? [];
  return slugs.length > 0 ? slugs : [DEFAULT_PACK_SLUG];
}

export async function setUserPack(userId: string, packSlug: string): Promise<void> {
  await supabase.from("user_selected_packs").delete().eq("user_id", userId);
  const { error } = await supabase
    .from("user_selected_packs")
    .insert({ user_id: userId, pack_slug: packSlug });
  if (error) throw error;
}

export async function addUserPack(userId: string, packSlug: string): Promise<void> {
  const { error } = await supabase
    .from("user_selected_packs")
    .insert({ user_id: userId, pack_slug: packSlug });
  if (error && (error as { code?: string }).code !== "23505") throw error;
}

export async function removeUserPack(userId: string, packSlug: string): Promise<void> {
  const { error } = await supabase
    .from("user_selected_packs")
    .delete()
    .eq("user_id", userId)
    .eq("pack_slug", packSlug);
  if (error) throw error;
}

export async function getSwipeableNames(
  userId: string,
  gender?: "boy" | "girl" | "either" | null,
  packSlugsOverride?: string[],
  excludeAlreadySwiped = false,
): Promise<Name[]> {
  const selectedPacks = packSlugsOverride ?? (await getUserSelectedPacks(userId));
  const { data, error } = await supabase.rpc("get_swipeable_names", {
    pack_slugs: selectedPacks,
    gender_filter: gender ?? null,
    p_user_id: excludeAlreadySwiped ? userId : null,
  });
  if (error) throw error;
  if (!data || data.length === 0) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    text: row.text as string,
    gender: row.gender as "boy" | "girl",
    pronunciation: clean(row.pronunciation),
    origin: clean(row.origin),
    meaning: clean(row.meaning),
    nickname: clean(row.nickname),
    rank: row.rank != null ? Number(row.rank) : null,
    created_at: "",
  }));
}

// Fetch custom names the partner added to their picks.
// Privacy guarantee: two independent conditions must both be true —
//   1. name_id appears in partner's swipes (liked=true)  → partner-scoped
//   2. user_created=true in the names table              → never catalog names
// This ensures a custom name surfaces only for the one user whose partner added it.
// Uses a single PostgREST join query instead of two sequential round-trips.
export async function getPartnerCreatedNames(
  partnerId: string,
  gender: string,
): Promise<Name[]> {
  try {
    let query = supabase
      .from("swipes")
      .select(
        "name_id, names!name_id!inner(uuid, name, gender, pronunciation, origin_raw, meaning, nicknames, rank, created_by_user_id)",
      )
      .eq("user_id", partnerId)
      .eq("liked", true)
      .eq("names.user_created", true);

    if (gender !== "either") {
      query = query.eq("names.gender", gender);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return (data as Array<Record<string, unknown>>).flatMap((row) => {
      const n = row.names as Record<string, unknown> | null;
      if (!n) return [];
      return [{
        id: n.uuid as string,
        text: n.name as string,
        gender: n.gender as "boy" | "girl",
        pronunciation: clean(n.pronunciation),
        origin: clean(n.origin_raw),
        meaning: clean(n.meaning),
        nickname: clean(n.nicknames),
        rank: n.rank != null ? Number(n.rank) : null,
        created_at: "",
        created_by_user_id: (n.created_by_user_id as string) ?? null,
      }];
    });
  } catch {
    return [];
  }
}
