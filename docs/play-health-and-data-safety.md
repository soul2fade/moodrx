# MoodRx — Health Permissions & Data Safety (Play) + App Privacy (iOS)

**Date:** 2026-06-08
**Purpose:** Ready-to-paste answers for Google Play's **Health Connect declaration** and **Data Safety** form, plus the equivalent **App Store App Privacy** mapping. Derived from the actual code, not assumptions.

> ⚠️ **Verify before submitting:** the RevenueCat data points below depend on the vendor's current behavior — cross-check with RevenueCat's published "Google Play Data Safety" guidance. Everything else is read straight from the repo.

---

## 0. What the app actually does with data (the source of truth)

| Data | Platform | Read / Write | Used for | Leaves device? |
|---|---|---|---|---|
| **Steps** | iOS HealthKit · Android Health Connect (`Steps`) | Read | Show activity↔mood correlation in Insights | **No** — shown on-device |
| **Sleep** | iOS HealthKit · Android Health Connect (`SleepSession`) | Read | Show rest↔mood correlation in Insights | **No** |
| **Workouts** | iOS HealthKit (`Workout`) · Android (`ExerciseSession`) | Write | Save completed MoodRx workouts to the user's health store | **No** — written to the OS health store, not a MoodRx server |
| **Mindful / breathing** | iOS (`MindfulMinutes`) · Android (`ExerciseSession`) | Write | Save breathing sessions | **No** |
| **Mood check-ins & session history** | App (AsyncStorage) | — | Core app function | **No** — on-device only |
| **Purchases / subscription status** | RevenueCat | — | Manage subscription entitlement | **Yes → RevenueCat** |

**Key facts:** no accounts/login; mood + health data are processed **on-device only**; the **only** off-device transmission is purchase/subscription data to RevenueCat. Users can erase all app data in-app (Settings → reset, `lib/reset-app.ts`).

> **Crash/diagnostics:** no third-party analytics or crash SDK is bundled (CatDoes Watch was removed), so no diagnostics leave the device. The table above correctly shows no diagnostics row. OS-level crash reporting via Play Vitals / App Store Connect is aggregated by the platform and needs no privacy declaration.

---

## 1. ✅ Fixed: remove the unused `READ_EXERCISE` permission

`app.json` previously declared `android.permission.health.READ_EXERCISE`, but the code **never reads exercise data** — it only *writes* `ExerciseSession` (needs `WRITE_EXERCISE`) and reads Steps + Sleep. An undeclared-purpose / unused health permission is a common Health Connect rejection.

**Done:** `android.permission.health.READ_EXERCISE` has been removed from `app.json`. The remaining three (`READ_STEPS`, `READ_SLEEP`, `WRITE_EXERCISE`) all map to real features below.

*(A rebuild is still needed to pick up this manifest change.)*

---

## 2. Health Connect declaration — per-permission justification (paste-ready)

Google asks, per permission: what feature uses it, and confirmation you follow the Health Connect policy (no ads, no unauthorized sharing of health data).

**`READ_STEPS` (Steps — read)**
> MoodRx reads the user's daily step count from Health Connect to display how physical activity relates to their mood trends in the in-app Insights screen. Step data is read on the device, shown only to the user, and is never transmitted off the device, sold, or shared with third parties or used for advertising.

**`READ_SLEEP` (SleepSession — read)**
> MoodRx reads the user's most recent sleep duration from Health Connect to show how rest relates to their mood in the in-app Insights screen. Sleep data is read on the device, shown only to the user, and is never transmitted off the device, sold, or shared with third parties or used for advertising.

**`WRITE_EXERCISE` (ExerciseSession — write)**
> When the user completes a MoodRx workout or guided breathing session, the app writes it to Health Connect as an exercise session so their activity is reflected in their health record. MoodRx only writes these sessions; it does not read them back. No exercise data is transmitted to MoodRx servers, sold, shared, or used for advertising.

**Policy confirmations (expect checkboxes/attestations):**
- Health data is **not** used for advertising or marketing.
- Health data is **not** shared or sold to third parties.
- Health data access maps 1:1 to a user-visible feature (Insights for reads; saving sessions for the write).
- A privacy policy describing health-data handling is linked. *(Ensure your privacy policy explicitly names steps, sleep, and written workout/breathing sessions.)*
- 🔎 Have a **30–60s screen recording** ready showing: granting permission → Insights using steps/sleep → completing a workout that writes to Health Connect.

---

## 3. Play Data Safety form (paste-ready answers)

Google's definition of **"collected"** = transferred off the device. Under that definition, mood and health data are **not** collected (they stay on-device); only purchase data is.

**Does your app collect or share any required user data?** → **Yes** (purchases via RevenueCat).

**Data types — COLLECTED:**
- **Financial info → Purchase history** — Collected · **Not shared** (processor) · Purpose: **App functionality** (subscription management) · Required (for purchasers). 🔎 confirm vs RevenueCat guidance.
- 🔎 **Device or other IDs** — RevenueCat may generate/collect an app-user/device identifier. If so: Collected · Not shared · App functionality. *Verify against RevenueCat's Data Safety doc; declare only if true.*

**Data types — NOT collected (declare absent):**
- **Health & fitness** (steps, sleep, workouts) — processed **on-device only**, never transmitted → **not collected**. *(The Health Connect declaration in §2 still applies — it governs permission use, not transmission.)*
- **Personal info / mood journal / messages** — on-device only → not collected.
- **Location, contacts, photos** — not used.

**Security practices:**
- **Is data encrypted in transit?** → **Yes** (RevenueCat over HTTPS).
- **Can users request data deletion?** → **Yes.** Describe: "Users can delete all app data from within the app (Settings → reset). No account exists; uninstalling also removes all on-device data." Provide a deletion contact/URL in the privacy policy.
- **Committed to Play Families policy?** → per your audience choice.

**Data sharing:** aim for **"No data shared with third parties"** — RevenueCat acts as a processor on your behalf. 🔎 Confirm with RevenueCat's guidance; if they classify any field as "shared," declare it.

---

## 4. App Store App Privacy (iOS) — mapping for the same inventory

Apple's "App Privacy" labels (definitions differ from Google — Apple counts on-device-linked collection too, but data that never leaves the device and isn't sent to you generally isn't "collected"). Draft:

- **Health & Fitness** — used **on device** to show insights and to save sessions to HealthKit; **not** linked to identity, **not** used for tracking. Apple's HealthKit rules already forbid using health data for ads — your reviewer notes should state this explicitly.
- **Purchases** — Collected (RevenueCat) · linked to the RevenueCat app-user id · **not** used for tracking · purpose: App Functionality.
- **Identifiers** — 🔎 only if RevenueCat collects a device id; not for tracking.
- **No tracking / no IDFA** — answer "No" to tracking (no ad SDK).

**Reviewer notes (HealthKit):** "MoodRx reads steps and sleep solely to display mood correlations to the user, and writes completed workouts/breathing sessions to Apple Health. Health data is processed on-device and never used for advertising or shared with third parties."

---

## 5. Privacy-policy must-haves (both stores read this)

Make sure the hosted privacy policy explicitly covers:
- The exact health data types: **steps, sleep, and written workout/breathing sessions**, and that reads are shown on-device only.
- Mood check-ins / history stored **on-device**, no account.
- **RevenueCat** as the payment/subscription processor (link their privacy policy).
- That health data is **never used for advertising** or sold.
- **How to delete data** (in-app reset + uninstall) and a contact.

---

*Companion to `docs/launch-submission-checklist.md`. Items marked 🔎 need a quick verification against the vendor's current docs before you submit.*
