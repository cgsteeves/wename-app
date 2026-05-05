import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

const paperTexture = require("../assets/images/paper-texture.jpg");
const flowerBorder = require("../assets/images/grass-flower-border.png");
const butterflyImg = require("../assets/images/butterfly.png");

export function PackCompleteModal({
  open,
  packName,
  onStartOver,
  onSwitchPack,
}: {
  open: boolean;
  packName: string;
  onStartOver: () => void;
  onSwitchPack: () => void;
}) {
  const colors = useColors();

  const card        = useSharedValue(0);
  const checkEntry  = useSharedValue(0);
  const nameEntry   = useSharedValue(0);
  const butterfly   = useSharedValue(0);
  const starGlow    = useSharedValue(0.3);
  const bob         = useSharedValue(0);

  useEffect(() => {
    if (open) {
      card.value       = withSpring(1, { damping: 15, stiffness: 155, mass: 0.85 });
      checkEntry.value = withDelay(140, withSpring(1, { damping: 7, stiffness: 260 }));
      nameEntry.value  = withDelay(280, withSpring(1, { damping: 16, stiffness: 140 }));
      butterfly.value  = withDelay(400, withSpring(1, { damping: 14, stiffness: 110 }));
      bob.value = withDelay(
        600,
        withRepeat(
          withSequence(
            withTiming(-8, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
            withTiming(0,  { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        ),
      );
      starGlow.value = withRepeat(
        withSequence(
          withTiming(1,   { duration: 900 }),
          withTiming(0.3, { duration: 900 }),
        ),
        -1,
        false,
      );
    } else {
      card.value       = withTiming(0, { duration: 180 });
      checkEntry.value = 0;
      nameEntry.value  = 0;
      butterfly.value  = 0;
      bob.value        = 0;
      starGlow.value   = 0.3;
    }
  }, [open, card, checkEntry, nameEntry, butterfly, bob, starGlow]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value,
    transform: [
      { scale: 0.86 + 0.14 * card.value },
      { translateY: (1 - card.value) * 30 },
    ],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkEntry.value,
    transform: [
      { scale: 0.2 + 0.8 * checkEntry.value },
      { translateY: bob.value },
    ],
  }));

  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameEntry.value,
    transform: [{ scale: 0.84 + 0.16 * nameEntry.value }],
  }));

  const butterflyStyle = useAnimatedStyle(() => ({
    opacity: butterfly.value,
    transform: [
      { translateX: (1 - butterfly.value) * 44 },
      { translateY: (1 - butterfly.value) * -24 },
      { rotate: `${(1 - butterfly.value) * 18}deg` },
    ],
  }));

  const starStyle = useAnimatedStyle(() => ({ opacity: starGlow.value }));

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onSwitchPack}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.cardWrap, cardStyle]}>
          <Pressable onPress={() => {}} style={styles.cardOuter}>

            {/* ── Card ─────────────────────────────────────────────── */}
            <View style={styles.card}>
              <Image
                source={paperTexture}
                style={[StyleSheet.absoluteFill, styles.texture]}
                contentFit="cover"
              />
              <Image source={flowerBorder} style={styles.flowerTop} contentFit="cover" />

              <View style={styles.body}>

                {/* Animated check badge */}
                <Animated.View style={[styles.checkBadge, { backgroundColor: colors.grass + "20", borderColor: colors.grass + "40" }, checkStyle]}>
                  <Feather name="check-circle" size={32} color={colors.grass} />
                </Animated.View>

                {/* Title */}
                <View style={styles.titleRow}>
                  <Animated.Text style={[styles.star, { color: colors.sun }, starStyle]}>✦</Animated.Text>
                  <Text style={[styles.title, { color: colors.grass }]}>Pack Complete!</Text>
                  <Animated.Text style={[styles.star, { color: colors.sun }, starStyle]}>✦</Animated.Text>
                </View>

                {/* Decorative rule */}
                <View style={styles.ruleRow}>
                  <View style={[styles.ruleLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.ruleGlyph, { color: colors.border }]}>❦</Text>
                  <View style={[styles.ruleLine, { backgroundColor: colors.border }]} />
                </View>

                {/* Subtitle */}
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  you've explored every name in
                </Text>

                {/* Pack name */}
                <Animated.View style={[styles.packNameWrap, nameStyle]}>
                  <Text
                    style={[styles.packName, { color: colors.grass }]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                  >
                    {packName}
                  </Text>
                </Animated.View>

                {/* Bottom rule */}
                <View style={styles.ruleRow}>
                  <View style={[styles.ruleLine, { backgroundColor: colors.border }]} />
                  <Animated.Text style={[styles.ruleGlyph, { color: colors.sun }, starStyle]}>✦</Animated.Text>
                  <View style={[styles.ruleLine, { backgroundColor: colors.border }]} />
                </View>

                {/* Buttons */}
                <Pressable
                  onPress={onSwitchPack}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: colors.grass, opacity: pressed ? 0.88 : 1 },
                  ]}
                >
                  <Feather name="layers" size={15} color="#fff" />
                  <Text style={styles.primaryBtnText}>Switch Pack</Text>
                </Pressable>

                <Pressable onPress={onStartOver} style={styles.secondary}>
                  <Text style={[styles.secondaryText, { color: colors.mutedForeground }]}>
                    Start over with this pack
                  </Text>
                </Pressable>

              </View>

              <Image
                source={flowerBorder}
                style={[styles.flowerBottom, { transform: [{ scaleY: -1 }] }]}
                contentFit="cover"
              />
            </View>

            {/* ── Butterfly ─────────────────────────────────────────── */}
            <Animated.View style={[styles.butterflyWrap, butterflyStyle]} pointerEvents="none">
              <Image source={butterflyImg} style={styles.butterflyImg} contentFit="contain" />
            </Animated.View>

          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 12, 6, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  cardWrap: {
    width: "100%",
    maxWidth: 360,
  },
  cardOuter: {},
  card: {
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#fdf6ef",
    borderWidth: 1.5,
    borderColor: "rgba(193, 177, 154, 0.75)",
    shadowColor: "#3d2009",
    shadowOpacity: 0.32,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  texture: {
    opacity: 0.3,
    borderRadius: 28,
  },
  flowerTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 52,
    opacity: 0.9,
  },
  flowerBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 52,
    opacity: 0.9,
  },
  body: {
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 28,
    alignItems: "center",
    gap: 12,
  },
  checkBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  star: {
    fontSize: 16,
    fontFamily: fonts.hand,
  },
  title: {
    fontSize: 32,
    fontFamily: fonts.hand,
    letterSpacing: 0.2,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "stretch",
    marginVertical: 2,
  },
  ruleLine: {
    flex: 1,
    height: 1,
    opacity: 0.55,
  },
  ruleGlyph: {
    fontSize: 16,
    fontFamily: fonts.hand,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fonts.display,
    letterSpacing: 0.2,
    marginTop: -2,
  },
  packNameWrap: {
    alignItems: "center",
    marginVertical: 2,
    paddingHorizontal: 8,
  },
  packName: {
    fontSize: 42,
    fontFamily: fonts.hand,
    textAlign: "center",
    lineHeight: 48,
    letterSpacing: -0.3,
  },
  primaryBtn: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
    height: 52,
    borderRadius: 999,
    justifyContent: "center",
    minWidth: 200,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  primaryBtnText: {
    color: "#fff",
    fontFamily: fonts.displayBold,
    fontSize: 15,
  },
  secondary: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  secondaryText: {
    fontFamily: fonts.displaySemibold,
    fontSize: 13,
  },
  butterflyWrap: {
    position: "absolute",
    top: -28,
    right: -16,
    width: 72,
    height: 72,
    zIndex: 20,
  },
  butterflyImg: {
    width: 72,
    height: 72,
  },
});
