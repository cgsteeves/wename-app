import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { NamePack } from "@/lib/supabase";

const flowerBorder = require("../assets/images/grass-flower-border.png");
const paperTexture = require("../assets/images/paper-texture.jpg");

export function PackSwitcherSheet({
  open,
  packs,
  selectedSlug,
  isPremium,
  onSelect,
  onClose,
}: {
  open: boolean;
  packs: NamePack[];
  selectedSlug: string | null;
  isPremium: boolean;
  onSelect: (slug: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const slideY = useSharedValue(600);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (open) {
      slideY.value = withSpring(0, { damping: 22, stiffness: 260, mass: 0.85 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      slideY.value = withTiming(600, { duration: 260 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [open, slideY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Dim backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + 12 }, sheetStyle]}
        >
          {/* Paper texture */}
          <Image
            source={paperTexture}
            style={[StyleSheet.absoluteFill, styles.texture]}
            contentFit="cover"
          />

          {/* Flower border strip at top of card */}
          <Image source={flowerBorder} style={styles.flowerTop} contentFit="cover" />

          {/* Content */}
          <View style={styles.body}>
            {/* Title */}
            <Text style={[styles.title, { color: colors.grass }]}>Switch Pack</Text>

            {/* Decorative rule */}
            <View style={styles.ruleRow}>
              <View style={[styles.ruleLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.ruleGlyph, { color: colors.border }]}>❦</Text>
              <View style={[styles.ruleLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Pack list */}
            <ScrollView
              style={styles.listScroll}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={[
                  styles.packList,
                  { borderColor: colors.border + "66", backgroundColor: colors.card + "cc" },
                ]}
              >
                {packs.map((pack, i) => {
                  const active = selectedSlug === pack.slug;
                  const locked = pack.is_premium && !isPremium;
                  return (
                    <Pressable
                      key={pack.slug}
                      onPress={() => {
                        if (!locked) {
                          onSelect(pack.slug);
                          onClose();
                        }
                      }}
                      style={({ pressed }) => [
                        styles.packRow,
                        i > 0 && {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: colors.border + "55",
                        },
                        pressed && !locked && { opacity: 0.75 },
                      ]}
                    >
                      <View
                        style={[
                          styles.radio,
                          {
                            borderColor: active ? colors.grass : colors.border,
                            backgroundColor: active ? colors.grass : "transparent",
                          },
                        ]}
                      >
                        {active && <Feather name="check" size={10} color="#fff" />}
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontFamily: active ? fonts.displaySemibold : fonts.display,
                          fontSize: 14,
                          color: active
                            ? colors.foreground
                            : locked
                              ? colors.mutedForeground
                              : colors.foreground + "cc",
                        }}
                      >
                        {pack.display_name}
                      </Text>
                      {active && !locked && (
                        <View
                          style={[
                            styles.activePill,
                            {
                              borderColor: "hsla(145,45%,35%,0.4)",
                              backgroundColor: "hsla(145,45%,35%,0.1)",
                            },
                          ]}
                        >
                          <Text style={[styles.activePillText, { color: colors.grass }]}>
                            Active
                          </Text>
                        </View>
                      )}
                      {locked && (
                        <View style={styles.lockRow}>
                          <Feather name="lock" size={11} color="#d97706" />
                          <Text style={styles.lockText}>Premium</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Done button */}
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.doneBtn,
                { borderColor: colors.border + "88", opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.doneBtnText, { color: colors.mutedForeground }]}>Done</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    backgroundColor: "rgba(18, 12, 6, 0.55)",
  },
  sheet: {
    backgroundColor: "#fdf6ef",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: "rgba(193, 177, 154, 0.7)",
    shadowColor: "#3d2009",
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  texture: {
    opacity: 0.28,
  },
  flowerTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    opacity: 0.85,
  },
  body: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 4,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.hand,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  ruleLine: {
    flex: 1,
    height: 1,
    opacity: 0.5,
  },
  ruleGlyph: {
    fontSize: 16,
    fontFamily: fonts.hand,
  },
  listScroll: {
    maxHeight: 320,
  },
  packList: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  packRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    height: 50,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  activePill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  activePillText: {
    fontFamily: fonts.displaySemibold,
    fontSize: 11,
  },
  lockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lockText: {
    color: "#d97706",
    fontFamily: fonts.displaySemibold,
    fontSize: 12,
  },
  doneBtn: {
    alignSelf: "center",
    marginTop: 4,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  doneBtnText: {
    fontFamily: fonts.displaySemibold,
    fontSize: 14,
  },
});
