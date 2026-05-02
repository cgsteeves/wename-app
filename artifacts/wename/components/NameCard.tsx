import { Feather, FontAwesome } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image, ImageBackground } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
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
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDecay,
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
// Snappy underdamped spring — quick response, tiny natural bounce on settle.
const SPRING_BACK = {
  damping: 14,
  stiffness: 240,
  mass: 0.5,
  overshootClamping: false,
  restDisplacementThreshold: 0.5,
  restSpeedThreshold: 1.5,
} as const;
// Minimum exit velocity so a slow drag past the threshold still flies off
// with conviction (also used when buttons fire fly() with no real velocity).
const MIN_EXIT_VELOCITY = 1400;
// Rotation angle (deg) when the card has been displaced one screen-width on
// X. Direct linear mapping — no clamping — so the rotation trajectory keeps
// going as the card flies off, instead of freezing at a max angle.
const ROTATION_PER_SCREEN_W = 22;
// Virtual pivot offset (px) below the card's geometric center. Rotation
// hinges from this point, making it feel like the card is being pushed or
// pulled from the top instead of spinning around its middle. ~40% of the
// card height puts the pivot in the lower third — natural for a held card.
const ROT_PIVOT_OFFSET = CARD_H * 0.4;

const boyBg = require("../assets/images/boy-card-bg.jpg");
const girlBg = require("../assets/images/girl-card-bg.jpg");
const paperTexture = require("../assets/images/paper-texture.jpg");
const likeSun = require("../assets/images/like_sun.png");
const dislikeSun = require("../assets/images/dislike_sun.png");

const ACTION_GRADIENT = ["hsl(38,50%,96%)", "hsl(38,45%,92%)"] as const;

export interface NameCardHandle {
  swipe: (liked: boolean) => void;
}

