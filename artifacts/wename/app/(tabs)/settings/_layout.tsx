import { Stack } from "expo-router";
import React from "react";

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="partner" />
      <Stack.Screen name="name-packs" />
      <Stack.Screen name="premium" />
      <Stack.Screen name="account" />
      <Stack.Screen name="support" />
    </Stack>
  );
}
