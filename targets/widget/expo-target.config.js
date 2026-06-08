/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "MoodRxWidget",
  displayName: "MoodRx",
  // SwiftUI containerBackground (full-bleed widget background) requires iOS 17+.
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit"],
  // Reuse the same App Group declared on the main app (app.json → ios.entitlements)
  // so the widget reads the UserDefaults suite the app writes to.
  entitlements: {
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
  // Brand colors. $widgetBackground is referenced by WidgetKit; the mood accent
  // is resolved per-render from the snapshot's precomputed hex.
  colors: {
    $widgetBackground: "#0a0a0a",
    $accent: "#ffffff",
  },
});
