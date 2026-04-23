import { Feather, FontAwesome } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image, ImageBackground } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import {
  Dimensions,
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
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CARD_W = Math.min(SCREEN_W - 32, 440);
const CARD_H = Math.min(SCREEN_H * 0.78, 720);
const SWIPE_THRESHOLD = SCREEN_W * 0.27;
const VELOCITY_THRESHOLD = 600;

const boyBg = require("../assets/images/boy-card-bg.jpg");
const girlBg = require("../assets/images/girl-card-bg.jpg");
const paperTexture = require("../assets/images/paper-texture.jpg");
const likeSun = require("../assets/images/like_sun.png");
const dislikeSun = require("../assets/images/dislike_sun.png");

const ACTION_GRADIENT = ["hsl(38,50%,96%)", "hsl(38,45%,92%)"] as const;

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
  dragProgress?: SharedValue<number>;
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
    dragProgress,
    onSwipe,
    onUndo,
  },
  ref,
) {
  const colors = useColors();
  const isBoy = gender === "boy";
  const labelColor = isBoy ? colors.boy : colors.girlPink;
  const nameColor = isBoy ? colors.boy : colors.girlRed;
  const [infoOpen, setInfoOpen] = useState(false);

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const opacity = useSharedValue(1);
  const committed = useRef(false);
  const sheetY = useSharedValue(CARD_H);

  function openInfo() {
    setInfoOpen(true);
    sheetY.value = withTiming(0, { duration: 180 });
  }
  function closeInfo() {
    sheetY.value = withTiming(CARD_H, { duration: 240 }, (finished) => {
      if (finished) runOnJS(setInfoOpen)(false);
    });
  }

  const dismissSheetState = () => setInfoOpen(false);

  const sheetPan = Gesture.Pan()
    .enabled(infoOpen)
    .onUpdate((e) => {
      sheetY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 600) {
        sheetY.value = withTiming(CARD_H, { duration: 240 }, (finished) => {
          if (finished) runOnJS(dismissSheetState)();
        });
      } else {
        sheetY.value = withTiming(0, { duration: 160 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));
  const sheetBackdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetY.value, [0, CARD_H], [0.35, 0], Extrapolation.CLAMP),
  }));

  function fly(liked: boolean, velocityX = 0) {
    if (committed.current) return;
    committed.current = true;
    Haptics.impactAsync(
      liked ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
    const direction = liked ? 1 : -1;
    const velocityBonus = Math.min(Math.abs(velocityX) / 1000, 1.8);
    const exitX = direction * SCREEN_W * (1.8 + velocityBonus * 0.6);
    const durationMs = Math.max(220, 420 - velocityBonus * 100);
    x.value = withTiming(exitX, { duration: durationMs });
    opacity.value = withTiming(0, { duration: durationMs });
    if (dragProgress) dragProgress.value = 1;
    setTimeout(() => onSwipe(liked), durationMs * 0.55);
  }

  useImperativeHandle(ref, () => ({ swipe: (liked: boolean) => fly(liked) }));

  const pan = Gesture.Pan()
    .enabled(!isNext && !infoOpen)
    .onStart(() => {
      committed.current = false;
    })
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY * 0.3;
      if (dragProgress) {
        dragProgress.value = Math.min(Math.abs(e.translationX) / SWIPE_THRESHOLD, 1);
      }
    })
    .onEnd((e) => {
      const passed =
        Math.abs(e.translationX) > SWIPE_THRESHOLD ||
        Math.abs(e.velocityX) > VELOCITY_THRESHOLD;
      if (passed) {
        const liked = e.translationX > 0 || (Math.abs(e.translationX) <= 10 && e.velocityX > 0);
        runOnJS(fly)(liked, e.velocityX);
      } else {
        x.value = withSpring(0, { damping: 18, stiffness: 220 });
        y.value = withSpring(0, { damping: 18, stiffness: 220 });
        if (dragProgress) dragProgress.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const rotation = useDerivedValue(() =>
    interpolate(x.value, [-SCREEN_W * 0.6, 0, SCREEN_W * 0.6], [-18, 0, 18], Extrapolation.CLAMP),
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotateZ: `${rotation.value}deg` },
    ],
    opacity:
      opacity.value *
      interpolate(
        Math.abs(x.value),
        [0, SWIPE_THRESHOLD * 0.5, SCREEN_W * 0.6],
        [1, 0.95, 0.55],
        Extrapolation.CLAMP,
      ),
  }));

  const likeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD], [0, 0.7, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(x.value, [0, SWIPE_THRESHOLD], [0.7, 1.15], Extrapolation.CLAMP),
      },
    ],
  }));
  const passOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      x.value,
      [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.5, 0],
      [1, 0.7, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(x.value, [-SWIPE_THRESHOLD, 0], [1.15, 0.7], Extrapolation.CLAMP),
      },
    ],
  }));

  const nextStackStyle = useAnimatedStyle(() => {
    const progress = dragProgress ? dragProgress.value : 0;
    return {
      transform: [
        { translateY: 14 * (1 - progress) },
        { scale: 0.95 + 0.05 * progress },
      ],
    };
  });

  const Body = (
    <View style={styles.cardInner}>
      <ImageBackground
        source={isBoy ? boyBg : girlBg}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      {/* Vignette */}
      <View pointerEvents="none" style={styles.vignette}>
        <LinearGradient
          colors={["transparent", "transparent", "rgba(0,0,0,0.15)"]}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* Parchment warmth tint */}
      <View pointerEvents="none" style={styles.warmthTint} />

      {/* Top label area */}
      <View style={styles.topBlock} pointerEvents="box-none">
        <Text
          style={{
            fontFamily: fonts.hand,
            fontSize: 30,
            color: labelColor,
            fontStyle: "italic",
            textAlign: "center",
          }}
        >
          {isBoy ? "Boy Name" : "Girl Name"}
        </Text>
        <View
          style={[styles.labelDivider, { backgroundColor: labelColor, opacity: 0.5 }]}
        />
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 14,
            color: colors.mutedForeground,
            marginTop: 4,
            textAlign: "center",
          }}
        >
          {remaining} names remaining
        </Text>
        {!isNext && (
          <Pressable
            style={[
              styles.infoChip,
              {
                borderColor: labelColor + "4d",
                backgroundColor: "rgba(255,255,255,0.35)",
              },
            ]}
            onPress={openInfo}
          >
            <Feather name="info" size={12} color={labelColor + "b3"} />
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 12,
                color: labelColor + "b3",
              }}
            >
              More info
            </Text>
          </Pressable>
        )}
      </View>

      {/* Center name block */}
      <View style={styles.centerBlock} pointerEvents="none">
        <Text
          style={[styles.nameText, { color: nameColor, fontFamily: fonts.displayBold }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {name}
        </Text>
        {!!lastName && (
          <Text
            style={[
              styles.lastNameText,
              {
                color: nameColor,
                opacity: isBoy ? 0.8 : 1,
                fontFamily: fonts.displaySemibold,
              },
            ]}
            numberOfLines={1}
          >
            {lastName}
          </Text>
        )}
        {!!pronunciation && (
          <Text
            style={[
              styles.pronText,
              { color: nameColor, opacity: 0.6, fontFamily: fonts.display },
            ]}
          >
            [{pronunciation}]
          </Text>
        )}
        {isPartnerPick && !isNext && (
          <View
            style={[
              styles.partnerPill,
              {
                backgroundColor: labelColor + "1a",
                borderColor: labelColor + "33",
              },
            ]}
          >
            <Feather name="heart" size={10} color={nameColor} />
            <Text
              style={{
                color: nameColor,
                fontSize: 12,
                fontFamily: fonts.displayMedium,
              }}
            >
              Partner Added
            </Text>
          </View>
        )}
      </View>

      {/* Bottom action buttons row inside card */}
      {!isNext && (
        <View style={styles.actionRow} pointerEvents="box-none">
          <ActionButton onPress={() => fly(false)} size={64}>
            <Text style={styles.passGlyph}>✕</Text>
          </ActionButton>
          <ActionButton onPress={() => onUndo?.()} size={56} disabled={!canUndo}>
            <Feather name="rotate-ccw" size={22} color={colors.mutedForeground} />
          </ActionButton>
          <ActionButton onPress={() => fly(true)} size={64}>
            <FontAwesome name="heart" size={26} color="#f43f5e" />
          </ActionButton>
        </View>
      )}

      {/* Drag overlays — sun image + rotated handwritten text per spec */}
      {!isNext && (
        <>
          <Animated.View
            style={[styles.dragBadge, styles.dragBadgeRight, likeOverlayStyle]}
            pointerEvents="none"
          >
            <Image source={likeSun} style={styles.sunImg} contentFit="contain" />
            <Text style={[styles.overlayText, styles.overlayLike]}>LIKE</Text>
          </Animated.View>
          <Animated.View
            style={[styles.dragBadge, styles.dragBadgeLeft, passOverlayStyle]}
            pointerEvents="none"
          >
            <Image source={dislikeSun} style={styles.sunImg} contentFit="contain" />
            <Text style={[styles.overlayText, styles.overlayPass]}>PASS</Text>
          </Animated.View>
        </>
      )}
    </View>
  );

  if (isNext) {
    return (
      <Animated.View
        style={[
          styles.cardWrap,
          { width: CARD_W, height: CARD_H, borderColor: colors.border + "66" },
          nextStackStyle,
        ]}
        pointerEvents="none"
      >
        {Body}
      </Animated.View>
    );
  }

  return (
    <View style={styles.absoluteCenter} pointerEvents="box-none">
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.cardWrap,
            { width: CARD_W, height: CARD_H, borderColor: colors.border + "66" },
            cardStyle,
          ]}
        >
          {Body}
        </Animated.View>
      </GestureDetector>

      {/* In-card info overlay — slides up over card, drag-to-dismiss */}
      {infoOpen && (
        <>
          <Animated.View
            pointerEvents="auto"
            style={[
              styles.inCardBackdrop,
              { width: CARD_W, height: CARD_H },
              sheetBackdropStyle,
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeInfo} />
          </Animated.View>
          <GestureDetector gesture={sheetPan}>
            <Animated.View
              style={[
                styles.inCardSheet,
                { width: CARD_W, height: CARD_H },
                sheetStyle,
              ]}
            >
              <LinearGradient
                colors={
                  isBoy
                    ? ["rgba(219,234,254,0.99)", "rgba(191,219,254,0.97)", "rgba(255,251,235,0.99)"]
                    : ["rgba(254,228,232,0.99)", "rgba(251,207,215,0.97)", "rgba(255,251,235,0.99)"]
                }
                style={StyleSheet.absoluteFill}
              />
              <ImageBackground
                source={paperTexture}
                style={StyleSheet.absoluteFill}
                imageStyle={{ opacity: 0.2 }}
                contentFit="cover"
              />
              <View style={styles.sheetHandle} />
              <Pressable style={styles.sheetClose} onPress={closeInfo} hitSlop={10}>
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </Pressable>
              <ScrollView
                contentContainerStyle={{ padding: 24, paddingTop: 36 }}
                showsVerticalScrollIndicator={false}
              >
                <Text
                  style={{
                    fontFamily: fonts.hand,
                    fontSize: 20,
                    color: labelColor,
                    opacity: 0.85,
                    fontStyle: "italic",
                    textAlign: "center",
                  }}
                >
                  About this name
                </Text>
                <View
                  style={{
                    height: 1.5,
                    width: 96,
                    borderRadius: 999,
                    backgroundColor: labelColor,
                    opacity: 0.4,
                    alignSelf: "center",
                    marginTop: 8,
                    marginBottom: 12,
                  }}
                />
                <Text
                  style={{
                    fontFamily: fonts.displayBold,
                    fontSize: 44,
                    color: nameColor,
                    textAlign: "center",
                    letterSpacing: -0.5,
                  }}
                >
                  {name}
                </Text>
                {!!lastName && (
                  <Text
                    style={{
                      fontFamily: fonts.displaySemibold,
                      fontSize: 22,
                      color: nameColor,
                      opacity: isBoy ? 0.8 : 1,
                      textAlign: "center",
                      marginTop: 4,
                    }}
                  >
                    {lastName}
                  </Text>
                )}
                {!!pronunciation && (
                  <Text
                    style={{
                      fontFamily: fonts.display,
                      fontSize: 14,
                      fontStyle: "italic",
                      color: nameColor,
                      opacity: 0.6,
                      textAlign: "center",
                      marginTop: 6,
                      letterSpacing: 0.5,
                    }}
                  >
                    [{pronunciation}]
                  </Text>
                )}

                <View style={{ marginTop: 20, gap: 8 }}>
                  <InfoRow icon="map-pin" label="Origin" value={origin} accent={labelColor} colors={colors} isBoy={isBoy} />
                  <InfoRow icon="award" label="Meaning" value={meaning} accent={labelColor} colors={colors} isBoy={isBoy} />
                  <InfoRow icon="tag" label="Possible Nickname" value={nickname} accent={labelColor} colors={colors} isBoy={isBoy} />
                  <InfoRow
                    icon="trending-up"
                    label="Popularity"
                    value={rank != null ? `#${rank} most popular` : null}
                    accent={labelColor}
                    colors={colors}
                    isBoy={isBoy}
                  />
                </View>
                <Text
                  style={{
                    fontFamily: fonts.display,
                    fontSize: 12,
                    color: labelColor,
                    opacity: 0.45,
                    textAlign: "center",
                    marginTop: 16,
                  }}
                >
                  swipe down to close
                </Text>
              </ScrollView>
            </Animated.View>
          </GestureDetector>
        </>
      )}
    </View>
  );
});

