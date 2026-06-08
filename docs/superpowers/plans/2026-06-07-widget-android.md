# Android Home-Screen Widget (PR 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an Android home-screen widget showing the user's streak and today's prescription, plus the shared JS data layer (reused by the iOS widget in PR 2).

**Architecture:** The app computes a small precomputed `WidgetSnapshot` from the persisted sessions (`lib/widget.ts`) and pushes it to the widget through a platform bridge (`widget-bridge.android.tsx` renders the JSX widget via `requestWidgetUpdate`; the default `widget-bridge.ts` is a no-op for iOS/web until PR 2). A headless `widgetTaskHandler` re-derives the snapshot from AsyncStorage when Android fires widget lifecycle events. Sync is triggered centrally from `SessionsProvider` (on sessions change + on app foreground for day rollover).

**Tech Stack:** Expo SDK 54, React Native (new architecture), `react-native-android-widget` (JSX widget UI, no Kotlin), AsyncStorage.

**Verification note:** This repo has no unit-test runner; per the project's working conventions every change is verified with `npm run typecheck` and `npm run lint:ci` (0-warning baseline). The widget itself can only be exercised on a real Android build, covered by the final verification task. Commit trailer for every commit: `Co-Authored-By: Claude <noreply@anthropic.com>`. Do not stage `.claude/settings.local.json` or `docs/moodrx-youtube-ep1-script.docx`.

**Reference spec:** `docs/superpowers/specs/2026-06-07-home-screen-widget-design.md`

---

## File structure

- Create `lib/widget.ts` — `WidgetSnapshot` type, pure `buildWidgetSnapshot(sessions)`, guarded `syncWidget(sessions)`.
- Create `lib/widget-bridge.ts` — default/web/iOS no-op bridge (`writeWidgetSnapshot`).
- Create `lib/widget-bridge.android.tsx` — Android bridge using `requestWidgetUpdate`.
- Create `components/widgets/MoodRxWidget.tsx` — the JSX widget UI (states + small/medium layout).
- Create `lib/widget-task-handler.tsx` — headless handler for Android widget lifecycle events.
- Create `index.js` — custom entry that registers the task handler (Android only) then loads `expo-router/entry`.
- Modify `package.json` — `main` → `index.js`.
- Modify `app.json` — add the `react-native-android-widget` config plugin.
- Modify `contexts/SessionsContext.tsx` — trigger `syncWidget` on sessions change + app foreground.

---

## Task 1: Install the library and register the config plugin

**Files:**
- Modify: `package.json` (via installer)
- Modify: `app.json`

- [ ] **Step 1: Install the SDK-compatible version**

Run:
```bash
npx expo install react-native-android-widget
```
Expected: adds `react-native-android-widget` to `package.json` dependencies (a `~`-pinned version compatible with SDK 54).

- [ ] **Step 2: Add the config plugin to `app.json`**

In `app.json`, inside `expo.plugins`, add this entry as the last element of the array (after the `expo-build-properties` entry). Keep the surrounding array valid (add a comma after the previous element):

```json
[
  "react-native-android-widget",
  {
    "widgets": [
      {
        "name": "MoodRxWidget",
        "label": "MoodRx",
        "description": "Your streak and today's prescription",
        "minWidth": "110dp",
        "minHeight": "110dp",
        "targetCellWidth": 2,
        "targetCellHeight": 2,
        "maxResizeWidth": "250dp",
        "maxResizeHeight": "180dp",
        "previewImage": "./assets/images/icon.png",
        "resizeMode": "horizontal|vertical",
        "updatePeriodMillis": 0
      }
    ]
  }
]
```

Note: `previewImage` points to the existing app icon as a placeholder for v1. A purpose-designed widget preview is a deferred follow-up (see plan footer).

- [ ] **Step 3: Verify typecheck and lint still pass**

Run:
```bash
npm run typecheck
npm run lint:ci
```
Expected: both exit 0 (no output / no errors).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "chore(widget): add react-native-android-widget + plugin config

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Shared data layer — `WidgetSnapshot`, builder, sync

**Files:**
- Create: `lib/widget.ts`
- Create: `lib/widget-bridge.ts`

- [ ] **Step 1: Create the default no-op bridge `lib/widget-bridge.ts`**

