import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image, ImageBackground } from "expo-image";
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
const VELOCITY_THRESHOLD = 800;

const boyBg = require("../assets/images/boy-card-bg.jpg");
const girlBg = require("../assets/images/girl-card-bg.jpg");
const paperTexture = require("../assets/images/paper-texture.jpg");
const likeSun = require("../assets/images/like_sun.png");
const dislikeSun = require("../assets/images/dislike_sun.png");

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
  const [infoOpen, setInfoOpen] = useState(false);

  const x = useSharedValue(0);
  const y = useSharedValue(0);

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
    .enabled(!isNext && !infoOpen)
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

  const likeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, SWIPE_THRESHOLD], [0, 0.85], Extrapolation.CLAMP),
  }));
  const passOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-SWIPE_THRESHOLD, 0], [0.85, 0], Extrapolation.CLAMP),
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
        { scale: 0.95 + 0.05 * progress },
        { translateY: 14 * (1 - progress) },
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

      {/* Top label area */}
      <View style={styles.topBlock} pointerEvents="box-none">
        <View style={[styles.labelUnderlineWrap, { borderBottomColor: accent }]}>
          <Text
            style={{
              fontFamily: fonts.hand,
              fontSize: 22,
              color: accent,
              fontStyle: "italic",
            }}
          >
            {isBoy ? "Boy Name" : "Girl Name"}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 14,
            color: colors.foreground,
            marginTop: 6,
          }}
        >
          {remaining} names remaining
        </Text>
        {!isNext && (
          <Pressable
            style={[styles.infoChip, { borderColor: colors.border }]}
            onPress={() => setInfoOpen(true)}
          >
            <Feather name="info" size={13} color={colors.foreground} />
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontSize: 13,
                color: colors.foreground,
              }}
            >
              More info
            </Text>
          </Pressable>
        )}
        {isPartnerPick && (
          <View style={[styles.partnerPill, { backgroundColor: accent }]}>
            <Feather name="users" size={11} color="#fff" />
            <Text
              style={{
                color: "#fff",
                fontSize: 11,
                fontFamily: fonts.displayBold,
              }}
            >
              Partner pick
            </Text>
          </View>
        )}
      </View>

      {/* Center name block */}
      <View style={styles.centerBlock} pointerEvents="none">
        <Text
          style={[styles.nameText, { color: accent, fontFamily: fonts.displayBold }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {name}
        </Text>
        {!!lastName && (
          <Text
            style={[
              styles.lastNameText,
              { color: accent, fontFamily: fonts.displaySemibold },
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
              { color: accent, fontFamily: fonts.display },
            ]}
          >
            [{pronunciation}]
          </Text>
        )}
      </View>

      {/* Bottom action buttons row inside card */}
      {!isNext && (
        <View style={styles.actionRow} pointerEvents="box-none">
          <Pressable
            style={[styles.actionBtn, styles.actionBtnLg]}
            onPress={() => fly(false)}
          >
            <Feather name="x" size={28} color={colors.destructive} />
          </Pressable>
          <Pressable
            style={[
              styles.actionBtn,
              styles.actionBtnSm,
              !canUndo && { opacity: 0.5 },
            ]}
            onPress={() => onUndo?.()}
            disabled={!canUndo}
          >
            <Feather name="rotate-ccw" size={20} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnLg]}
            onPress={() => fly(true)}
          >
            <Feather name="heart" size={28} color={colors.heart} />
          </Pressable>
        </View>
      )}

      {/* Drag overlays — sun image with rotated handwritten text */}
      {!isNext && (
        <>
          <Animated.View
            style={[styles.dragBadge, styles.dragBadgeLeft, likeOverlayStyle]}
            pointerEvents="none"
          >
            <Image source={likeSun} style={styles.sunImg} contentFit="contain" />
            <Text
              style={[
                styles.overlayText,
                {
                  fontFamily: fonts.hand,
                  color: "#3a7a2a",
                  transform: [{ rotate: "-18deg" }],
                },
              ]}
            >
              LIKE
            </Text>
          </Animated.View>
          <Animated.View
            style={[styles.dragBadge, styles.dragBadgeRight, passOverlayStyle]}
            pointerEvents="none"
          >
            <Image source={dislikeSun} style={styles.sunImg} contentFit="contain" />
            <Text
              style={[
                styles.overlayText,
                {
                  fontFamily: fonts.hand,
                  color: "#a4351f",
                  transform: [{ rotate: "18deg" }],
                },
              ]}
            >
              PASS
            </Text>
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
          { width: CARD_W, height: CARD_H, borderColor: colors.border },
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
            { width: CARD_W, height: CARD_H, borderColor: colors.border },
            cardStyle,
          ]}
        >
          {Body}
        </Animated.View>
      </GestureDetector>

      {/* Info bottom-sheet */}
      <Modal
        visible={infoOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInfoOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ImageBackground
              source={paperTexture}
              style={StyleSheet.absoluteFill}
              imageStyle={{ opacity: 0.22, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
              contentFit="cover"
            />
            <View style={styles.sheetHandle} />
            <Pressable style={styles.sheetClose} onPress={() => setInfoOpen(false)}>
              <Feather name="x" size={18} color={colors.foreground} />
            </Pressable>
            <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 32 }}>
              <Text
                style={{
                  fontFamily: fonts.hand,
                  fontSize: 44,
                  color: colors.foreground,
                  textAlign: "center",
                }}
              >
                {name}
              </Text>
              {!!pronunciation && (
                <Text
                  style={{
                    fontFamily: fonts.display,
                    fontSize: 16,
                    fontStyle: "italic",
                    color: colors.mutedForeground,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  [{pronunciation}]
                </Text>
              )}
              <View style={[styles.genderBadge, { backgroundColor: accent + "26" }]}>
                <Text
                  style={{
                    color: accent,
                    fontFamily: fonts.displayBold,
                    fontSize: 12,
                  }}
                >
                  {isBoy ? "Boy" : "Girl"}
                </Text>
              </View>
              {!!origin && (
                <Section label="Origin" value={origin} colors={colors} />
              )}
              {!!meaning && (
                <Section label="Meaning" value={meaning} colors={colors} />
              )}
              {!!nickname && (
                <Section label="Nickname" value={nickname} colors={colors} />
              )}
              {rank != null && (
                <View style={{ marginTop: 18 }}>
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
                      style={{
                        fontFamily: fonts.displaySemibold,
                        fontSize: 12,
                        color: colors.foreground,
                      }}
                    >
                      #{rank} in the US
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

function Section({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text
        style={[
          styles.detailLabel,
          { color: colors.mutedForeground, fontFamily: fonts.displaySemibold },
        ]}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: 15,
          color: colors.foreground,
          lineHeight: 22,
        }}
      >
        {value}
      </Text>
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
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cardInner: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden",
  },
  topBlock: {
    alignItems: "center",
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  labelUnderlineWrap: {
    borderBottomWidth: 1.5,
    paddingBottom: 2,
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    marginTop: 10,
  },
  partnerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 10,
  },
  centerBlock: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 16,
    right: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  nameText: {
    fontSize: 64,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  lastNameText: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },
  pronText: {
    fontSize: 18,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },
  actionRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
  },
  actionBtn: {
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  actionBtnLg: { width: 64, height: 64, borderRadius: 32 },
  actionBtnSm: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  dragBadge: {
    position: "absolute",
    top: 70,
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  dragBadgeLeft: { left: -20 },
  dragBadgeRight: { right: -20 },
  sunImg: {
    position: "absolute",
    width: 220,
    height: 220,
  },
  overlayText: {
    fontSize: 56,
    textShadowColor: "rgba(255,255,255,0.85)",
    textShadowRadius: 6,
    letterSpacing: 1,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "80%",
    paddingBottom: 24,
    overflow: "hidden",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignSelf: "center",
    marginTop: 10,
  },
  sheetClose: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  genderBadge: {
    alignSelf: "center",
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
  },
  detailLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 4,
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
    backgroundColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
  },
});

export default NameCard;
