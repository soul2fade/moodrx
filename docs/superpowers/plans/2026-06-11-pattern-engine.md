# Pattern Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `lib/patterns.ts` — a pure, on-device engine that turns the session log into an ordered list of `{ id, text, kind: 'finding' | 'question' }` items, surfacing causal/actionable patterns (time-of-day, day-of-week roughness, consistency) under a tiered-honesty gate that emits **nothing below a floor**, a **question** in the gray zone, and a **confident finding** only when the effect is strong — verified by a noise fixture that must produce zero findings.

**Architecture:** Three pure detector functions (`detectTimeOfDay`, `detectDayOfWeek`, `detectConsistency`), each computing an effect size + observation count over the existing `Session[]` and passing them through one shared `classifyTier` gate, then emitting templated text in the app's voice or `null`. `buildPatterns` composes them and orders findings before questions. No network, no LLM, no new data — reads only existing `Session` fields. The sleep/steps signal is **deferred to Plan 4** (it needs the per-session health fields that plan adds); the engine is structured so a fourth detector slots in cleanly.

**Tech Stack:** TypeScript, vitest (Node, pure-logic units — the Plan-2 vitest `@`-alias + AsyncStorage stub already make `lib/*` importable under Node; no infra task needed). No new runtime deps.

**Spec:** `docs/superpowers/specs/2026-06-11-adaptive-intelligence-design.md` (Unit A — Pattern engine + the tiered-honesty gate). UI rendering + free/Pro gating is **Plan 6** (insights "noticed" section); the free-teaser selection rule is Plan 6's, not this engine's.

---

### Task 1: Types, helpers, and the tiered-honesty gate

The shared substrate: the `PatternItem`/`Tier` types, `sessionImprovement` (sign-adjusted so "higher = better outcome" across moods), an internal `mean`, and `classifyTier` (the floor/gray/strong gate every signal runs through). Threshold constants live here too.

**Files:**
- Create: `lib/patterns.ts`
- Test: `lib/__tests__/patterns.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/patterns.test.ts`. This also defines the fixture helpers (`at`, `dateStr`, `mk`, `sess`) reused by every later task — `at` builds a **local-timezone** timestamp so `new Date(ts).getHours()` round-trips deterministically regardless of the machine's TZ.

