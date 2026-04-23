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

  const alreadySwiped = new Set((authSwipes || []).map((s: any) => s.name_id));
  const toInsert = guestSwipes
    .filter((s: any) => !alreadySwiped.has(s.name_id))
    .map((s: any) => ({ user_id: authUserId, name_id: s.name_id, liked: s.liked }));

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

async function mergeProfileSettings(guestUserId: string, authUserId: string): Promise<void> {
  const [{ data: guest }, { data: auth }] = await Promise.all([
    supabase.from("users").select("*").eq("id", guestUserId).maybeSingle(),
    supabase.from("users").select("*").eq("id", authUserId).maybeSingle(),
  ]);

  if (!guest || !auth) return;

  const updates: Record<string, unknown> = {};
  if (!auth.display_name && guest.display_name) updates.display_name = guest.display_name;
  if (!auth.baby_last_name && guest.baby_last_name) updates.baby_last_name = guest.baby_last_name;
  if (guest.baby_gender && guest.baby_gender !== "either") updates.baby_gender = guest.baby_gender;
  if (!auth.partner_id && guest.partner_id) updates.partner_id = guest.partner_id;
  if (!auth.invite_code && guest.invite_code) updates.invite_code = guest.invite_code;
  if (!auth.onboarding_complete && guest.onboarding_complete)
    updates.onboarding_complete = guest.onboarding_complete;
  if (!auth.plan_tier && guest.plan_tier) updates.plan_tier = guest.plan_tier;

  if (Object.keys(updates).length) {
    await supabase.from("users").update(updates).eq("id", authUserId);
  }
}
