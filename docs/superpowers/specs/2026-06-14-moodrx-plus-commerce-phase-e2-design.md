# Phase E2 — MoodRx+ commerce surfaces (design spec)

**Date:** 2026-06-14
**Status:** Approved in brainstorming; ready for implementation planning.
**Parent:** [purchase-flow redesign](2026-06-14-purchase-flow-redesign-design.md) Phase E
(E1 = foundation & gating, shipped; E2 = commerce surfaces, this spec).
**Builds on:** E1 entitlement model (`isPlus`, `all_access`, `canUseLiveCoach`, the
taste counter) + Phase A `usePurchaseButton`.
**Goal:** Let owners start a 7-day MoodRx+ trial / subscribe at the moment the live
coach proves its worth, with a single shared sheet and quiet secondary entries.

---

## 1. Scope

E2 adds the **commerce surfaces** for MoodRx+. JS-only; the **UI + mock-grant flow**
are locally testable (the dev `purchasePlus` path grants `all_access` → `isPlus`),
but the **real trial/subscription, the "save ~half" live prices, and store review**
require the products to be configured in App Store Connect / Google Play /
RevenueCat (manual, external — not in code scope). No `app.json`/native changes.

**Out of scope:** any change to E1 gating, the $9.99 base, voices (Phase C), or a
true scheduled "day-8 trial-expired" trigger — the dual offer is baked into the
sheet instead (§4).

---

## 2. Products & entitlement

- A new RevenueCat **`plus` offering** holding two **auto-renewing subscription**
  products with a **7-day free intro trial**:
  - monthly — package id `$rc_monthly` — **$3.99/mo**
  - annual — package id `$rc_annual` — **$24.99/yr** ("save ~half")
- Both grant the **`all_access`** entitlement (reused from E1 → `isPlus` true →
  unlocks everything incl. the live coach).
- `lib/revenuecat.tsx`: add `export const PLUS_OFFERING_ID = 'plus';`
- `contexts/SubscriptionContext.tsx`: add
  `purchasePlus(period: 'monthly' | 'annual'): Promise<boolean>` — finds the
  `$rc_monthly`/`$rc_annual` package in the `plus` offering and calls the existing
  `triggerPurchase(pkg, ALL_ACCESS_ENTITLEMENT_IDENTIFIER)`. The `__DEV__`
  mock-grant path grants `all_access`, so the full UI flow (tap → grant → `isPlus`
  → unlimited live coach + voices) is testable with no real products.

The 7-day trial is an intro offer on the store products; the app just purchases —
the store/RevenueCat apply the trial. Copy says "Start 7-day free trial."

---

## 3. The MoodRx+ sheet — `components/PlusSheet.tsx` (new)

A presentational modal (mirrors `PremiumSheet`'s structure/styles), wired by its
host. Top to bottom:

- **Headline:** "Keep the live coach."
- **Value line:** "Live Dr. MoodRx + every voice + new content packs."
- **Trial-first framing:** lead line — "7 days free, then your plan."
- **Two plan options** (selectable rows; annual preselected as the smart-money
  pick): **Annual — $24.99/yr** (a small "save ~half" / "best value" tag) and
  **Monthly — $3.99/mo**. Prices from the `plus` offering package `priceString`s
  (fallbacks `$24.99` / `$3.99`).
- **Primary CTA:** "Start 7-day free trial" → `usePurchaseButton` wrapping
  `purchasePlus(selectedPeriod)`; Phase-A states (disabled-until-loaded, spinner →
  "You're in ✓" → `onSuccess` closes the sheet). On success the user is `isPlus`.
- **Soft-landing (baked in, §4):** a **quiet secondary link "Own the core once —
  $9.99"** that runs `purchaseBase` (only meaningful for users who don't already
  own the base; harmless otherwise). 
- **Footer:** "Restore purchase" (reuses `usePurchaseButton` over `restorePurchases`)
  + "Maybe later" (close). Legal links as in `PremiumSheet`.

Props: `visible`, `onClose`, plus the derived buy/period controllers from the host
(keeps the sheet presentational, like `VoiceSheet`). The host (a small
`usePlusSheet`-style hook or inline state) owns `purchasePlus`/`purchaseBase`
controllers + the selected period.

---

## 4. Trigger — gentle inline prompt (post-workout)

In `app/post-workout.tsx`, when the live-coach taste is spent for a non-plus owner,
show a quiet, dismissible prompt instead of interrupting:

- Show when `aiCoachEnabled && !isPlus && !canUseLiveCoach({ isPlus, tasteUsed })`
  (i.e. the same gate that just fell back to the stock line). Reuse the existing
  `canUseLiveCoach`; no new pure logic.
- Render a small tappable line beneath the (stock) coach line:
  *"Dr. MoodRx wrote your first few live. Keep the live coach →"* → opens
  `<PlusSheet>`.
- Never auto-present; dismissible by ignoring it. The post-workout effect already
  reads `tasteUsed`/`isPlus` — surface a `liveCoachLocked` boolean to drive the
  prompt.

The **soft-landing** is handled here + in the sheet: a post-trial user (trial
expired → `isPlus` false again, taste already spent) hits this same prompt → opens
the sheet, which offers both "Start trial again / subscribe" and the quiet "Own the
core once — $9.99." No scheduled day-8 detection needed.

---

## 5. Secondary entries

- **Voice picker** (`VoiceSheet`/`CoachVoicePicker`): add the deferred quiet
  **"Included with MoodRx+ →"** line under the bundle CTA → opens `<PlusSheet>`.
- **Settings**: a real **"MoodRx+"** row (in the Pro section) → opens `<PlusSheet>`
  (separate from the `__DEV__` dev panel).

Both reuse the one `<PlusSheet>`.

---

## 6. Testing

- Pure logic: none new (reuses `canUseLiveCoach`). If any tiny derivation appears
  (e.g. plan-row formatting), unit-test it; otherwise no new vitest.
- On-device (local debug, mock-grant): inline prompt appears after the taste is
  spent (toggle base on, exhaust the 3, no plus); tapping it opens `PlusSheet`;
  "Start 7-day free trial" → dev confirm → `all_access` granted → `isPlus` → live
  coach unlimited + voices unlocked + prompt gone. Voice-picker + settings entries
  open the same sheet. The "Own the core once — $9.99" path runs the base purchase.
- **Not locally verifiable:** the real 7-day trial, live subscription prices, and
  store review — these need the configured products + sandbox accounts.
- `npm test`, `npm run typecheck`, `npx expo lint` green before each commit.

---

## 7. Store config (manual, external — for launch, not code)

Create the `plus` offering + monthly ($3.99) and annual ($24.99) auto-renewing
subscriptions with a **7-day free trial intro offer**, both granting `all_access`,
package identifiers `$rc_monthly` / `$rc_annual`, in App Store Connect + Google Play
+ RevenueCat. Subscriptions carry more store review than the one-time products —
budget time for it.
