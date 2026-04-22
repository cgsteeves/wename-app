import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ImageBackground } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { forwardRef, useImperativeHandle, useState } from "react";
import {
  Dimensions,
  Pressable,
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
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CARD_W = Math.min(SCREEN_W * 0.9, 380);
const CARD_H = Math.min(SCREEN_H * 0.62, 600);
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

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const NameCard = forwardRef<NameCardHandle, NameCardProps>(function NameCard(
  {
    name,
    pronunciation,
    origin,
    meaning,
    nickname,
    rank,
    gender,
    remaining: _remaining,
    lastName: _lastName,
    isPartnerPick,
    isNext,
    onSwipe,
  },
  ref,
) {
  const colors = useColors();
  const isBoy = gender === "boy";
  const accent = isBoy ? colors.boy : colors.girlRed;

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const flip = useSharedValue(0); // 0 = front, 1 = back
  const [flipped, setFlipped] = useState(false);

  const setFlippedJS = (v: boolean) => setFlipped(v);

  function toggleFlip() {
    const next = !flipped;
    flip.value = withTiming(next ? 1 : 0, { duration: 450 });
    setFlipped(next);
  }

  function fly(liked: boolean) {
    Haptics.impactAsync(
      liked
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    );
    x.value = withTiming(liked ? SCREEN_W * 1.5 : -SCREEN_W * 1.5, {
      duration: 280,
    });
    y.value = withTiming(-40, { duration: 280 });
    setTimeout(() => onSwipe(liked), 220);
  }

  useImperativeHandle(ref, () => ({ swipe: fly }));

  const pan = Gesture.Pan()
    .enabled(!isNext && !flipped)
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY * 0.4;
    })
    .onEnd((e) => {
      const passed =
        Math.abs(e.translationX) > SWIPE_THRESHOLD ||
        Math.abs(e.velocityX) > VELOCITY_THRESHOLD;
      if (passed) {
        const liked = e.translationX > 0;
        runOnJS(fly)(liked);
      } else {
        x.value = withSpring(0, { damping: 18, stiffness: 180 });
        y.value = withSpring(0, { damping: 18, stiffness: 180 });
      }
    });

  const rotation = useDerivedValue(() =>
    interpolate(
      x.value,
      [-SCREEN_W, 0, SCREEN_W],
      [-12, 0, 12],
      Extrapolation.CLAMP,
    ),
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotateZ: `${rotation.value}deg` },
    ],
  }));

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180}deg` }],
    opacity: flip.value < 0.5 ? 1 : 0,
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${180 + flip.value * 180}deg` },
    ],
    opacity: flip.value > 0.5 ? 1 : 0,
  }));

  const likeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      x.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));
  const passOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      x.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const nextStackStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      Math.abs(x.value),
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { scale: 0.96 + 0.04 * progress },
        { translateY: 12 * (1 - progress) },
      ],
    };
  });

  if (isNext) {
    return (
      <Animated.View
        style={[
          styles.cardWrap,
          { width: CARD_W, height: CARD_H },
          nextStackStyle,
        ]}
        pointerEvents="none"
      >
        <CardFront
          accent={accent}
          isBoy={isBoy}
          name={name}
          pronunciation={pronunciation}
          origin={origin}
          meaning={meaning}
          rank={rank}
          isPartnerPick={isPartnerPick}
        />
      </Animated.View>
    );
  }

  return (
    <View style={styles.absoluteCenter} pointerEvents="box-none">
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.cardWrap,
            { width: CARD_W, height: CARD_H },
            cardStyle,
          ]}
        >
          {/* FRONT */}
          <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={toggleFlip}>
              <CardFront
                accent={accent}
                isBoy={isBoy}
                name={name}
                pronunciation={pronunciation}
                origin={origin}
                meaning={meaning}
                rank={rank}
                isPartnerPick={isPartnerPick}
              />
              {/* Drag overlays */}
              <Animated.View
                style={[styles.cornerOverlay, styles.cornerLeft, likeOverlayStyle]}
                pointerEvents="none"
              >
                <View style={[styles.cornerCircle, { backgroundColor: colors.grass }]}>
                  <Feather name="heart" size={36} color="#fff" />
                </View>
              </Animated.View>
              <Animated.View
                style={[styles.cornerOverlay, styles.cornerRight, passOverlayStyle]}
                pointerEvents="none"
              >
                <View
                  style={[styles.cornerCircle, { backgroundColor: colors.destructive }]}
                >
                  <Feather name="x" size={36} color="#fff" />
                </View>
              </Animated.View>
            </Pressable>
          </Animated.View>

          {/* BACK */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.backFace, backStyle]}
          >
            <Pressable style={styles.backInner} onPress={toggleFlip}>
              <Text
                style={[
                  styles.backName,
                  { color: colors.foreground, fontFamily: fonts.hand },
                ]}
              >
                {name}
              </Text>
              {!!pronunciation && (
                <Text
                  style={[
                    styles.backPron,
                    { color: colors.mutedForeground, fontFamily: fonts.display },
                  ]}
                >
                  ({pronunciation})
                </Text>
              )}
              {!!origin && (
                <DetailSection
                  label="Origin"
                  value={origin}
                  color={colors.foreground}
                  muted={colors.mutedForeground}
                />
              )}
              {!!meaning && (
                <DetailSection
                  label="Meaning"
                  value={meaning}
                  color={colors.foreground}
                  muted={colors.mutedForeground}
                />
              )}
              {!!nickname && (
                <DetailSection
                  label="Nickname"
                  value={nickname}
                  color={colors.foreground}
                  muted={colors.mutedForeground}
                />
              )}
              {rank != null && (
                <View style={{ width: "100%", marginTop: 14 }}>
                  <Text
                    style={[
                      styles.detailLabel,
                      { color: colors.mutedForeground, fontFamily: fonts.displaySemibold },
                    ]}
                  >
                    POPULARITY
                  </Text>
                  <View style={styles.popRow}>
                    <View style={styles.popTrack}>
                      <View
                        style={{
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: accent,
                          width: `${Math.max(
                            4,
                            Math.min(100, ((10000 - rank) / 10000) * 100),
                          )}%`,
                        }}
                      />
                    </View>
                    <Text
                      style={[
                        styles.popLabel,
                        { color: colors.foreground, fontFamily: fonts.displaySemibold },
                      ]}
                    >
                      #{rank} in the US
                    </Text>
                  </View>
                </View>
              )}
              <Text
                style={[
                  styles.tapHint,
                  { color: colors.mutedForeground, fontFamily: fonts.display },
                ]}
              >
                Tap to flip back
              </Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

