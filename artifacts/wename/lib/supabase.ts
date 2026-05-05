import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

// Per-tab, per-process lock implementation that avoids navigator.locks
// (Web Locks API is shared across all same-origin tabs, which causes
// lock-steal cascades when multiple Supabase contexts compete).
//
// IMPORTANT: supabase-js passes acquireTimeout=0 for getSession() calls,
// meaning "wait forever for the previous holder."  On iOS, AsyncStorage
// can intermittently stall, causing the initial getSession() to hang and
// hold the lock indefinitely.  Every subsequent Supabase call — including
// plain table queries — then queues behind that stuck lock and never runs,
// producing an endless loading spinner.
//
// Fix: always cap lock acquisition at MAX_ACQUIRE_MS, even when
// supabase-js passes 0.  If the previous holder is still running after
// that window we break out and proceed anyway.  The worst case is that a
// query runs without fresh auth headers (falls back to anon key), which
// is recoverable — far better than a permanent hang.
const MAX_ACQUIRE_MS = 5_000;
const _processLocks: Record<string, Promise<unknown>> = {};
async function inProcessLock<T>(
  name: string,
  acquireTimeout: number,
  fn: () => T | PromiseLike<T>,
): Promise<T> {
  const previous: Promise<unknown> = _processLocks[name] ?? Promise.resolve();
  const effectiveTimeout = acquireTimeout > 0 ? acquireTimeout : MAX_ACQUIRE_MS;
  const gate: Promise<unknown> = Promise.race([
    previous,
    new Promise<void>((r) => setTimeout(r, effectiveTimeout)),
  ]);
  const current = gate.then(() => fn(), () => fn()) as Promise<T>;
  _processLocks[name] = current.catch(() => {});
  return current;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage as unknown as Storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
    lock: inProcessLock,
  },
});

export type User = {
  id: string;
  email: string | null;
  display_name: string | null;
  baby_last_name: string | null;
  baby_gender: "boy" | "girl" | "either" | null;
  partner_id: string | null;
  invite_code: string;
  onboarding_complete: boolean | null;
  plan_tier: string | null;
  daily_swipe_count: number;
  daily_like_count: number;
  daily_match_count: number;
  usage_last_reset_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export type Name = {
  id: string;
  text: string;
  gender: "boy" | "girl";
  pronunciation: string | null;
  origin: string | null;
  meaning: string | null;
  nickname: string | null;
  rank: number | null;
  created_at: string;
  created_by_user_id?: string | null;
};

export type NamePack = {
  slug: string;
  display_name: string;
  category: string;
  is_premium: boolean;
  sort_order: number;
};

export type PartnerInvite = {
  id: string;
  token: string;
  short_code: string;
  inviter_id: string;
  invitee_id: string | null;
  status: "pending" | "accepted" | "expired";
  created_at: string;
  expires_at: string;
};

export const DEFAULT_PACK_SLUG = "top_2000";
export const USER_ID_KEY = "baby_picker_user_id";
export const ONBOARDED_KEY = "wename_onboarded";
