import { supabase, PartnerInvite } from "./supabase";

// ─── URL helper ──────────────────────────────────────────────────────────────
export function getInviteUrl(token: string): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? process.env.EXPO_PUBLIC_REPL_ID;
  if (domain) return `https://${domain}/join/${token}`;
  return `/join/${token}`;
}

// ─── Random hex token (48 chars) ─────────────────────────────────────────────
// Uses Math.random() — expo-crypto not guaranteed; invite tokens don't need
// cryptographic-grade randomness (length provides collision resistance).
function randomHex(chars: number): string {
  let result = "";
  for (let i = 0; i < chars; i++) {
    result += Math.floor(Math.random() * 16).toString(16);
  }
  return result;
}

// ─── Human-readable short code (8 chars, no O/0/I/1) ─────────────────────────
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomShortCode(length = 8): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return result;
}

// ─── Create a new invite (expires all previous pending first) ─────────────────
export async function createInvite(userId: string): Promise<PartnerInvite> {
  // Expire all existing pending invites for this user
  await supabase
    .from("partner_invites")
    .update({ status: "expired" })
    .eq("inviter_id", userId)
    .eq("status", "pending");

  const token = randomHex(48);
  const short_code = randomShortCode();

  const { data, error } = await supabase
    .from("partner_invites")
    .insert({ token, short_code, inviter_id: userId, status: "pending" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as PartnerInvite;
}

// ─── Look up a pending invite by short code ───────────────────────────────────
export async function getInviteByShortCode(
  code: string,
): Promise<PartnerInvite | null> {
  const { data } = await supabase
    .from("partner_invites")
    .select("*")
    .eq("short_code", code.trim().toUpperCase())
    .eq("status", "pending")
    .maybeSingle();
  return (data as PartnerInvite | null) ?? null;
}

// ─── Look up a pending invite by full token ───────────────────────────────────
export async function getInviteByToken(
  token: string,
): Promise<PartnerInvite | null> {
  const { data } = await supabase
    .from("partner_invites")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();
  return (data as PartnerInvite | null) ?? null;
}

// ─── Call the accept_partner_invite RPC ──────────────────────────────────────
export async function acceptInvite(
  invite: PartnerInvite,
  joinerId: string,
): Promise<{ success: boolean; error?: string; inviter_id?: string }> {
  const { data, error } = await supabase.rpc("accept_partner_invite", {
    p_token: invite.token,
    p_joiner_id: joinerId,
  });
  if (error) return { success: false, error: error.message };
  return data as { success: boolean; error?: string; inviter_id?: string };
}
