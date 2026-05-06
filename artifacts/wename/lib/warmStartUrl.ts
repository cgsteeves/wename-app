import * as Linking from "expo-linking";

// ─── Warm-start URL capture ────────────────────────────────────────────────────
//
// Problem: On a warm start (app in background), the Linking `url` event fires
// and Expo Router navigates to auth/callback BEFORE the screen component
// mounts. By the time the screen's useEffect attaches its own addEventListener,
// the event is gone and getInitialURL() returns null — the URL is lost.
//
// Fix: Capture every incoming deep-link URL at module level here. _layout.tsx
// imports this file as a side-effect so the listener is active before any
// navigation can occur. The auth/callback screen calls takeCapturedUrl() when
// getInitialURL() returns null to recover the URL.
//
// Hot-reload safety: module-level code re-runs on every Fast Refresh cycle in
// dev, which would register a new listener on each reload while the old one
// stays attached (native subscription, not GC'd). We use a global flag to
// ensure the listener is only registered once per app process lifetime. The
// captured URL is also stored on `global` so it survives module re-evaluation.

type WarmStartGlobal = typeof global & {
  __wsnInitialized?: boolean;
  __wsnCapturedUrl?: string | null;
};

const g = global as WarmStartGlobal;

if (!g.__wsnInitialized) {
  g.__wsnInitialized = true;
  g.__wsnCapturedUrl = null;

  Linking.addEventListener("url", ({ url }) => {
    // Store the raw URL without logging — it may contain tokens in the hash
    // fragment. The auth/callback screen logs a safe redacted version.
    g.__wsnCapturedUrl = url;
  });

  console.log("[warmStartUrl] listener initialized — ready to capture warm-start URLs");
}

/**
 * Return and clear the last captured deep-link URL.
 * Returns null if no URL has been captured since the last call.
 * Calling this consumes the URL so old magic links are never reused.
 */
export function takeCapturedUrl(): string | null {
  const url = g.__wsnCapturedUrl ?? null;
  g.__wsnCapturedUrl = null;
  return url;
}

/**
 * Peek at whether a URL is currently captured, without consuming it.
 * Used by the callback screen's wait loop.
 */
export function hasCapturedUrl(): boolean {
  return !!g.__wsnCapturedUrl;
}
