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
): Promise<Name[]> {
  const selectedPacks = await getUserSelectedPacks(userId);
  const { data, error } = await supabase.rpc("get_swipeable_names", {
    pack_slugs: selectedPacks,
    gender_filter: gender ?? null,
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
export async function getPartnerCreatedNames(
  partnerId: string,
  gender: string,
): Promise<Name[]> {
  try {
    // Step 1: get every name_id the partner has liked
    const { data: swipeRows, error: swipeErr } = await supabase
      .from("swipes")
      .select("name_id")
      .eq("user_id", partnerId)
      .eq("liked", true);

    if (swipeErr || !swipeRows || swipeRows.length === 0) return [];

    const nameIds = (swipeRows as Array<{ name_id: string }>).map(
      (r) => r.name_id,
    );

    // Step 2: fetch those names, but only user-created ones + gender filter
    let query = supabase
      .from("names")
      .select(
        "uuid, name, gender, pronunciation, origin, meaning, nickname, rank, created_by_user_id",
      )
      .in("uuid", nameIds)
      .eq("user_created", true);

    if (gender !== "either") {
      query = query.eq("gender", gender);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return (data as Array<Record<string, unknown>>).map((row) => ({
      id: row.uuid as string,
      text: row.name as string,
      gender: row.gender as "boy" | "girl",
      pronunciation: clean(row.pronunciation),
      origin: clean(row.origin),
      meaning: clean(row.meaning),
      nickname: clean(row.nickname),
      rank: row.rank != null ? Number(row.rank) : null,
      created_at: "",
      created_by_user_id: (row.created_by_user_id as string) ?? null,
    }));
  } catch {
    return [];
  }
}
