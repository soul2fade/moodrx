# Voiced Insult Control (Phase 2) — Design Spec

**Date:** 2026-06-12
**Status:** Approved design, pre-plan.
**Sub-project 2 of 3** in the "voiced trash-talk app-side wiring" build:
1. **Delivery (done)** — host the library + fetch/cache playback (`...-insult-delivery-phase1-design.md`).
2. **Control (this spec)** — the severity "bite" sheet that drives the audio tier + the AI coach tone.
3. **Commerce (later)** — the Settings voice picker + RevenueCat voice packs (moved here from Phase 2 — a picker is only useful once voices are ownable).

## Context

Phase 1 made the workout play the hosted library at a **fixed** `rachel` / `sticks` default (`DEFAULT_INSULT_VOICE` / `DEFAULT_INSULT_TIER` in `app/workout.tsx`), with a never-silent bundled fallback. Today the "TRASH TALK" button just toggles on/off, and the AI coach's tone is derived from the **trash-talk volume** (`lib/coach-client.ts` `resolveTone()`: `volume >= 0.5 ? 'roasting' : 'teasing'`) — an awkward coupling. Phase 2 introduces a single user-chosen **severity** that selects the audio tier AND the coach tone, and frees the volume to be pure loudness.

## Goals

- One coherent "how mean is Dr. MoodRx" control: **Glass House** / **Sticks and Stones** / **Roasted** (keys `glass-house` / `sticks` / `roast`).
- Severity drives **both** the workout audio tier and the AI coach tone, from one stored value.
- A "prepare to laugh" sheet on every TRASH TALK enable, last choice pre-selected — so the hard-R **Roasted** tier is an explicit opt-in each session.
- Remove the volume→tone coupling; trash-talk **volume becomes pure loudness**.
- Stay forward-compatible with Phase 3 (the voice picker + packs).

## Non-goals (out of scope)

- The Settings **voice picker** and **RevenueCat voice packs** — moved to Phase 3 (they ship together; a picker is meaningless until voices are ownable). Voice stays `rachel` in Phase 2.
- The live Pro-gated post-workout roast (separate piece).
- Any change to the audio loudness control itself (it stays the existing `trashTalkVolume`).

## Design

### Naming (one set of three, used everywhere)
| key | display label | bite |
|-----|---------------|------|
| `glass-house` | **Glass House** | softest |
| `sticks` | **Sticks and Stones** | standard |
| `roast` | **Roasted** | sharpest (hard-R audio) |

`CoachTone` is redefined to **these three values** (replacing `teasing`/`roasting`), so the severity value *is* the coach tone — no mapping table, it passes straight through.

### Component 1 — Severity storage (`lib/storage.ts`)
- `getInsultSeverity(): Promise<InsultTier>` / `setInsultSeverity(t: InsultTier): Promise<void>`, key `@moodrx_insult_severity`, default **`'sticks'`** (matches the Phase-1 default). `InsultTier` is imported from `lib/insult-library.ts` (Phase 1).

### Component 2 — Severity metadata (`lib/insult-severity.ts`, new, pure)
- Exports the ordered list `SEVERITIES: { key: InsultTier; label: string; blurb: string }[]` — `glass-house`→"Glass House", `sticks`→"Sticks and Stones", `roast`→"Roasted", each with a short text-only (no-emoji) descriptor. Pure (no RN/expo) → vitest-testable; the single source of the labels/order for the sheet.

### Component 3 — The "prepare to laugh" sheet (`components/SeveritySheet.tsx`, new)
- A modal sheet: a "prepare to laugh" header + **three selectable rows** (from `SEVERITIES`, text-only, no emojis), the current severity pre-selected. Choosing a row calls `onConfirm(tier)`; a dismiss path calls `onCancel`. Presentational — it receives the current severity + callbacks; it does not read storage itself.
- *(This realizes the "3-stop" concept as three discrete rows — accessible for a text-only choice. A literal draggable slider was considered and rejected for clarity.)*

