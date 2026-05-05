import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

export type LoadingStep =
  | "Checking session"
  | "Loading profile"
  | "Loading pack"
  | "Loading names"
  | "Profile failed"
  | "Ready";

type Props = {
  step: LoadingStep | string;
  userIdSuffix?: string;
  packSlug?: string | null;
  isPremium?: boolean;
  namesCount?: number;
  errorMsg?: string;
  onRetry: () => void;
  onSignOut: () => void;
  onReset: () => void;
};

const TIMEOUT_SECONDS = 8;

export function DebugLoadingScreen({
  step,
  onRetry,
  onSignOut,
  onReset,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, []);

  const isTimedOut = elapsed >= TIMEOUT_SECONDS;
  const isFailed = step === "Profile failed";

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.parchment,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      {!isFailed && (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={styles.spinner}
        />
      )}

      <Text style={[styles.stepText, { color: colors.foreground }]}>
        {step}
        {!isFailed && "…"}
      </Text>

      {(isTimedOut || isFailed) && (
        <View style={styles.recovery}>
          <Text style={[styles.recoveryTitle, { color: colors.foreground }]}>
            {isFailed ? "Could not load your profile." : `Stuck on: ${step}`}
          </Text>
          <Text style={[styles.recoveryBody, { color: colors.mutedForeground }]}>
            {isFailed
              ? "Check your connection and try again."
              : "Something is taking longer than expected. Choose an option below."}
          </Text>

          <Pressable
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={onRetry}
          >
            <Text style={[styles.btnText, { color: "#fff" }]}>Retry</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
            onPress={onSignOut}
          >
            <Text style={[styles.btnText, { color: colors.foreground }]}>Sign Out</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.destructive + "66" }]}
            onPress={onReset}
          >
            <Text style={[styles.btnText, { color: colors.destructive }]}>
              Reset App Data
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  spinner: {
    marginBottom: 8,
  },
  stepText: {
    fontFamily: fonts.displaySemibold,
    fontSize: 16,
    textAlign: "center",
  },
  recovery: {
    marginTop: 20,
    alignSelf: "stretch",
    gap: 10,
  },
  recoveryTitle: {
    fontFamily: fonts.displaySemibold,
    fontSize: 15,
    textAlign: "center",
    marginBottom: 2,
  },
  recoveryBody: {
    fontFamily: fonts.display,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 6,
    lineHeight: 19,
  },
  btn: {
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontFamily: fonts.displaySemibold,
    fontSize: 15,
  },
});
