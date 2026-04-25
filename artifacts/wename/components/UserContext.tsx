import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { supabase, User, USER_ID_KEY } from "@/lib/supabase";

type UserContextValue = {
  user: User | null;
  loading: boolean;
  updateUser: (updates: Partial<User>) => Promise<void>;
  removePartner: () => Promise<void>;
  reload: () => Promise<void>;
  linkPartnerByCode: (code: string) => Promise<{ ok: boolean; error?: string }>;
  signOutLocal: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const createUser = useCallback(async (): Promise<User | null> => {
    const { data, error } = await supabase
      .from("users")
      .insert({ invite_code: generateInviteCode() })
      .select()
      .single();
    if (error) {
      console.error("[UserContext] createUser error", error);
      return null;
    }
    const newUser = data as User;
    await AsyncStorage.setItem(USER_ID_KEY, newUser.id);
    return newUser;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const safetyTimer = setTimeout(() => setLoading(false), 8000);
    try {
      const stored = await AsyncStorage.getItem(USER_ID_KEY);
      if (stored) {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", stored)
          .maybeSingle();
        if (!error && data) {
          setUser(data as User);
          return;
        }
      }
      const created = await createUser();
      if (created) setUser(created);
    } catch (e) {
      console.error("[UserContext] load error", e);
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  }, [createUser]);

  useEffect(() => {
    load();
  }, [load]);

  // React to Supabase auth events so the user profile stays in sync
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        load();
      }
    });
    return () => subscription.unsubscribe();
  }, [load]);

  const updateUser = useCallback(
    async (updates: Partial<User>) => {
      if (!user) return;
      const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id)
        .select()
        .single();
      if (error) {
        console.error("[UserContext] updateUser error", error);
        return;
      }
      setUser(data as User);
    },
    [user],
  );

  const removePartner = useCallback(async () => {
    if (!user || !user.partner_id) return;
    await supabase.from("users").update({ partner_id: null }).eq("id", user.partner_id);
    await supabase.from("users").update({ partner_id: null }).eq("id", user.id);
    await supabase
      .from("matches")
      .delete()
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
    setUser({ ...user, partner_id: null });
  }, [user]);

  const linkPartnerByCode = useCallback(
    async (code: string): Promise<{ ok: boolean; error?: string }> => {
      if (!user) return { ok: false, error: "No user" };
      const cleaned = code.trim().toUpperCase();
      if (!cleaned) return { ok: false, error: "Enter a code" };
      if (cleaned === user.invite_code) {
        return { ok: false, error: "That's your own code" };
      }
      const { data: inviter, error } = await supabase
        .from("users")
        .select("*")
        .eq("invite_code", cleaned)
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      if (!inviter) return { ok: false, error: "Code not found" };
      if ((inviter as User).partner_id) {
        return { ok: false, error: "That partner is already linked" };
      }
      await supabase.from("users").update({ partner_id: inviter.id }).eq("id", user.id);
      await supabase.from("users").update({ partner_id: user.id }).eq("id", inviter.id);
      await load();
      return { ok: true };
    },
    [user, load],
  );

  const signOutLocal = useCallback(async () => {
    await AsyncStorage.removeItem(USER_ID_KEY);
    await AsyncStorage.removeItem("wename_onboarded");
    setUser(null);
    await load();
  }, [load]);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        updateUser,
        removePartner,
        reload: load,
        linkPartnerByCode,
        signOutLocal,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
