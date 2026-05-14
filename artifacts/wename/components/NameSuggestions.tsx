import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ImageBackground } from "expo-image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
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
  "Short names",
  "Easy to pronounce",
  "Rare but not weird",
  "Traditional",
  "Modern",
  "Spiritual",
  "Arabic origin",
  "Hebrew origin",
  "Works in English/French",
  "Strong meaning",
  "Soft sounding",
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

// Fetch timeout in milliseconds. Matches the OpenAI server-side timeout (25 s)
// plus a generous buffer for Edge Function cold-start and network round-trip.
// Android devices observe noticeably slower TLS handshakes on cold connections,
// so we give them extra headroom.
const FETCH_TIMEOUT_MS = Platform.OS === "android" ? 60_000 : 45_000;

// ── Status state machine ─────────────────────────────────────────────────────
// One explicit status replaces the implicit combination of loading / hasLoaded /
// streamingDone / error / suggestions.length flags so that each UI affordance
// is unambiguous (timeout vs error vs true-empty).
type Status = "idle" | "loading" | "success" | "empty" | "error" | "timeout";

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
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [shownNames, setShownNames] = useState<Set<string>>(new Set());
  // Mirror shownNames in a ref so fetchSuggestions can read the latest value
  // without needing it as a useCallback dependency (avoids infinite re-renders).
  const shownNamesRef = useRef<Set<string>>(new Set());
  const hasFetchedOnMount = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // AbortController for the in-flight fetch. A fresh controller is created for
  // every attempt (including silent retries) so each gets its own deadline.
  const abortControllerRef = useRef<AbortController | null>(null);
  // Separate timeout handle for the per-attempt wall-clock deadline.
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

  // Mirror name lists in refs so fetchSuggestions can read the latest values
  // without becoming a dependency on every list change (which would cancel
  // in-flight requests on every parent render).
  const likedNamesRef = useRef<string[]>(likedNames);
  const matchedNamesRef = useRef<string[]>(matchedNames);
  const partnerLikedNamesRef = useRef<string[]>(partnerLikedNames);
  const excludeNamesRef = useRef<string[]>(excludeNames);
  useEffect(() => { likedNamesRef.current = likedNames; }, [likedNames]);
  useEffect(() => { matchedNamesRef.current = matchedNames; }, [matchedNames]);
  useEffect(() => { partnerLikedNamesRef.current = partnerLikedNames; }, [partnerLikedNames]);
  useEffect(() => { excludeNamesRef.current = excludeNames; }, [excludeNames]);

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
  // On a transient failure (timeout, non-2xx, exception, empty response) the
  // function silently retries once after 3 s so that Supabase Edge Function
  // cold-starts are invisible to the user.
  //
  // opts.force = true means "user-initiated retry": reset the per-session
  // shownNames so we can produce fresh names, and append ?noCache=1 so the
  // Edge Function bypasses its KV cache.
  const fetchSuggestions = useCallback(async (
    opts: { isRefresh?: boolean; force?: boolean } = {},
    attempt = 0,
  ) => {
    const { isRefresh = false, force = false } = opts;

    if (attempt === 0) {
      // Cancel any queued retry and previous in-flight request.
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      abortControllerRef.current?.abort("cancelled");

      if (force) {
        // User asked for a truly fresh batch — drop session-shown names so the
        // server can return previously-shown options if needed.
        setShownNames(new Set());
        shownNamesRef.current = new Set();
      }

      setStatus("loading");
      setErrorMessage("");
      setSuggestions([]);
      setAddedIds(new Set());
    }

    // Fresh controller + wall-clock deadline for THIS attempt. Silent retries
    // get a brand-new clock so the previous timeout doesn't immediately fire.
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    fetchTimeoutRef.current = setTimeout(() => {
      controller.abort("timeout");
    }, FETCH_TIMEOUT_MS);
    const signal = controller.signal;

    // ── Compose excludeNames (≤ 30 entries) ────────────────────────────────
    // Priority order so the most relevant exclusions survive the cap:
    //   1. liked names         (user's own picks — never re-suggest)
    //   2. matched names       (already paired with partner)
    //   3. shown this session  (avoid duplicates within the panel)
    //   4. extra (allSwiped)   (low-priority filler from the prop)
    const norm = (n: string) => n.trim().toLowerCase();
    const seenExclude = new Set<string>();
    const excludeForRequest: string[] = [];
    const sources = [
      ...likedNamesRef.current,
      ...matchedNamesRef.current,
      ...Array.from(shownNamesRef.current),
      ...excludeNamesRef.current,
    ];
    for (const raw of sources) {
      const trimmed = (raw ?? "").trim();
      if (!trimmed) continue;
      const k = norm(trimmed);
      if (seenExclude.has(k)) continue;
      seenExclude.add(k);
      excludeForRequest.push(trimmed);
      if (excludeForRequest.length >= 30) break;
    }

    const tuningForRequest = [...tuningPrefsRef.current];

    const requestStartedAt = Date.now();
    console.log("[NameSuggestions] fetch:start", {
      attempt,
      isRefresh,
      force,
      tuningCount: tuningForRequest.length,
      likedCount: likedNamesRef.current.length,
      matchedCount: matchedNamesRef.current.length,
      excludeCount: excludeForRequest.length,
      timeoutMs: FETCH_TIMEOUT_MS,
    });

    const scheduleRetry = (reason: string) => {
      console.log("[NameSuggestions] fetch:retry-scheduled", { attempt, reason });
      retryTimeoutRef.current = setTimeout(
        () => fetchSuggestions(opts, attempt + 1),
        3000,
      );
    };

    const url =
      `${SUPABASE_URL}/functions/v1/suggest-names` +
      (force ? "?noCache=1" : "");

    try {
      const response = await fetch(url, {
        method: "POST",
        signal,
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gender: settingsGender,
          likedNames: likedNamesRef.current,
          matchedNames: matchedNamesRef.current,
          partnerLikedNames: partnerLikedNamesRef.current,
          excludeNames: excludeForRequest,
          style: selectedStyle,
          lastName: user.baby_last_name ?? "",
          tuningPreferences: tuningForRequest,
        }),
      });

      console.log("[NameSuggestions] fetch:response", {
        attempt,
        status: response.status,
        elapsedMs: Date.now() - requestStartedAt,
      });

      if (!response.ok) {
        if (attempt === 0) { scheduleRetry(`status_${response.status}`); return; }
        clearFetchTimeout();
        setStatus("error");
        setErrorMessage("Couldn't load suggestions — try again.");
        return;
      }

      clearFetchTimeout();

      // Defensive client-side filter: drop any returned name that case-
      // insensitively matches a liked/matched name. We keep names that match
      // the prop excludeNames (already-swiped) since the server already saw
      // them — but if it returns one anyway, it's probably the best it can do.
      const filterSet = new Set<string>();
      for (const n of likedNamesRef.current) filterSet.add(norm(n));
      for (const n of matchedNamesRef.current) filterSet.add(norm(n));

      const fetched: Suggestion[] = [];
      // Mirror of every valid suggestion object the server sent, BEFORE the
      // defensive client-side filter. If the filter ends up wiping everything
      // (e.g. the server already returned only liked/matched names because the
      // taste profile is exhausted) we fall back to showing this raw set
      // rather than collapsing to the empty state.
      const rawFromServer: Suggestion[] = [];
      let chunkCount = 0;
      let parsedCount = 0;
      let filteredOutCount = 0;
      let fallbackUsed: boolean | null = null;
      let fallbackReason: string | null = null;
      let buffer = "";
      const seenInThisBatch = new Set<string>();

      const handleObj = (obj: unknown) => {
        if (!obj || typeof obj !== "object") return;
        const o = obj as Record<string, unknown>;
        // Meta lines from the Edge Function — record but don't render.
        if (o.type === "meta") {
          if (typeof o.fallback === "boolean") fallbackUsed = o.fallback;
          if (typeof o.reason === "string") fallbackReason = o.reason;
          return;
        }
        if (typeof o.name !== "string" || typeof o.gender !== "string") return;
        parsedCount++;
        const sug: Suggestion = {
          name: o.name,
          meaning: typeof o.meaning === "string" ? o.meaning : "",
          gender: o.gender,
          reason: typeof o.reason === "string" ? o.reason : undefined,
        };
        rawFromServer.push(sug);
        const k = norm(o.name);
        if (!k || seenInThisBatch.has(k) || filterSet.has(k)) {
          filteredOutCount++;
          return;
        }
        seenInThisBatch.add(k);
        fetched.push(sug);
        setSuggestions((prev) => [...prev, sug]);
        setShownNames((prev) => {
          const next = new Set(prev);
          next.add(sug.name);
          return next;
        });
      };

      const processLines = () => {
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            handleObj(JSON.parse(trimmed));
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
            chunkCount++;
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

      // If the client-side filter wiped the entire batch but the server
      // actually sent suggestions, prefer showing the raw set over the empty
      // state. This honors the "dedupe never wipes the whole result set to
      // zero" requirement.
      if (fetched.length === 0 && rawFromServer.length > 0) {
        // De-duplicate within the raw batch only (not against liked/matched).
        const seenRaw = new Set<string>();
        const recovered: Suggestion[] = [];
        for (const sug of rawFromServer) {
          const k = norm(sug.name);
          if (!k || seenRaw.has(k)) continue;
          seenRaw.add(k);
          recovered.push(sug);
        }
        if (recovered.length > 0) {
          console.log("[NameSuggestions] fetch:filter-rescued", {
            attempt,
            recovered: recovered.length,
          });
          fetched.push(...recovered);
          setSuggestions(recovered);
          setShownNames((prev) => {
            const next = new Set(prev);
            for (const s of recovered) next.add(s.name);
            return next;
          });
        }
      }

      console.log("[NameSuggestions] fetch:done", {
        attempt,
        chunkCount,
        parsedCount,
        filteredOutCount,
        finalCount: fetched.length,
        fallbackUsed,
        fallbackReason,
        elapsedMs: Date.now() - requestStartedAt,
      });

      if (fetched.length === 0) {
        if (attempt === 0) { scheduleRetry("empty_response"); return; }
        // Truly empty after a retry — show the empty state, NOT an error.
        setStatus("empty");
        return;
      }

      // Snapshot tuning prefs only on a successful, non-empty response so a
      // failed/timed-out request keeps the Apply button visible for retry.
      lastAppliedTuningRef.current = [...tuningPrefsRef.current];
      setStatus("success");
    } catch (err) {
      clearFetchTimeout();

      if (isAbortError(err)) {
        const reason =
          (controller.signal.reason as string | undefined) ??
          (signal.reason as string | undefined);
        console.log("[NameSuggestions] fetch:aborted", { attempt, reason });
        if (reason === "cancelled") {
          // A newer request has taken over — this one can safely exit.
          return;
        }
        // Timeout: silently retry once on attempt 0 with a fresh controller;
        // surface the timeout state only after the retry also fails.
        if (attempt === 0) {
          scheduleRetry("timeout");
          return;
        }
        setStatus("timeout");
        setErrorMessage("Suggestions took too long — try again.");
        return;
      }

      console.log("[NameSuggestions] fetch:error", {
        attempt,
        message: err instanceof Error ? err.message : String(err),
      });

      if (attempt === 0) { scheduleRetry("exception"); return; }
      setStatus("error");
      setErrorMessage("Couldn't load suggestions — try again.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStyle, settingsGender, user.baby_last_name]);

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
      fetchSuggestions();
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
          {hasUnappliedTuning && status !== "idle" && (
            <Pressable
              onPress={() => fetchSuggestions()}
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
      {tooFewNames && status === "idle" && (
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

      {/* Loading skeleton — only while the first batch hasn't arrived yet */}
      {status === "loading" && suggestions.length === 0 && (
        <SkeletonList isBoy={isBoy} accent={accent} />
      )}

      {/* Suggestions list */}
      {suggestions.length > 0 && (
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

          {/* Refresh button (shown after a successful batch completes) */}
          {status === "success" && (
            <Pressable
              onPress={() => fetchSuggestions({ isRefresh: true, force: true })}
              style={({ pressed }) => [
                styles.refreshBtn,
                {
                  backgroundColor: a(accent, 0.1),
                  borderColor: a(accent, 0.2),
                  opacity: pressed ? 0.8 : 1,
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

      {/* Empty (true zero, after a successful response) */}
      {status === "empty" && (
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
            onPress={() => fetchSuggestions({ isRefresh: true, force: true })}
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

      {/* Timeout / Error — distinct copy, both with a working Try Again */}
      {(status === "timeout" || status === "error") && (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 13,
              color: MUTED,
              textAlign: "center",
              paddingHorizontal: 16,
            }}
          >
            {errorMessage}
          </Text>
          <Pressable
            onPress={() => fetchSuggestions({ force: true })}
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
      {status === "idle" && !tooFewNames && (
        <Pressable
          onPress={() => {
            hasFetchedOnMount.current = true;
            fetchSuggestions();
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