function ActionButton({
  size,
  disabled,
  onPress,
  children,
}: {
  size: number;
  disabled?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: disabled ? 0.4 : pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.92 : 1 }],
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 5,
          borderWidth: 2,
          borderColor: "rgba(255,255,255,0.6)",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
      ]}
    >
      <LinearGradient
        colors={ACTION_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </Pressable>
  );
}

function InfoRow({
  icon,
  label,
  value,
  accent,
  colors,
  isBoy,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string | null | undefined;
  accent: string;
  colors: ReturnType<typeof useColors>;
  isBoy: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: isBoy ? "rgba(100,140,200,0.08)" : "rgba(255,160,170,0.08)",
        borderWidth: 1,
        borderColor: isBoy ? "hsl(214,50%,80%)" : "hsl(345,50%,82%)",
      }}
    >
      <Feather name={icon} size={15} color={accent} style={{ opacity: 0.65, marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: fonts.displaySemibold,
            fontSize: 10,
            letterSpacing: 1.5,
            color: accent,
            opacity: 0.6,
            marginBottom: 2,
          }}
        >
          {label.toUpperCase()}
        </Text>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 14,
            color: colors.foreground,
            opacity: 0.85,
            lineHeight: 20,
          }}
        >
          {value || "—"}
        </Text>
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
    borderRadius: 16,
    backgroundColor: "hsl(38,45%,93%)",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    overflow: "hidden",
  },
  cardInner: {
    flex: 1,
  },
  vignette: { ...StyleSheet.absoluteFillObject },
  warmthTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "hsla(38,45%,93%,0.05)",
  },
  topBlock: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 8,
    paddingHorizontal: 24,
    zIndex: 5,
  },
  labelDivider: {
    height: 1.5,
    width: 112,
    borderRadius: 999,
    marginTop: 2,
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
  },
  centerBlock: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 16,
    right: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -112,
  },
  nameText: {
    fontSize: 60,
    textAlign: "center",
    letterSpacing: -1.5,
  },
  lastNameText: {
    fontSize: 30,
    textAlign: "center",
    marginTop: 8,
  },
  pronText: {
    fontSize: 16,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 4,
    letterSpacing: 0.4,
  },
  partnerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 12,
  },
  actionRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingHorizontal: 32,
    zIndex: 6,
  },
  passGlyph: {
    color: "hsl(0,72%,50%)",
    fontSize: 30,
    fontWeight: "bold",
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 1 },
  },
  dragBadge: {
    position: "absolute",
    top: 20,
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  dragBadgeLeft: { left: 16, transformOrigin: "top left" },
  dragBadgeRight: { right: 16, transformOrigin: "top right" },
  sunImg: {
    position: "absolute",
    width: 160,
    height: 160,
  },
  overlayText: {
    position: "absolute",
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: "#fff",
    letterSpacing: 3.2,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  overlayLike: { top: 28, right: 28, transform: [{ rotate: "22deg" }] },
  overlayPass: { top: 28, left: 28, transform: [{ rotate: "-22deg" }] },
  inCardBackdrop: {
    position: "absolute",
    backgroundColor: "#000",
    borderRadius: 28,
  },
  inCardSheet: {
    position: "absolute",
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "hsl(45,55%,94%)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignSelf: "center",
    marginTop: 12,
  },
  sheetClose: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
});

export default NameCard;
