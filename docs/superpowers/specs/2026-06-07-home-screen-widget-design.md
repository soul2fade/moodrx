# MoodRx Home-Screen Widget — Design Spec

**Date:** 2026-06-07
**Status:** Approved (design); ready for implementation planning
**Goal:** Ship an iOS + Android home-screen widget showing the user's streak and
today's prescription. This is the headline "shows off the platform" build for
App Store / Play Store featuring readiness.

## Decisions (locked with the user)

- **Timing:** Launch-blocking. The user is willing to delay launch to get it
  right, so quality takes priority over the ~1-week launch window.
- **Platform order:** Android first (PR 1), iOS second (PR 2). The shared
  JS data layer is built in PR 1 and reused by iOS.
- **Content:** Streak + today's prescription with smart states.
  - small size = streak hero (big number + `DAY STREAK`, mood-colored)
  - medium size = streak + today's Rx (mood + workout name + duration)
  - states: "checked in today" confirmation; "start your first session" for new
    users
  - tapping the widget deep-links into the app
- **iOS scope:** Home screen only for v1 (`systemSmall` + `systemMedium`).
  Lock Screen / StandBy accessory widgets are a deferred fast-follow.
- **Libraries (validated against current docs via context7):**
  - iOS: `@bacons/apple-targets` (expo-apple-targets) — WidgetKit target +
    `ExtensionStorage` data bridge over a shared App Group `UserDefaults`.
  - Android: `react-native-android-widget` — widget UI authored in JSX, updated
    via `requestWidgetUpdate`. No Kotlin required.

## Architecture & data flow

The app already computes everything in JS: `getStreak(sessions)`,
`buildWeeklyPrescription(sessions)` → today's `DayRx`, and
`hasSessionToday(sessions)`. The widget never recomputes business logic — the
app writes a small **precomputed snapshot** to shared storage and asks the OS to
refresh.

```
sessions change ──► SessionsProvider effect ──► buildWidgetSnapshot(sessions)
                                                       │
                                          lib/widget.ts syncWidget()
                                              │                    │
                              widget-bridge.android.ts     widget-bridge.ios.ts
                              requestWidgetUpdate()         ExtensionStorage.set + reloadWidget()
                              (renders JSX widget)          (App Group UserDefaults → SwiftUI reads)
                                              │                    │
                              widget-bridge.ts (web/default) = no-op
```

## Shared data layer (PR 1, reused by iOS)

**`lib/widget.ts`** (platform-agnostic):

- `buildWidgetSnapshot(sessions): WidgetSnapshot` — pure function composing the
  existing helpers. **Precomputes the mood display name and brand hex color** so
  native code never needs the `MOODS` map.
- `syncWidget(sessions)` — builds the snapshot, delegates to the platform
  bridge, and is fully `try/catch`-guarded so it never throws into the app.

```ts
interface WidgetSnapshot {
  streak: number;
  checkedInToday: boolean;
  hasSessions: boolean;          // false → "start your first session" state
  today: {
    moodName: string;            // e.g. "Anxious"
    moodColor: string;           // e.g. "#..." brand color
    workoutName: string;
    durationMin: number;
  } | null;
  updatedAt: number;             // unix ms
}
```

**Triggers** (all funnel through `syncWidget`):

- `SessionsProvider`: `useEffect(() => { void syncWidget(sessions); }, [sessions])`
  — covers initial load, every add, and clear.
- An `AppState` `'active'` listener — covers **day rollover** (streak / today's
  Rx changing at midnight while the app was backgrounded).

**Platform split** via Metro platform extensions, all sharing one interface so
call sites are identical:

- `lib/widget-bridge.android.ts` — `requestWidgetUpdate` rendering the JSX widget.
- `lib/widget-bridge.ios.ts` — `ExtensionStorage.set(...)` + `reloadWidget(...)`.
- `lib/widget-bridge.ts` — default/web no-op.

## Android widget — PR 1

- `react-native-android-widget` config plugin in `app.json`: one widget
  `MoodRxWidget`, resizable, **small** (≈2×2 cells) and **medium** (≈4×2 cells)
  targets, `updatePeriodMillis: 0` (updates are pushed; app-foreground sync is
  the primary path).
- Widget UI in **JSX** (`components/widgets/MoodRxWidget.tsx`) using the
  library's `FlexWidget` / `TextWidget` primitives, dark-mode brand styling
  (`#0a0a0a` background, mono font, mood-color accent):
  - **small:** streak hero — big number + `DAY STREAK`.
  - **medium:** streak + `TODAY` mood + workout name + duration.
  - **checked-in:** confirmation treatment.
  - **new user:** "Log your first mood →".
- **Widget task handler** (registered via the plugin): on `WIDGET_ADDED` /
  `WIDGET_UPDATE`, headless JS reads sessions from AsyncStorage →
  `buildWidgetSnapshot` → render. (This is why the snapshot builder must be pure
  and self-sufficient.)
- **Tap:** `clickAction: OPEN_APP` with a `moodrx://` deep link (existing
  scheme) to home.
- A brand preview image under `assets/` for the widget picker.

## iOS widget — PR 2

- `@bacons/apple-targets` plugin + `targets/widget/expo-target.config.js`
  (`type: "widget"`, App Group `group.com.moodrx.app` entitlement, brand
  colors). The same App Group is added to the main app's entitlements.
- **SwiftUI** widget (`systemSmall` + `systemMedium`, home screen only for v1)
  with a `TimelineProvider` reading **flat primitive keys** from
  `UserDefaults(suiteName:)`:
  - `streak: Int`, `checkedInToday: Bool`, `hasSessions: Bool`,
    `moodName: String`, `moodColor: String`, `workoutName: String`,
    `durationMin: Int`.
  - Flat keys (not a JSON object) so Swift uses typed `UserDefaults` accessors
    with no decoding.
- `lib/widget-bridge.ios.ts` writes those keys via `ExtensionStorage.set` then
  `ExtensionStorage.reloadWidget("MoodRxWidget")`.
- **Tap:** `.widgetURL(URL(string: "moodrx://home"))`.
- Requires registering the App Group in the Apple Developer account (EAS manages
  provisioning, but the group must exist).

## Config / build / risk

- Both libraries require a **development or production build** (no Expo Go) and
  support the **new architecture** (already enabled; confirm pinned versions
  during planning).
- The Android PR is buildable and testable **locally on Windows**
  (`npx expo run:android` or an EAS build). The iOS PR needs an **EAS cloud
  build → TestFlight/device** to test the SwiftUI target (no Mac available).
- **Known v1 limitation:** if the app is never opened across midnight, the
  streak / today's Rx can briefly lag until the next foreground. Android
  periodic widget updates are unreliable and clamp to a 30-minute minimum;
  a WorkManager-based refresh is deferred. Documented, not blocking.
- Maintain the 0-warning lint baseline and clean typecheck on every commit.

## PR breakdown

- **PR 1 — `feat/widget-android`:** this spec doc, the shared data layer
  (`lib/widget.ts` + the three bridge files), the SessionsProvider + AppState
  triggers, the Android widget component + task handler + plugin config +
  preview asset. Verified on an Android build.
- **PR 2 — `feat/widget-ios`:** apple-targets plugin, the SwiftUI target, the
  App Group, the iOS bridge. Verified via EAS / TestFlight.

## Out of scope (v1)

- iOS Lock Screen / StandBy accessory widgets.
- WorkManager / background-fetch driven midnight refresh.
- Widget configuration screens / multiple widget variants beyond small + medium.
- Interactive widget controls (iOS 18 controls, App Intents).
