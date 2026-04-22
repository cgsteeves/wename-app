import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image, ImageBackground } from "expo-image";
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

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_W } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_W * 0.27;
const VELOCITY_THRESHOLD = 800;

const boyBg = require("../assets/images/boy-card-bg.jpg");
const girlBg = require("../assets/images/girl-card-bg.jpg");
const likeSun = require("../assets/images/like_sun.png");
const passSun = require("../assets/images/dislike_sun.png");
const paperTexture = require("../assets/images/paper-texture.jpg");

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
  const handLabelColor = isBoy ? colors.boy : colors.girlPink;
  const dividerColor = isBoy ? colors.boy : colors.girlPink;
  const [showInfo, setShowInfo] = useState(false);

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const exiting = useSharedValue(false);

  const haptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const finishSwipe = (liked: boolean) => onSwipe(liked);

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
        x.value = withTiming(liked ? SCREEN_W * 1.5 : -SCREEN_W * 1.5, { duration: 260 });
        runOnJS(haptic)();
        runOnJS(finishSwipe)(liked);
      } else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    if (isNext) {
      return { transform: [{ scale: 0.95 }, { translateY: 14 }], opacity: 1 };
    }
    const rotate = interpolate(x.value, [-SCREEN_W, 0, SCREEN_W], [-15, 0, 15], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: x.value },
        { translateY: y.value },
        { rotate: `${rotate}deg` },
      ],
    };
  }, [isNext]);

  const likeOverlayStyle = useAnimatedStyle(() => ({
    opacity: isNext ? 0 : interpolate(x.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: isNext
          ? 0.7
          : interpolate(x.value, [0, SWIPE_THRESHOLD], [0.7, 1.15], Extrapolation.CLAMP),
      },
    ],
  }));
  const passOverlayStyle = useAnimatedStyle(() => ({
    opacity: isNext ? 0 : interpolate(x.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale: isNext
          ? 0.7
          : interpolate(x.value, [-SWIPE_THRESHOLD, 0], [1.15, 0.7], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <Animated.View style={[styles.cardWrap, cardStyle]} pointerEvents="box-none">
      <GestureDetector gesture={pan}>
        <View style={[styles.card, { borderColor: colors.border + "66" }]} collapsable={false}>
          <ImageBackground
            source={isBoy ? boyBg : girlBg}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={["transparent", "transparent", "rgba(0,0,0,0.15)"]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Sun-shaped LIKE overlay */}
          <Animated.View
            style={[styles.sunWrap, { right: 12, top: 18 }, likeOverlayStyle]}
            pointerEvents="none"
          >
            <Image source={likeSun} style={styles.sunImg} contentFit="contain" />
            <View style={[styles.sunLabel, { transform: [{ rotate: "22deg" }] }]}>
              <Text style={styles.sunLabelText}>LIKE</Text>
            </View>
          </Animated.View>
          <Animated.View
            style={[styles.sunWrap, { left: 12, top: 18 }, passOverlayStyle]}
            pointerEvents="none"
          >
            <Image source={passSun} style={styles.sunImg} contentFit="contain" />
            <View style={[styles.sunLabel, { transform: [{ rotate: "-22deg" }] }]}>
              <Text style={styles.sunLabelText}>PASS</Text>
            </View>
          </Animated.View>

          <View style={styles.header} pointerEvents="box-none">
            <Text style={[styles.handLabel, { color: handLabelColor }]}>
              {isBoy ? "Boy Name" : "Girl Name"}
            </Text>
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
            <Text style={styles.remaining}>{remaining} names remaining</Text>
            {!isNext && (
              <Pressable
                onPress={() => setShowInfo(true)}
                style={[styles.infoChip, { borderColor: accent + "55" }]}
              >
                <Feather name="info" size={11} color={accent} />
                <Text style={[styles.infoChipText, { color: accent }]}>More info</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.center} pointerEvents="none">
            <Text
              style={[styles.name, { color: accent }]}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {name}
            </Text>
            {!!lastName && (
              <Text style={[styles.lastName, { color: isBoy ? accent + "cc" : accent }]}>
                {lastName}
              </Text>
            )}
            {!!pronunciation && (
              <Text style={[styles.pronunciation, { color: accent + "aa" }]}>
                [{pronunciation}]
              </Text>
            )}
            {isPartnerPick && !isNext && (
              <View
                style={[
                  styles.partnerChip,
                  { borderColor: accent + "55", backgroundColor: accent + "1a" },
                ]}
              >
                <Feather name="heart" size={10} color={accent} />
                <Text style={[styles.partnerChipText, { color: accent }]}>Partner Added</Text>
              </View>
            )}
          </View>

          {!isNext && (
            <View style={styles.actionRow}>
              <ActionButton onPress={() => commit(false)}>
                <Text style={styles.xMark}>✕</Text>
              </ActionButton>
              <Pressable
                disabled={!canUndo}
                onPress={onUndo}
                style={({ pressed }) => [
                  styles.undoBtn,
                  {
                    opacity: canUndo ? (pressed ? 0.85 : 1) : 0.4,
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  },
                ]}
              >
                <Feather name="rotate-ccw" size={20} color={colors.mutedForeground} />
              </Pressable>
              <ActionButton onPress={() => commit(true)}>
                <Feather name="heart" size={26} color={colors.rose} fill={colors.rose} />
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
            style={styles.infoSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <LinearGradient
              colors={
                isBoy
                  ? ["rgba(219,234,254,0.99)", "rgba(191,219,254,0.97)", "rgba(255,251,235,0.99)"]
                  : ["rgba(254,228,232,0.99)", "rgba(251,207,215,0.97)", "rgba(255,251,235,0.99)"]
              }
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Image
              source={paperTexture}
              style={[StyleSheet.absoluteFill, { opacity: 0.18 }]}
              contentFit="cover"
            />
            <View style={styles.infoHandle} />
            <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 28 }}>
              <Text style={[styles.infoTitle, { color: handLabelColor }]}>About this name</Text>
              <View style={[styles.divider, { backgroundColor: dividerColor, opacity: 0.4, marginBottom: 12 }]} />
              <Text style={[styles.name, { color: accent, textAlign: "center", fontSize: 44 }]}>
                {name}
              </Text>
              {!!lastName && (
                <Text style={[styles.lastName, { color: accent, textAlign: "center", fontSize: 22 }]}>
                  {lastName}
                </Text>
              )}
              {!!pronunciation && (
                <Text
                  style={[styles.pronunciation, { color: accent + "aa", textAlign: "center" }]}
                >
                  [{pronunciation}]
                </Text>
              )}
              <View style={{ height: 18 }} />
              <InfoRow icon="map-pin" label="Origin" value={origin} accent={accent} />
              <InfoRow icon="zap" label="Meaning" value={meaning} accent={accent} />
              <InfoRow icon="tag" label="Possible Nickname" value={nickname} accent={accent} />
              <InfoRow
                icon="trending-up"
                label="Popularity"
                value={rank != null ? `#${rank} most popular` : "—"}
                accent={accent}
              />
              <View style={{ height: 22 }} />
              <View style={styles.infoActions}>
                <ActionButton
                  onPress={() => {
                    setShowInfo(false);
                    setTimeout(() => commit(false), 100);
                  }}
                >
                  <Text style={styles.xMark}>✕</Text>
                </ActionButton>
                <ActionButton
                  onPress={() => {
                    setShowInfo(false);
                    setTimeout(() => commit(true), 100);
                  }}
                >
                  <Feather name="heart" size={26} color={colors.rose} fill={colors.rose} />
                </ActionButton>
              </View>
              <Text style={[styles.infoSwipeHint, { color: handLabelColor + "66" }]}>
                swipe down to close
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Animated.View>
  );
});

function ActionButton({
  onPress,
  children,
}: {
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.92 : 1 }] })}>
      <LinearGradient
        colors={["hsl(38, 50%, 96%)", "hsl(38, 45%, 92%)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.actionBtn}
      >
        {children}
      </LinearGradient>
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
        { borderColor: accent + "44", backgroundColor: accent + "11" },
      ]}
    >
      <Feather name={icon} size={15} color={accent} style={{ opacity: 0.65, marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: accent, opacity: 0.6 }]}>
          {label.toUpperCase()}
        </Text>
        <Text style={styles.infoValue}>{value || "—"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrap: { ...StyleSheet.absoluteFillObject },
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    backgroundColor: "hsl(38, 45%, 93%)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  header: { paddingTop: 18, alignItems: "center", zIndex: 5 },
  handLabel: {
    fontSize: 28,
    fontFamily: fonts.hand,
    fontStyle: "italic",
    textAlign: "center",
  },
  divider: {
    width: 110,
    height: 1.5,
    marginTop: 2,
    borderRadius: 1,
    opacity: 0.5,
  },
  remaining: {
    fontSize: 12,
    color: "hsl(25, 12%, 48%)",
    marginTop: 6,
    fontFamily: fonts.display,
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  infoChipText: { fontSize: 11, fontFamily: fonts.display },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    marginTop: -80,
  },
  name: {
    fontSize: 60,
    fontFamily: fonts.displayBold,
    textAlign: "center",
    letterSpacing: -1,
  },
  lastName: {
    fontSize: 28,
    fontFamily: fonts.displaySemibold,
    marginTop: 4,
    textAlign: "center",
  },
  pronunciation: {
    fontSize: 15,
    fontStyle: "italic",
    marginTop: 4,
    fontFamily: fonts.display,
    letterSpacing: 0.5,
  },
  partnerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 12,
  },
  partnerChipText: { fontSize: 11, fontFamily: fonts.displayMedium },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    paddingBottom: 28,
    paddingHorizontal: 32,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  undoBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "hsl(38, 47%, 94%)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  xMark: {
    color: "hsl(0, 72%, 50%)",
    fontSize: 30,
    fontFamily: fonts.displayBold,
    lineHeight: 32,
  },
  sunWrap: {
    position: "absolute",
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9,
  },
  sunImg: { width: 150, height: 150 },
  sunLabel: { position: "absolute", alignItems: "center", justifyContent: "center" },
  sunLabelText: {
    color: "#fff",
    fontFamily: fonts.displayBold,
    fontSize: 17,
    letterSpacing: 3,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  infoBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  infoSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "85%",
    overflow: "hidden",
    backgroundColor: "hsl(38, 45%, 93%)",
  },
  infoHandle: {
    alignSelf: "center",
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.18)",
    marginTop: 10,
    zIndex: 1,
  },
  infoTitle: {
    fontSize: 22,
    fontFamily: fonts.hand,
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 4,
    opacity: 0.85,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 10,
    fontFamily: fonts.displaySemibold,
    letterSpacing: 1.4,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 14,
    color: "hsl(25, 30%, 25%)",
    lineHeight: 19,
    fontFamily: fonts.display,
  },
  infoActions: { flexDirection: "row", justifyContent: "center", gap: 32 },
  infoSwipeHint: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: fonts.display,
    marginTop: 12,
  },
});

export default NameCard;
