import { supabase } from "@/lib/supabase";

export async function mergeGuestData(guestUserId: string, authUserId: string): Promise<void> {
  try {
    await mergeSwipes(guestUserId, authUserId);
    await mergeMatches(guestUserId, authUserId);
    await mergeProfileSettings(guestUserId, authUserId);
  } catch (e) {
    console.error("[guestDataMerge] merge failed (non-fatal):", e);
  }
}

type SwipeRow = { name_id: string; liked: boolean };
type SwipeRef  = { name_id: string };

async function mergeSwipes(guestUserId: string, authUserId: string): Promise<void> {
  const { data: guestSwipes } = await supabase
    .from("swipes")
    .select("name_id, liked")
    .eq("user_id", guestUserId);

  if (!guestSwipes?.length) return;

  const { data: authSwipes } = await supabase
    .from("swipes")
    .select("name_id")
    .eq("user_id", authUserId);

  const alreadySwiped = new Set(
    ((authSwipes ?? []) as SwipeRef[]).map((s) => s.name_id),
  );

  const toInsert = ((guestSwipes ?? []) as SwipeRow[])
    .filter((s) => !alreadySwiped.has(s.name_id))
    .map((s) => ({ user_id: authUserId, name_id: s.name_id, liked: s.liked }));

  if (toInsert.length) {
    await supabase.from("swipes").insert(toInsert);
  }
}

async function mergeMatches(guestUserId: string, authUserId: string): Promise<void> {
  await supabase
    .from("matches")
    .update({ user_a_id: authUserId })
    .eq("user_a_id", guestUserId);

  await supabase
    .from("matches")
    .update({ user_b_id: authUserId })
    .eq("user_b_id", guestUserId);
}

type UserRow = Record<string, unknown> & {
  display_name: string | null;
  baby_last_name: string | null;
  baby_gender: string | null;
  partner_id: string | null;
  invite_code: string | null;
  onboarding_complete: boolean | null;
  plan_tier: string | null;
};

async function mergeProfileSettings(guestUserId: string, authUserId: string): Promise<void> {
  const [{ data: guest }, { data: auth }] = await Promise.all([
    supabase.from("users").select("*").eq("id", guestUserId).maybeSingle(),
    supabase.from("users").select("*").eq("id", authUserId).maybeSingle(),
  ]);

  if (!guest || !auth) return;

  const g = guest as UserRow;
  const a = auth as UserRow;

  const updates: Record<string, unknown> = {};
  if (!a.display_name && g.display_name)           updates.display_name = g.display_name;
  if (!a.baby_last_name && g.baby_last_name)       updates.baby_last_name = g.baby_last_name;
  if (!a.baby_gender && g.baby_gender)             updates.baby_gender = g.baby_gender;
  if (!a.partner_id && g.partner_id)               updates.partner_id = g.partner_id;
  if (!a.invite_code && g.invite_code)             updates.invite_code = g.invite_code;
  if (!a.onboarding_complete && g.onboarding_complete)
    updates.onboarding_complete = g.onboarding_complete;
  if (!a.plan_tier && g.plan_tier)                 updates.plan_tier = g.plan_tier;

  if (Object.keys(updates).length) {
    await supabase.from("users").update(updates).eq("id", authUserId);
  }
}
