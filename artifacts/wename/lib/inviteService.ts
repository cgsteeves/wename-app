import { supabase, PartnerInvite } from "./supabase";

// ─── URL helper ──────────────────────────────────────────────────────────────
export function getInviteUrl(token: string): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? process.env.EXPO_PUBLIC_REPL_ID;
  if (domain) return `https://${domain}/join/${token}`;
  return `/join/${token}`;
}

// ─── Generate a cryptographically random hex token (48 chars) ────────────────
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Generate a human-readable short code (8 chars, no O/0/I/1) ─────────────
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomShortCode(length = 8): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => CHARSET[b % CHARSET.length]).join("");
}

// ─── Create a new invite (expires all previous pending first) ─────────────────
export async function createInvite(userId: string): Promise<PartnerInvite> {
  // Expire all existing pending invites for this user
  await supabase
    .from("partner_invites")
    .update({ status: "expired" })
    .eq("inviter_id", userId)
    .eq("status", "pending");

  const token = randomHex(24);       // 48 hex chars
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
