import * as Font from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { Text, TextInput } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/components/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import { UserProvider, useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { supabase } from "@/lib/supabase";

Font.loadAsync({
  Fredoka_400Regular: require("../assets/fonts/Fredoka_400Regular.ttf"),
  Fredoka_500Medium: require("../assets/fonts/Fredoka_500Medium.ttf"),
  Fredoka_600SemiBold: require("../assets/fonts/Fredoka_600SemiBold.ttf"),
  Fredoka_700Bold: require("../assets/fonts/Fredoka_700Bold.ttf"),
  PatrickHand_400Regular: require("../assets/fonts/PatrickHand_400Regular.ttf"),
  Feather: require("../assets/fonts/Feather.ttf"),
  FontAwesome: require("../assets/fonts/FontAwesome.ttf"),
  FontAwesome5_Regular: require("../assets/fonts/FontAwesome5_Regular.ttf"),
  FontAwesome5_Solid: require("../assets/fonts/FontAwesome5_Solid.ttf"),
  FontAwesome5_Brands: require("../assets/fonts/FontAwesome5_Brands.ttf"),
});

if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.id = "wename-web-styles";
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
    @font-face {
      font-family: "Fredoka_400Regular";
      font-style: italic;
      src: url("/assets/fonts/Fredoka_400Regular.e1acb36133ba3fedec8ab2610cd61c6b.ttf") format("truetype");
    }
    @font-face {
      font-family: "Fredoka_500Medium";
      font-style: italic;
      src: url("/assets/fonts/Fredoka_500Medium.3e8c574c93c92c04130508b454b61529.ttf") format("truetype");
    }
    @font-face {
      font-family: "Fredoka_600SemiBold";
      font-style: italic;
      src: url("/assets/fonts/Fredoka_600SemiBold.89a2d8224922009e6f9b96181093b634.ttf") format("truetype");
    }
    @font-face {
      font-family: "Fredoka_700Bold";
      font-style: italic;
      src: url("/assets/fonts/Fredoka_700Bold.eaa34632fd156f78e16a584d1648ffcc.ttf") format("truetype");
    }
    @font-face {
      font-family: "PatrickHand_400Regular";
      font-style: italic;
      src: url("/assets/fonts/PatrickHand_400Regular.0b94e62171b862ddb28135554050f315.ttf") format("truetype");
    }
  `;
  if (!document.getElementById("wename-web-styles")) {
    document.head.appendChild(style);
  }
}

const TextAny = Text as any;
TextAny.defaultProps = TextAny.defaultProps || {};
TextAny.defaultProps.style = [{ fontFamily: fonts.display }, TextAny.defaultProps.style];
const TextInputAny = TextInput as any;
TextInputAny.defaultProps = TextInputAny.defaultProps || {};
TextInputAny.defaultProps.style = [
  { fontFamily: fonts.display },
  TextInputAny.defaultProps.style,
];

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

// The Google sign-in popup writes a session straight into localStorage and
// posts a "wename:auth:signed_in" message to its opener. This bridge picks
// up that message in the original tab, refreshes the in-memory session, and
// reloads the user profile so the UI immediately reflects the signed-in
// state without requiring a manual refresh.
function PopupAuthSyncBridge() {
  const { reload } = useUser();
  const { closeAuthModal } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string } | null;
      if (!data || data.type !== "wename:auth:signed_in") return;
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
  useEffect(() => {
    return () => {
      document.getElementById("wename-web-styles")?.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
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
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
