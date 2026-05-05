import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useUser } from "@/components/UserContext";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { ONBOARDED_KEY } from "@/lib/supabase";

export default function Index() {
  const { user, loading, loadError, reload } = useUser();
  const colors = useColors();
  const [localOnboarded, setLocalOnboarded] = useState<boolean | null>(null);
  const resolvedRef = useRef(false);

  useEffect(() => {
    resolvedRef.current = false;

    const resolve = (value: boolean) => {
      if (!resolvedRef.current) {
        resolvedRef.current = true;
        setLocalOnboarded(value);
      }
    };

    const timeout = setTimeout(() => resolve(false), 3000);

    AsyncStorage.getItem(ONBOARDED_KEY)
      .then((v) => resolve(v === "true"))
      .catch(() => resolve(false))
      .finally(() => clearTimeout(timeout));

    return () => {
      resolvedRef.current = true;
      clearTimeout(timeout);
    };
  }, []);

  // Surface an explicit error/retry UI if profile loading failed entirely.
  // Without this the app would silently spin forever on a TestFlight build
  // when createUser fails (RLS, network, etc).
  if (loadError && !user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.parchment }]}>
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>
          Couldn&apos;t load your profile
        </Text>
        <Text style={[styles.errorBody, { color: colors.mutedForeground }]}>
          Check your internet connection and try again.
        </Text>
        <Pressable
          onPress={() => reload()}
          style={({ pressed }) => [
            styles.retryBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (loading || localOnboarded === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.parchment }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Don't redirect into the tab nav until the user profile is actually
  // ready. Otherwise (tabs)/index.tsx renders with user=null and shows a
  // silent spinner forever — the exact bug TestFlight users hit when
  // ONBOARDED_KEY persisted from a previous install but the profile fetch
  // failed on the new build.
  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.parchment }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const onboarded = localOnboarded || !!user.onboarding_complete;

  if (!onboarded) {
    return <Redirect href="/onboarding" />;
  }
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  errorTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    textAlign: "center",
  },
  errorBody: {
    fontFamily: fonts.display,
    fontSize: 14,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryText: {
    fontFamily: fonts.displaySemibold,
    fontSize: 14,
    color: "#fff",
  },
});
