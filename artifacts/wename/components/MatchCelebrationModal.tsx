import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

const paperTexture = require("../assets/images/paper-texture.jpg");

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
  const heart = useSharedValue(0);
  const card = useSharedValue(0);
  const accent =
    gender === "boy"
      ? colors.boy
      : gender === "girl"
        ? colors.girlPink
        : colors.accent;

  useEffect(() => {
    if (open) {
      card.value = withSpring(1, { damping: 14, stiffness: 180 });
      heart.value = withDelay(150, withSpring(1, { damping: 8, stiffness: 220 }));
    } else {
      card.value = withTiming(0, { duration: 180 });
      heart.value = 0;
    }
  }, [open, card, heart]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value,
    transform: [{ scale: 0.92 + 0.08 * card.value }],
  }));
  const heartStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 0.4 + 0.6 * heart.value },
      { rotate: `${(1 - heart.value) * -20}deg` },
    ],
  }));

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.cardWrap, cardStyle]}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              <LinearGradient
                colors={["#fffbeb", "#fef3c7", "#fde68a"]}
                style={StyleSheet.absoluteFill}
              />
              <Image
                source={paperTexture}
                style={[StyleSheet.absoluteFill, { opacity: 0.18 }]}
                contentFit="cover"
              />

              <Animated.View style={[styles.heartBadge, heartStyle]}>
                <Feather name="heart" size={42} color={colors.heart} />
              </Animated.View>

              <Text style={[styles.title, { color: colors.grass }]}>It's a Match!</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                You both love the name
              </Text>

              <Text style={[styles.nameText, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
                {name ?? ""}
              </Text>
              {!!lastName && (
                <Text style={[styles.lastName, { color: accent + "cc" }]} numberOfLines={1}>
                  {lastName}
                </Text>
              )}

              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: accent, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text style={styles.primaryBtnText}>Keep swiping</Text>
              </Pressable>
              <Pressable onPress={onSeeAll} style={styles.secondary}>
                <Text style={[styles.secondaryText, { color: accent }]}>See all matches</Text>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  cardWrap: { width: "100%", maxWidth: 360 },
  card: {
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  heartBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  title: { fontSize: 32, fontFamily: fonts.hand, marginTop: 8 },
  subtitle: { fontSize: 14, fontFamily: fonts.display, marginTop: 4 },
  nameText: {
    fontSize: 48,
    fontFamily: fonts.displayBold,
    marginTop: 14,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  lastName: { fontSize: 22, fontFamily: fonts.displaySemibold, marginTop: 2 },
  primaryBtn: {
    marginTop: 20,
    paddingHorizontal: 28,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 180,
  },
  primaryBtnText: { color: "#fff", fontFamily: fonts.displayBold, fontSize: 15 },
  secondary: { marginTop: 12, paddingVertical: 6 },
  secondaryText: { fontFamily: fonts.displaySemibold, fontSize: 14 },
});
