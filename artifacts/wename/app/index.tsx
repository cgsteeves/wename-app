import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useUser } from "@/components/UserContext";
import { useColors } from "@/hooks/useColors";
import { ONBOARDED_KEY } from "@/lib/supabase";

export default function Index() {
  const { user, loading } = useUser();
  const colors = useColors();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY).then((v) => setOnboarded(v === "true"));
  }, []);

  if (loading || onboarded === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.parchment }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!onboarded || !user) {
    return <Redirect href="/onboarding" />;
  }
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
