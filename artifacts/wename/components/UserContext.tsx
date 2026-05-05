import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { getUserSelectedPacks, setUserPack } from "@/lib/namePacks";
import { onMergeComplete } from "@/lib/mergeEvents";
import { supabase, User, USER_ID_KEY, DEFAULT_PACK_SLUG } from "@/lib/supabase";

type UserContextValue = {
  user: User | null;
  loading: boolean;
  loadError: boolean;
  packLoading: boolean;
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

// Race a promise against a timeout. If the timeout fires first, resolves with
// `null`. Used to keep startup network calls from hanging indefinitely on a
// flaky cellular connection or a stuck Supabase auth lock.
async function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T | null> {
  return Promise.race<T | null>([
    Promise.resolve(p),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [packLoading, setPackLoading] = useState(false);
  const [selectedPackSlug, setSelectedPackSlug] = useState<string | null>(null);
  // Tracks the currently-loaded user ID so the onAuthStateChange handler can
  // skip spurious SIGNED_IN events (e.g. iOS fires one every time the app
  // returns from background — including after the Apple payment sheet closes).
  const currentUserIdRef = useRef<string | null>(null);
  // Fallback timer set by the SIGNED_IN handler. Cleared when onMergeComplete
  // fires (meaning finalizeLogin succeeded and the real loadById already ran).
  const signInFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPackForUser = useCallback(async (userId: string): Promise<void> => {
    setPackLoading(true);
    try {
      // getUserSelectedPacks has no internal timeout — wrap it so a stalled
      // auth lock never leaves packLoading=true and selectedPackSlug=null forever.
      const slugs = await withTimeout(getUserSelectedPacks(userId), 5000);
      // Always resolve to a valid slug. null means the query timed out;
      // an empty array means no preference row exists — both fall back to the
      // free default so the swipe screen can render immediately.
      setSelectedPackSlug(slugs?.[0] ?? DEFAULT_PACK_SLUG);
    } catch {
      // Network or RLS error — fall back to the free pack so nothing blocks.
      setSelectedPackSlug(DEFAULT_PACK_SLUG);
    } finally {
      setPackLoading(false);
    }
  }, []);

  const createUser = useCallback(async (): Promise<User | null> => {
    const result = await withTimeout(
      supabase
        .from("users")
        .insert({ invite_code: generateInviteCode() })
        .select()
        .single(),
      5000,
    );
    if (!result) {
      console.error("[UserContext] createUser timed out");
      return null;
    }
    const { data, error } = result;
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
    async (userId: string, maxRetries = 2): Promise<void> => {
      setLoading(true);
      setLoadError(false);
      const safetyTimer = setTimeout(() => setLoading(false), 8000);
      try {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          const queryResult = await withTimeout(
            supabase.from("users").select("*").eq("id", userId).maybeSingle(),
            3000,
          );

          if (queryResult && !queryResult.error && queryResult.data) {
            const loadedUser = queryResult.data as User;
            currentUserIdRef.current = loadedUser.id;
            setUser(loadedUser);
            // Fire-and-forget — do NOT await before setUser. Awaiting
            // loadPackForUser blocks setUser, and if the pack query hangs
            // (auth lock stall post-purchase) it resets selectedPackSlug to
            // null, changes activePack, and triggers a full loadNames reload
            // in the swipe screen — exactly the post-purchase spinner bug.
            loadPackForUser(loadedUser.id).catch(() => {});
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

        // Fallback: profile row never appeared (e.g. finalizeLogin failed
        // silently in a previous session). Since we have an authenticated
        // session for this userId, RLS allows us to upsert our own row.
        // Without this the user would be stuck on an endless spinner.
        console.warn(
          "[UserContext] loadById: upserting fallback profile for",
          userId,
        );
        const upsertResult = await withTimeout(
          supabase
            .from("users")
            .upsert(
              { id: userId, invite_code: generateInviteCode() },
              { onConflict: "id", ignoreDuplicates: false },
            )
            .select()
            .single(),
          5000,
        );
        if (upsertResult && !upsertResult.error && upsertResult.data) {
          await AsyncStorage.setItem(USER_ID_KEY, userId);
          const upsertedUser = upsertResult.data as User;
          currentUserIdRef.current = upsertedUser.id;
          setUser(upsertedUser);
          loadPackForUser(userId).catch(() => {});
          return;
        }
        console.error(
          "[UserContext] loadById: fallback upsert failed",
          upsertResult?.error,
        );
        setLoadError(true);
      } catch (e) {
        console.error("[UserContext] loadById error", e);
        setLoadError(true);
      } finally {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    },
    [loadPackForUser],
  );

  // General load — reads USER_ID_KEY from storage and falls through to guest
  // creation if no match is found.  Used on app start and SIGNED_OUT.
  // User profile + pack selection are fetched in parallel so the swipe screen
  // always has selectedPackSlug ready when loading completes.
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const safetyTimer = setTimeout(() => setLoading(false), 8000);
    try {
      const stored = await AsyncStorage.getItem(USER_ID_KEY);
      if (stored) {
        const queryResult = await withTimeout(
          supabase.from("users").select("*").eq("id", stored).maybeSingle(),
          3000,
        );
        // Pack load is fire-and-forget — failures here must not block the
        // whole startup spinner.
        loadPackForUser(stored).catch(() => {});
        if (queryResult && !queryResult.error && queryResult.data) {
          const loadedUser = queryResult.data as User;
          currentUserIdRef.current = loadedUser.id;
          setUser(loadedUser);
          return;
        }
        // Stored ID didn't resolve (deleted user, network failure, or
        // query timeout). Fall through to creating a fresh guest profile.
      }
      const created = await createUser();
      if (created) {
        currentUserIdRef.current = created.id;
        setUser(created);
        loadPackForUser(created.id).catch(() => {});
        return;
      }
      // Both stored lookup AND createUser failed — surface a retry UI
      // instead of leaving the user staring at a silent spinner.
      setLoadError(true);
    } catch (e) {
      console.error("[UserContext] load error", e);
      setLoadError(true);
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
  // SIGNED_IN: Do NOT call loadById immediately. AuthContext's finalizeLogin
  //            runs concurrently and holds the auth lock for multiple Supabase
  //            operations (SELECT, upsert, guest-data merge). Calling loadById
  //            at the same time causes lock contention: every query in loadById
  //            times out waiting for the lock, selectedPackSlug bounces between
  //            null and the real value, and loadNames keeps re-triggering with
  //            fresh gen counters so the 10 s safety timer never clears the
  //            swipe-screen spinner.
  //
  //            Instead, finalizeLogin (authService.ts) always emits
  //            mergeComplete when it finishes. The onMergeComplete handler
  //            below is the real trigger for loadById. A 10 s fallback fires
  //            here only if finalizeLogin itself fails before emitting.
  //
  //            iOS also fires SIGNED_IN on every app-foreground return (e.g.
  //            Apple payment sheet close). Skip the reload entirely when we
  //            already have this user — the currentUserIdRef guard covers that.
  //
  // SIGNED_OUT: fall back to load() which will create/find a guest profile.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        if (currentUserIdRef.current === session.user.id) return;
        // Clear any stale fallback from a previous sign-in attempt.
        if (signInFallbackRef.current) {
          clearTimeout(signInFallbackRef.current);
          signInFallbackRef.current = null;
        }
        const userId = session.user.id;
        // Fallback: if finalizeLogin fails and mergeComplete never fires,
        // load the profile directly after a generous delay.
        signInFallbackRef.current = setTimeout(() => {
          signInFallbackRef.current = null;
          if (currentUserIdRef.current !== userId) loadById(userId);
        }, 10_000);
      } else if (event === "SIGNED_OUT") {
        currentUserIdRef.current = null;
        if (signInFallbackRef.current) {
          clearTimeout(signInFallbackRef.current);
          signInFallbackRef.current = null;
        }
        load();
      }
    });
    return () => subscription.unsubscribe();
  }, [load, loadById]);

  // Primary trigger for loadById after sign-in: finalizeLogin (authService.ts)
  // always emits mergeComplete when it finishes, whether or not guest data was
  // merged. Cancel the fallback timer from the SIGNED_IN handler since we're
  // now handling the load ourselves with a clean post-finalize state.
  //
  // CRITICAL GUARD: only call loadById when the user ID is actually changing
  // (guest → authenticated). iOS fires SIGNED_IN on every app foreground,
  // causing finalizeLogin → mergeComplete on every foreground. Without this
  // guard, loadById fires on every resume → loadPackForUser runs → selectedPackSlug
  // may bounce (null → slug) → loadNames re-triggers with a new gen counter →
  // the 10 s safety timer from the old gen never clears → indefinite spinner.
  useEffect(() => {
    const unsub = onMergeComplete(() => {
      if (signInFallbackRef.current) {
        clearTimeout(signInFallbackRef.current);
        signInFallbackRef.current = null;
      }
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user?.id) return;
        // Skip if this user is already loaded — mergeComplete now fires on every
        // SIGNED_IN (including spurious iOS foreground events), so this guard
        // prevents redundant loadById calls for returning authenticated users.
        if (currentUserIdRef.current === session.user.id) return;
        loadById(session.user.id);
      });
    });
    return unsub;
  }, [loadById]);

  // Realtime subscription — watch for remote changes to this user's own row.
  // Fires when a partner links to us (they write partner_id into our row),
  // or when any other out-of-app change occurs, so the UI stays in sync
  // without needing an app restart.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user-row-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          setUser((prev) =>
            prev ? { ...prev, ...(payload.new as Partial<User>) } : prev,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const changeSelectedPack = useCallback(
    async (slug: string) => {
      if (!user) return;
      // Update context immediately so the swipe screen reacts at once — the
      // DB write is fire-and-forget. On Mac Catalyst the Supabase PKCE lock
      // can delay auth-concurrent writes long enough that waiting for the DB
      // before calling setSelectedPackSlug caused the deck to never reload.
      setSelectedPackSlug(slug);
      try {
        await setUserPack(user.id, slug);
      } catch (e) {
        console.error("[UserContext] changeSelectedPack error", e);
        // Don't roll back — the in-memory selection is correct for this
        // session. It will re-sync from the DB on next app launch.
      }
    },
    [user],
  );

  const updateUser = useCallback(
    async (updates: Partial<User>) => {
      if (!user) return;
      const result = await withTimeout(
        supabase
          .from("users")
          .update(updates)
          .eq("id", user.id)
          .select()
          .single(),
        5000,
      );
      if (!result) {
        console.error("[UserContext] updateUser timed out");
        return;
      }
      const { data, error } = result;
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
        loadError,
        packLoading,
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