### Component 4 — Workout-screen wiring (`app/workout.tsx`)
- New state `insultSeverity` (loaded from `getInsultSeverity()` on mount, default `sticks`) and `severitySheetOpen`.
- **TRASH TALK tap when OFF** → open the sheet (pre-selecting `insultSeverity`). On confirm(tier): `setInsultSeverity(tier)` + update state + close sheet + turn trash-talk **on**. On cancel: close, stay off.
- **TRASH TALK tap when ON** → turn trash-talk **off** (no sheet).
- The Phase-1 `DEFAULT_INSULT_TIER` constant is removed; the trash-talk effect and `prefetchTier` now use the `insultSeverity` state. `DEFAULT_INSULT_VOICE` (`'rachel'`) stays. Bundled fallback unchanged. (The effect's dep list gains `insultSeverity` so changing it re-prefetches/re-targets.)

### Component 5 — Coach tone (expand to 3, decouple volume)
- `lib/coach-insight.ts`: widen `CoachTone` to `'glass-house' | 'sticks' | 'roast'` (i.e. `= InsultTier`).
- `lib/coach-client.ts` `resolveTone()`: return `await getInsultSeverity()` (the severity *is* the tone) instead of reading volume. Keep a default of `'sticks'` on error. The trash-talk volume no longer affects tone.
- `netlify/functions/lib/coach-prompt.ts` `coachSystemPrompt(tone, crisis, hasEpisode)`: replace the 2-tone intensity branch with 3 — `glass-house` = gentlest playful ribbing, `sticks` = standard teasing, `roast` = sharpest (the existing "roasting" copy). Crisis mode + the episode/guardrail rules are unchanged. **Requires a redeploy** of the coach-line Netlify function (CLI: `npx netlify deploy --prod --build` on `moodrx-api`).
- **Find every `CoachTone` consumer** (grep) and handle the new values — at minimum `resolveTone`, `coachSystemPrompt`, and any local static-line selection. None may be left assuming `teasing`/`roasting`.
- **Backward-compat during the deploy gap (important):** the coach-line function is redeployed *before* the new app build ships, so the **currently-live app keeps sending the legacy `'teasing'` / `'roasting'`** tone values for a while. `coachSystemPrompt` MUST therefore accept an unknown/legacy tone and fall back to the standard (`sticks`) branch rather than break — e.g. treat anything that isn't `glass-house`/`sticks`/`roast` as `sticks`. (Optionally map `teasing`→gentler, `roasting`→sharper, but a safe default to `sticks` is sufficient.) This keeps live users working through the transition; once their app updates they send the new values.

## Data flow
1. Mount: workout reads `getInsultSeverity()` → `insultSeverity` (default `sticks`).
2. Tap TRASH TALK (off) → sheet (pre-selected) → pick → persist + state + on → effect prefetches/plays `rachel × <severity>`.
3. Tap TRASH TALK (on) → off.
4. Post-workout: `resolveTone()` reads the same severity → coach-line → `coachSystemPrompt` renders the matching bite.

## Error handling
- `getInsultSeverity` failure → default `'sticks'` (both the workout loop and `resolveTone`). No crash, sensible bite.
- Audio delivery failures already degrade to the bundled fallback (Phase 1) — unchanged.
- An unknown stored severity value is treated as `'sticks'`.

## Testing
Pure logic via vitest:
- `lib/insult-severity.ts` — `SEVERITIES` has the three tiers in order with the exact labels (Glass House / Sticks and Stones / Roasted) and non-empty blurbs.
- `resolveTone` mapping — extract/keep it pure enough to assert each severity yields its own tone (glass-house→glass-house, etc.), and the error default is `sticks`.
- `coachSystemPrompt` — extend `netlify/functions/__tests__/coach-prompt.test.ts`: a `glass-house` tone renders the gentlest copy; `roast` renders the sharpest; the 3 tones are distinct; crisis + guardrail assertions still pass.
The sheet UI + workout wiring are verified **on-device** at the build (the project's convention).

## Existing code this builds on / touches
- `app/workout.tsx` — TRASH TALK button (`handleTrashTalk`), the trash-talk effect, the Phase-1 `DEFAULT_INSULT_TIER`.
- `lib/storage.ts` — pattern of `get*/set*` + `@moodrx_*` keys (e.g. `getTrashTalkVolume`).
- `lib/coach-client.ts` `resolveTone`, `lib/coach-insight.ts` `CoachTone`, `netlify/functions/lib/coach-prompt.ts` `coachSystemPrompt` (+ its test).
- `lib/insult-library.ts` (Phase 1) — `InsultTier`.

## Owner-ops / deploy
- After the coach-prompt change: redeploy the coach-line function (`npx netlify deploy --prod --build` on `moodrx-api`). No store-config change (Phase 3 owns that).

## Open decisions — resolved
1. **Scope:** severity drives both audio tier + coach tone (not audio only).
2. **Sheet behavior:** opens on every enable, last choice pre-selected.
3. **Voice picker:** moved to Phase 3.
4. **Coach tone levels:** expand to 3, named to match the severities (Glass House / Sticks and Stones / Roasted); severity = tone.
5. **Control style:** three discrete rows, not a draggable slider. Default severity `sticks`.

## Success criteria
- Tapping TRASH TALK (off) opens the "prepare to laugh" sheet with the last severity pre-selected; picking one turns trash talk on at that audio tier and persists it.
- The post-workout AI coach's bite matches the chosen severity (Glass House softest → Roasted sharpest); the trash-talk volume no longer affects tone.
- Re-opening the sheet shows the remembered choice; default is `sticks`.
- Pure logic unit-tested; typecheck + lint clean. Phase 3 only needs to add the voice dimension on top.

## ⚠ Launch note
The **Roasted** tier remains hard-R → the app is **17+**; the every-enable sheet is the in-app opt-in, but the store age-rating + content descriptors still need updating at submission (carried from Phase 1).