```ts
import { describe, it, expect } from 'vitest';
import { sessionImprovement, classifyTier } from '@/lib/patterns';
import type { MoodKey, Session } from '@/lib/storage';

// ── Shared fixture helpers (used by all pattern tests) ───────────────────────
/** Local-constructed epoch ms — getHours() on this round-trips to `hour`
 *  regardless of the test machine's timezone. */
function at(year: number, month1: number, day: number, hour = 9): number {
  return new Date(year, month1 - 1, day, hour, 0, 0).getTime();
}
function dateStr(year: number, month1: number, day: number): string {
  return `${year}-${String(month1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function mk(over: Partial<Session>): Session {
  return {
    id: Math.random().toString(36).slice(2),
    mood: 'stressed',
    intensity: 6,
    postScore: 4,
    workoutName: 'Box Breathing',
    duration: 5,
    timestamp: at(2026, 6, 1, 9),
    rating: 'yes',
    localDateString: dateStr(2026, 6, 1),
    ...over,
  };
}
/** A June-2026 session on `day` at `hour`, with explicit intensity/post(/mood). */
function sess(day: number, hour: number, intensity: number, post: number, mood: MoodKey = 'stressed'): Session {
  return mk({
    timestamp: at(2026, 6, day, hour),
    localDateString: dateStr(2026, 6, day),
    intensity,
    postScore: post,
    mood,
  });
}

describe('sessionImprovement', () => {
  it('is intensity - post for distress moods (lower post = better)', () => {
    expect(sessionImprovement(sess(1, 9, 8, 4, 'stressed'))).toBe(4);
    expect(sessionImprovement(sess(1, 9, 6, 6, 'low'))).toBe(0);
  });
  it('is post - intensity for the good mood (higher post = better)', () => {
    expect(sessionImprovement(sess(1, 9, 3, 7, 'good'))).toBe(4);
  });
});

describe('classifyTier', () => {
  it('emits nothing below the observation floor', () => {
    expect(classifyTier(3, 4, 5, 1, 2)).toBe('none');
  });
  it('emits nothing when the effect is below the gray threshold', () => {
    expect(classifyTier(5, 4, 0.5, 1, 2)).toBe('none');
  });
  it('emits a question in the gray zone (>= gray, < strong)', () => {
    expect(classifyTier(5, 4, 1.5, 1, 2)).toBe('question');
    expect(classifyTier(4, 4, 1, 1, 2)).toBe('question'); // both at floor/boundary
  });
  it('emits a finding at or above the strong threshold', () => {
    expect(classifyTier(5, 4, 2, 1, 2)).toBe('finding');
    expect(classifyTier(10, 4, 4, 1, 2)).toBe('finding');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- patterns.test`
Expected: FAIL — cannot import `sessionImprovement`/`classifyTier` from `@/lib/patterns`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/patterns.ts`:

```ts
import { sessionDateString, type MoodKey, type Session } from '@/lib/storage';
import { toDateString } from '@/lib/dateUtils';

// ─── Pattern engine (Unit A) ─────────────────────────────────────────────────
//
// Pure, on-device. Turns the session log into observational pattern items under
// a tiered-honesty gate: below a floor → nothing; gray zone → a hedged QUESTION;
// strong effect → a confident FINDING. Templated text only — no LLM, no network.

export type Tier = 'none' | 'question' | 'finding';

export interface PatternItem {
  /** Stable per-signal key (also a React key for the insights UI). */
  id: 'time-of-day' | 'day-of-week' | 'consistency';
  /** Templated, in-app-voice phrasing. */
  text: string;
  kind: 'finding' | 'question';
}

// Effect/observation thresholds. Tuned so a flat/random log yields zero findings
// (see the noise-set test) while real effects cross into question/finding.
const MIN_OBS_PER_BUCKET = 4;   // time-of-day & consistency: per-bucket minimum
const EFFECT_GRAY = 1.0;        // improvement-point gap → hedged question
const EFFECT_STRONG = 2.0;      // improvement-point gap → confident finding
const MIN_OBS_PER_WEEKDAY = 3;  // day-of-week: sessions needed on a weekday
const ROUGH_GRAY = 1.5;         // intensity-point gap above other days → question
const ROUGH_STRONG = 2.5;       // intensity-point gap above other days → finding

/** Sign-adjusted so a larger number always means a better outcome: for every
 *  mood except 'good' a LOWER post-score is better, so flip the sign there. */
export function sessionImprovement(s: Session): number {
  return s.mood === 'good' ? s.postScore - s.intensity : s.intensity - s.postScore;
}

function mean(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** The tiered-honesty gate. `obs` is the binding observation count (e.g. the
 *  smaller of two buckets); `effect` is the absolute effect size. Below the
 *  floor or below `gray` → 'none'; >= `strong` → 'finding'; else 'question'. */
export function classifyTier(
  obs: number,
  minObs: number,
  effect: number,
  gray: number,
  strong: number,
): Tier {
  if (obs < minObs || effect < gray) return 'none';
  return effect >= strong ? 'finding' : 'question';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- patterns.test`
Expected: PASS — `sessionImprovement` + `classifyTier` cases.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add lib/patterns.ts lib/__tests__/patterns.test.ts
git commit -m "feat(patterns): tiered-honesty gate + improvement helper"
```

---

### Task 2: Time-of-day signal (`detectTimeOfDay`)

Splits sessions into morning (`getHours() < 12`) vs evening and compares mean improvement. Floor: ≥ `MIN_OBS_PER_BUCKET` in **each** bucket. Effect: absolute gap in improvement points.

**Files:**
- Modify: `lib/patterns.ts`
- Test: `lib/__tests__/patterns.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `lib/__tests__/patterns.test.ts`:

```ts
import { detectTimeOfDay } from '@/lib/patterns';

describe('detectTimeOfDay', () => {
  it('emits a finding when one part of day clearly helps more', () => {
    const sessions = [
      // 4 morning sessions, improvement 4 (int 8 - post 4)
      sess(1, 9, 8, 4), sess(3, 9, 8, 4), sess(5, 9, 8, 4), sess(7, 9, 8, 4),
      // 4 evening sessions, improvement 1 (int 6 - post 5)
      sess(2, 19, 6, 5), sess(4, 19, 6, 5), sess(6, 19, 6, 5), sess(8, 19, 6, 5),
    ];
    const item = detectTimeOfDay(sessions);
    expect(item?.kind).toBe('finding');
    expect(item?.id).toBe('time-of-day');
    expect(item?.text.toLowerCase()).toContain('morning');
  });

  it('emits a hedged question in the gray zone', () => {
    const sessions = [
      // morning improvement 3 (int 7 - post 4)
      sess(1, 9, 7, 4), sess(3, 9, 7, 4), sess(5, 9, 7, 4), sess(7, 9, 7, 4),
      // evening improvement 1.5 (int 6 - post 4.5) → effect 1.5
      sess(2, 19, 6, 4.5), sess(4, 19, 6, 4.5), sess(6, 19, 6, 4.5), sess(8, 19, 6, 4.5),
    ];
    const item = detectTimeOfDay(sessions);
    expect(item?.kind).toBe('question');
    expect(item?.text.toLowerCase()).toContain('morning');
  });

  it('returns null below the per-bucket floor', () => {
    const sessions = [
      sess(1, 9, 8, 4), sess(3, 9, 8, 4), sess(5, 9, 8, 4), // only 3 morning
      sess(2, 19, 6, 5), sess(4, 19, 6, 5), sess(6, 19, 6, 5), sess(8, 19, 6, 5), sess(10, 19, 6, 5),
    ];
    expect(detectTimeOfDay(sessions)).toBeNull();
  });

  it('returns null when the two parts of day are equivalent', () => {
    const sessions = [
      sess(1, 9, 6, 4), sess(3, 9, 6, 4), sess(5, 9, 6, 4), sess(7, 9, 6, 4),   // imp 2
      sess(2, 19, 6, 4), sess(4, 19, 6, 4), sess(6, 19, 6, 4), sess(8, 19, 6, 4), // imp 2
    ];
    expect(detectTimeOfDay(sessions)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- patterns.test`
Expected: FAIL — `detectTimeOfDay` not exported.

- [ ] **Step 3: Implement**

Append to `lib/patterns.ts`:

```ts
/** Time-of-day: does morning or evening reliably help more? Buckets by the
 *  session's LOCAL hour (getHours on the stored epoch ms). */
export function detectTimeOfDay(sessions: Session[]): PatternItem | null {
  const morning: number[] = [];
  const evening: number[] = [];
  for (const s of sessions) {
    const hour = new Date(s.timestamp).getHours();
    (hour < 12 ? morning : evening).push(sessionImprovement(s));
  }
  const obs = Math.min(morning.length, evening.length);
  const mMean = mean(morning);
  const eMean = mean(evening);
  const effect = Math.abs(mMean - eMean);
  const tier = classifyTier(obs, MIN_OBS_PER_BUCKET, effect, EFFECT_GRAY, EFFECT_STRONG);
  if (tier === 'none') return null;

  const part = mMean >= eMean ? 'morning' : 'evening';
  const Part = part === 'morning' ? 'Morning' : 'Evening';
  const text =
    tier === 'finding'
      ? `Your mood lifts most after ${part} sessions.`
      : `${Part} sessions might be landing better for you — worth watching?`;
  return { id: 'time-of-day', text, kind: tier };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- patterns.test`
Expected: PASS — all `detectTimeOfDay` cases.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add lib/patterns.ts lib/__tests__/patterns.test.ts
git commit -m "feat(patterns): time-of-day signal"
```

---

### Task 3: Day-of-week roughness signal (`detectDayOfWeek`)

Finds the weekday where the user shows up most wound up — mean pre-workout `intensity` on that weekday vs all other days. Floor: ≥ `MIN_OBS_PER_WEEKDAY` sessions on the weekday. Effect: intensity-point gap above the rest (only a *rougher* weekday counts, so only a positive gap).

**Files:**
- Modify: `lib/patterns.ts`
- Test: `lib/__tests__/patterns.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `lib/__tests__/patterns.test.ts`. (Weekday is derived from `localDateString`; in June 2026, the 3rd/10th/17th/24th are Wednesdays.)

```ts
import { detectDayOfWeek } from '@/lib/patterns';

describe('detectDayOfWeek', () => {
  it('emits a finding when one weekday runs much rougher', () => {
    const sessions = [
      // 4 Wednesdays at intensity 9
      sess(3, 9, 9, 4), sess(10, 9, 9, 4), sess(17, 9, 9, 4), sess(24, 9, 9, 4),
      // other days at intensity 5 (≤2 per weekday so none else is eligible)
      sess(1, 9, 5, 4), sess(2, 9, 5, 4), sess(4, 9, 5, 4),
      sess(5, 9, 5, 4), sess(8, 9, 5, 4), sess(9, 9, 5, 4),
    ];
    const item = detectDayOfWeek(sessions);
    expect(item?.kind).toBe('finding');
    expect(item?.id).toBe('day-of-week');
    expect(item?.text.toLowerCase()).toContain('wednesday');
  });

  it('emits a question for a milder weekday spike', () => {
    const sessions = [
      sess(3, 9, 7, 4), sess(10, 9, 7, 4), sess(17, 9, 7, 4), // 3 Wednesdays at 7
      sess(1, 9, 5, 4), sess(2, 9, 5, 4), sess(4, 9, 5, 4), sess(5, 9, 5, 4), // others at 5 → effect 2.0
    ];
    const item = detectDayOfWeek(sessions);
    expect(item?.kind).toBe('question');
    expect(item?.text.toLowerCase()).toContain('wednesday');
  });

  it('returns null below the per-weekday floor', () => {
    const sessions = [
      sess(3, 9, 9, 4), sess(10, 9, 9, 4), // only 2 Wednesdays
      sess(1, 9, 5, 4), sess(2, 9, 5, 4), sess(4, 9, 5, 4), sess(5, 9, 5, 4),
    ];
    expect(detectDayOfWeek(sessions)).toBeNull();
  });

  it('returns null when no weekday stands out', () => {
    const sessions = [
      sess(3, 9, 5, 4), sess(10, 9, 5, 4), sess(17, 9, 5, 4), // Wednesdays at 5
      sess(1, 9, 5, 4), sess(2, 9, 5, 4), sess(4, 9, 5, 4),   // others at 5
    ];
    expect(detectDayOfWeek(sessions)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- patterns.test`
Expected: FAIL — `detectDayOfWeek` not exported.

- [ ] **Step 3: Implement**

Append to `lib/patterns.ts`:

```ts
const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** Day-of-week roughness: the weekday with the biggest positive gap in mean
 *  pre-workout intensity vs every other day — "you show up more wound up". */
export function detectDayOfWeek(sessions: Session[]): PatternItem | null {
  const byDow: number[][] = [[], [], [], [], [], [], []];
  for (const s of sessions) {
    const dow = new Date(sessionDateString(s) + 'T00:00:00').getDay();
    byDow[dow].push(s.intensity);
  }
  let best = -1;
  let bestEffect = 0; // only a strictly-rougher weekday qualifies
  for (let dow = 0; dow < 7; dow++) {
    if (byDow[dow].length < MIN_OBS_PER_WEEKDAY) continue;
    const others = byDow.filter((_, i) => i !== dow).flat();
    if (others.length === 0) continue;
    const effect = mean(byDow[dow]) - mean(others);
    if (effect > bestEffect) {
      bestEffect = effect;
      best = dow;
    }
  }
  if (best === -1) return null;

  const tier = classifyTier(byDow[best].length, MIN_OBS_PER_WEEKDAY, bestEffect, ROUGH_GRAY, ROUGH_STRONG);
  if (tier === 'none') return null;

  const day = WEEKDAY_NAMES[best];
  const text =
    tier === 'finding'
      ? `${day}s run rough — you show up more wound up than on your other days.`
      : `Your ${day}s have been running a little rough — anything recurring?`;
  return { id: 'day-of-week', text, kind: tier };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- patterns.test`
Expected: PASS — all `detectDayOfWeek` cases.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add lib/patterns.ts lib/__tests__/patterns.test.ts
git commit -m "feat(patterns): day-of-week roughness signal"
```

---

### Task 4: Consistency signal (`detectConsistency`)

Compares mean improvement on **back-to-back** days (a session the day before) vs **after-gap** days (no session the prior day). Operates at day granularity (a day's improvement = mean of that day's sessions). Floor: ≥ `MIN_OBS_PER_BUCKET` days in each group.

**Files:**
- Modify: `lib/patterns.ts`
- Test: `lib/__tests__/patterns.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `lib/__tests__/patterns.test.ts`. (All sessions share hour 9 — irrelevant to this signal, which keys on dates. The run Jun 1–5 makes Jun 2–5 "back-to-back"; the rest are isolated "after-gap" days.)

```ts
import { detectConsistency } from '@/lib/patterns';

describe('detectConsistency', () => {
  it('emits a finding when stacked days clearly help more', () => {
    const sessions = [
      // Run Jun 1-5: Jun 1 is after-gap; Jun 2-5 are back-to-back, improvement 4.
      sess(1, 9, 6, 5),                                   // after-gap, imp 1
      sess(2, 9, 8, 4), sess(3, 9, 8, 4), sess(4, 9, 8, 4), sess(5, 9, 8, 4), // back-to-back, imp 4
      // Isolated after-gap days, improvement 1 → gap group has 4 days total.
      sess(9, 9, 6, 5), sess(11, 9, 6, 5), sess(13, 9, 6, 5),
    ];
    const item = detectConsistency(sessions);
    expect(item?.kind).toBe('finding');
    expect(item?.id).toBe('consistency');
    expect(item?.text.toLowerCase()).toContain("skip"); // "don't skip days"
  });

  it('emits a question for a milder consistency effect', () => {
    const sessions = [
      sess(1, 9, 6, 4.5),                                       // after-gap, imp 1.5
      sess(2, 9, 7, 4), sess(3, 9, 7, 4), sess(4, 9, 7, 4), sess(5, 9, 7, 4), // back-to-back, imp 3
      sess(9, 9, 6, 4.5), sess(11, 9, 6, 4.5), sess(13, 9, 6, 4.5),           // gap, imp 1.5 → effect 1.5
    ];
    const item = detectConsistency(sessions);
    expect(item?.kind).toBe('question');
  });

  it('returns null below the per-group floor', () => {
    const sessions = [
      // Run Jun 1-3 → only 2 back-to-back days (Jun 2, 3).
      sess(1, 9, 6, 5), sess(2, 9, 8, 4), sess(3, 9, 8, 4),
      sess(9, 9, 6, 5), sess(11, 9, 6, 5), sess(13, 9, 6, 5), sess(15, 9, 6, 5),
    ];
    expect(detectConsistency(sessions)).toBeNull();
  });

  it('returns null when there are no back-to-back days at all', () => {
    const sessions = [
      sess(1, 9, 8, 4), sess(5, 9, 8, 4), sess(9, 9, 8, 4),
      sess(13, 9, 6, 5), sess(17, 9, 6, 5), sess(21, 9, 6, 5),
    ];
    expect(detectConsistency(sessions)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- patterns.test`
Expected: FAIL — `detectConsistency` not exported.

- [ ] **Step 3: Implement**

Append to `lib/patterns.ts`:

```ts
/** The local YYYY-MM-DD calendar day before `dateStr` (DST-safe via setDate). */
function prevDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return toDateString(d.getTime());
}

/** Consistency: does stacking days back-to-back help more than starting cold
 *  after a gap? Compares mean day-level improvement between the two groups. */
export function detectConsistency(sessions: Session[]): PatternItem | null {
  // Day-level mean improvement.
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const s of sessions) {
    const d = sessionDateString(s);
    const agg = byDay.get(d) ?? { sum: 0, count: 0 };
    agg.sum += sessionImprovement(s);
    agg.count += 1;
    byDay.set(d, agg);
  }
  const present = new Set(byDay.keys());
  const backToBack: number[] = [];
  const afterGap: number[] = [];
  for (const [d, agg] of byDay) {
    const dayImprovement = agg.sum / agg.count;
    (present.has(prevDay(d)) ? backToBack : afterGap).push(dayImprovement);
  }

  const obs = Math.min(backToBack.length, afterGap.length);
  const bMean = mean(backToBack);
  const gMean = mean(afterGap);
  const effect = Math.abs(bMean - gMean);
  const tier = classifyTier(obs, MIN_OBS_PER_BUCKET, effect, EFFECT_GRAY, EFFECT_STRONG);
  if (tier === 'none') return null;

  const stackedBetter = bMean >= gMean;
  const text =
    tier === 'finding'
      ? stackedBetter
        ? "You get more out of your sessions when you don't skip days."
        : 'A day off between sessions seems to set up a better one.'
      : stackedBetter
        ? 'Stacking days back-to-back might be working better — worth keeping up?'
        : 'A rest day between sessions might be helping — worth noticing?';
  return { id: 'consistency', text, kind: tier };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- patterns.test`
Expected: PASS — all `detectConsistency` cases.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add lib/patterns.ts lib/__tests__/patterns.test.ts
git commit -m "feat(patterns): consistency signal"
```

---

### Task 5: `buildPatterns` aggregator + noise-set guarantee

Composes the three detectors, drops nulls, and orders **findings before questions**. The headline test: a flat/random noise fixture must produce **zero findings** (and, here, zero items) — the credibility guarantee.

**Files:**
- Modify: `lib/patterns.ts`
- Test: `lib/__tests__/patterns.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `lib/__tests__/patterns.test.ts`. The ordering fixture is hand-computed to fire **exactly** consistency (finding) + day-of-week (question), with time-of-day silenced (every session at hour 9 → the evening bucket is empty). See the inline arithmetic.

```ts
import { buildPatterns } from '@/lib/patterns';

describe('buildPatterns', () => {
  it('produces ZERO findings on a flat/noise session set', () => {
    // Uniform improvement (imp 2) and intensity (5); alternating morning/evening;
    // no two days consecutive; no weekday reaching the floor. Nothing must fire.
    const noise = [
      sess(1, 9, 5, 3), sess(3, 19, 5, 3), sess(5, 9, 5, 3), sess(7, 19, 5, 3),
      sess(9, 9, 5, 3), sess(11, 19, 5, 3), sess(13, 9, 5, 3), sess(15, 19, 5, 3),
      sess(17, 9, 5, 3), sess(19, 19, 5, 3),
    ];
    const items = buildPatterns(noise);
    expect(items.filter((i) => i.kind === 'finding')).toHaveLength(0);
    expect(items).toEqual([]); // gray zone is quiet too on genuine noise
  });

  it('orders findings before questions', () => {
    // All hour 9 → time-of-day silent (evening bucket empty).
    // Consistency: Jun 2-5 back-to-back (imp 4) vs 6 after-gap days (imp 1) → FINDING.
    // Day-of-week: 3 Saturdays (Jun 13,20,27) at intensity 9 vs others ~7.14 → effect ~1.86 → QUESTION.
    const sessions = [
      sess(1, 9, 6, 5),                                                   // after-gap, imp 1, Mon
      sess(2, 9, 8, 4), sess(3, 9, 8, 4), sess(4, 9, 8, 4), sess(5, 9, 8, 4), // back-to-back, imp 4
      sess(9, 9, 6, 5), sess(11, 9, 6, 5),                                // after-gap, imp 1
      sess(13, 9, 9, 8), sess(20, 9, 9, 8), sess(27, 9, 9, 8),            // Saturdays, int 9, imp 1
    ];
    const items = buildPatterns(sessions);
    const kinds = items.map((i) => i.kind);
    expect(kinds).toContain('finding');
    expect(kinds).toContain('question');
    // every finding precedes every question
    expect(kinds.lastIndexOf('finding')).toBeLessThan(kinds.indexOf('question'));
  });

  it('returns an empty list when there is no data', () => {
    expect(buildPatterns([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- patterns.test`
Expected: FAIL — `buildPatterns` not exported.

- [ ] **Step 3: Implement**

Append to `lib/patterns.ts`:

```ts
/** The public engine: run every signal, drop the silent ones, and order
 *  confident findings ahead of hedged questions (the insights UI renders them
 *  in this order; the free-teaser pick is the UI's concern, not the engine's).
 *  A fourth detector (sleep/steps) is added in the per-session-health plan. */
export function buildPatterns(sessions: Session[]): PatternItem[] {
  const detected = [
    detectTimeOfDay(sessions),
    detectDayOfWeek(sessions),
    detectConsistency(sessions),
  ].filter((x): x is PatternItem => x !== null);

  const findings = detected.filter((i) => i.kind === 'finding');
  const questions = detected.filter((i) => i.kind === 'question');
  return [...findings, ...questions];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- patterns.test`
Expected: PASS — including the zero-findings noise guarantee and the ordering invariant.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test`
Expected: PASS — all suites (the Plan-1/Plan-2 suites plus the new patterns suite).
Run: `npm run typecheck`
Expected: no errors.
Run: `npm run lint:ci`
Expected: clean (lint covers `lib/`).

- [ ] **Step 6: Commit**

```bash
git add lib/patterns.ts lib/__tests__/patterns.test.ts
git commit -m "feat(patterns): buildPatterns aggregator + zero-findings noise guarantee"
```

---

## Self-Review

**1. Spec coverage (Unit A of `2026-06-11-adaptive-intelligence-design.md`):**
- "Pure, on-device, no network, no LLM. Input: the session log. Output: an ordered list of `{ text, kind: 'finding' | 'question' }`, already phrased in the app's voice. Templated text." → `buildPatterns` returns `PatternItem[]` (`{ id, text, kind }`; `id` added for the UI's React keys), templated, pure. ✓ (The `id` field is a superset of the spec's `{text, kind}`, harmless for the UI.)
- Signal: time-of-day improvement morning vs evening → Task 2. ✓
- Signal: day-of-week roughness (high-intensity clustering on a weekday) → Task 3. ✓
- Signal: consistency effect (back-to-back vs after gaps) → Task 4. ✓
- Signal: sleep/steps correlation "only once per-session health capture (Unit C) has accrued enough data" → **correctly deferred to Plan 4** (Session has no health fields yet; the engine is structured so a 4th detector + a line in `buildPatterns` slots in). Noted in `buildPatterns`' doc comment and the plan header. ✓
- Tiered honesty gate (below floor → nothing; gray → question; strong → finding), constants in `lib/patterns.ts`, "unit-tested against fixture session sets including a noise set that must produce zero findings" → `classifyTier` + the Task 5 noise test (asserts zero findings *and* zero items). ✓
- "Floor/threshold constants (min observations per bucket, min effect size) defined in `lib/patterns.ts`" → `MIN_OBS_PER_BUCKET`, `EFFECT_GRAY/STRONG`, `MIN_OBS_PER_WEEKDAY`, `ROUGH_GRAY/STRONG`. ✓
- Open item "exact floor/threshold constants + the fixture session sets (including the noise set) to calibrate them" → resolved here with concrete values and co-designed fixtures. ✓
- Open item "templated phrasings per pattern type (finding vs question variants)" → resolved: each detector has finding+question (and directional) variants. ✓

**2. Correctly out of scope (later plans):** the insights "noticed" UI + free-teaser/Pro gating → Plan 6; the sleep/steps signal + Session health fields → Plan 4. This plan reads only existing `Session` fields (`mood`, `intensity`, `postScore`, `timestamp`, `localDateString`), so it's back-compat with old records and needs no infra task (Plan-2 vitest alias already covers `@/lib/*` under Node).

**3. Placeholder scan:** none — every step has concrete code, fixtures, and commands. The ordering fixture's arithmetic is worked out inline (consistency effect 3 → finding; Saturday intensity 9 vs others 50/7≈7.14 → effect ≈1.86 ∈ [1.5, 2.5) → question; time-of-day silent because all sessions are hour 9 so the evening bucket is empty).

**4. Type consistency:** `Tier` (`'none'|'question'|'finding'`) is the gate's return; `PatternItem.kind` is the narrower `'finding'|'question'` (detectors return `null` for `'none'`, then assign the narrowed `tier`). `classifyTier(obs, minObs, effect, gray, strong)` is called identically in all three detectors. `sessionImprovement`, `mean`, `prevDay`, `WEEKDAY_NAMES`, and the threshold constants are each defined once and used consistently. `id` values (`'time-of-day'`, `'day-of-week'`, `'consistency'`) match the `PatternItem.id` union exactly. Fixture helpers (`at`, `dateStr`, `sess`) are defined once in Task 1 and reused by Tasks 2–5.
