import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: "notgood18",
  slug: "moodrx",
  name: "MoodRx",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "moodrx",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  extra: {
    eas: {
      projectId: "856c4912-709e-4132-9028-49d55e06e6b5",
    },
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.moodrx.app",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSUserNotificationsUsageDescription: "MoodRx uses notifications to remind you of your daily mood check-in and workouts.",
    },
  },
  android: {
    package: "com.moodrx.app",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#0a0a0a",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-web-browser",
    [
      "expo-notifications",
      {
        icon: "./assets/images/icon.png",
        color: "#0a0a0a",
        sounds: [],
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 280,
        resizeMode: "contain",
        backgroundColor: "#0a0a0a",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});