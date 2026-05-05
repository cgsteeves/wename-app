import { Feather } from "@expo/vector-icons";
import { ImageBackground } from "expo-image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fonts } from "@/constants/fonts";
import type { User } from "@/lib/supabase";

const boyCardBg = require("../assets/images/boy-card-bg.jpg");

// ── Types ────────────────────────────────────────────────────────────────────
type StyleFilter = "classic" | "modern" | "unique" | null;

interface Suggestion {
  name: string;
  meaning: string;
  gender: string;
  reason?: string;
}

// ── Color helpers ────────────────────────────────────────────────────────────
const BOY = "hsl(214,55%,42%)";
const GIRL = "hsl(345,55%,50%)";
const MUTED = "hsl(25,12%,48%)";
const BORDER = "hsl(35,22%,80%)";

const a = (base: string, alpha: number) =>
  base === BOY
    ? `hsla(214,55%,42%,${alpha})`
    : `hsla(345,55%,50%,${alpha})`;

// ── Env ──────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────
interface Props {
  user: User;
  likedNames: string[];
  matchedNames: string[];
  partnerLikedNames: string[];
  excludeNames: string[];
  onNameAdded: (name: string, gender: string) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────
export function NameSuggestions({
  user,
  likedNames,
  matchedNames,
  partnerLikedNames,
  excludeNames,
  onNameAdded,
}: Props) {
  const settingsGender: "boy" | "girl" =
    user.baby_gender === "girl" ? "girl" : "boy";
  const isBoy = settingsGender === "boy";
  const accent = isBoy ? BOY : GIRL;

  const [selectedStyle, setSelectedStyle] = useState<StyleFilter>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [hasLoaded, setHasLoaded] = useState(false);
  const [shownNames, setShownNames] = useState<Set<string>>(new Set());
  const [streamingDone, setStreamingDone] = useState(false);
  const hasFetchedOnMount = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel any pending retry on unmount
  useEffect(() => () => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
  }, []);

