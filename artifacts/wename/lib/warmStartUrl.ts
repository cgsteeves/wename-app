import * as Linking from "expo-linking";

// ─── Warm-start URL capture ────────────────────────────────────────────────────
//
// Problem: On a warm start (app in background), the Linking `url` event fires
// and Expo Router navigates to auth/callback BEFORE the screen component
// mounts. By the time the screen's useEffect attaches its own addEventListener,
// the event is gone and getInitialURL() returns null — the URL is lost.
//
// Fix: Capture every incoming deep-link URL at module level here. _layout.tsx
// imports this file early (side-effect import), so the listener is active
// before any navigation can occur. The auth/callback screen calls
// takeCapturedUrl() when getInitialURL() returns null to recover the URL.

let _capturedUrl: string | null = null;

Linking.addEventListener("url", ({ url }) => {
  // Store the most recent URL. The auth/callback screen consumes it once.
  _capturedUrl = url;
});

/**
 * Return and clear the last captured deep-link URL.
 * Returns null if no URL has been captured since the last call.
 */
export function takeCapturedUrl(): string | null {
  const url = _capturedUrl;
  _capturedUrl = null;
  return url;
}
