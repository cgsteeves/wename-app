import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage as unknown as Storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
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