  const tooFewNames = likedNames.length < 3;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  // `attempt` is internal — callers always use the default (0).
  // On the first failure the function silently retries once after 3 s so that
  // Supabase Edge Function cold-starts are invisible to the user.
  const fetchSuggestions = useCallback(async (isRefresh: boolean, attempt = 0) => {
    // Cancel any queued retry when a new explicit fetch begins
    if (attempt === 0) {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      setLoading(true);
      setError("");
      setSuggestions([]);
      setAddedIds(new Set());
      setStreamingDone(false);
    }

    const excludeForRequest = isRefresh
      ? [...excludeNames, ...Array.from(shownNames)]
      : [...excludeNames];

    const scheduleRetry = () => {
      // Keep skeleton visible; silently retry after 3 s
      retryTimeoutRef.current = setTimeout(
        () => fetchSuggestions(isRefresh, attempt + 1),
        3000,
      );
    };

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/suggest-names`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            gender: settingsGender,
            likedNames,
            matchedNames,
            partnerLikedNames,
            excludeNames: excludeForRequest,
            style: selectedStyle,
            lastName: user.baby_last_name ?? "",
          }),
        },
      );

      if (!response.ok) {
        if (attempt === 0) { scheduleRetry(); return; }
        setLoading(false);
        setHasLoaded(true);
        setError("Could not load suggestions. Please try again.");
        setStreamingDone(true);
        return;
      }

      // Transition: skeleton → streaming
      setLoading(false);
      setHasLoaded(true);

      const fetched: Suggestion[] = [];
      let buffer = "";

      const processLines = () => {
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const obj = JSON.parse(trimmed) as Suggestion;
            if (obj.name && obj.gender) {
              fetched.push(obj);
              setSuggestions((prev) => [...prev, obj]);
              setShownNames((prev) => new Set([...prev, obj.name]));
            }
          } catch {
            // incomplete chunk — skip
          }
        }
      };

      // Try streaming reader (works on web + RN 0.76+)
      try {
        const reader = (response.body as ReadableStream<Uint8Array> | null)?.getReader?.();
        if (reader) {
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            processLines();
          }
          if (buffer.trim()) {
            buffer += "\n";
            processLines();
          }
        } else {
          throw new Error("no reader");
        }
      } catch {
        // Fallback: read full response text at once
        const text = await response.text().catch(() => "");
        buffer = text + "\n";
        processLines();
      }

      if (fetched.length === 0) {
        if (attempt === 0) { scheduleRetry(); return; }
        setError("Could not load suggestions. Please try again.");
      }
      setStreamingDone(true);
    } catch {
      if (attempt === 0) { scheduleRetry(); return; }
      setLoading(false);
      setHasLoaded(true);
      setError("Something went wrong. Please try again.");
      setStreamingDone(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludeNames, likedNames, matchedNames, partnerLikedNames, selectedStyle, settingsGender, user.baby_last_name]);

  // Auto-fetch on mount if enough likes
  useEffect(() => {
    if (!hasFetchedOnMount.current && likedNames.length >= 3) {
      hasFetchedOnMount.current = true;
      fetchSuggestions(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [likedNames.length]);

  // Auto-refetch when style changes (only after first fetch)
  const isFirstStyleRender = useRef(true);
  useEffect(() => {
    if (isFirstStyleRender.current) {
      isFirstStyleRender.current = false;
      return;
    }
    if (hasFetchedOnMount.current) {
      setSuggestions([]);
      setAddedIds(new Set());
      fetchSuggestions(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStyle]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleAddToLiked(s: Suggestion) {
    const key = s.name + s.gender;
    if (addedIds.has(key)) return;
    setAddedIds((prev) => new Set([...prev, key]));
    setShownNames((prev) => new Set([...prev, s.name]));
    onNameAdded(s.name, s.gender);
  }

  function toggleStyle(style: "classic" | "modern" | "unique") {
    setSelectedStyle((prev) => (prev === style ? null : style));
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View>
      {/* Style filter pills */}
      <View style={styles.pillRow}>
        {(["classic", "modern", "unique"] as const).map((s) => {
          const active = selectedStyle === s;
          return (
            <Pressable
              key={s}
              onPress={() => toggleStyle(s)}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? a(accent, 0.1) : "rgba(255,255,255,0.4)",
                  borderColor: active ? a(accent, 0.2) : `hsla(35,22%,80%,0.3)`,
                },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: active ? accent : MUTED },
                ]}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Too few names card */}
      {tooFewNames && !hasLoaded && (
        <View
          style={[
            styles.tooFewCard,
            {
              backgroundColor: a(accent, 0.05),
              borderColor: a(accent, 0.15),
            },
          ]}
        >
          <Feather
            name="star"
            size={24}
            color={accent}
            style={{ marginBottom: 8 }}
          />
          <Text
            style={[
              styles.tooFewText,
              { color: MUTED },
            ]}
          >
            Like a few more names while swiping to unlock personalized
            suggestions.
          </Text>
        </View>
      )}

      {/* Loading skeleton */}
      {loading && <SkeletonList isBoy={isBoy} accent={accent} />}

      {/* Suggestions list */}
      {!loading && suggestions.length > 0 && (
        <View style={{ gap: 6 }}>
          {suggestions.map((s, i) => (
            <SuggestionTile
              key={`${s.name}-${i}`}
              suggestion={s}
              index={i}
              isBoy={isBoy}
              accent={accent}
              added={addedIds.has(s.name + s.gender)}
              onAdd={() => handleAddToLiked(s)}
            />
          ))}

          {/* Refresh button (shown after streaming completes) */}
          {streamingDone && (
            <Pressable
              disabled={loading}
              onPress={() => fetchSuggestions(true)}
              style={({ pressed }) => [
                styles.refreshBtn,
                {
                  backgroundColor: a(accent, 0.1),
                  borderColor: a(accent, 0.2),
                  opacity: loading ? 0.5 : pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather name="refresh-cw" size={14} color={accent} />
              <Text style={[styles.refreshBtnText, { color: accent }]}>
                Refresh Suggestions
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Empty after load */}
      {!loading && hasLoaded && suggestions.length === 0 && !error && (
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 14,
              color: MUTED,
              textAlign: "center",
            }}
          >
            No more new suggestions right now.
          </Text>
          <Pressable
            onPress={() => fetchSuggestions(true)}
            style={({ pressed }) => [
              styles.refreshBtn,
              {
                backgroundColor: a(accent, 0.1),
                borderColor: a(accent, 0.2),
                paddingVertical: 8,
                paddingHorizontal: 20,
                alignSelf: "center",
                marginTop: 12,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather name="refresh-cw" size={14} color={accent} />
            <Text style={[styles.refreshBtnText, { color: accent }]}>
              Try Again
            </Text>
          </Pressable>
        </View>
      )}

      {/* Not yet loaded, enough likes — show generate button */}
      {!loading && !hasLoaded && !tooFewNames && (
        <Pressable
          onPress={() => {
            hasFetchedOnMount.current = true;
            fetchSuggestions(false);
          }}
          style={({ pressed }) => [
            styles.generateBtn,
            {
              backgroundColor: a(accent, 0.1),
              borderColor: a(accent, 0.2),
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="zap" size={16} color={accent} />
          <Text style={[styles.generateBtnText, { color: accent }]}>
            Generate Suggestions
          </Text>
        </Pressable>
      )}

      {/* Error */}
      {!!error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Skeleton
// ────────────────────────────────────────────────────────────────────────────
function SkeletonList({ isBoy, accent }: { isBoy: boolean; accent: string }) {
  return (
    <View style={{ gap: 6 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.skeletonTile,
            {
              borderColor: isBoy
                ? "hsl(214,50%,62%)"
                : "hsl(345,50%,68%)",
              backgroundColor: isBoy
                ? "hsl(214,72%,93%)"
                : "hsl(345,65%,93%)",
            },
          ]}
        >
          <View style={styles.skeletonContent}>
            <View style={{ flex: 1, gap: 6 }}>
              <View
                style={[
                  styles.skeletonBar,
                  {
                    width: 96,
                    height: 16,
                    backgroundColor: isBoy
                      ? "hsl(214,50%,80%)"
                      : "hsl(345,50%,82%)",
                  },
                ]}
              />
              <View
                style={[
                  styles.skeletonBar,
                  {
                    width: 160,
                    height: 12,
                    backgroundColor: isBoy
                      ? "hsl(214,50%,88%)"
                      : "hsl(345,50%,90%)",
                  },
                ]}
              />
            </View>
            <View
              style={[
                styles.skeletonCircle,
                {
                  backgroundColor: isBoy
                    ? "hsl(214,50%,84%)"
                    : "hsl(345,50%,86%)",
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Suggestion tile
// ────────────────────────────────────────────────────────────────────────────
function SuggestionTile({
  suggestion,
  index,
  isBoy,
  accent,
  added,
  onAdd,
}: {
  suggestion: Suggestion;
  index: number;
  isBoy: boolean;
  accent: string;
  added: boolean;
  onAdd: () => void;
}) {
  const nameColor = isBoy ? "hsl(214,55%,30%)" : "hsl(345,55%,38%)";
  const reasonLabelColor = isBoy ? "hsl(214,45%,55%)" : "hsl(345,45%,55%)";
  const reasonTextColor = isBoy ? "hsl(214,45%,40%)" : "hsl(345,45%,46%)";
  const reasonBg = isBoy ? "rgba(100,140,200,0.10)" : "rgba(255,160,170,0.12)";
  const reasonBorder = isBoy ? "hsl(214,50%,76%)" : "hsl(345,50%,80%)";
  const tileBorder = isBoy ? "hsl(214,50%,62%)" : "hsl(345,50%,68%)";

  if (isBoy) {
    return (
      <View style={[styles.tile, { borderColor: tileBorder }]}>
        <ImageBackground
          source={boyCardBg}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        {/* Blue semi-transparent overlay */}
        <View
          style={[StyleSheet.absoluteFill, styles.boyOverlay]}
          pointerEvents="none"
        />
        <TileContent
          suggestion={suggestion}
          isBoy={isBoy}
          nameColor={nameColor}
          reasonLabelColor={reasonLabelColor}
          reasonTextColor={reasonTextColor}
          reasonBg={reasonBg}
          reasonBorder={reasonBorder}
          accent={accent}
          added={added}
          onAdd={onAdd}
        />
      </View>
    );
  }

  return (
    <View style={[styles.tile, { borderColor: tileBorder }]}>
      {/* Pink radial gradient background */}
      <View
        style={[StyleSheet.absoluteFill, styles.girlBg]}
        pointerEvents="none"
      />
      <TileContent
        suggestion={suggestion}
        isBoy={isBoy}
        nameColor={nameColor}
        reasonLabelColor={reasonLabelColor}
        reasonTextColor={reasonTextColor}
        reasonBg={reasonBg}
        reasonBorder={reasonBorder}
        accent={accent}
        added={added}
        onAdd={onAdd}
      />
    </View>
  );
}

function TileContent({
  suggestion,
  isBoy,
  nameColor,
  reasonLabelColor,
  reasonTextColor,
  reasonBg,
  reasonBorder,
  accent,
  added,
  onAdd,
}: {
  suggestion: Suggestion;
  isBoy: boolean;
  nameColor: string;
  reasonLabelColor: string;
  reasonTextColor: string;
  reasonBg: string;
  reasonBorder: string;
  accent: string;
  added: boolean;
  onAdd: () => void;
}) {
  return (
    <View style={styles.tileInner}>
      {/* Top row: name + meaning | add button */}
      <View style={styles.tileTopRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.tileName, { color: nameColor }]} numberOfLines={1}>
            {suggestion.name}
          </Text>
          <Text
            style={[styles.tileMeaning, { color: MUTED }]}
            numberOfLines={2}
          >
            {suggestion.meaning}
          </Text>
        </View>
        <Pressable
          onPress={onAdd}
          disabled={added}
          style={({ pressed }) => [
            styles.addBtn,
            added
              ? styles.addBtnAdded
              : {
                  backgroundColor: "rgba(255,255,255,0.6)",
                  borderColor: `${accent}4D`,
                  opacity: pressed ? 0.85 : 1,
                },
          ]}
        >
          <Feather
            name={added ? "check" : "plus"}
            size={11}
            color={added ? "#16a34a" : accent}
          />
          <Text
            style={[
              styles.addBtnText,
              { color: added ? "#16a34a" : accent },
            ]}
          >
            {added ? "Added" : "Add to My Picks"}
          </Text>
        </Pressable>
      </View>

      {/* Reason panel */}
      {!!suggestion.reason && (
        <View
          style={[
            styles.reasonPanel,
            {
              backgroundColor: reasonBg,
              borderColor: reasonBorder,
            },
          ]}
        >
          <Text
            style={[styles.reasonLabel, { color: reasonLabelColor }]}
          >
            Why you&apos;ll like this
          </Text>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4 }}>
            <Feather
              name="star"
              size={9}
              color={reasonTextColor}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <Text style={[styles.reasonText, { color: reasonTextColor }]}>
              {suggestion.reason}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pillRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 8,
  },
  pill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontFamily: fonts.displayMedium,
    fontSize: 10,
  },

  tooFewCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  tooFewText: {
    fontFamily: fonts.display,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  skeletonTile: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  skeletonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  skeletonBar: {
    borderRadius: 4,
  },
  skeletonCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    flexShrink: 0,
  },

  tile: {
    position: "relative",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  boyOverlay: {
    borderRadius: 8,
    backgroundColor: "hsla(214,72%,88%,0.82)",
  },
  girlBg: {
    borderRadius: 8,
    backgroundColor: "hsla(345,75%,92%,0.90)",
  },
  tileInner: {
    position: "relative",
    zIndex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tileTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  tileName: {
    fontFamily: fonts.displayMedium,
    fontSize: 16,
  },
  tileMeaning: {
    fontFamily: fonts.display,
    fontSize: 10,
    lineHeight: 14,
    paddingRight: 4,
    marginTop: 2,
  },
  addBtn: {
    flexShrink: 0,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  addBtnAdded: {
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac",
  },
  addBtnText: {
    fontFamily: fonts.displayMedium,
    fontSize: 10,
  },

  reasonPanel: {
    marginTop: 8,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  reasonLabel: {
    fontSize: 10,
    fontFamily: fonts.displaySemibold,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 10,
    fontFamily: fonts.display,
    lineHeight: 14,
    flex: 1,
  },

  refreshBtn: {
    width: "100%",
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  refreshBtnText: {
    fontFamily: fonts.displayMedium,
    fontSize: 14,
  },

  generateBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  generateBtnText: {
    fontFamily: fonts.displayMedium,
    fontSize: 14,
  },

  errorText: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: "#f87171",
    textAlign: "center",
    marginTop: 8,
  },
});
