import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { useUser } from "@/components/UserContext";

const butterfly = require("../../assets/images/butterfly.png");

function TabBarIcon({
  name,
  focused,
  color,
  isButterfly,
}: {
  name: keyof typeof Feather.glyphMap;
  focused: boolean;
  color: string;
  isButterfly?: boolean;
}) {
  if (isButterfly) {
    return focused ? (
      <Image source={butterfly} style={styles.butterflyImg} contentFit="contain" />
    ) : (
      <Text style={{ fontSize: 18, opacity: 0.7 }}>🦋</Text>
    );
  }
  return <Feather name={name} size={18} color={color} />;
}

export default function TabLayout() {
  const colors = useColors();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const isBoy = !user || user.baby_gender !== "girl";
  const accent = isBoy ? colors.boy : colors.girlPink;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: fonts.displayMedium,
          fontSize: 11,
          marginTop: 2,
        },
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border + "55",
          backgroundColor: "transparent",
          elevation: 0,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarBackground: () => (
          <LinearGradient
            colors={["hsl(38, 42%, 91%)", "hsl(38, 45%, 93%)"]}
            style={[
              StyleSheet.absoluteFill,
              {
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: -2 },
              },
            ]}
          />
        ),
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Swipe",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="layers" color={color} focused={focused} isButterfly />
          ),
        }}
      />
      <Tabs.Screen
        name="names"
        options={{
          title: "Names",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && pillStyle(accent)]}>
              <Feather name="heart" size={18} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && pillStyle(accent)]}>
              <Feather name="settings" size={18} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

function pillStyle(accent: string) {
  return {
    backgroundColor: accent + "14",
    borderWidth: Platform.OS === "ios" ? 0.5 : 1,
    borderColor: accent + "33",
  } as const;
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 36,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  butterflyImg: { width: 26, height: 26 },
});
