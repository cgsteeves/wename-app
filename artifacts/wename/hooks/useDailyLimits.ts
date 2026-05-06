import { useCallback, useRef } from "react";

import { supabase, User } from "@/lib/supabase";

export const FREE_LIMITS = { swipes: 30, likes: 8, matches: 3 } as const;

function todayLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateFromTimestamp(ts: string | null): string | null {
  if (!ts) return null;
  return ts.slice(0, 10);
}

export function useDailyLimits(
  user: User | null | undefined,
  updateUser: (updates: Partial<User>) => Promise<void>,
  // The authoritative premium signal from RevenueCat (useSubscription().hasPremiumEntitlement).
  // Must NOT be derived from user.plan_tier — callers must pass this explicitly.
  // Defaults to false while RevenueCat is loading, which correctly keeps limits enforced.
  hasPremiumEntitlement: boolean,
) {
  const resetInFlight = useRef(false);

  // isPremium is derived exclusively from the RevenueCat entitlement.
  // Never read user.plan_tier here.
  const isPremium = hasPremiumEntitlement;

  const ensureResetIfNeeded = useCallback(async () => {
    if (!user) return { swipe_count: 0, like_count: 0, match_count: 0 };
    const today = todayLocalDate();
    const lastReset = dateFromTimestamp(user.usage_last_reset_at);
    if (lastReset !== today && !resetInFlight.current) {
      resetInFlight.current = true;
      try {
        const resetUpdates = {
          daily_swipe_count: 0,
          daily_like_count: 0,
          daily_match_count: 0,
          usage_last_reset_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from("users")
          .update(resetUpdates)
          .eq("id", user.id);
        if (!error) await updateUser(resetUpdates as Partial<User>);
        return { swipe_count: 0, like_count: 0, match_count: 0 };
      } finally {
        resetInFlight.current = false;
      }
    }
    return {
      swipe_count: user.daily_swipe_count ?? 0,
      like_count: user.daily_like_count ?? 0,
      match_count: user.daily_match_count ?? 0,
    };
  }, [user, updateUser]);

  const checkCanSwipe = useCallback(
    async (
      liked: boolean,
    ): Promise<{ allowed: boolean; limitType: "swipe" | "like" | null }> => {
      if (!user) return { allowed: false, limitType: null };
      if (isPremium) return { allowed: true, limitType: null };
      const counts = await ensureResetIfNeeded();
      if (counts.swipe_count >= FREE_LIMITS.swipes) {
        return { allowed: false, limitType: "swipe" };
      }
      if (liked && counts.like_count >= FREE_LIMITS.likes) {
        return { allowed: false, limitType: "like" };
      }
      const updates: Partial<User> = {
        daily_swipe_count: counts.swipe_count + 1,
        ...(liked && { daily_like_count: counts.like_count + 1 }),
      };
      const { error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id);
      if (!error) await updateUser(updates);
      return { allowed: true, limitType: null };
    },
    [isPremium, user, ensureResetIfNeeded, updateUser],
  );

  const checkCanRevealMatch = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    if (isPremium) return true;
    const counts = await ensureResetIfNeeded();
    if (counts.match_count >= FREE_LIMITS.matches) return false;
    const updates: Partial<User> = { daily_match_count: counts.match_count + 1 };
    const { error } = await supabase.from("users").update(updates).eq("id", user.id);
    if (!error) await updateUser(updates);
    return true;
  }, [isPremium, user, ensureResetIfNeeded, updateUser]);

  return {
    isPremium,
    limits: FREE_LIMITS,
    currentCounts: {
      swipes: user?.daily_swipe_count ?? 0,
      likes: user?.daily_like_count ?? 0,
      matches: user?.daily_match_count ?? 0,
    },
    checkCanSwipe,
    checkCanRevealMatch,
  };
}
