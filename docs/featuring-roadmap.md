# MoodRx Featuring-Readiness Roadmap

**Date:** 2026-06-08
**Goal:** Maximize the odds of App Store (App of the Day / Editor's Choice) and Google
Play (Editor's Choice / "Apps we love") featuring by raising platform-integration,
accessibility, and quality — without destabilizing the launch.

**How to read this:** items are grouped into phases. Phase 0 is the near-term, launch-window
work (detailed + actionable). Phases 1–3 are the backlog, ordered roughly by
**featuring-value-per-day**. Effort is **calendar, part-time, solo**, including build/
test/review round-trips — not raw coding time.

---

## Strategic principles (why phased, not one mega-launch)

1. **Featuring is not only a launch event.** Apple and Google both routinely feature apps
   on a *notable update* ("now with a Live Activity," "new Apple Watch app"). A steady
   **monthly cadence of platform-feature updates** gives editors repeated reasons to look —
   a stronger strategy than one giant launch. Pitch each feature to App Review / Play
   editorial as it ships.
2. **Pre-launch native pile-ups slip the date and break builds.** Every native feature
   added before launch increases build risk (we already hit an EAS worker failure). Land
   the cheap, high-leverage platform signals first; hold the giants.
3. **80/20 holds hard here.** Widgets, themed icon, Android Vitals, Quick Settings tile,
   and App Intents deliver ~80% of the "shows off the platform" signal for ~20% of the
   effort. The three giant rocks — **cross-device cloud sync, Apple Watch, Wear OS** — are
   ~60% of the total effort and belong last.

## Estimating constraints (these drive the calendar more than coding)

- **Solo dev**; Claude writes code, you build/test/merge — so engineering-days stretch into
  calendar time bounded by your availability.
- **No Mac** → every iOS *native* feature (WidgetKit, Live Activity, App Intents, State of
  Mind, Watch) can only iterate via **EAS cloud build → TestFlight**, ~20–40 min/cycle,
  several cycles each. This is the single biggest tax; SwiftUI can't be previewed locally.
- **No local Android SDK** → Android also builds via EAS, but without the SwiftUI barrier it
  iterates faster.
- **Evidence confidence** is flagged per item: **[data]** = measurable / documented platform
  signal; **[pattern]** = well-established UX/retention principle; **[verify]** = needs an
  API/Expo-feasibility check before scoping.

---

## Consolidated effort × value table

| Item | Platform | Size | ~Calendar | Evidence |
|---|---|---|---|---|
| Android widget (in progress) | A | M | underway | [data] |
| iOS widget PR2 (home screen) | iOS | M | 3–5 d | [data] |
| Lock Screen / StandBy widgets | iOS | S–M | 2–4 d | [data] |
| Themed monochrome icon | A | XS | <1 d | [data] |
| Android Vitals instrumentation | A | S | 1–2 d + ongoing | [data] |
| Quick Settings tile + App Shortcuts | A | M | 3–5 d | [pattern] |
| Material You widget variant | A | S | 1–2 d | [data] |
| Actionable notifications | both | S | 2–3 d | [pattern] |
| Onboarding aha / goal capture | both | S–M | 2–4 d | [pattern] |
| Large-screen / foldable layouts | A (+iOS) | M–L | 4–7 d | [data] |
| VoiceOver / TalkBack + contrast audit | both | M | 2–4 d | [data] |
| App Intents / Siri / Control Center control | iOS | M–L | 4–6 d | [verify] |
| Live Activity / Dynamic Island (timer) | iOS | L | 1–2 wk | [verify] |
| HealthKit **State of Mind** (iOS 17+) | iOS | L | 1–2 wk | [verify] |
| Play listing A/B + Data Safety + ASO | A | S | 1–3 d (non-code) | [data] |
| **Cross-device cloud sync** (iCloud + Android) | both | XL | 2–3 wk | [pattern] |
| **Apple Watch** app + complication | iOS | XL | 2–4 wk | [pattern] |
| **Wear OS** tile + complication | A | XL | 2–4 wk | [pattern] |

**All-in total:** ~**4–6 months** part-time solo. Drop the two watches → ~**2.5–3.5 months**.
Featuring-critical subset (widgets + QS tile + themed icon + Vitals + Live Activity + App
Intents + large-screen) → ~**4–6 weeks** beyond the current widget work.

---

## Phase 0 — finish the launch story (NOW → launch)

**Target window:** ~1.5–2.5 weeks (this already slips launch modestly — accepted).
**Theme:** ship the widget on both platforms + bank the near-free Android platform signals.

- [ ] **Android home-screen widget** — *in progress* (PR #24). Streak + today's Rx, smart
      states. Blocked only on on-device verification (EAS build → install → check states).
- [ ] **iOS home-screen widget (PR 2)** — WidgetKit via `expo-apple-targets`, App Group data
      bridge, reuses the shared snapshot layer from PR #24. `systemSmall` + `systemMedium`,
      home screen only. (Spec: `docs/superpowers/specs/2026-06-07-home-screen-widget-design.md`.)
- [ ] **Themed (monochrome) adaptive icon** — add the `monochromeImage` layer so the launcher
      icon themes with the user's wallpaper on Android 13+. ~Half a day; near-free Material You
      signal. **[data]**
- [ ] **Android Vitals instrumentation** — confirm crash/ANR reporting is wired and start
      watching cold-start + frozen-frame metrics post-launch. Play *ranks* on these. Builds
      directly on the crash-hardening already done (PRs #20/#21). **[data]**
- [ ] **Actionable notifications** — add a "Log mood" action to the check-in reminder
      (one-tap re-engagement). Shared work across iOS/Android. **[pattern]**

**Exit criteria for Phase 0 / launch:** both widgets verified on real devices; themed icon
shipping; Vitals dashboard green and monitored; review prompt (PR #22) and Dynamic Type fix
(PR #23) already merged. *Launch here.*

---

## Phase 1 — cheap platform-integration wave (launch + ~3–4 weeks)

Ordered by value-per-day:

- [ ] **Quick Settings tile + App Shortcuts (Android)** — one-tap "Log mood" / "Today's Rx"
      from Quick Settings and the launcher long-press. Friction-killing + very Android.
      *Expo: needs a small native bit / config plugin.* **[verify]**
- [ ] **App Intents / Siri / Spotlight + Control Center control (iOS)** — "Hey Siri, log my
      mood"; iOS 18 Control Center "log mood" control. Apple rewards App Intents adoption.
      *Expo: likely custom native module.* **[verify]**
- [ ] **Lock Screen / StandBy widgets (iOS)** — glanceable streak; a small increment on the
      Phase 0 iOS widget. Arguably higher daily value than the home-screen widget. **[data]**
- [ ] **Onboarding aha + goal capture** — pull a lightweight "what do you want from this?" and
      a fast first win earlier. You already have a guided first session to build on. **[pattern]**
- [ ] **Accessibility audit (VoiceOver / TalkBack + contrast)** — verify mood accent colors
      clear WCAG contrast on `#0a0a0a` and the full flow is screen-reader navigable. A hard
      featuring prerequisite on both stores. **[data]**
- [ ] **Material You widget variant (Android)** — optional dynamic-color tint on the widget
      only (keep the in-app brand dark/controlled). "Respects the system" signal. **[data]**
- [ ] **Play Store conversion levers (non-code)** — store-listing A/B experiments, custom
      store listings, Data Safety section, long-description ASO. Measurable install-conversion
      wins independent of the app. **[data]**

---

## Phase 2 — mid-lift featuring magnets (month 2–3, ~4–6 weeks)

- [ ] **Live Activity / Dynamic Island (iOS)** — surface the active workout/breathing timer on
      the Lock Screen + Dynamic Island. Marquee iOS feature; near-perfect fit since the timers
      already exist. *Expo: ActivityKit via a widget extension — verify approach.* **[verify]**
- [ ] **HealthKit State of Mind (iOS 17+)** — write mood check-ins to Apple Health's native
      mood/emotion type. The most differentiated, most Apple-aligned thing a *mood* app can do.
      *Expo: verify whether the current HealthKit lib exposes `HKStateOfMind`; likely custom
      native.* **[verify]**
- [ ] **Large-screen / foldable layouts** — you're portrait-locked; Google runs a distinct
      large-screen quality tier + foldables featuring track. Responsive layouts + landscape on
      large screens move you into it. **[data]**
- [ ] **Cross-device cloud sync (the long pole)** — a unified backend (e.g. Supabase/Firebase/
      CloudKit) so a new phone doesn't wipe the streak. Streak loss is a top churn + 1-star
      driver. Unlocks the watches and multi-device. ~2–3 weeks on its own. **[pattern]**

> Note: Android has **no Health Connect analog to iOS State of Mind** yet, so that play is
> iOS-only. Android's glanceability story stays widgets + QS tile + (later) Wear tiles.

## Phase 3 — the giants (month 3–6, ~4–8 weeks combined)

- [ ] **Apple Watch app + complication** — glanceable mood log + breathing + streak
      complication. Effectively its own small app; brutal to iterate without a Mac. **[pattern]**
- [ ] **Wear OS tile + complication** — the Android-watch analog. **[pattern]**

---

## Cross-platform asymmetries (don't assume symmetry)

- **No Android twin for Live Activity / Dynamic Island** — closest analog is an ongoing/
  foreground notification (Android 16 "Live Updates" is still nascent).
- **No Health Connect "State of Mind"** — Android's mental-wellbeing data model is thinner,
  so the marquee iOS mood-logging play doesn't port.
- **No iOS-style system Lock Screen widgets on Android** — Android glanceability = home-screen
  widgets + Quick Settings tile + (later) Wear tiles.

## Already shipped (featuring-readiness, this work cycle)

- In-app review prompt at positive moments — PR #22 (merged).
- Dynamic Type / font-scaling accessibility fix — PR #23 (merged).
- Android home-screen widget + shared data layer — PR #24 (open, verifying on-device).
- Prior: crash-hardening (PRs #20/#21), IP cleanup, audit backlog.