```ts
import type { WidgetSnapshot } from './widget';

// Default bridge for web and iOS (until the iOS bridge lands in PR 2).
// The Android implementation lives in widget-bridge.android.tsx and is
// selected automatically by Metro's platform-extension resolution.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function writeWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  // no-op
}
```

- [ ] **Step 2: Create `lib/widget.ts`**

```ts
import type { Session } from './storage';
import { getStreak, hasSessionToday } from './storage';
import { buildWeeklyPrescription } from './analytics';
import { MOODS } from './moods';
import { writeWidgetSnapshot } from './widget-bridge';

/** Precomputed, native-friendly snapshot of what the widget renders. Mood
 *  name + brand color are resolved here so the widget never needs the MOODS
 *  map. Shared by Android (rendered in JS) and iOS (written to App Group). */
export interface WidgetSnapshot {
  streak: number;
  checkedInToday: boolean;
  hasSessions: boolean;          // false → "log your first mood" state
  today: {
    moodName: string;            // e.g. "Anxious"
    moodColor: string;           // e.g. "#E8B84B"
    workoutName: string;
    durationMin: number;
  } | null;
  updatedAt: number;             // unix ms
}

/** Pure: derive the widget snapshot from the session history. Must stay
 *  self-sufficient — the Android headless task handler calls this with
 *  sessions loaded straight from AsyncStorage. */
export function buildWidgetSnapshot(sessions: Session[]): WidgetSnapshot {
  const plan = buildWeeklyPrescription(sessions);
  const todayIdx = new Date().getDay();
  const todayRx = plan.find((d) => d.dayIndex === todayIdx) ?? null;
  return {
    streak: getStreak(sessions),
    checkedInToday: hasSessionToday(sessions),
    hasSessions: sessions.length > 0,
    today: todayRx
      ? {
          moodName: MOODS[todayRx.mood].name,
          moodColor: MOODS[todayRx.mood].color,
          workoutName: todayRx.workoutName,
          durationMin: todayRx.duration,
        }
      : null,
    updatedAt: Date.now(),
  };
}

/** Build + push the snapshot to the platform widget. Fully guarded so a
 *  widget failure can never break the app flow. No-op on web/iOS (PR 1). */
export async function syncWidget(sessions: Session[]): Promise<void> {
  try {
    await writeWidgetSnapshot(buildWidgetSnapshot(sessions));
  } catch (e) {
    console.warn('[MoodRx] syncWidget failed:', e);
  }
}
```

- [ ] **Step 3: Verify typecheck and lint**

Run:
```bash
npm run typecheck
npm run lint:ci
```
Expected: both exit 0. (If lint flags the unused `snapshot` param in the no-op despite the disable comment, rename it to `_snapshot` and remove the disable comment.)

- [ ] **Step 4: Commit**

```bash
git add lib/widget.ts lib/widget-bridge.ts
git commit -m "feat(widget): shared WidgetSnapshot builder + sync entrypoint

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Widget UI component

**Files:**
- Create: `components/widgets/MoodRxWidget.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetSnapshot } from '@/lib/widget';

const BG = '#0a0a0a';
const FG = '#ffffff';
const MUTED = '#888888';
const ACCENT_DEFAULT = '#ffffff';

// Android delivers the current pixel width in widgetInfo; anything at/above
// this is treated as the "medium" layout that also shows today's Rx.
const MEDIUM_MIN_WIDTH = 200;

