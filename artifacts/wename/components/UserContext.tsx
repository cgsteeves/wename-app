import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { getUserSelectedPacks, setUserPack } from "@/lib/namePacks";
import { supabase, User, USER_ID_KEY } from "@/lib/supabase";

type UserContextValue = {
  user: User | null;
  loading: boolean;
  selectedPackSlug: string | null;
  changeSelectedPack: (slug: string) => Promise<void>;
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
  const [selectedPackSlug, setSelectedPackSlug] = useState<string | null>(null);

  const loadPackForUser = useCallback(async (userId: string) => {
    try {
      const slugs = await getUserSelectedPacks(userId);
      setSelectedPackSlug(slugs[0] ?? null);
    } catch {
      setSelectedPackSlug(null);
    }
  }, []);

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

  // Fetch a user profile by explicit ID.  Used on SIGNED_IN to bypass the
  // AsyncStorage race condition: finalizeLogin (in AuthContext) updates
  // USER_ID_KEY asynchronously, so reading it immediately in load() often
  // returns the old guest ID.  By going straight to the auth session ID we
  // always land on the correct authenticated profile.
  // Retries up to `maxRetries` times (500 ms apart) to handle the edge case
  // where finalizeLogin hasn't finished upserting the profile row yet.
  const loadById = useCallback(
    async (userId: string, maxRetries = 5): Promise<void> => {
      setLoading(true);
      const safetyTimer = setTimeout(() => setLoading(false), 8000);
      try {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

          if (!error && data) {
            setUser(data as User);
            loadPackForUser((data as User).id);
            return;
          }

          if (attempt < maxRetries) {
            // Profile row may not exist yet — finalizeLogin is still running.
            await new Promise((r) => setTimeout(r, 500));
          } else {
            console.warn(
              "[UserContext] loadById: profile not found after retries for",
              userId,
            );
          }
        }
      } catch (e) {
        console.error("[UserContext] loadById error", e);
      } finally {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    },
    [loadPackForUser],
  );

  // General load — reads USER_ID_KEY from storage and falls through to guest
  // creation if no match is found.  Used on app start and SIGNED_OUT.
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
          loadPackForUser((data as User).id);
          return;
        }
      }
      const created = await createUser();
      if (created) {
        setUser(created);
        loadPackForUser(created.id);
      }
    } catch (e) {
      console.error("[UserContext] load error", e);
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  }, [createUser, loadPackForUser]);

  // On mount: load the profile for whoever is current (guest or authenticated).
  useEffect(() => {
    load();
  }, [load]);

  // React to Supabase auth events.
  //
  // SIGNED_IN: use the session's user ID directly — do NOT read USER_ID_KEY
  //            here because finalizeLogin (AuthContext) may not have written
  //            the new ID yet, causing a stale guest-user load.
  //
  // SIGNED_OUT: fall back to load() which will create/find a guest profile.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        loadById(session.user.id);
      } else if (event === "SIGNED_OUT") {
        load();
      }
    });
    return () => subscription.unsubscribe();
  }, [load, loadById]);

  const changeSelectedPack = useCallback(
    async (slug: string) => {
      if (!user) return;
      try {
        await setUserPack(user.id, slug);
        setSelectedPackSlug(slug);
      } catch (e) {
        console.error("[UserContext] changeSelectedPack error", e);
      }
    },
    [user],
  );

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
        selectedPackSlug,
        changeSelectedPack,
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
