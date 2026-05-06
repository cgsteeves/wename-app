import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

import { supabase, USER_ID_KEY } from "@/lib/supabase";
import { authSignOut, authDeleteAccount, finalizeLogin } from "@/lib/authService";
import { emitMergeComplete } from "@/lib/mergeEvents";

export type AuthModalProps = {
  title?: string;
  body?: string;
  preHeader?: string;
};

type AuthContextValue = {
  session: Session | null;
  authUser: SupabaseUser | null;
  isAuthenticated: boolean;
  // True only when the session belongs to a real named/verified account
  // (email or OAuth). Guests have no Supabase session so this is false
  // for them. Used to gate the premium purchase flow.
  isPurchaseEligible: boolean;
  authLoading: boolean;
  showAuthModal: boolean;
  authModalProps: AuthModalProps | null;
  openAuthModal: (props?: AuthModalProps) => void;
  closeAuthModal: () => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalProps, setAuthModalProps] = useState<AuthModalProps | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (event === "SIGNED_IN" && session?.user) {
        // IMPORTANT: Do NOT await finalizeLogin here.
        //
        // supabase-js awaits every onAuthStateChange listener before resolving
        // the triggering call (e.g. setSession / signInWithIdToken). If we
        // await finalizeLogin and any of its Supabase queries stall due to the
        // auth-lock on cold start, setSession() in auth/callback.tsx never
        // resolves → the "Signing you in" spinner stays forever.
        //
        // Fire-and-forget: the listener returns immediately, setSession resolves,
        // and the callback navigates to the app. finalizeLogin runs in the
        // background and emits mergeComplete() when done, which is UserContext's
        // signal to call loadById(). Each step in finalizeLogin has its own
        // timeout so it cannot hang indefinitely.
        finalizeLogin(session.user.id, session.user.email ?? "").catch((e) => {
          console.warn("[AuthContext] finalizeLogin failed:", e);
          // Safety net: if finalizeLogin threw before reaching emitMergeComplete,
          // emit it now so UserContext doesn't wait on the 10-second fallback timer.
          emitMergeComplete();
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await authSignOut();
    await AsyncStorage.removeItem(USER_ID_KEY);
    setSession(null);
  }

  async function deleteAccount() {
    await authDeleteAccount();
    setSession(null);
  }

  function openAuthModal(props?: AuthModalProps) {
    setAuthModalProps(props ?? null);
    setShowAuthModal(true);
  }

  function closeAuthModal() {
    setShowAuthModal(false);
    setAuthModalProps(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        authUser: session?.user ?? null,
        isAuthenticated: !!session,
        // A real account always has an email or a non-anonymous OAuth provider.
        // Guests have no Supabase session, so this is always false for them.
        // Using both checks guards edge cases where Apple private-relay emails
        // are stripped, while still excluding any hypothetical anonymous-provider
        // sessions that might be cached from earlier SDK versions.
        isPurchaseEligible:
          !!session &&
          (!!session.user.email ||
            (!!session.user.app_metadata?.provider &&
              session.user.app_metadata.provider !== "anonymous")),
        authLoading,
        showAuthModal,
        authModalProps,
        openAuthModal,
        closeAuthModal,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
