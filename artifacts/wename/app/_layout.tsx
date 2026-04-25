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
import React, { useEffect } from "react";
import { Platform, Text, TextInput } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/components/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import { UserProvider, useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { supabase } from "@/lib/supabase";

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

// Listens for the popup-window callback's success message and refreshes
// the opener tab's session + user profile so the original tab reflects the
// signed-in state without requiring a manual reload.
function PopupAuthSyncBridge() {
  const { reload } = useUser();
  const { closeAuthModal } = useAuth();

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    function handleMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string } | null;
      if (!data || data.type !== "wename:auth:signed_in") return;
      // Pick up the session the popup just wrote into localStorage and
      // refresh the user profile.
      supabase.auth
        .refreshSession()
        .catch(() => {})
        .finally(() => {
          reload();
          closeAuthModal();
        });
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [reload, closeAuthModal]);

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
                  <PopupAuthSyncBridge />
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
                  <AuthModalOverlay />
                </UserProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
