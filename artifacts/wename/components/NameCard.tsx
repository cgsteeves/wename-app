import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ImageBackground } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { forwardRef, useImperativeHandle, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

const { width: SCREEN_W } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_W * 0.27;
const VELOCITY_THRESHOLD = 800;

const boyBg = require("../assets/images/boy-card-bg.jpg");
const girlBg = require("../assets/images/girl-card-bg.jpg");

export interface NameCardHandle {
  swipe: (liked: boolean) => void;
}

export type NameCardProps = {
  name: string;
  pronunciation?: string | null;
  origin?: string | null;
  meaning?: string | null;
  nickname?: string | null;
  rank?: number | null;
  gender: "boy" | "girl";
  remaining: number;
  lastName?: string;
  isPartnerPick?: boolean;
  isNext?: boolean;
  canUndo?: boolean;
  onSwipe: (liked: boolean) => void;
  onUndo?: () => void;
};

const NameCard = forwardRef<NameCardHandle, NameCardProps>(function NameCard(
  {
    name,
    pronunciation,
    origin,
    meaning,
    nickname,
    rank,
    gender,
    remaining,
    lastName,
    isPartnerPick,
    isNext,
    canUndo,
    onSwipe,
    onUndo,
  },
  ref,
) {
  const colors = useColors();
  const isBoy = gender === "boy";
  const accent = isBoy ? colors.boy : colors.girlRed;
  const accentSoft = isBoy ? colors.boy : colors.girlPink;
  const [showInfo, setShowInfo] = useState(false);

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const exiting = useSharedValue(false);

  const haptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const finishSwipe = (liked: boolean) => {
    onSwipe(liked);
  };

  const commit = (liked: boolean) => {
    if (exiting.value) return;
    exiting.value = true;
    runOnJS(haptic)();
    x.value = withTiming(liked ? SCREEN_W * 1.5 : -SCREEN_W * 1.5, { duration: 280 });
    setTimeout(() => runOnJS(finishSwipe)(liked), 180);
  };

  useImperativeHandle(ref, () => ({ swipe: commit }));

  const pan = Gesture.Pan()
    .enabled(!isNext && !showInfo)
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY * 0.3;
    })
    .onEnd((e) => {
      const past = Math.abs(e.translationX) > SWIPE_THRESHOLD;
      const fast = Math.abs(e.velocityX) > VELOCITY_THRESHOLD;
      if (past || fast) {
        const liked = e.translationX > 0;
        exiting.value = true;
        x.value = withTiming(liked ? SCREEN_W * 1.5 : -SCREEN_W * 1.5, {
          duration: 260,
        });
        runOnJS(haptic)();
        runOnJS(finishSwipe)(liked);
      } else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    if (isNext) {
      return {
        transform: [{ scale: 0.95 }, { translateY: 14 }],
        opacity: 1,
      };
    }
    const rotate = interpolate(
      x.value,
      [-SCREEN_W, 0, SCREEN_W],
      [-15, 0, 15],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: x.value },
        { translateY: y.value },
        { rotate: `${rotate}deg` },
      ],
    };
  }, [isNext]);

  const likeOverlayStyle = useAnimatedStyle(() => ({
    opacity: isNext
      ? 0
      : interpolate(x.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const passOverlayStyle = useAnimatedStyle(() => ({
    opacity: isNext
      ? 0
      : interpolate(x.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.cardWrap, cardStyle]} pointerEvents="box-none">
      <GestureDetector gesture={pan}>
        <View
          style={[styles.card, { borderColor: accent + "55" }]}
          collapsable={false}
        >
          <ImageBackground
            source={isBoy ? boyBg : girlBg}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={["rgba(255,255,255,0.05)", "rgba(0,0,0,0.18)"]}
            style={StyleSheet.absoluteFill}
          />

          <Animated.View
            style={[styles.swipeBadge, styles.likeBadge, likeOverlayStyle]}
            pointerEvents="none"
          >
            <Text style={styles.swipeBadgeText}>LIKE</Text>
          </Animated.View>
          <Animated.View
            style={[styles.swipeBadge, styles.passBadge, passOverlayStyle]}
            pointerEvents="none"
          >
            <Text style={styles.swipeBadgeText}>PASS</Text>
          </Animated.View>

          <View style={styles.header} pointerEvents="box-none">
            <Text style={[styles.label, { color: accentSoft }]}>
              {isBoy ? "Boy Name" : "Girl Name"}
            </Text>
            <View style={[styles.divider, { backgroundColor: accentSoft }]} />
            <Text style={styles.remaining}>{remaining} names remaining</Text>
            {!isNext && (
              <Pressable
                onPress={() => setShowInfo(true)}
                style={[
                  styles.infoChip,
                  { borderColor: accent + "55", backgroundColor: "rgba(255,255,255,0.55)" },
                ]}
              >
                <Feather name="info" size={12} color={accent} />
                <Text style={[styles.infoChipText, { color: accent }]}>More info</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.center} pointerEvents="none">
            <Text style={[styles.name, { color: accent }]}>{name}</Text>
            {!!lastName && (
              <Text style={[styles.lastName, { color: accent }]}>{lastName}</Text>
            )}
            {!!pronunciation && (
              <Text style={[styles.pronunciation, { color: accent + "cc" }]}>
                [{pronunciation}]
              </Text>
            )}
            {isPartnerPick && !isNext && (
              <View style={[styles.partnerChip, { borderColor: accent + "55" }]}>
                <Feather name="heart" size={10} color={accent} />
                <Text style={[styles.partnerChipText, { color: accent }]}>
                  Partner Added
                </Text>
              </View>
            )}
          </View>

          {!isNext && (
            <View style={styles.actionRow}>
              <ActionButton color={colors.destructive} onPress={() => commit(false)}>
                <Feather name="x" size={28} color={colors.destructive} />
              </ActionButton>
              <Pressable
                disabled={!canUndo}
                onPress={onUndo}
                style={[
                  styles.undoBtn,
                  { opacity: canUndo ? 1 : 0.4, backgroundColor: colors.parchment },
                ]}
              >
                <Feather
                  name="rotate-ccw"
                  size={20}
                  color={colors.mutedForeground}
                />
              </Pressable>
              <ActionButton color={colors.heart} onPress={() => commit(true)}>
                <Feather name="heart" size={26} color={colors.heart} />
              </ActionButton>
            </View>
          )}
        </View>
      </GestureDetector>

      <Modal
        visible={showInfo}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInfo(false)}
      >
        <Pressable style={styles.infoBackdrop} onPress={() => setShowInfo(false)}>
          <Pressable
            style={[
              styles.infoSheet,
              {
                backgroundColor: isBoy ? "#dceeff" : "#ffe4e8",
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.infoHandle} />
            <ScrollView contentContainerStyle={{ padding: 24 }}>
              <Text style={[styles.infoTitle, { color: accentSoft }]}>
                About this name
              </Text>
              <Text style={[styles.name, { color: accent, textAlign: "center" }]}>
                {name}
              </Text>
              {!!lastName && (
                <Text
                  style={[styles.lastName, { color: accent, textAlign: "center" }]}
                >
                  {lastName}
                </Text>
              )}
              {!!pronunciation && (
                <Text
                  style={[
                    styles.pronunciation,
                    { color: accent + "cc", textAlign: "center" },
                  ]}
                >
                  [{pronunciation}]
                </Text>
              )}
              <View style={{ height: 16 }} />
              <InfoRow icon="map-pin" label="Origin" value={origin} accent={accent} />
              <InfoRow
                icon="zap"
                label="Meaning"
                value={meaning}
                accent={accent}
              />
              <InfoRow
                icon="tag"
                label="Possible Nickname"
                value={nickname}
                accent={accent}
              />
              <InfoRow
                icon="trending-up"
                label="Popularity"
                value={rank != null ? `#${rank} most popular` : "—"}
                accent={accent}
              />
              <View style={{ height: 24 }} />
              <View style={styles.infoActions}>
                <ActionButton
                  color={colors.destructive}
                  onPress={() => {
                    setShowInfo(false);
                    setTimeout(() => commit(false), 100);
                  }}
                >
                  <Feather name="x" size={28} color={colors.destructive} />
                </ActionButton>
                <ActionButton
                  color={colors.heart}
                  onPress={() => {
                    setShowInfo(false);
                    setTimeout(() => commit(true), 100);
                  }}
                >
                  <Feather name="heart" size={26} color={colors.heart} />
                </ActionButton>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Animated.View>
  );
});

function ActionButton({
  color,
  onPress,
  children,
}: {
  color: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        { borderColor: color + "33", transform: [{ scale: pressed ? 0.92 : 1 }] },
      ]}
    >
      {children}
    </Pressable>
  );
}

function InfoRow({
  icon,
  label,
  value,
  accent,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string | null | undefined;
  accent: string;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        { borderColor: accent + "33", backgroundColor: accent + "0d" },
      ]}
    >
      <Feather name={icon} size={16} color={accent} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: accent }]}>{label.toUpperCase()}</Text>
        <Text style={styles.infoValue}>{value || "—"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrap: { ...StyleSheet.absoluteFillObject },
  card: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 2,
    backgroundColor: "#fdf7e6",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  header: { paddingTop: 20, alignItems: "center" },
  label: { fontSize: 18, fontStyle: "italic", fontWeight: "600" },
  divider: { width: 80, height: 2, marginTop: 4, borderRadius: 1, opacity: 0.5 },
  remaining: { fontSize: 12, color: "#7a6a52", marginTop: 6 },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
  },
  infoChipText: { fontSize: 12, fontWeight: "500" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  name: { fontSize: 56, fontWeight: "800", textAlign: "center" },
  lastName: { fontSize: 28, fontWeight: "600", marginTop: 4, textAlign: "center" },
  pronunciation: { fontSize: 16, fontStyle: "italic", marginTop: 4 },
  partnerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  partnerChipText: { fontSize: 11, fontWeight: "600" },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    paddingBottom: 28,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fdf7e6",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  undoBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#d9c89c",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  swipeBadge: {
    position: "absolute",
    top: 32,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 4,
    zIndex: 10,
  },
  likeBadge: {
    right: 24,
    borderColor: "#3aa55a",
    transform: [{ rotate: "12deg" }],
    backgroundColor: "rgba(58,165,90,0.85)",
  },
  passBadge: {
    left: 24,
    borderColor: "#d9534f",
    transform: [{ rotate: "-12deg" }],
    backgroundColor: "rgba(217,83,79,0.85)",
  },
  swipeBadgeText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 28,
    letterSpacing: 3,
  },
  infoBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  infoSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "85%",
  },
  infoHandle: {
    alignSelf: "center",
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.18)",
    marginTop: 10,
  },
  infoTitle: {
    fontSize: 18,
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  infoLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.4, marginBottom: 2 },
  infoValue: { fontSize: 14, color: "#3a2e22", lineHeight: 18 },
  infoActions: { flexDirection: "row", justifyContent: "center", gap: 32 },
});

export default NameCard;
