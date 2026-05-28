import { Platform } from "react-native";
import { AppEventsLogger, Settings } from "react-native-fbsdk-next";

let initialized = false;

/**
 * Initialize Meta/Facebook SDK and request ATT permission on iOS.
 * Safe to call on all platforms — no-ops on web/Android gracefully.
 * Must be called after the app UI is ready (post-splash) so the ATT
 * dialog appears at a sensible moment and is not blocked by the OS.
 */
export async function initMetaTracking(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (Platform.OS === "web") return;

  try {
    Settings.initializeSDK();

    if (Platform.OS === "ios") {
      const { requestTrackingPermissionsAsync } = await import(
        "expo-tracking-transparency"
      );
      const { status } = await requestTrackingPermissionsAsync();
      const granted = status === "granted";
      if (typeof Settings.setAdvertiserTrackingEnabled === "function") {
        Settings.setAdvertiserTrackingEnabled(granted);
      }
    }

    AppEventsLogger.logEvent("fb_mobile_activate_app");
  } catch (err) {
    console.warn("[MetaTracking] initialization failed silently:", err);
  }
}
