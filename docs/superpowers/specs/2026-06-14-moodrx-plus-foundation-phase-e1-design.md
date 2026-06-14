# Phase E1 — MoodRx+ foundation & gating (design spec)

**Date:** 2026-06-14
**Status:** Approved in brainstorming; ready for implementation planning.
**Parent:** [purchase-flow redesign](2026-06-14-purchase-flow-redesign-design.md) build
order, Phase E (split into E1 foundation + E2 commerce surfaces).
**Related:** [MoodRx+ trial scope & churn](../../../../.claude/projects/C--Users-zimme-Projects-moodrx/memory/moodrx-plus-trial-scope.md)
(trial unlocks everything; reuse `all_access`).
**Goal:** Put the entitlement foundation in place so MoodRx+ (`all_access`) means
full access, and re-gate the **live** post-workout coach line behind it with a small
free taste — without yet adding the upsell sheet, products, or soft-landing (E2).

---

## 1. Scope & sequencing

E1 is foundation + gating only. **JS-only**, fully **mock-testable** on the local
debug build (dev mock-grant of `all_access`). No new products, no `app.json`/native
changes.

**Interim, not-shippable state (expected):** after E1 alone, a $9.99 base owner goes
from unlimited live coach → "3 live replies, then the stock line," with **no upsell
prompt** (the moment-of-value sheet, products, soft-landing, and "Included with
MoodRx+" entries are all E2). The branch is not shippable until E2 lands. This is
the intended consequence of the split.

**Out of scope (→ E2):** MoodRx+ subscription products (monthly $3.99 / annual
$24.99 / 7-day trial), the moment-of-value upsell sheet shown when the taste runs
out, the day-8 trial soft-landing (dual $9.99-or-keep offer), and the secondary
"Included with MoodRx+" entries (voice picker, settings upgrade row). The voice-
venting reply is **not** gated (separate flagship feature).

---

## 2. Entitlement model (`contexts/SubscriptionContext.tsx`)

Reuse the existing `all_access` entitlement as the MoodRx+ grant.

- Track `hasAllAccess = ownedEntitlements.has(ALL_ACCESS_ENTITLEMENT_IDENTIFIER)`.
- **`isPremium`** becomes "full app access" = `isPaidPremium || hasAllAccess`. This
  makes every existing base-feature gate (workouts, calendar, supplements, patterns,
  programs, etc.) unlock for a MoodRx+ trial/subscriber — i.e. the trial unlocks
  everything. (Today `isPremium = isPaidPremium`.)
- **`isPlus`** (new, exposed on the context) = `hasAllAccess` — the **live-coach**
  gate. A $9.99-only owner has `isPremium = true`, `isPlus = false`.
- `ownsPack`/`ownsVoice` already honor `all_access` — unchanged.

No change to `purchaseBase`/`purchasePack`/`purchaseVoice`/`restorePurchases` or the
dev confirm modal. Add `isPlus` to the context value + deps.

---

## 3. Live-coach gate + taste

### Pure logic — `lib/live-coach.ts` (new, TDD, RN-free)
```ts
export const LIVE_COACH_TASTE_LIMIT = 3;

/** Whether a live coach line may be fetched: MoodRx+ always; otherwise while the
 *  free lifetime taste remains. Pure. */
export function canUseLiveCoach(args: {
  isPlus: boolean;
  tasteUsed: number;
  tasteLimit?: number; // defaults to LIVE_COACH_TASTE_LIMIT
}): boolean;
```
- `isPlus` → always true. Else → `tasteUsed < (tasteLimit ?? LIVE_COACH_TASTE_LIMIT)`.
- Tests: plus always allowed (even tasteUsed ≥ limit); non-plus allowed below limit;
  non-plus blocked at/above limit; custom limit honored; negative/zero handled.

### Storage — `lib/storage.ts`
- `getLiveCoachTasteUsed(): Promise<number>` (default 0).
- `incrementLiveCoachTasteUsed(): Promise<void>` (read, +1, persist).
- Follow the existing AsyncStorage helper pattern + key naming in the file.

### Wiring — `app/post-workout.tsx` (the effect at ~line 112)
Current gate: `if (!enabled || !isPremium || postInsult === '') return;`

New behavior inside the effect:
1. Destructure `isPlus` (not `isPremium`) from `useSubscription()` for the gate.
2. `const enabled = await getAiCoachEnabled(); if (!enabled || postInsult === '') return;`
3. `const tasteUsed = await getLiveCoachTasteUsed();`
4. `if (!canUseLiveCoach({ isPlus, tasteUsed })) return;` (falls back to the stock
   `postInsult` line already shown — never blocks/spins).
5. Fetch as today; on a successful non-cancelled line: `setDynamicLine(line)` and, if
   `!isPlus`, `await incrementLiveCoachTasteUsed()` (a consumed taste).
6. Effect deps: replace `isPremium` with `isPlus` (`[postInsult, isPlus]`).

A MoodRx+ user never increments the counter; a $9.99/free user consumes one taste
per live line actually received, up to 3, then gets the stock line.

---

## 4. Testing

- Unit (vitest): `canUseLiveCoach` cases above. `lib/live-coach.ts` stays RN-free.
- On-device (local debug build, mock-grant):
  - Mock-grant `all_access` → `isPremium` + `isPlus` true → base features unlocked +
    live coach every workout, counter never moves.
  - Non-plus (base or free) → live line appears for the first 3 post-workouts, then
    the stock line; add a **dev reset** for `liveCoachTasteUsed` so the exhaustion →
    stock fallback is re-testable.
- `npm test`, `npm run typecheck`, `npx expo lint` green before each commit.
