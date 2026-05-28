import { Platform } from "react-native";

let initialized = false;

/**
 * Request iOS App Tracking Transparency permission.
 *
 * The react-native-fbsdk-next SDK has been removed — its podspec requires
 * FBSDKCoreKit ~> 18.0 which does not exist in the CocoaPods registry
 * (latest available is v11.x), making it impossible to build in Expo
 * managed workflow.
 *
 * iOS app install attribution for Meta Ads is handled by Apple's
 * SKAdNetwork framework automatically. When a user installs the app after
 * clicking a Meta ad, Apple sends a privacy-preserving postback to Meta.
 * This requires no SDK code — only the SKAdNetworkItems entries in
 * Info.plist (see app.json ios.infoPlist.SKAdNetworkItems).
 *
 * Granting ATT improves the quality and win rate of those postbacks.
 */
export async function initMetaTracking(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (Platform.OS !== "ios") return;

  try {
    const { requestTrackingPermissionsAsync } = await import(
      "expo-tracking-transparency"
    );
    await requestTrackingPermissionsAsync();
  } catch (err) {
    console.warn("[MetaTracking] ATT request failed silently:", err);
  }
}
