import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUser } from "@/components/UserContext";
import { useColors } from "@/hooks/useColors";

export default function JoinByCode() {
  const colors = useColors();
  const router = useRouter();
  const { user, loading, linkPartnerByCode } = useUser();
  const { token } = useLocalSearchParams<{ token: string }>();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<"idle" | "linking" | "ok" | "err">(
    "idle",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading || !user || !token || status !== "idle") return;
    setStatus("linking");
    linkPartnerByCode(String(token)).then((res) => {
      if (res.ok) setStatus("ok");
      else {
        setStatus("err");
        setError(res.error ?? "Could not link");
      }
    });
  }, [loading, user, token, status, linkPartnerByCode]);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.parchment,
          paddingTop: insets.top + 24,
        },
      ]}
    >
      {status === "linking" && <ActivityIndicator color={colors.primary} />}
      {status === "ok" && (
        <>
          <Feather name="check-circle" size={48} color={colors.grass} />
          <Text style={[styles.title, { color: colors.foreground }]}>You're linked!</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            You and your partner can now see matches together.
          </Text>
        </>
      )}
      {status === "err" && (
        <>
          <Feather name="alert-circle" size={48} color={colors.destructive} />
          <Text style={[styles.title, { color: colors.foreground }]}>Couldn't link</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{error}</Text>
        </>
      )}
      {status !== "linking" && (
        <Pressable
          onPress={() => router.replace("/(tabs)")}
          style={[styles.btn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.btnText}>Continue</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  title: { fontSize: 22, fontWeight: "800", marginTop: 8 },
  body: { fontSize: 14, textAlign: "center" },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 24 },
  btnText: { color: "#fff", fontWeight: "700" },
});
