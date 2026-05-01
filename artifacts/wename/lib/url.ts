/**
 * Returns the canonical base URL for the app.
 *
 * Priority:
 *  1. EXPO_PUBLIC_APP_URL env var  (e.g. "https://wename.app" in production)
 *  2. window.location.origin       (web dev / preview)
 *  3. Hard-coded production domain (native dev fallback)
 */
export function getAppUrl(): string {
  const appUrl = process.env.EXPO_PUBLIC_APP_URL;
  if (appUrl) return appUrl.replace(/\/$/, ""); // strip trailing slash

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "https://wename.app";
}
