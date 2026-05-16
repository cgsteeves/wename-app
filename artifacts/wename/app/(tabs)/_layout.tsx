import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { useUser } from "@/components/UserContext";

const butterfly = require("../../assets/images/butterfly.png");

// ─── Tab bar height constants (consumed by swipe screen for Android card sizing)
// barInner: paddingVertical(8×2=16) + tabButton paddingVertical(2×2=4) + pill(36) + label(~14) ≈ 70
export const TAB_BAR_INNER_HEIGHT = 70;
// Extra bottom padding added on Android above Math.max(insets.bottom, 8)
export const TAB_BAR_BOTTOM_PAD_ANDROID = 8;

// ─── Tab definitions ─────────────────────────────────────────────────────────
const TABS = [
  { name: "index",    label: "Swipe",    icon: "layers"   as const },
  { name: "names",    label: "Names",    icon: "heart"    as const },
  { name: "settings", label: "Settings", icon: "settings" as const },
] as const;

// ─── Single tab button ────────────────────────────────────────────────────────
function TabButton({
  tab,
  focused,
  accent,
  onPress,
  onLongPress,
}: {
  tab: typeof TABS[number];
  focused: boolean;
  accent: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale  = useRef(new Animated.Value(1)).current;
  const pillW  = useRef(new Animated.Value(focused ? 1 : 0)).current;

  // Pill expand/contract animation
  useEffect(() => {
    Animated.spring(pillW, {
      toValue: focused ? 1 : 0,
      useNativeDriver: false,
      tension: 220,
      friction: 22,
    }).start();
  }, [focused]);

  function handlePressIn() {
    Animated.spring(scale, {
      toValue: 0.88,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  }

  const iconColor    = focused ? "#fff" : "#a09080";
  const labelColor   = focused ? accent : "#a09080";

  // Pill width: interpolates from icon-only width to icon+label width
  const pillBg = pillW.interpolate({
    inputRange:  [0, 1],
    outputRange: ["rgba(0,0,0,0)", accent],
  });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabButton}
      accessibilityRole="button"
      accessibilityLabel={tab.label}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
        {/* Active pill */}
        <Animated.View
          style={[
            styles.pill,
            {
              backgroundColor: pillBg,
              paddingHorizontal: pillW.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 14],
              }),
            },
          ]}
        >
          {/* Icon */}
          {tab.name === "index" ? (
            focused ? (
              <Image
                source={butterfly}
                style={styles.butterflyImg}
                contentFit="contain"
              />
            ) : (
              <Text style={styles.butterflyEmoji}>🦋</Text>
            )
          ) : (
            <Feather name={tab.icon} size={18} color={iconColor} />
          )}

          {/* Label — only visible inside active pill */}
          <Animated.Text
            style={[
              styles.pillLabel,
              {
                maxWidth: pillW.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 64],
                }),
                opacity: pillW,
                marginLeft: pillW.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 5],
                }),
              },
            ]}
            numberOfLines={1}
          >
            {tab.label}
          </Animated.Text>
        </Animated.View>

        {/* Always-visible label beneath the pill */}
        <Animated.Text
          style={[
            styles.tabLabel,
            {
              color: labelColor,
              opacity: pillW.interpolate({
                inputRange: [0, 0.5],
                outputRange: [1, 0],
              }),
              fontFamily: focused ? fonts.displaySemibold : fonts.display,
            },
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Custom tab bar ───────────────────────────────────────────────────────────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useColors();
  const { user } = useUser();
  const insets  = useSafeAreaInsets();
  const isBoy   = !user || user.baby_gender !== "girl";
  const accent  = isBoy ? colors.boy : colors.girlPink;

  return (
    <View
      style={[
        styles.barOuter,
        {
          paddingBottom: Math.max(insets.bottom, 8) + (Platform.OS === "android" ? 8 : 0),
          backgroundColor: "transparent",
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.barInner,
          {
            backgroundColor: "#f5ede0",
            borderColor: "rgba(206,197,185,0.55)",
            shadowColor: "#3d2e20",
          },
        ]}
      >
        {TABS.map((tab, i) => {
          const route   = state.routes[i];
          const focused = state.index === i;

          function onPress() {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          function onLongPress() {
            navigation.emit({ type: "tabLongPress", target: route.key });
          }

          return (
            <TabButton
              key={tab.name}
              tab={tab}
              focused={focused}
              accent={accent}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"    options={{ title: "Swipe"    }} />
      <Tabs.Screen name="names"    options={{ title: "Names"    }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  barOuter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
  },

  barInner: {
    width: "100%",
    flexDirection: "row",
    borderRadius: 26,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },

  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    height: 36,
    overflow: "hidden",
  },

  pillLabel: {
    color: "#fff",
    fontFamily: fonts.displaySemibold,
    fontSize: 13,
    overflow: "hidden",
  },

  tabLabel: {
    fontSize: 10,
    marginTop: 3,
  },

  butterflyImg:   { width: 22, height: 22 },
  butterflyEmoji: { fontSize: 18 },
});
