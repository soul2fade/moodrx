# Phase D — Onboarding redesign (design spec)

**Date:** 2026-06-14
**Status:** Approved in brainstorming; ready for implementation planning.
**Parent:** [purchase-flow redesign](2026-06-14-purchase-flow-redesign-design.md) build order, Phase D.
**Goal:** Redesign the first-run decision block so the $9.99 base reads as a clear,
confident choice — price + proof + reassurance lead, and "free" becomes a quiet
secondary option (not an equal-weight button).

---

## 1. Scope

Single file: `app/onboarding.tsx`. Copy + layout of the **bottom decision block**
only. JS-only — verifies on the local debug build. No new products, no purchase
logic changes (reuses the Phase-A `unlockBtn` and `handleFreeVersion` already in
the file). No `app.json`/native changes.

**Unchanged:** the hook headline ("Your brain is lying to you."), the 3 steps, the
−3 outcome-proof block, the wellness disclaimer, legal links, and all navigation /
purchase wiring. Onboarding is pre-session, so the static −3 example is correct —
do NOT swap in the personalized `OfferProof` here.

---

## 2. The redesigned decision block

Replace today's block (the `trialBanner` "MOODRX PRO / One-time unlock. Full access
forever." + the white `UNLOCK MOODRX PRO →` button + the equal-weight
`CONTINUE WITH FREE VERSION` button) with, top to bottom:

1. **Sub-headline:** `Own MoodRx.`
2. **Value line:** `Every workout, every pattern, your whole evidence file — yours forever.`
   - Deliberately excludes the coach and voices: the **live** Dr. MoodRx coach is
     the MoodRx+ tier (Phase E) and voices are à la carte (Phase C), so the
     base-unlock pitch must not imply them. This line promises only what $9.99
     delivers.
3. **Feature list (kept):** the existing short list — `All 18 science-backed
   workouts`, `Supplement tracker with research`, `Full progress history`. All
   accurate for the base.
4. **Reassurance, prominent:** `$9.99 once. No subscription. No auto-renew.` — given
   real visual weight (it is the differentiator that earns the tap).
5. **Primary CTA (bold, full-width):** label `Own it — $9.99 →`, styled **gold**
   (`colors.premium`, outlined — matches the PRO-in-gold treatment), reusing the
   existing `unlockBtn` controller so it keeps the Phase-A states: disabled until
   init settles → spinner → `You're in ✓` → `setFirstLaunchDone()` + navigate to
   `/guided`.
6. **Secondary:** `Start free →` as a **quiet, muted text link** (small, low
   contrast — NOT the current equal-weight bordered button), reusing
   `handleFreeVersion`.

---

## 3. Copy reference (verbatim)

- Sub-headline: `Own MoodRx.`
- Value line: `Every workout, every pattern, your whole evidence file — yours forever.`
- Reassurance: `$9.99 once. No subscription. No auto-renew.`
- Primary CTA idle label: `Own it — $9.99 →` (processing/success come from
  `purchaseButtonLabel` → "Processing…" / "You're in ✓").
- Secondary link: `Start free →`

The CTA price string stays the literal `$9.99` (onboarding is the pitch; the price
is the deal). It does not need to read the live RevenueCat price — but if desired,
`selectBasePrice(offerings)` is available (offerings already on the screen).

---

## 4. Testing

- No new pure logic → no new unit tests. Existing suite must stay green.
- `npm test`, `npm run typecheck`, `npx expo lint` green before commit.
- On-device (local debug build): the redesigned block reads price + proof +
  reassurance first; "Own it — $9.99" flashes "You're in ✓" then drops into the
  guided flow (Phase A, via mock-grant); "Start free →" is a quiet link that skips
  to the guided flow without purchase.