function DetailSection({
  label,
  value,
  color,
  muted,
}: {
  label: string;
  value: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={{ width: "100%", marginTop: 14 }}>
      <Text
        style={[
          styles.detailLabel,
          { color: muted, fontFamily: fonts.displaySemibold },
        ]}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={[
          styles.detailValue,
          { color, fontFamily: fonts.displaySemibold },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function CardFront({
  accent,
  isBoy,
  name,
  pronunciation,
  origin,
  meaning,
  rank,
  isPartnerPick,
}: {
  accent: string;
  isBoy: boolean;
  name: string;
  pronunciation?: string | null;
  origin?: string | null;
  meaning?: string | null;
  rank?: number | null;
  isPartnerPick?: boolean;
}) {
  return (
    <View style={styles.cardInner}>
      <ImageBackground
        source={isBoy ? boyBg : girlBg}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      {/* gender tint top */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: accent, opacity: 0.12 },
        ]}
        pointerEvents="none"
      />
      {/* gradient bottom for text legibility */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.22)", "rgba(0,0,0,0.6)"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* rank pill top right */}
      {rank != null && (
        <View style={styles.rankPill}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: "#3a2a18",
              fontFamily: fonts.displaySemibold,
            }}
          >
            #{rank}
          </Text>
        </View>
      )}

      {/* partner pick badge top-left */}
      {isPartnerPick && (
        <View style={[styles.partnerPill, { backgroundColor: accent }]}>
          <Feather name="users" size={11} color="#fff" />
          <Text
            style={{
              color: "#fff",
              fontSize: 11,
              fontWeight: "700",
              fontFamily: fonts.displayBold,
            }}
          >
            Partner pick
          </Text>
        </View>
      )}

      {/* bottom text block */}
      <View style={styles.bottomBlock}>
        <Text
          style={[styles.nameText, { fontFamily: fonts.hand }]}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {name}
        </Text>
        {!!pronunciation && (
          <Text style={[styles.pronText, { fontFamily: fonts.display }]}>
            ({pronunciation})
          </Text>
        )}
        <View style={styles.chipRow}>
          {!!origin && (
            <View style={styles.chip}>
              <Text style={[styles.chipText, { fontFamily: fonts.display }]}>
                {truncate(origin, 18)}
              </Text>
            </View>
          )}
          {!!meaning && (
            <View style={styles.chip}>
              <Text style={[styles.chipText, { fontFamily: fonts.display }]}>
                {truncate(meaning, 22)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  cardWrap: {
    borderRadius: 28,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cardInner: {
    flex: 1,
    borderRadius: 28,
    overflow: "hidden",
  },
  rankPill: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  partnerPill: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  bottomBlock: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 26,
  },
  nameText: {
    color: "#fff",
    fontSize: 60,
    fontWeight: "700",
    lineHeight: 64,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 2 },
  },
  pronText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    fontStyle: "italic",
    marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowRadius: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  chipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  cornerOverlay: {
    position: "absolute",
    top: 24,
  },
  cornerLeft: { left: 24 },
  cornerRight: { right: 24 },
  cornerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  backFace: {
    backgroundColor: "#f4ebd8",
    borderRadius: 28,
    overflow: "hidden",
  },
  backInner: {
    flex: 1,
    padding: 26,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 40,
  },
  backName: {
    fontSize: 48,
    fontWeight: "700",
    textAlign: "center",
  },
  backPron: {
    fontSize: 16,
    fontStyle: "italic",
    marginTop: 4,
  },
  detailLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "600",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    lineHeight: 22,
  },
  popRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  popTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.1)",
    overflow: "hidden",
  },
  popLabel: {
    fontSize: 12,
  },
  tapHint: {
    position: "absolute",
    bottom: 18,
    fontSize: 11,
  },
});

export default NameCard;
