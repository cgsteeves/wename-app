import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

// Preference chips users can toggle to guide the AI.
// The string values are sent verbatim to the Edge Function, which maps them
// to prompt instructions — keep them in sync if you change the labels.
const TUNING_OPTIONS: readonly string[] = [
  "Short",
  "Easy to pronounce",
  "Rare but usable",
  "Meaningful",
  "Spiritual",
  "Modern",
  "Classic",
  "Soft sounding",
  "Strong sounding",
  "Works with last name",
];

const TUNING_STORAGE_KEY = "wename_tuning_preferences";

const sortKey = (arr: readonly string[]): string => [...arr].sort().join("|");

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

// Fetch timeout in milliseconds. Matches the OpenAI server-side timeout (10 s)
// plus a small buffer for network round-trip.
const FETCH_TIMEOUT_MS = 13_000;

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

  const selectedStyle: StyleFilter = null;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [hasLoaded, setHasLoaded] = useState(false);
  const [shownNames, setShownNames] = useState<Set<string>>(new Set());
  // Mirror shownNames in a ref so fetchSuggestions can read the latest value
  // without needing it as a useCallback dependency (avoids infinite re-renders).
  const shownNamesRef = useRef<Set<string>>(new Set());
  const [streamingDone, setStreamingDone] = useState(false);
  const hasFetchedOnMount = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // AbortController for the in-flight fetch. Replaced on every new top-level
  // request (attempt === 0) and aborted on unmount or when a newer request starts.
  const abortControllerRef = useRef<AbortController | null>(null);
  // Separate timeout handle for the per-request wall-clock deadline.
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tuning preferences (chip selections). Persisted via AsyncStorage so they
  // survive app restarts. Read inside fetchSuggestions via ref to avoid
  // re-creating the callback on every toggle.
  const [tuningPrefs, setTuningPrefs] = useState<string[]>([]);
  const [tuningLoaded, setTuningLoaded] = useState(false);
  const tuningPrefsRef = useRef<string[]>([]);
  // Tracks the tuning prefs that were active during the last successful fetch.
  // The Apply button appears whenever current prefs differ from this snapshot.
  const lastAppliedTuningRef = useRef<string[]>([]);

  // Keep ref in sync with state so fetchSuggestions always reads the latest set
  useEffect(() => { shownNamesRef.current = shownNames; }, [shownNames]);
  useEffect(() => { tuningPrefsRef.current = tuningPrefs; }, [tuningPrefs]);

  // Load persisted tuning preferences once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TUNING_STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter(
              (p): p is string =>
                typeof p === "string" && TUNING_OPTIONS.includes(p),
            );
            setTuningPrefs(valid);
            tuningPrefsRef.current = valid;
            lastAppliedTuningRef.current = valid;
          }
        }
      } catch {
        // Storage read failure is non-fatal — start with empty prefs.
      } finally {
        if (!cancelled) setTuningLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Cancel any pending timers and in-flight request on unmount.
  useEffect(() => () => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    abortControllerRef.current?.abort("cancelled");
  }, []);

  const tooFewNames = likedNames.length < 3;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  // `attempt` is internal — callers always use the default (0).
  // On the first failure the function silently retries once after 3 s so that
  // Supabase Edge Function cold-starts are invisible to the user.
  const fetchSuggestions = useCallback(async (isRefresh: boolean, attempt = 0) => {
    if (attempt === 0) {
      // Cancel any queued retry and previous in-flight request.
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
      abortControllerRef.current?.abort("cancelled");

      // Fresh controller + wall-clock deadline for this request.
      const controller = new AbortController();
      abortControllerRef.current = controller;
      fetchTimeoutRef.current = setTimeout(() => {
        controller.abort("timeout");
      }, FETCH_TIMEOUT_MS);

      setLoading(true);
      setError("");
      setSuggestions([]);
      setAddedIds(new Set());
      setStreamingDone(false);
    }

    // Use the controller that was set up for attempt 0 of this request.
    const signal = abortControllerRef.current?.signal;

    const excludeForRequest = isRefresh
      ? [...excludeNames, ...Array.from(shownNamesRef.current)]
      : [...excludeNames];

    const tuningForRequest = [...tuningPrefsRef.current];

    if (attempt === 0) {
      console.log("[NameSuggestions] fetch", {
        isRefresh,
        style: selectedStyle,
        tuningPreferences: tuningForRequest,
        likedCount: likedNames.length,
        excludeCount: excludeForRequest.length,
      });
    }

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
          signal,
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
            tuningPreferences: tuningForRequest,
          }),
        },
      );

      if (!response.ok) {
        if (attempt === 0) { scheduleRetry(); return; }
        clearFetchTimeout();
        setLoading(false);
        setHasLoaded(true);
        setError("Could not load suggestions. Please try again.");
        setStreamingDone(true);
        return;
      }

      // Transition: skeleton → streaming
      clearFetchTimeout();
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
      } catch (streamErr) {
        // If the request was aborted during streaming, propagate so the outer
        // catch can handle it cleanly rather than trying response.text().
        if (isAbortError(streamErr)) throw streamErr;
        // Fallback: read full response text at once
        const text = await response.text().catch(() => "");
        buffer = text + "\n";
        processLines();
      }

      if (fetched.length === 0) {
        if (attempt === 0) { scheduleRetry(); return; }
        setError("Could not load suggestions. Please try again.");
      } else {
        // Snapshot tuning prefs only on a successful, non-empty response so a
        // failed/timed-out request keeps the Apply button visible for retry.
        lastAppliedTuningRef.current = [...tuningPrefsRef.current];
      }
      console.log("[NameSuggestions] received", { count: fetched.length });
      setStreamingDone(true);
    } catch (err) {
      clearFetchTimeout();

      // Handle abort (cancelled by new request) silently.
      if (isAbortError(err)) {
        const reason = abortControllerRef.current?.signal.reason ?? signal?.reason;
        if (reason === "cancelled") {
          // A newer request has taken over — this one can safely exit.
          return;
        }
        // Timeout — inform the user.
        setLoading(false);
        setHasLoaded(true);
        setError("Request timed out. Check your connection and try again.");
        setStreamingDone(true);
        return;
      }

      if (attempt === 0) { scheduleRetry(); return; }
      setLoading(false);
      setHasLoaded(true);
      setError("Something went wrong. Please try again.");
      setStreamingDone(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludeNames, likedNames, matchedNames, partnerLikedNames, selectedStyle, settingsGender, user.baby_last_name]);

  function clearFetchTimeout() {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }
  }

  // Auto-fetch on mount if enough likes — gated on tuningLoaded so the first
  // request includes the user's persisted preferences.
  useEffect(() => {
    if (!tuningLoaded) return;
    if (!hasFetchedOnMount.current && likedNames.length >= 3) {
      hasFetchedOnMount.current = true;
      fetchSuggestions(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [likedNames.length, tuningLoaded]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleAddToLiked(s: Suggestion) {
    const key = s.name + s.gender;
    if (addedIds.has(key)) return;
    setAddedIds((prev) => new Set([...prev, key]));
    setShownNames((prev) => new Set([...prev, s.name]));
    onNameAdded(s.name, s.gender);
  }

  function toggleTuning(opt: string) {
    setTuningPrefs((prev) => {
      const next = prev.includes(opt)
        ? prev.filter((p) => p !== opt)
        : [...prev, opt];
      AsyncStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(next)).catch(
        () => { /* persistence is best-effort */ },
      );
      return next;
    });
  }

  const hasUnappliedTuning =
    sortKey(tuningPrefs) !== sortKey(lastAppliedTuningRef.current);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View>
      {/* Tune my suggestions */}
      {!tooFewNames && (
        <View style={styles.tuneSection}>
          <Text style={[styles.tuneTitle, { color: accent }]}>
            Tune my suggestions
          </Text>
          <Text style={[styles.tuneSubtitle, { color: MUTED }]}>
            Choose what you want more of.
          </Text>
          <View style={styles.chipWrap}>
            {TUNING_OPTIONS.map((opt) => {
              const active = tuningPrefs.includes(opt);
              return (
                <Pressable
                  key={opt}
                  onPress={() => toggleTuning(opt)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? a(accent, 0.12)
                        : "rgba(255,255,255,0.5)",
                      borderColor: active
                        ? a(accent, 0.3)
                        : `hsla(35,22%,80%,0.4)`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? accent : MUTED },
                    ]}
                  >
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {hasUnappliedTuning && hasLoaded && (
            <Pressable
              onPress={() => fetchSuggestions(false)}
              style={({ pressed }) => [
                styles.applyBtn,
                {
                  backgroundColor: a(accent, 0.12),
                  borderColor: a(accent, 0.3),
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather name="check" size={12} color={accent} />
              <Text style={[styles.applyBtnText, { color: accent }]}>
                Apply changes
              </Text>
            </Pressable>
          )}
        </View>
      )}

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
            Like at least 3 names so WeName can learn your style.
          </Text>
          <Text style={[styles.tooFewProgress, { color: accent }]}>
            {Math.min(likedNames.length, 3)} of 3 likes needed
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

// ── Abort error helper ────────────────────────────────────────────────────────
function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || err.name === "TimeoutError")
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
  tooFewProgress: {
    fontFamily: fonts.displayMedium,
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },

  tuneSection: {
    marginTop: 4,
    marginBottom: 8,
  },
  tuneTitle: {
    fontFamily: fonts.displaySemibold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  tuneSubtitle: {
    fontFamily: fonts.display,
    fontSize: 11,
    marginBottom: 6,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: fonts.displayMedium,
    fontSize: 10,
  },
  applyBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  applyBtnText: {
    fontFamily: fonts.displayMedium,
    fontSize: 11,
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