export function MoodRxWidget({
  snapshot,
  width,
}: {
  snapshot: WidgetSnapshot;
  width: number;
}) {
  const accent = snapshot.today?.moodColor ?? ACCENT_DEFAULT;
  const isMedium = width >= MEDIUM_MIN_WIDTH;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: BG,
        borderRadius: 20,
        padding: 16,
      }}
      accessibilityLabel="MoodRx streak and today's prescription"
    >
      {!snapshot.hasSessions ? (
        <TextWidget
          text="Log your first mood →"
          style={{ fontSize: 16, fontWeight: 'bold', color: FG }}
          maxLines={2}
        />
      ) : (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
          <TextWidget
            text={String(snapshot.streak)}
            style={{ fontSize: 44, fontWeight: 'bold', color: accent }}
          />
          <TextWidget
            text="DAY STREAK"
            style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 2, color: MUTED, marginTop: 2 }}
          />

          {snapshot.checkedInToday && (
            <TextWidget
              text="✓ DONE TODAY"
              style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 1, color: accent, marginTop: 10 }}
            />
          )}

          {!snapshot.checkedInToday && snapshot.today && isMedium && (
            <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', marginTop: 12 }}>
              <TextWidget
                text="TODAY"
                style={{ fontSize: 10, fontWeight: 'bold', letterSpacing: 2, color: MUTED }}
              />
              <TextWidget
                text={`${snapshot.today.moodName} · ${snapshot.today.durationMin} MIN`}
                style={{ fontSize: 13, color: FG, marginTop: 2 }}
                maxLines={1}
                truncate="END"
              />
              <TextWidget
                text={snapshot.today.workoutName}
                style={{ fontSize: 14, fontWeight: 'bold', color: accent, marginTop: 2 }}
                maxLines={1}
                truncate="END"
              />
            </FlexWidget>
          )}

          {!snapshot.checkedInToday && snapshot.today && !isMedium && (
            <TextWidget
              text={`TODAY: ${snapshot.today.moodName}`}
              style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 1, color: MUTED, marginTop: 10 }}
              maxLines={1}
              truncate="END"
            />
          )}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
```

Note: v1 uses the system font (no `fontFamily`). Bundling the brand font into the widget is a deferred follow-up (see plan footer).

- [ ] **Step 2: Verify typecheck and lint**

Run:
```bash
npm run typecheck
npm run lint:ci
```
Expected: both exit 0. (If lint objects to the `'use no memo'` directive, keep it — it is required by the library to stop the React Compiler injecting hooks into the widget render; add an `eslint-disable` only if a specific rule errors.)

- [ ] **Step 3: Commit**

```bash
git add components/widgets/MoodRxWidget.tsx
git commit -m "feat(widget): MoodRx widget UI with streak + today's Rx states

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Android bridge

**Files:**
- Create: `lib/widget-bridge.android.tsx`

- [ ] **Step 1: Create the Android bridge**

```tsx
import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { MoodRxWidget } from '@/components/widgets/MoodRxWidget';
import type { WidgetSnapshot } from './widget';

const WIDGET_NAME = 'MoodRxWidget';

// Android selects this file over widget-bridge.ts via Metro's platform
// extension resolution. Re-renders every on-screen MoodRxWidget instance
// with the latest snapshot; widgetInfo.width drives the small/medium layout.
export async function writeWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  await requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: (info) => <MoodRxWidget snapshot={snapshot} width={info.width} />,
    widgetNotFound: () => {
      // No widget on the home screen — nothing to update.
    },
  });
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run:
```bash
npm run typecheck
npm run lint:ci
```
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/widget-bridge.android.tsx
git commit -m "feat(widget): Android bridge via requestWidgetUpdate

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Headless task handler + entry registration

**Files:**
- Create: `lib/widget-task-handler.tsx`
- Create: `index.js`
- Modify: `package.json` (`main`)

- [ ] **Step 1: Create the task handler**

```tsx
import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { getSessions } from '@/lib/storage';
import { buildWidgetSnapshot } from '@/lib/widget';
import { MoodRxWidget } from '@/components/widgets/MoodRxWidget';

const WIDGET_NAME = 'MoodRxWidget';

// Headless handler for Android widget lifecycle events. Runs outside the React
// tree, so it re-derives the snapshot directly from AsyncStorage rather than
// from app state. OPEN_APP clicks are handled natively — no JS work needed.
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  if (props.widgetInfo.widgetName !== WIDGET_NAME) return;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const sessions = await getSessions();
      const snapshot = buildWidgetSnapshot(sessions);
      props.renderWidget(<MoodRxWidget snapshot={snapshot} width={props.widgetInfo.width} />);
      break;
    }
    default:
      break;
  }
}
```

- [ ] **Step 2: Create the custom entry `index.js`**

```js
import 'expo-router/entry';
import { Platform } from 'react-native';

// Register the Android widget task handler. Lazily required behind a platform
// check so the Android-only native module is never loaded on iOS or web.
if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./lib/widget-task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
```

- [ ] **Step 3: Point `package.json` `main` at the custom entry**

In `package.json`, change:
```json
"main": "expo-router/entry",
```
to:
```json
"main": "index.js",
```

- [ ] **Step 4: Verify typecheck and lint**

Run:
```bash
npm run typecheck
npm run lint:ci
```
Expected: both exit 0. (`index.js` is outside the lint globs; that's fine.)

- [ ] **Step 5: Commit**

```bash
git add lib/widget-task-handler.tsx index.js package.json
git commit -m "feat(widget): headless task handler + entry registration

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Trigger sync from SessionsProvider

