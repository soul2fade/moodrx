# Adaptive Intelligence — Design Spec

**Date:** 2026-06-11
**Status:** Approved design, pre-plan
**Decision context:** v1 launch expanded again to ship all major differentiators (see memory `adaptive-intelligence-features`). Builds on the existing analytics/coach layer; ships in the same single production build as voice venting.

## Summary

Two features that make MoodRx compound on its own data — the retention moat:

1. **Adaptive memory coaching** — the AI coach (post-workout line *and* the voice-vent reply) references a **specific past episode** when one carries a real lesson ("breathing flopped last Monday — not again"), instead of only aggregate stats. Selective, high-signal recall.
2. **Causal pattern surfacing** — the insights screen surfaces richer, actionable, *causal* patterns ("mood lifts most after morning sessions"; "three roughish Wednesdays — anything recurring?") under a tiered-honesty discipline so it never asserts noise as fact.

Both are **enhancements of existing, well-structured code**, not greenfield. The app already does primitive versions: `lib/coach-insight.ts` feeds the coach aggregate `workoutHelpedRate`/`recentTrend`; `lib/analytics.ts` (`buildWeeklyPrescription`) does day-of-week learning; `lib/workout-insights.ts` ranks/demotes workouts and builds effective-combo callouts; `app/insights.tsx` has a thin "PATTERN" box + "WHAT WORKS FOR YOU".

## Goals

- Coach feels like it *remembers you* — references specific prior episodes when they teach something.
- Insights surface causal, actionable patterns that feel observant without ever asserting randomness as fact.
- App gets more valuable the longer it's used (anti "month 6 = day 1").
- No new off-device data category; no reopening store declarations (unlike voice venting).

## Non-goals (scope guardrail)

- **No exhaustive correlation miner** — a focused, curated signal set only.
- **No LLM-phrased patterns** — pattern text is templated on-device (free/instant/private). The LLM is used only for the coach/vent reply, which already exists.
- **No new screen** — enhance `app/insights.tsx`.
- **No transcript storage** — episodic recall uses structured session facts only.
- **No "always reach" recall** — recall only fires when an episode clears the lesson bar; otherwise fall back to existing aggregate context.

## Architecture

The defining decision: **patterns stay 100% on-device; only episodic recall touches the LLM** — and it rides the call that already exists.

### Unit A — Pattern engine (`lib/patterns.ts`, new)
Pure, on-device, no network, no LLM. Input: the session log (+ stored per-session health, Unit C). Output: an ordered list of `{ text: string, kind: 'finding' | 'question' }` items, already phrased in the app's voice. Templated text, not model-generated. Consumed by the insights screen (Unit, UI).

**Signals (curated, YAGNI):**
- **Time-of-day** — improvement (postScore − intensity, sign-adjusted) on morning vs evening sessions.
- **Day-of-week roughness** — clustering of high-intensity / low-improvement days on a weekday.
- **Consistency effect** — improvement following back-to-back days vs after gaps.
- **Sleep/steps correlation** — only once per-session health capture (Unit C) has accrued enough data.

**Tiered honesty gate (the "C" discipline) applied to every candidate:**
- **Below floor** (too few observations / effect too small) → **emit nothing**.
- **Gray zone** → emit as a **question** in Dr. MoodRx voice (`kind: 'question'`) — a hunch, never a claim.
- **Strong** (enough observations + real effect size) → emit as a **confident finding** (`kind: 'finding'`).

Floor/threshold constants (min observations per bucket, min effect size) are defined in `lib/patterns.ts` and unit-tested against fixture session sets including a **noise set that must produce zero findings**.

### Unit B — Episodic memory (extend `lib/coach-insight.ts`)
Add a selector that, given the current `{mood, intensity}` and the session log, returns **at most one** decision-relevant prior episode, or `null`. Selection: a recent, similar-state session (same mood, close intensity) with a clear did-it-help outcome, preferring a **clear win to repeat** or a **clear flop to avoid**; `null` if none clears the bar. The episode is returned as **structured facts** — `{ mood, intensity, workoutName, helped: 'yes'|'somewhat'|'no', dayLabel, daysAgo }` — never a transcript.

