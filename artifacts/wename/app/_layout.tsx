import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  useFonts as useFredoka,
} from "@expo-google-fonts/fredoka";
import { PatrickHand_400Regular } from "@expo-google-fonts/patrick-hand";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Alert, Platform, Text, TextInput } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/components/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import { UserProvider, useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { initializeRevenueCat, SubscriptionProvider, useSubscription } from "@/lib/revenuecat";

const TextAny = Text as any;
TextAny.defaultProps = TextAny.defaultProps || {};
TextAny.defaultProps.style = [{ fontFamily: fonts.display }, TextAny.defaultProps.style];
const TextInputAny = TextInput as any;
TextInputAny.defaultProps = TextInputAny.defaultProps || {};
TextInputAny.defaultProps.style = [
  { fontFamily: fonts.display },
  TextInputAny.defaultProps.style,
];

SplashScreen.preventAutoHideAsync();

try {
  initializeRevenueCat();
} catch (err: any) {
  Alert.alert("RevenueCat Unavailable", err?.message ?? "Unknown error");
}

const queryClient = new QueryClient();

function AuthModalOverlay() {
  const { showAuthModal, authModalProps, closeAuthModal } = useAuth();
  if (!showAuthModal) return null;
  return (
    <AuthModal
      onClose={closeAuthModal}
      title={authModalProps?.title}
      body={authModalProps?.body}
      preHeader={authModalProps?.preHeader}
    />
  );
}

function PlanSyncEffect() {
  const { user, updateUser } = useUser();
  const { hasPremiumEntitlement, isSubscriptionLoading } = useSubscription();
  // Fires at most once per user ID per app session.
  const syncedForUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // On web the RevenueCat test-store persists simulated purchases in
    // localStorage, so hasPremiumEntitlement may be true even for a fresh
    // preview session. Skip the automatic DB sync on web — real upgrades are
    // handled by the explicit purchase/restore flows and the webhook in prod.
    if (Platform.OS === "web") return;
    if (!user || isSubscriptionLoading) return;
    // Only run once per user ID per app session. This prevents an update loop
    // (updateUser re-renders the component, re-triggering the effect) at the
    // cost of not catching same-session drift after the initial sync. In practice
    // that drift can only happen if RC emits a second customerInfo change within
    // the same session (e.g. subscription renewal) — tolerable because the
    // feature gates already read from RC live; Supabase is only a cache.
    if (syncedForUserIdRef.current === user.id) return;
    syncedForUserIdRef.current = user.id;

    const isPremiumInDb = user.plan_tier === "premium";
    const uid = user.id.slice(-6);

    if (hasPremiumEntitlement && !isPremiumInDb) {
      // RC confirms active entitlement but Supabase is stale — upgrade.
      console.log("[PlanSyncEffect] decision=upgrade", {
        uid,
        hasPremiumEntitlement,
        plan_tier: user.plan_tier,
      });
      // Defensive: guard is implicit — this branch only executes when
      // hasPremiumEntitlement === true, satisfying the RC entitlement check.
      updateUser({ plan_tier: "premium" });
    } else if (!hasPremiumEntitlement && isPremiumInDb) {
      // RC confirmed no entitlement but Supabase still says premium — downgrade
      // to repair stale cache. All feature gates already read from RC, so the
      // user is already correctly limited; this just keeps Supabase consistent.
      console.log("[PlanSyncEffect] decision=downgrade", {
        uid,
        hasPremiumEntitlement,
        plan_tier: user.plan_tier,
      });
      updateUser({ plan_tier: "free" });
    } else {
      console.log("[PlanSyncEffect] decision=no-op (RC and DB in sync)", {
        uid,
        hasPremiumEntitlement,
        plan_tier: user.plan_tier,
      });
    }
  }, [hasPremiumEntitlement, isSubscriptionLoading, user?.id]);

  return null;
}

export default function RootLayout() {
  const [loaded] = useFredoka({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    PatrickHand_400Regular,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const style = document.createElement("style");
    style.id = "wename-phone-frame";
    style.textContent = `
      body {
        margin: 0 !important;
        height: auto !important;
        min-height: 100vh;
        overflow: auto !important;
        display: flex !important;
        justify-content: center;
        align-items: flex-start;
        background-color: #c8bfb0;
        background-image: radial-gradient(circle at 60% 40%, #d4c9b8 0%, #b8ad9e 100%);
      }
      #root {
        flex: none !important;
        width: 100% !important;
        max-width: 390px !important;
        height: auto !important;
        min-height: 100vh;
        background-color: #f9f1de;
        overflow: hidden;
        box-shadow:
          0 0 0 1px rgba(0,0,0,0.10),
          0 8px 24px rgba(0,0,0,0.14),
          0 32px 80px rgba(0,0,0,0.18);
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.getElementById("wename-phone-frame")?.remove();
    };
  }, []);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <UserProvider>
                  <SubscriptionProvider>
                    <PlanSyncEffect />
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen
                        name="onboarding"
                        options={{ animation: "fade" }}
                      />
                      <Stack.Screen
                        name="join/[token]"
                        options={{ presentation: "modal" }}
                      />
                      <Stack.Screen name="auth/callback" />
                      <Stack.Screen name="delete-account" />
                    </Stack>
                  </SubscriptionProvider>
                </UserProvider>
                <AuthModalOverlay />
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
