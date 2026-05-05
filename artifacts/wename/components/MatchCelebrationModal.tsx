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

export function MatchCelebrationModal({
  open,
  name,
  gender,
  lastName,
  onClose,
  onSeeAll,
}: {
  open: boolean;
  name: string | null;
  gender: "boy" | "girl" | "either" | null;
  lastName?: string | null;
  onClose: () => void;
  onSeeAll: () => void;
}) {
  const colors = useColors();
  const accent =
    gender === "boy"
      ? colors.boy
      : gender === "girl"
        ? colors.girlPink
        : colors.accent;

  // ── Animation shared values ──────────────────────────────────────────────
  const card          = useSharedValue(0);
  const h1            = useSharedValue(0);
  const h2            = useSharedValue(0);
  const h3            = useSharedValue(0);
  const bob           = useSharedValue(0);
  const nameEntry     = useSharedValue(0);
  const butterflyVal  = useSharedValue(0);
  const starGlow      = useSharedValue(0.3);

  useEffect(() => {
    if (open) {
      card.value         = withSpring(1, { damping: 15, stiffness: 160, mass: 0.8 });
      h1.value           = withDelay(100, withSpring(1, { damping: 8, stiffness: 240 }));
      h2.value           = withDelay(220, withSpring(1, { damping: 8, stiffness: 240 }));
      h3.value           = withDelay(340, withSpring(1, { damping: 8, stiffness: 240 }));
      nameEntry.value    = withDelay(320, withSpring(1, { damping: 16, stiffness: 140 }));
      butterflyVal.value = withDelay(450, withSpring(1, { damping: 14, stiffness: 110 }));
      bob.value = withDelay(
        700,
        withRepeat(
          withSequence(
            withTiming(-10, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
            withTiming(0,   { duration: 1700, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        ),
      );
      starGlow.value = withRepeat(
        withSequence(
          withTiming(1,   { duration: 850 }),
          withTiming(0.3, { duration: 850 }),
        ),
        -1,
        false,
      );
    } else {
      card.value         = withTiming(0, { duration: 180 });
      h1.value           = 0;
      h2.value           = 0;
      h3.value           = 0;
      nameEntry.value    = 0;
      butterflyVal.value = 0;
      bob.value          = 0;
      starGlow.value     = 0.3;
    }
  }, [open, card, h1, h2, h3, bob, nameEntry, butterflyVal, starGlow]);

  // ── Animated styles ──────────────────────────────────────────────────────
  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value,
    transform: [
      { scale: 0.86 + 0.14 * card.value },
      { translateY: (1 - card.value) * 28 },
    ],
  }));

  const h1Style = useAnimatedStyle(() => ({
    opacity: h1.value,
    transform: [{ scale: 0.2 + 0.8 * h1.value }, { translateY: bob.value * 0.7 }],
  }));
  const h2Style = useAnimatedStyle(() => ({
    opacity: h2.value,
    transform: [{ scale: 0.2 + 0.8 * h2.value }, { translateY: bob.value }],
  }));
  const h3Style = useAnimatedStyle(() => ({
    opacity: h3.value,
    transform: [{ scale: 0.2 + 0.8 * h3.value }, { translateY: bob.value * 0.55 }],
  }));

  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameEntry.value,
    transform: [{ scale: 0.82 + 0.18 * nameEntry.value }],
  }));

  const butterflyStyle = useAnimatedStyle(() => ({
    opacity: butterflyVal.value,
    transform: [
      { translateX: (1 - butterflyVal.value) * 44 },
      { translateY: (1 - butterflyVal.value) * -24 },
      { rotate: `${(1 - butterflyVal.value) * 18}deg` },
    ],
  }));

  const starStyle = useAnimatedStyle(() => ({ opacity: starGlow.value }));

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.cardWrap, cardStyle]}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.cardOuter}>

            {/* ── Card ────────────────────────────────────────────────── */}
            <View style={styles.card}>

              {/* Paper texture overlay */}
              <Image
                source={paperTexture}
                style={[StyleSheet.absoluteFill, styles.texture]}
                contentFit="cover"
              />

              {/* Top flower border */}
              <Image source={flowerBorder} style={styles.flowerTop} contentFit="cover" />

              {/* Body */}
              <View style={styles.body}>

                {/* Floating hearts */}
                <View style={styles.heartsRow}>
                  <Animated.View style={h1Style}>
                    <Feather name="heart" size={16} color={colors.heart} />
                  </Animated.View>
                  <Animated.View style={h2Style}>
                    <Feather name="heart" size={26} color={colors.heart} />
                  </Animated.View>
                  <Animated.View style={h3Style}>
                    <Feather name="heart" size={16} color={colors.heart} />
                  </Animated.View>
                </View>

                {/* Title with twinkling stars */}
                <View style={styles.titleRow}>
                  <Animated.Text style={[styles.star, { color: colors.sun }, starStyle]}>✦</Animated.Text>
                  <Text style={[styles.title, { color: colors.grass }]}>It's a Match!</Text>
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
                  you both love the name
                </Text>

                {/* Name */}
                <Animated.View style={[styles.nameWrap, nameStyle]}>
                  <Text
                    style={[styles.nameText, { color: accent }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {name ?? ""}
                  </Text>
                  {!!lastName && (
                    <Text style={[styles.lastName, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {lastName}
                    </Text>
                  )}
                </Animated.View>

                {/* Bottom rule */}
                <View style={styles.ruleRow}>
                  <View style={[styles.ruleLine, { backgroundColor: colors.border }]} />
                  <Animated.Text style={[styles.ruleGlyph, { color: colors.sun }, starStyle]}>✦</Animated.Text>
                  <View style={[styles.ruleLine, { backgroundColor: colors.border }]} />
                </View>

                {/* Buttons */}
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: accent, opacity: pressed ? 0.88 : 1 },
                  ]}
                >
                  <Feather name="heart" size={15} color="#fff" />
                  <Text style={styles.primaryBtnText}>Keep Swiping</Text>
                </Pressable>

                <Pressable onPress={onSeeAll} style={styles.secondary}>
                  <Text style={[styles.secondaryText, { color: accent }]}>
                    See all matches →
                  </Text>
                </Pressable>

              </View>

              {/* Bottom flower border (flipped vertically) */}
              <Image
                source={flowerBorder}
                style={[styles.flowerBottom, { transform: [{ scaleY: -1 }] }]}
                contentFit="cover"
              />

            </View>

            {/* ── Butterfly accent ────────────────────────────────────── */}
            <Animated.View style={[styles.butterfly, butterflyStyle]} pointerEvents="none">
              <Image source={butterflyImg} style={styles.butterflyImg} contentFit="contain" />
            </Animated.View>

          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 12, 6, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  cardWrap: {
    width: "100%",
    maxWidth: 360,
  },
  cardOuter: {
    // overflow visible so butterfly can escape card bounds
  },

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
    opacity: 0.32,
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

  // Hearts
  heartsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 2,
  },

  // Title
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  star: {
    fontSize: 18,
    fontFamily: fonts.hand,
  },
  title: {
    fontSize: 36,
    fontFamily: fonts.hand,
    letterSpacing: 0.3,
  },

  // Rule
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
    opacity: 0.6,
  },
  ruleGlyph: {
    fontSize: 18,
    fontFamily: fonts.hand,
  },

  // Subtitle
  subtitle: {
    fontSize: 13,
    fontFamily: fonts.display,
    letterSpacing: 0.2,
    marginTop: -2,
  },

  // Name
  nameWrap: {
    alignItems: "center",
    marginVertical: 4,
  },
  nameText: {
    fontSize: 56,
    fontFamily: fonts.hand,
    letterSpacing: -0.5,
    textAlign: "center",
    lineHeight: 62,
  },
  lastName: {
    fontSize: 20,
    fontFamily: fonts.displaySemibold,
    marginTop: 2,
    letterSpacing: 0.5,
  },

  // Buttons
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
    shadowOpacity: 0.18,
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
    fontSize: 14,
  },

  // Butterfly
  butterfly: {
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
