# MoodRx Android widget — graceful space-fill design

**Date:** 2026-06-08
**Status:** Approved (cosmetic polish, low priority)
**Touches:** `components/widgets/MoodRxWidget.tsx`, `lib/widget-task-handler.tsx`, `lib/widget-bridge.tsx`

## Problem

When the Android home-screen widget (`react-native-android-widget`) is stretched
to a large/square size, content clusters at the top-left and leaves large dead
space — most visible in the "✓ DONE TODAY" and streak-only states. The
not-checked-in medium state already looks balanced because it uses
`justifyContent: 'space-between'`; the centered states do not.

## Root cause (verified in library source)

`FlexWidget` compiles to an Android `LinearLayout`
(`node_modules/react-native-android-widget/lib/module/widgets/FlexWidget.js`):

- `flex: n` → Android `layout_weight`. **This is the only reliable
  space-distribution primitive.**
- `justifyContent` / `alignItems` → a single `gravity` bitmask. Gravity only
  nudges the whole child block when there is slack, and does not honor centering
  consistently on the widget root.
- `space-between` / `space-around` / `space-evenly` work because the library
  **injects real `flex:1` spacer children**: `space-between` inserts spacers
  *between* children only; `space-around`/`space-evenly` also add spacers before
  the first and after the last child (reliable centering).
- `widgetInfo.height` (and the `renderWidget({ width, height })` callback) expose
  the widget's pixel height, but the component currently receives only `width`,
  so it cannot adapt vertically at all.

## Design

Build every state on weighted spacers instead of gravity.

1. **Thread `height` through.** Add a `height: number` prop to `MoodRxWidget`;
   pass `widgetInfo.height` from `widget-task-handler.tsx` and `info.height` from
   `widget-bridge.tsx`.

2. **Size breakpoints.**
   - `isMedium = width >= 200` (unchanged — gates today's full Rx block).
   - `isLarge = height >= 200` (new — gates typography scale-up).

3. **Two-zone fill for has-sessions states.** A `RootColumn` with
   `justifyContent: 'space-between'` containing exactly two children:
   - **Top zone (always):** streak number + `DAY STREAK`.
   - **Bottom zone (state-dependent):**
     - `checkedInToday` → `✓ DONE TODAY`
     - `!checkedIn && today && isMedium` → `TODAY` block (label / mood·duration / workout)
     - `!checkedIn && today && !isMedium` → compact `TODAY: <mood>`
   The injected weighted spacer fills the middle, so the streak pins to the top
   and the status/Rx pins to the bottom at every size.

4. **Reliable centering for single-content states.** When there is no bottom
   zone — the new-user line, and the rare broken-streak-with-no-Rx case — use a
   `RootColumn` with `justifyContent: 'space-around'` and one child, so the
   library brackets it with spacers and it centers vertically.

5. **Typography scales on large.** Streak number `44 → 64`; new-user line
   `16 → 20` when `isLarge`. A stretched square reads as intentionally full.

6. **Spacing cleanup.** Inter-block separation that previously used `marginTop`
   (e.g. on `✓ DONE TODAY`, the today block, the compact today line) now comes
   from the spacer, so those margins are dropped.

Horizontal alignment is unchanged: the streak number stays left-aligned. The
complaint was vertical dead space, not horizontal.

## Non-goals / YAGNI

- No horizontal re-centering — preserves the established left-aligned look.
- No per-size font ramp beyond a single `isLarge` step.
- No in-repo `WidgetPreview` harness in this change (offered as optional
  follow-up). Visual verification remains the library `WidgetPreview` component
  or an EAS preview build, as the change cannot be eyeballed without rendering.

## Verification

- `npm run typecheck` — clean.
- `npm run lint:ci` — 0 warnings (existing `local/no-small-fontsize-without-lineheight`
  disable block retained for the small bold labels).
- Visual: on-device / `WidgetPreview` across small, medium, large/square for
  new-user, active streak, DONE TODAY, broken streak.
