import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

import { supabase, USER_ID_KEY } from "@/lib/supabase";
import { authSignOut, authDeleteAccount } from "@/lib/authService";

export type AuthModalProps = {
  title?: string;
  body?: string;
  preHeader?: string;
};

type AuthContextValue = {
  session: Session | null;
  authUser: SupabaseUser | null;
  isAuthenticated: boolean;
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
        await supabase
          .from("users")
          .upsert(
            {
              id: session.user.id,
              email: session.user.email,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          )
          .catch(() => {});
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
