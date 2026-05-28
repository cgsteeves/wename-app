/**
 * Expo config plugin — restrict react-native-fbsdk-next to the Core subspec only.
 *
 * react-native-fbsdk-next v13.x declares three subspecs (Core, Login, Share).
 * The Share subspec depends on FBSDKGamingServicesKit ~> 18.0, which Meta renamed
 * in their iOS SDK v17+ and is no longer available in CocoaPods at v18.0. This
 * causes `pod install` to fail with a non-zero exit code during EAS builds.
 *
 * We only use Settings and AppEventsLogger, both of which live in the Core subspec
 * (backed by FBSDKCoreKit). This plugin sets `default_subspecs` on the podspec to
 * ['Core'] before the iOS prebuild writes the Podfile, so CocoaPods never tries to
 * resolve FBSDKGamingServicesKit or FBSDKLoginKit.
 */

const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withFBSDKCoreOnly(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podspecPath = path.join(
        config.modRequest.projectRoot,
        "node_modules",
        "react-native-fbsdk-next",
        "react-native-fbsdk-next.podspec"
      );

      if (!fs.existsSync(podspecPath)) {
        console.warn(
          "[withFBSDKCoreOnly] podspec not found — skipping patch:",
          podspecPath
        );
        return config;
      }

      let contents = fs.readFileSync(podspecPath, "utf8");

      if (contents.includes("default_subspecs")) {
        return config;
      }

      contents = contents.replace(
        /s\.platforms\s*=/,
        "s.default_subspecs = ['Core']\n  s.platforms ="
      );

      fs.writeFileSync(podspecPath, contents);
      console.log("[withFBSDKCoreOnly] Patched podspec: default_subspecs = ['Core']");

      return config;
    },
  ]);
};
