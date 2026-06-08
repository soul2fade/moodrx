# iOS Home-Screen Widget (PR 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the iOS home-screen widget (`systemSmall` + `systemMedium`) showing the user's streak and today's prescription, reusing the shared JS data layer built in PR 1.

**Architecture:** The shared `buildWidgetSnapshot(sessions)` / `syncWidget(sessions)` layer and the `SessionsProvider` + `AppState` triggers already exist from PR 1 and are platform-agnostic. PR 2 adds the iOS leg: `lib/widget-bridge.tsx` gains a `Platform.OS === 'ios'` branch that writes flat primitive keys into a shared **App Group** `UserDefaults` suite via `@bacons/apple-targets`' `ExtensionStorage`, then calls `ExtensionStorage.reloadWidget("MoodRxWidget")`. A SwiftUI WidgetKit target (`targets/widget/`) reads those keys in a `TimelineProvider` and renders the small/medium layouts. No business logic is recomputed natively — the app precomputes the mood display name and brand hex color into the snapshot.

**Tech Stack:** Expo SDK 54, React Native (new architecture), `@bacons/apple-targets` (WidgetKit target via config plugin + `ExtensionStorage` data bridge), SwiftUI / WidgetKit.

**Verification note:** This repo has no unit-test runner; every change is verified with `npm run typecheck` and `npm run lint:ci` (0-warning baseline). The Swift target and the App Group bridge can only be exercised on a real iOS build, which requires an **EAS cloud build → TestFlight/device** (no Mac available locally). Commit trailer for every commit: `Co-Authored-By: Claude <noreply@anthropic.com>`. Do not stage `.claude/settings.local.json` or `docs/moodrx-youtube-ep1-script.docx`.

**Reference spec:** `docs/superpowers/specs/2026-06-07-home-screen-widget-design.md`

---

## Key implementation decision: booleans are stored as 0/1 Ints

The spec called for flat `Bool` keys read via typed `UserDefaults` accessors. `@bacons/apple-targets`' `ExtensionStorage.set` only bridges `number → setInt`, `string → setString`, and `object/array → setObject` (JSON) — **there is no `setBool`**, and a JS boolean would route to `setObject`, whose native signature (`[String: Any]`) rejects a scalar. So `checkedInToday` / `hasSessions` are written as `0/1` Ints and read in Swift with `UserDefaults.bool(forKey:)` (a stored Int `1` reads as `true`). This preserves the spec's intent (typed access, no JSON decoding) within the library's real API. Verified against `node_modules/@bacons/apple-targets/build/ExtensionStorage.js` and `ios/ExtensionStorageModule.swift`.

---

## File structure

- Modify `app.json` — add `@bacons/apple-targets` plugin (auto-added by `expo install`) + `ios.entitlements["com.apple.security.application-groups"] = ["group.com.moodrx.app"]`.
- Create `targets/widget/expo-target.config.js` — `type: "widget"`, App Group entitlement (reused from the app), brand colors, `deploymentTarget: "17.0"`.
- Create `targets/widget/index.swift` — SwiftUI WidgetKit target: `TimelineProvider` reading flat keys, small/medium views, `@main WidgetBundle`.
- Modify `lib/widget-bridge.tsx` — add the iOS branch writing the keys via `ExtensionStorage` + `reloadWidget`.
- Modify `package.json` / `package-lock.json` — `@bacons/apple-targets` dependency.

---

## Task 1: Install the library + entitlements (DONE)

- [x] `npx expo install @bacons/apple-targets` (adds dep, auto-appends the plugin to `app.json`).
- [x] Add `ios.entitlements["com.apple.security.application-groups"] = ["group.com.moodrx.app"]` to `app.json`.
- [x] `npm run typecheck` + `npm run lint:ci` → clean.

## Task 2: Widget target config (DONE)

- [x] Create `targets/widget/expo-target.config.js` (`type: "widget"`, `name: "MoodRxWidget"`, `displayName: "MoodRx"`, `deploymentTarget: "17.0"`, `frameworks: ["SwiftUI", "WidgetKit"]`, App Group entitlement reused via `config.ios.entitlements`, `colors: { $widgetBackground: "#0a0a0a", $accent: "#ffffff" }`).

## Task 3: SwiftUI widget (DONE)

- [x] Create `targets/widget/index.swift`:
  - `MoodRxEntry: TimelineEntry` with `streak`, `checkedInToday`, `hasSessions`, `moodName`, `moodColor`, `workoutName`, `durationMin`; `accent` derived from `moodColor` (default white).
  - `Provider: TimelineProvider` reads `UserDefaults(suiteName: "group.com.moodrx.app")` with typed accessors; timeline refresh policy `.after(next 00:01)` as the day-rollover safety net (the app pushes reloads otherwise).
  - States: new user → "Log your first mood →"; checked-in → "✓ DONE TODAY"; otherwise streak hero (muted "START A NEW STREAK" when streak is 0). `systemSmall` = streak + compact today line; `systemMedium` = streak hero left, today's Rx right.
  - `.containerBackground(#0a0a0a)`, `.widgetURL("moodrx://home")`, `.supportedFamilies([.systemSmall, .systemMedium])`, `.contentMarginsDisabled()`.
  - `@main MoodRxWidgetBundle`; `Color(hex:)` helper.

## Task 4: iOS bridge (DONE)

- [x] In `lib/widget-bridge.tsx`, add a `Platform.OS === 'ios'` branch → `writeWidgetSnapshotIOS` writing all seven keys (booleans as `0/1`, empty/zero fallbacks when `today` is null) then `ExtensionStorage.reloadWidget("MoodRxWidget")`.
- [x] `npm run typecheck` + `npm run lint:ci` → clean.

## Task 5: Build + verify on device (REQUIRES MAC-FREE EAS / USER)

- [ ] **Set `ios.appleTeamId`** in `app.json` (or confirm EAS-managed credentials inject it). `@bacons/apple-targets` warns and the widget target may fail to code-sign without it. This is the one value not derivable from the repo.
- [ ] Register the App Group `group.com.moodrx.app` in the Apple Developer account (EAS manages provisioning, but the group must exist).
- [ ] Commit (eas.json has `requireCommit: true`), then `eas build --profile development --platform ios` (or `preview`) → install via TestFlight/device.
- [ ] Verify states on the home screen:
  - New user (reset data): "Log your first mood →".
  - Streak, not checked in: small shows streak hero + "TODAY: <mood>"; medium shows streak hero + TODAY mood/duration + workout name in the mood color.
  - After logging today: "✓ DONE TODAY".
  - Tap → app opens at home (`moodrx://home`).
  - Day rollover: streak/today's Rx update on next foreground (app push) and after midnight (timeline policy).

---

## Deferred follow-ups (not in this PR)

- iOS Lock Screen / StandBy accessory widgets (`accessoryCircular`/`accessoryRectangular`).
- Purpose-designed widget gallery preview.
- Brand font bundled into the widget (currently system font).
- Interactive widget controls (iOS 18 controls, App Intents).