// Captured at the moment the user releases (or a button is pressed) so the
// outgoing card can continue the trajectory seamlessly from where the
// original card was, with the same momentum, rather than restarting from
// (0, 0).
export type ExitState = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
};

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
  // When true, this card is the outgoing/flying-away copy. It mounts with
  // initialExit applied to its shared values and immediately re-runs the
  // exit animation from that position with that velocity, then calls
  // onExitComplete when settled. Gestures are disabled.
  isOutgoing?: boolean;
  initialExit?: ExitState & { liked: boolean };
  onExitComplete?: () => void;
  canUndo?: boolean;
  dragProgress?: SharedValue<number>;
  // Second arg only fires when the swipe came from the user (drag or
  // button) — used by the parent to snapshot exit state for the outgoing
  // slot. Outgoing cards never call this back (suppressed internally).
  onSwipe: (liked: boolean, exit?: ExitState) => void;
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
    isOutgoing,
    initialExit,
    onExitComplete,
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

  // Outgoing cards mount with the user's release position pre-applied so
  // there's no "snap back to center" frame before the fly-off begins.
  const x = useSharedValue(isOutgoing && initialExit ? initialExit.x : 0);
  const y = useSharedValue(isOutgoing && initialExit ? initialExit.y : 0);
  // startX/startY snapshot the in-flight animated value when a new touch
  // begins, so re-grabbing a card mid-spring continues from where it is
  // instead of teleporting to translationX = 0.
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const committed = useRef(false);
  // UI-thread mirror of `committed` so the pan gesture worklets can lock
  // themselves out the instant fly() begins — prevents "ghost card" catches
  // where the user grabs a card mid-flight after onSwipe has already
  // advanced the parent's index.
  const isCommitted = useSharedValue(false);
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
  const resetCommitted = () => {
    committed.current = false;
  };

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

  // Held in a ref so the withDecay worklet always sees the current callback
  // (outgoing cards get this as a prop after mount).
  const onExitCompleteRef = useRef(onExitComplete);
  onExitCompleteRef.current = onExitComplete;
  const fireExitComplete = () => {
    onExitCompleteRef.current?.();
  };

  function fly(
    liked: boolean,
    velocityX = 0,
    velocityY = 0,
    suppressOnSwipe = false,
  ) {
    if (committed.current) return;
    committed.current = true;
    isCommitted.value = true;
    // Outgoing cards skip the haptic — the original card already fired one
    // when the user released, so a second tap would feel like a stutter.
    if (!suppressOnSwipe) {
      Haptics.impactAsync(
        liked
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      );
    }
    const direction = liked ? 1 : -1;
    // Carry the user's actual flick velocity into the exit, with a floor so
    // tap-driven exits (heart/X buttons) and slow drags-past-threshold also
    // leave the screen with momentum. withDecay gives the natural physics-y
    // ease-out a fixed-duration timing animation can't.
    const exitVelocity =
      Math.max(Math.abs(velocityX), MIN_EXIT_VELOCITY) * direction;
    // Promote the next card to full scale instantly so it's already in
    // position the moment React swaps it to "current".
    if (dragProgress) dragProgress.value = 1;
    // Snapshot the user's release position BEFORE we overwrite x/y with the
    // decay animation — the parent uses this to seed the outgoing card so
    // it picks up exactly where this one left off.
    const releaseX = x.value;
    const releaseY = y.value;
    x.value = withDecay(
      {
        velocity: exitVelocity,
        deceleration: 0.9985,
        // Clamp just past the off-screen edge so withDecay's completion
        // callback fires quickly once the card is fully invisible. Without a
        // tight clamp, withDecay coasts for ~5s before settling, leaving the
        // outgoing slot occupied (and blocking memory cleanup) long after
        // the card is visually gone.
        clamp: [-SCREEN_W * 1.6, SCREEN_W * 1.6],
      },
      (finished) => {
        "worklet";
        if (finished) runOnJS(fireExitComplete)();
      },
    );
    y.value = withDecay({
      velocity: velocityY,
      deceleration: 0.9985,
    });
    // No opacity fade. The card flies off-screen via withDecay's clamp; the
    // user sees a continuous physical motion all the way out, not a card
    // that "vanishes" mid-air. Opacity stays 1 for the entire flight.
    if (!suppressOnSwipe) {
      onSwipe(liked, {
        x: releaseX,
        y: releaseY,
        velocityX,
        velocityY,
      });
    }
  }

  // Outgoing cards: kick off the exit animation IMMEDIATELY during render
  // (guarded by a ref so it only fires once, even under StrictMode's double
  // render). useEffect would defer the animation by one frame — that frame
  // is exactly the perceptible "freeze" between release and motion. Setting
  // shared values + queueing withDecay during render means the UI thread
  // already has the animation running when the first paint commits, so the
  // card's flight is continuous from the user's release.
  const outgoingTriggered = useRef(false);
  if (isOutgoing && initialExit && !outgoingTriggered.current) {
    outgoingTriggered.current = true;
    fly(
      initialExit.liked,
      initialExit.velocityX,
      initialExit.velocityY,
      true,
    );
  }

  useImperativeHandle(ref, () => ({ swipe: (liked: boolean) => fly(liked) }));

  const pan = Gesture.Pan()
    .enabled(!isNext && !isOutgoing && !infoOpen)
    .onStart(() => {
      // Already swiped — ignore further touches on this card. The next
      // render will replace it; until then it's locked out of interaction.
      if (isCommitted.value) return;
      runOnJS(resetCommitted)();
      // Cancel any in-flight spring/decay so the finger fully owns the card,
      // and snapshot the current animated position so re-grabbing mid-spring
      // continues smoothly instead of teleporting.
      cancelAnimation(x);
      cancelAnimation(y);
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      if (isCommitted.value) return;
      // Additive: card follows finger from wherever it was when grabbed.
      x.value = startX.value + e.translationX;
      // Less Y dampening (0.55× vs 0.3×) for a more direct, less laggy feel.
      y.value = startY.value + e.translationY * 0.55;
      if (dragProgress) {
        dragProgress.value = Math.min(
          Math.abs(x.value) / SWIPE_THRESHOLD,
          1,
        );
      }
    })
    .onEnd((e) => {
      if (isCommitted.value) return;
      const passed =
        Math.abs(x.value) > SWIPE_THRESHOLD ||
        Math.abs(e.velocityX) > VELOCITY_THRESHOLD;
      if (passed) {
        // Use velocity sign first when it's significant (matches the user's
        // intent during a flick), fall back to position sign otherwise.
        const liked =
          Math.abs(e.velocityX) > VELOCITY_THRESHOLD
            ? e.velocityX > 0
            : x.value > 0;
        runOnJS(fly)(liked, e.velocityX, e.velocityY);
      } else {
        // Velocity-aware snap-back: a quick release feels physical because
        // the spring continues the finger's motion before pulling back.
        x.value = withSpring(0, { ...SPRING_BACK, velocity: e.velocityX });
        y.value = withSpring(0, { ...SPRING_BACK, velocity: e.velocityY });
        if (dragProgress) {
          dragProgress.value = withSpring(0, SPRING_BACK);
        }
      }
    });

  // Direct, unclamped linear function of X displacement — rotation keeps
  // tracking position even as the card flies off-screen, preserving the
  // organic "trajectory" instead of snapping to a fixed exit angle.
  const rotation = useDerivedValue(
    () => (x.value / SCREEN_W) * ROTATION_PER_SCREEN_W,
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      // Off-center rotation: shift the rotation center down to ROT_PIVOT
      // before rotating, then shift back. The result is a rotation that
      // hinges near the card's bottom — top swings left/right like the
      // card is being pushed at the top while pinned at the bottom.
      { translateY: -ROT_PIVOT_OFFSET },
      { rotateZ: `${rotation.value}deg` },
      { translateY: ROT_PIVOT_OFFSET },
    ],
    // Keep the card fully opaque during drag — only fade on actual exit.
    // (Compounding a drag-time dim with the exit fade made the card look
    // muddy mid-flick.)
    opacity: opacity.value,
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
        // Slide up from a slight inset as the top card moves away.
        { translateY: 14 * (1 - progress) },
        // 0.92 → 1.0 over the drag — wider scale range than before so the
        // background card's "rise" is visibly tied to drag distance.
        { scale: 0.92 + 0.08 * progress },
      ],
      // Cross-fade in too: ~78% opacity at rest, fully opaque when the
      // top card has been pulled past the threshold. The scale + opacity
      // curves are perfectly synced because both read the same shared
      // value, so the next card "rises and brightens" as one motion.
      opacity: 0.78 + 0.22 * progress,
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
        {!isNext && !isOutgoing && (
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
      {!isNext && !isOutgoing && (
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
