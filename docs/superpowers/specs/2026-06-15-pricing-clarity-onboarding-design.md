# Pricing clarity: onboarding redesign + coaches folded into MoodRx+

**Date:** 2026-06-15
**Status:** Design — approved in brainstorming, pending spec review
**Branch (proposed):** `feat/pricing-clarity` (new; builds on `feat/purchase-flow-phase-a` / PR #34)

## Problem

The pricing model has three layers but onboarding only sells one of them. The
$9.99 "Own MoodRx" decision block ([app/onboarding.tsx](../../../app/onboarding.tsx))
presents the one-time base unlock as "yours forever, no subscription" and never
mentions that:

- the paid coach voices cost extra (à la carte $0.99 each / $2.99 bundle), and
- the live AI coach requires the MoodRx+ subscription ($3.99/mo).

So a user who "owns it forever" still hits a $0.99 voice wall and a $3.99/mo
coach wall later — and the onboarding copy actively primes them *not* to expect
that. The result is surprise and a feeling of nickel-and-diming.

## Goals

1. **No surprises.** Every cost a user can encounter is disclosed up front, in a
   form that is honest and easy to scan.
2. **Simplify the model.** Collapse the à la carte voice tier into MoodRx+ so
   there is exactly one thing that gates the "extra" stuff.
3. **Preserve the trust line.** "Start free" must never read as a disguised
   subscription trial.

## Non-goals / roadmap (separate specs)

- **Coaches that actually shape your prescription.** Today coach personalities
  change *who delivers* your coaching (voice + tone), not *which* workouts get
  recommended. A future feature could make the chosen coach influence
  recommendations; only then does "personalize your prescription" become a true
  claim. Out of scope here — launch copy stays honest (personality framing).
- **RevenueCat cleanup** of the now-dormant `voice_*` / `voice_pack` products
  (they stay configured but unused; harmless). Optional follow-up.

## The pricing model (canonical statement)

Three doors. The two paid doors are **independent alternatives**, not a ladder —
MoodRx+ already includes the core, so a subscriber never also pays $9.99.

| Door | Price | Mechanic | Unlocks |
|------|-------|----------|---------|
| **Free** | $0 forever | No card, no trial, never charges | Mood check-ins + prescriptions, coach Rachel, today's top workout per mood + a weekly-rotating bonus, first supplement, last 3 check-ins |
| **Own it** | $9.99 once | Instant one-time, no subscription | Everything in Free **+** all 18 workouts (every mood), full supplement tracker + research, full history / patterns / calendar / programs |
| **MoodRx+** | $3.99/mo or $24.99/yr | 7-day free trial, then auto-renews | Everything in Own it **+** the live Dr. MoodRx AI coach, every coach personality, new content packs |

Only **MoodRx+** has a trial and only MoodRx+ ever auto-charges. The dual
soft-landing at trial expiry ("keep MoodRx+" vs "own the core once — $9.99",
per [[moodrx-plus-trial-scope]]) is a separate existing flow, unchanged here.

### Tier colors (from the mood palette)

Applied **only to the columns of the pricing comparison** (tile 2). Nothing else
changes color — the decision CTAs, PlusSheet, lock chips, and PremiumSheet keep
their current (gold) styling.

- **Free** — **white** (`colors.text` `#ffffff`); no accent.
- **Own it** — **blue `#5EAAB5`** (mood `foggy`; equals `colors.info`).
- **MoodRx+** — **green `#059669`** (mood `good`; equals `colors.success`).

Color the column header (tier name + price) and that column's check marks only.

## Changes by surface

### 1. Onboarding → two-tile carousel ([app/onboarding.tsx](../../../app/onboarding.tsx))

Replace the single vertical "how it works → disclaimer → Own MoodRx" scroll with
a **two-tile horizontal carousel**, reusing the existing carousel pattern
([components/HomeCarousel.tsx](../../../components/HomeCarousel.tsx)) or a simple
paged `ScrollView` with a pager indicator.

- **Tile 1 — How it works.** The current 3 steps (`STEPS`), the wordmark, the
  medical disclaimer. Pager dots + a "swipe to see pricing →" affordance.
- **Tile 2 — What it costs.** The 3-tier comparison (Free / Own it / MoodRx+) as
  a compact feature matrix (rows = features, columns = tiers, check/dash icons).
  Column headers + check marks carry the tier colors (Free white, Own it blue,
  MoodRx+ green); the CTAs below keep existing (gold) styling. The decision CTAs
  live **on this tile** so pricing is always seen before acting:
  - **OWN IT — $9.99** button → `purchaseBase`.
  - **Start 7-day free trial** button → MoodRx+ (`purchasePlus`).
  - **Start free →** — quiet text link, visibly distinct from the trial,
    proceeds to the free tier (`handleFreeVersion`). No card, no charge.

  **Feature-matrix rows** (the canonical list; must match real gating — see
  Testing). ✓ = included, – = not included:

  | Feature | Free | Own it | MoodRx+ |
  |---|:---:|:---:|:---:|
  | Mood check-ins + coach Rachel | ✓ | ✓ | ✓ |
  | Top workout + weekly bonus | ✓ | ✓ | ✓ |
  | Today's supplement pick | ✓ | ✓ | ✓ |
  | All 18 workouts, every mood | – | ✓ | ✓ |
  | Full supplement tracker + reminders | – | ✓ | ✓ |
  | Full history, patterns, calendar | – | ✓ | ✓ |
  | Live Dr. MoodRx AI coach | – | – | ✓ |
  | Every coach personality | – | – | ✓ |
  | New content packs | – | – | ✓ |

**Density note:** a 3-column matrix is tight at phone width. Implement the matrix
first; if it reads cramped on-device, fall back to three stacked tier cards
(vertical comparison). Decide on-device during verification.

**Honesty guardrail (must hold):** "Start free" and "Start 7-day free trial" are
two different controls with two different words and two different outcomes. The
trial's terms ("7 days free, then $X/mo, cancel anytime") are spelled out on the
trial control, per Apple/Google requirements.

### 2. Voices → "coach personalities," folded into MoodRx+

À la carte voice purchases are removed. Voices become a MoodRx+ perk only (free
users keep Rachel). `ownsVoice` already grants via `all_access`
([lib/voices.ts](../../../lib/voices.ts)), so this is primarily deletion.
`purchaseVoice` / `purchasePack` are **removed outright** (not left dormant) once
no caller remains.

- **[components/VoiceSheet.tsx](../../../components/VoiceSheet.tsx):**
  - Remove the per-voice **Buy** button (`voiceBuyBtn` / `onBuyVoice`) and the
    **bundle CTA** (`showBundle` / `onBuyBundle` / `bundleLabel`).
  - Locked rows show "Locked" and route to the PlusSheet (`onPlus`) instead of a
    price. Keep Sample + Select-when-owned.
  - Reframe copy: header "COACH VOICE" → e.g. "YOUR COACH"; sub
    "Who trash-talks you during a workout?" → e.g. "Choose who coaches you."
    Keep the existing "Included with MoodRx+ →" link as the single unlock path.
- **Callers** (the screen owning VoiceSheet — settings/coach picker): drop the
  `voicePrice` / `onBuyVoice` / bundle props and the `purchaseVoice` /
  `purchasePack` wiring they pass in.
- **[app/settings.tsx](../../../app/settings.tsx):** voice entries show
  "Included with MoodRx+" rather than per-voice prices.
- **[contexts/SubscriptionContext.tsx](../../../contexts/SubscriptionContext.tsx):**
  `purchaseVoice` / `purchasePack` / `ownsPack` are removed (functions +
  context-value exposure + interface), since no caller remains after the fold
  and the packs-store removal below. `ownsVoice` / `ownedEntitlements` stay
  (still gate playback).

### 2a. Remove the à la carte packs store (decision 2026-06-15: "remove it")

There is no à la carte anything under the new model, and the voices were seeded
into the `packs` offering — so the generic store would show them for sale.

- **Delete [app/packs.tsx](../../../app/packs.tsx)** (the "Add-on content" store).
- **[app/premium.tsx](../../../app/premium.tsx):** remove the button that
  navigates to `/packs` (~line 181-183) and any now-unused imports.
- **[lib/revenuecat.tsx](../../../lib/revenuecat.tsx):** `PACKS_OFFERING_ID`,
  `VOICE_PACK_ID`, and `packEntitlementId` become unused after the above —
  remove them and their references. `ALL_ACCESS_ENTITLEMENT_IDENTIFIER`,
  `BASE_UNLOCK_PACKAGE_ID`, `PLUS_OFFERING_ID`, `REVENUECAT_ENTITLEMENT_IDENTIFIER`
  stay. Content packs become a MoodRx+ perk, not a store. (The RC `packs`
  offering + `voice_*` products stay configured but unreferenced — roadmap
  cleanup, unchanged from the non-goals above.)

### 3. Copy reframe (global)

Replace "trash-talk voices" framing with "coaches / coach personalities" on the
voice picker, settings, and PlusSheet, honestly (they change who delivers your
coaching, not the prescription). The trash-talk *severity* control
(`trashTalkVolume`) keeps its own naming — it is about tone intensity, not the
voice identity.

## Architecture / boundaries

- **Onboarding tile content** is presentational; the carousel is a thin paging
  wrapper. Pricing copy + the feature matrix live in a small dedicated component
  (e.g. `components/PricingComparison.tsx`) so the same matrix can be reused by
  the PlusSheet later if desired, and tested in isolation. Tier rows are data
  (`{ feature, free, base, plus }[]`), rendered by the component.
- **Tier colors** added as named tokens in [lib/colors.ts](../../../lib/colors.ts)
  (e.g. `tierOwn = colors.info`, `tierPlus = colors.success`) and used **only**
  by the pricing-comparison component, so the mapping is single-sourced.
- **No RevenueCat changes required** — the catalog already grants voices via
  `all_access`. The à la carte products simply stop being referenced.

## Testing

- **Unit (vitest):** the feature-matrix data is pure — assert each tier's
  included/excluded set matches the gating in
  [lib/free-tier.ts](../../../lib/free-tier.ts) and the `isPremium` / `isPlus`
  gates (guards against the matrix drifting from real behavior). `ownsVoice`
  tests already cover the `all_access` path — keep them.
- **On-device (local debug build, no EAS):**
  - Onboarding: swipe both tiles; verify all three CTAs route correctly and
    "Start free" never starts a purchase/trial.
  - Voice picker: locked coaches show no price and open the PlusSheet; owning
    MoodRx+ unlocks every coach.
  - Confirm no remaining surface shows a $0.99 / $2.99 voice price.
- **Typecheck + lint** clean.

## Resolved decisions (spec review, 2026-06-15)

1. **Tier colors scoped to the comparison columns only** — Free white, Own it
   blue, MoodRx+ green. No other surface changes color.
2. **`purchaseVoice` / `purchasePack` removed outright.**
3. **Matrix is the default tile-2 layout**; fall back to stacked cards only if
   it reads cramped on a real device.