**Files:**
- Modify: `contexts/SessionsContext.tsx`

- [ ] **Step 1: Add imports**

At the top of `contexts/SessionsContext.tsx`, add `useRef` to the React import and add the new imports:

Change:
```tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
```
to:
```tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
```

And add after the existing storage import block:
```tsx
import { syncWidget } from '@/lib/widget';
```

- [ ] **Step 2: Add the sync effects**

Inside `SessionsProvider`, immediately after the existing initial-load effect:
```tsx
  useEffect(() => {
    refresh();
  }, [refresh]);
```
add:
```tsx
  // Keep the home-screen widget in sync. The sessions effect covers load,
  // add, and clear; the AppState listener covers day rollover (streak /
  // today's Rx change at midnight while the app was backgrounded). No-op on
  // platforms without a widget bridge.
  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
    void syncWidget(sessions);
  }, [sessions]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncWidget(sessionsRef.current);
    });
    return () => sub.remove();
  }, []);
```

- [ ] **Step 3: Verify typecheck and lint**

Run:
```bash
npm run typecheck
npm run lint:ci
```
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add contexts/SessionsContext.tsx
git commit -m "feat(widget): sync widget on sessions change + app foreground

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Build and verify on a real Android device/emulator

**Files:** none (verification only)

- [ ] **Step 1: Produce an Android build**

Either a local run (requires Android SDK / a connected device or emulator):
```bash
npx expo run:android
```
or an EAS development build:
```bash
eas build --profile development --platform android
```
Expected: build succeeds; the config plugin generates the AppWidgetProvider native files (the build log mentions `MoodRxWidget`). If the build fails on the new architecture, check the installed `react-native-android-widget` version's SDK-54 / new-arch compatibility before proceeding.

- [ ] **Step 2: Add the widget and verify states**

On the device home screen, long-press → Widgets → MoodRx → drag the widget out. Verify:
  - **New user (no sessions):** shows "Log your first mood →".
  - **With a streak, not checked in today:** small size shows the streak hero + "TODAY: <mood>"; resize to medium shows the streak + TODAY mood/duration + workout name in the mood color.
  - **After logging a session today:** widget updates to show "✓ DONE TODAY" (open the app, complete a session, return to the home screen).
  - **Reset all data (Settings):** widget returns to the "Log your first mood →" state.

- [ ] **Step 3: Verify tap + rollover**

  - Tap the widget → the app opens.
  - Day rollover: change the device date forward a day, foreground the app, return to the home screen → streak/today's Rx reflect the new day.

- [ ] **Step 4: Final clean check**

Run:
```bash
npm run typecheck
npm run lint:ci
```
Expected: both exit 0.

---

## Self-review (completed)

- **Spec coverage:** snapshot data layer (Task 2) ✓; Android JSX widget + small/medium + states (Task 3) ✓; bridge via `requestWidgetUpdate` (Task 4) ✓; headless handler reading AsyncStorage (Task 5) ✓; SessionsProvider + AppState triggers (Task 6) ✓; plugin config + sizes + preview + `updatePeriodMillis: 0` (Task 1) ✓; tap → open app (Task 3 `clickAction="OPEN_APP"`) ✓; build/verify on device (Task 7) ✓. iOS pieces are intentionally PR 2.
- **Type consistency:** `WidgetSnapshot` (defined Task 2) is consumed identically in Tasks 3/4/5; `writeWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void>` matches across the default and `.android.tsx` bridges; `MoodRxWidget` always receives `{ snapshot, width }`; widget name string `"MoodRxWidget"` is identical in `app.json`, the bridge, and the handler.
- **Placeholder scan:** no TBD/TODO; every code step contains complete code.

## Deferred follow-ups (not in this PR)

- Purpose-designed widget preview image (currently the app icon placeholder).
- Brand font bundled into the widget (currently system font).
- Optional deep link to today's prescription via `OPEN_URI` instead of `OPEN_APP`.
- WorkManager-based midnight refresh for when the app isn't opened across rollover.