`CoachContext` gains an optional `episode` field carrying this. Both LLM surfaces consume it:
- the post-workout coach line (`netlify/functions/coach-line.ts` system prompt + context), and
- the voice-vent reply (the `vent-line` function from the voice-venting spec).

The system prompt instruction: *if an episode is provided, you may reference it in voice; never invent one; use only the provided facts.* Because the selector only passes an episode when one qualifies, the model can't fabricate significance.

### Unit C — Per-session health capture (extend session logging + `lib/storage`)
At session-log time, attach the current Health snapshot (steps today, sleep last night, via the existing `getHealthSnapshot`) onto the persisted session record (new optional fields). On-device, privacy-clean — health data already on the device, stored locally with the session. Enables Unit A's sleep/steps signals over time. No network, no new store declaration.

### Unit (UI) — Insights "noticed" section (modify `app/insights.tsx`)
Replace the thin "PATTERN" box with a richer section rendering Unit A's items — confident findings styled as statements, gray-zone items styled as the coach posing a question. Respect gating (below). Keep everything else on the screen as-is.

## Privacy, cost, gating

- **Patterns:** entirely on-device → **zero** new data leaves the phone, **$0** model cost, **no** store-declaration change.
- **Episodic memory:** adds a few **structured facts** (one past episode) to the **already-existing, already-declared** coach/vent call — same data *category* (mood/workout facts, not transcripts/audio) already covered by the Health declaration. Negligible extra tokens (~same ~$0.002 call). **No store-form reopen.** During implementation, re-read the privacy policy's AI Coach line ("summaries derived from your own history") and lightly clarify wording if needed — at most a one-line edit.
- **Gating:** episodic recall rides the coach → **Pro** (naturally). Causal patterns → **one basic pattern free** (so everyone feels "it notices me"), **full pattern set behind Pro** — consistent with existing insights gating (calendar/full-history are Pro) and reinforces "progress depth = Pro" without paywalling help.

## Risks & mitigations

- **Spurious patterns erode "data doesn't lie" credibility** → tiered floor+hedge gate; noise-set unit test that must yield zero findings; gray-zone items framed as questions, never claims.
- **Model fabricating an episode** → selector passes an episode only when one qualifies; system prompt forbids inventing one and restricts to provided facts.
- **Hollow/forced recall** → selective (Unit B returns `null` when no episode clears the bar; coach falls back to aggregate context).
- **Sleep/steps patterns implying a new privacy posture** → health snapshot is stored locally per session and used only on-device; never transmitted.
- **Over-scoping into a correlation engine** → curated signal set, non-goals enforce it.

## Success criteria

- Coach/vent references a specific past episode when (and only when) a qualifying one exists; never fabricates.
- Insights "noticed" section shows confident findings only above the floor; gray-zone items appear as questions; a fixture **noise set produces zero findings**.
- Pattern detection runs on-device with no network calls (verified) and no measurable model cost.
- Episodic recall adds no new off-device data category (structured facts only).
- Free users get one teaser pattern; Pro unlocks the full set; episodic recall is Pro.

## Existing code this builds on

- `lib/coach-insight.ts` — `CoachContext`, `buildCoachContext`, crisis floor (extend with `episode`).
- `lib/analytics.ts` — `getLastNDays`, `buildWeeklyPrescription`, `DayAggregate` (reuse for time/day signals).
- `lib/workout-insights.ts` — effectiveness/effective-combos (reuse; don't duplicate).
- `app/insights.tsx` — the "PATTERN" box to upgrade; gating patterns (`isPremium`, `PremiumSheet`) already present.
- `lib/health.ts` — `getHealthSnapshot` (reuse for Unit C).
- `lib/storage.ts` — `Session` shape (extend with optional health fields).
- `netlify/functions/coach-line.ts` + the `vent-line` function (voice-venting spec) — consume `episode`.

## Open items for the plan

- Exact floor/threshold constants per signal (min observations, min effect size) + the fixture session sets (including the noise set) to calibrate them.
- The `Session` health fields' shape and back-compat for existing records lacking them.
- Episode-selection scoring (similarity weighting of mood/intensity/recency/outcome).
- Templated phrasings per pattern type in Dr. MoodRx voice (finding vs question variants).
- The free-teaser selection rule (which one pattern shows to free users).
