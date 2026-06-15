# Per-Session Health Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At session-log time, attach the current on-device Health snapshot (steps today, sleep last night) to the persisted `Session` record as optional fields, then light up the pattern engine's deferred **sleep** signal so insights can say "you get more out of sessions after a fuller night's sleep" — all on-device, privacy-clean, no network, no new store declaration.

**Architecture:** A new dependency-free `lib/session-health.ts` holds the pure `healthFieldsFromSnapshot` mapper (only `import type` statements → it never pulls `react-native`, so vitest can unit-test it under Node). `lib/storage.ts` gains a `SessionHealthFields` interface that `Session` extends (additive optional fields → back-compat with old records). `lib/health.ts` gets the async `captureSessionHealth()` wrapper, called at each of the four session-logging sites to spread health into the new session. `lib/patterns.ts` gains a pure `detectSleep` detector wired into `buildPatterns` (the 4th signal the pattern-engine plan deferred).

**Tech Stack:** TypeScript, vitest (Node, pure-logic units — the existing `@`-alias + AsyncStorage stub already make `lib/*` importable; `lib/session-health.ts` has no runtime imports at all). The wiring (call sites) is RN/UI code verified by `typecheck` + `lint` + on-device, not vitest. No new runtime deps.

**Spec:** `docs/superpowers/specs/2026-06-11-adaptive-intelligence-design.md` (Unit C — Per-session health capture; and Unit A's sleep/steps signal, which this enables). The insights UI that renders the new pattern is **Plan 6**.

**Scope note (YAGNI):** This plan ships the **sleep** signal only (sleep-last-night → this-session improvement is the clean causal story). Steps-today is captured and stored, but a steps *pattern detector* is intentionally deferred — steps-so-far-today correlated with the same session's improvement is causally weak. The stored `stepsToday` field is forward-compatible for a future steps signal if the data justifies one.

---

### Task 1: `Session` health fields + pure `healthFieldsFromSnapshot` mapper

Add the optional health fields to the `Session` shape and a pure mapper that copies only genuinely-present numeric readings from a `HealthSnapshot` (null/unavailable → omitted, so a session logged without health simply lacks the fields).

**Files:**
- Modify: `lib/storage.ts`
- Create: `lib/session-health.ts`
- Test: `lib/__tests__/session-health.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/session-health.test.ts`. It imports only the pure mapper (whose module has no runtime deps) and passes plain object literals — it never loads `lib/health.ts` (which imports `react-native`).

```ts
import { describe, it, expect } from 'vitest';
import { healthFieldsFromSnapshot } from '@/lib/session-health';

// A structural HealthSnapshot (no import of lib/health needed — TS accepts the shape).
function snap(over: Record<string, unknown>) {
  return {
    connected: true,
    available: true,
    platform: 'apple',
    stepsToday: null,
    sleepHoursLastNight: null,
    ...over,
  } as Parameters<typeof healthFieldsFromSnapshot>[0];
}

describe('healthFieldsFromSnapshot', () => {
  it('copies both readings when present', () => {
    expect(healthFieldsFromSnapshot(snap({ stepsToday: 5000, sleepHoursLastNight: 7.5 }))).toEqual({
      stepsToday: 5000,
      sleepHoursLastNight: 7.5,
    });
  });

  it('omits fields that are null (unavailable)', () => {
    expect(healthFieldsFromSnapshot(snap({ stepsToday: null, sleepHoursLastNight: null }))).toEqual({});
  });

  it('includes only the reading that is present', () => {
    expect(healthFieldsFromSnapshot(snap({ stepsToday: 8200, sleepHoursLastNight: null }))).toEqual({
      stepsToday: 8200,
    });
  });

  it('omits non-finite numbers (NaN / Infinity)', () => {
    expect(healthFieldsFromSnapshot(snap({ stepsToday: NaN, sleepHoursLastNight: Infinity }))).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- session-health`
Expected: FAIL — cannot import `healthFieldsFromSnapshot` from `@/lib/session-health`.

- [ ] **Step 3: Add `SessionHealthFields` to `lib/storage.ts` and make `Session` extend it**

In `lib/storage.ts`, find the `Session` interface:

```ts
export interface Session {
  id: string;
  mood: MoodKey;
  intensity: number;
  postScore: number;
  workoutName: string;
  workoutId?: string;
  duration: number;
  timestamp: number;
  rating?: 'yes' | 'somewhat' | 'no';
  note?: string;
  lightDay?: boolean;
```

Insert a new exported interface directly ABOVE it, and change the `Session` declaration line to extend it:

```ts
/** Optional on-device health readings captured at session-log time
 *  (HealthKit / Health Connect). Absent on sessions logged without health
 *  sync — purely additive, so old records remain valid (no schema bump). */
export interface SessionHealthFields {
  /** Steps recorded for the day at log time, if health was available. */
  stepsToday?: number;
  /** Hours of sleep the night before the session, if available. */
  sleepHoursLastNight?: number;
}

export interface Session extends SessionHealthFields {
  id: string;
```

(Leave the rest of the `Session` body unchanged. `sanitizeSession`/`readVersioned`/`writeVersioned` need no changes — the new fields are optional and pass through untouched.)

- [ ] **Step 4: Create the pure mapper `lib/session-health.ts`**

```ts
import type { HealthSnapshot } from './health';
import type { SessionHealthFields } from './storage';

/** Map a Health snapshot to the optional Session health fields, including only
 *  genuinely-present finite readings. null/unavailable/NaN → omitted, so a
 *  session logged without health simply lacks the fields (back-compat clean).
 *
 *  Both imports are type-only, so this module has NO runtime dependencies — it
 *  never loads lib/health (react-native) or lib/storage, which keeps it unit-
 *  testable under Node. */
export function healthFieldsFromSnapshot(snapshot: HealthSnapshot): SessionHealthFields {
  const fields: SessionHealthFields = {};
  if (typeof snapshot.stepsToday === 'number' && Number.isFinite(snapshot.stepsToday)) {
    fields.stepsToday = snapshot.stepsToday;
  }
  if (
    typeof snapshot.sleepHoursLastNight === 'number' &&
    Number.isFinite(snapshot.sleepHoursLastNight)
  ) {
    fields.sleepHoursLastNight = snapshot.sleepHoursLastNight;
  }
  return fields;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- session-health`
Expected: PASS — all 4 mapper cases.

- [ ] **Step 6: Typecheck + lint + commit**

Run: `npm run typecheck`
Expected: no errors.
Run: `npm run lint:ci`
Expected: clean (lint covers `lib/`).

```bash
git add lib/storage.ts lib/session-health.ts lib/__tests__/session-health.test.ts
git commit -m "feat(health): Session health fields + pure snapshot mapper"
```

---

### Task 2: `captureSessionHealth` + wire the four session-logging sites

Add the async capture wrapper to `lib/health.ts`, then call it at every session-creation site so the snapshot rides onto the persisted record. This is RN/integration code — verified by typecheck + lint + read-through (and on-device in Plan 7), not vitest.

**Files:**
- Modify: `lib/health.ts`
- Modify: `app/home.tsx`
- Modify: `app/bad-day.tsx`
- Modify: `app/post-workout.tsx`

- [ ] **Step 1: Add `captureSessionHealth` to `lib/health.ts`**

`lib/health.ts` already exports `async function getHealthSnapshot(): Promise<HealthSnapshot>`. Add the import at the top of the file (alongside the existing imports) and the wrapper near `getHealthSnapshot`:

```ts
import { healthFieldsFromSnapshot } from './session-health';
import type { SessionHealthFields } from './storage';
```

```ts
/** Capture the current health snapshot as Session health fields for logging.
 *  Returns {} when health is unavailable/disabled or the read fails, so callers
 *  can spread it into a Session unconditionally. No-op-safe and never throws. */
export async function captureSessionHealth(): Promise<SessionHealthFields> {
  try {
    return healthFieldsFromSnapshot(await getHealthSnapshot());
  } catch {
    return {};
  }
}
```

(This creates a runtime edge `health.ts → session-health.ts`, which only `import type`s back — no cycle. `getHealthSnapshot` already short-circuits to a disconnected snapshot when health isn't set up, so this stays cheap when the user hasn't enabled health.)

- [ ] **Step 2: Confirm the four logging sites (no edit yet)**

Run: `npx rg -n "addSession\(|addSessionToContext\(" app/`
Expected: exactly these four creation sites (the context's `addSession` simply forwards the `Session` to storage — confirmed in `contexts/SessionsContext.tsx:70-71`, so spreading extra fields into the session object flows through):
- `app/home.tsx` — `handleJustLogIt` (`await addSession(session)`)
- `app/home.tsx` — `handleSameAsYesterdayLog` (`await addSession(session)`)
- `app/bad-day.tsx` — `await addSession({ ... })`
- `app/post-workout.tsx` — `await addSessionToContext({ ... })`

If `rg` shows any creation site beyond these four, STOP and report it — the plan assumes these four.

- [ ] **Step 3: Wire `app/home.tsx` (both quick-log handlers)**

`app/home.tsx` already imports from `@/lib/health` is NOT guaranteed — add `captureSessionHealth` to the existing `@/lib/health` import if present, otherwise add a new import line:

```ts
import { captureSessionHealth } from '@/lib/health';
```

In `handleJustLogIt`, change:

```ts
    const session = {
      id: createSessionId(),
      mood: selectedMood,
      intensity,
      postScore: intensity,
      workoutName: 'Mood check-in',
      duration: 0,
      timestamp: Date.now(),
      lightDay: true as const,
    };
    await addSession(session);
```

to:

```ts
    const health = await captureSessionHealth();
    const session = {
      id: createSessionId(),
      mood: selectedMood,
      intensity,
      postScore: intensity,
      workoutName: 'Mood check-in',
      duration: 0,
      timestamp: Date.now(),
      lightDay: true as const,
      ...health,
    };
    await addSession(session);
```

In `handleSameAsYesterdayLog`, change:

```ts
    const session = {
      id: createSessionId(),
      mood: lastSession.mood,
      intensity: lastSession.intensity,
      postScore: lastSession.intensity,
      workoutName: 'Same as yesterday',
      duration: 0,
      timestamp: Date.now(),
      lightDay: true as const,
    };
    await addSession(session);
```

to:

```ts
    const health = await captureSessionHealth();
    const session = {
      id: createSessionId(),
      mood: lastSession.mood,
      intensity: lastSession.intensity,
      postScore: lastSession.intensity,
      workoutName: 'Same as yesterday',
      duration: 0,
      timestamp: Date.now(),
      lightDay: true as const,
      ...health,
    };
    await addSession(session);
```

- [ ] **Step 4: Wire `app/bad-day.tsx`**

Add `captureSessionHealth` to the existing `@/lib/health` import (or a new import line). Change `handleLog`'s body from:

```ts
    try {
      await addSession({
        id: createSessionId(),
        mood,
        intensity,
        postScore,
        workoutName: MICRO_WORKOUT_NAME,
        workoutId: MICRO_WORKOUT_ID,
        duration: MICRO_WORKOUT_DURATION_MIN,
        timestamp: Date.now(),
        lightDay: true,
        rating: 'somewhat',
```

to (insert the capture before `addSession`, spread `...health` into the object — keep every other field, including the rest of the object after `rating` that this excerpt cuts off):

```ts
    try {
      const health = await captureSessionHealth();
      await addSession({
        id: createSessionId(),
        mood,
        intensity,
        postScore,
        workoutName: MICRO_WORKOUT_NAME,
        workoutId: MICRO_WORKOUT_ID,
        duration: MICRO_WORKOUT_DURATION_MIN,
        timestamp: Date.now(),
        lightDay: true,
        rating: 'somewhat',
        ...health,
```

(Read the full object literal first; add `...health,` as the LAST property before the closing `})`. Do not drop any existing properties.)

- [ ] **Step 5: Wire `app/post-workout.tsx`**

Add `captureSessionHealth` to the existing `@/lib/health` import (or a new import line). Read the `await addSessionToContext({ ... })` call starting at line ~188, then insert `const health = await captureSessionHealth();` immediately before it and add `...health,` as the last property of the object passed to `addSessionToContext`. Example shape:

```ts
      const health = await captureSessionHealth();
      await addSessionToContext({
        id: createSessionId(),
        // ...all existing fields unchanged...
        ...health,
      });
```

(Read the actual object first and preserve every existing field; only add the capture line and the `...health,` spread.)

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck`
Expected: no errors — `...health` (a `SessionHealthFields`) spreads cleanly into each `Session` literal.
Run: `npm run lint:ci`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add lib/health.ts app/home.tsx app/bad-day.tsx app/post-workout.tsx
git commit -m "feat(health): capture per-session health snapshot at all log sites"
```

---

### Task 3: `detectSleep` pattern signal + wire into `buildPatterns`

The payoff: a pure detector that compares mean improvement on rested (≥ 7h) vs short-sleep (< 7h) nights, gated through the same tiered-honesty `classifyTier`. It only considers sessions that captured sleep, so it stays silent until health data has accrued.

**Files:**
- Modify: `lib/patterns.ts`
- Test: `lib/__tests__/patterns.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `lib/__tests__/patterns.test.ts` (the file already imports `buildPatterns` and defines `sess`; sleep is attached by spreading onto a `sess(...)`):

```ts
import { detectSleep } from '@/lib/patterns';

describe('detectSleep', () => {
  it('emits a finding when rested nights clearly help more', () => {
    const sessions = [
      // 4 rested nights (sleep 8h), improvement 4 (int 8 - post 4)
      { ...sess(1, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(2, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(3, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(4, 9, 8, 4), sleepHoursLastNight: 8 },
      // 4 short nights (sleep 5h), improvement 1 (int 6 - post 5)
      { ...sess(5, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(6, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(7, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(8, 9, 6, 5), sleepHoursLastNight: 5 },
    ];
    const item = detectSleep(sessions);
    expect(item?.kind).toBe('finding');
    expect(item?.id).toBe('sleep');
    expect(item?.text.toLowerCase()).toContain('sleep');
  });

  it('emits a hedged question in the gray zone', () => {
    const sessions = [
      { ...sess(1, 9, 7, 4), sleepHoursLastNight: 8 }, // imp 3
      { ...sess(2, 9, 7, 4), sleepHoursLastNight: 8 },
      { ...sess(3, 9, 7, 4), sleepHoursLastNight: 8 },
      { ...sess(4, 9, 7, 4), sleepHoursLastNight: 8 },
      { ...sess(5, 9, 6, 4.5), sleepHoursLastNight: 5 }, // imp 1.5 → effect 1.5
      { ...sess(6, 9, 6, 4.5), sleepHoursLastNight: 5 },
      { ...sess(7, 9, 6, 4.5), sleepHoursLastNight: 5 },
      { ...sess(8, 9, 6, 4.5), sleepHoursLastNight: 5 },
    ];
    expect(detectSleep(sessions)?.kind).toBe('question');
  });

  it('returns null below the per-bucket floor', () => {
    const sessions = [
      { ...sess(1, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(2, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(3, 9, 8, 4), sleepHoursLastNight: 8 }, // only 3 rested
      { ...sess(5, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(6, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(7, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(8, 9, 6, 5), sleepHoursLastNight: 5 },
    ];
    expect(detectSleep(sessions)).toBeNull();
  });

  it('ignores sessions that did not capture sleep (quiet until data accrues)', () => {
    const sessions = [
      // 4 rested with sleep, but the other 4 have no sleep field → short bucket empty
      { ...sess(1, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(2, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(3, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(4, 9, 8, 4), sleepHoursLastNight: 8 },
      sess(5, 9, 6, 5), sess(6, 9, 6, 5), sess(7, 9, 6, 5), sess(8, 9, 6, 5),
    ];
    expect(detectSleep(sessions)).toBeNull();
  });
});

describe('buildPatterns includes the sleep signal', () => {
  it('surfaces a sleep finding (and nothing spurious) on sleep-only data', () => {
    // Spread across weekdays (≤2 each) and non-consecutive days, all hour 9, so
    // time-of-day / day-of-week / consistency stay silent — only sleep fires.
    const sessions = [
      { ...sess(1, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(5, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(9, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(13, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(17, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(21, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(25, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(28, 9, 6, 5), sleepHoursLastNight: 5 },
    ];
    const items = buildPatterns(sessions);
    expect(items.some((i) => i.id === 'sleep' && i.kind === 'finding')).toBe(true);
    expect(items.filter((i) => i.kind === 'finding')).toHaveLength(1);
  });
});
```

(Add `detectSleep` to an existing `@/lib/patterns` import line or a new one — keep it tidy.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- patterns.test`
Expected: FAIL — `detectSleep` not exported.

- [ ] **Step 3: Implement**

In `lib/patterns.ts`, first extend the `PatternItem.id` union. Find:

```ts
  /** Stable per-signal key (also a React key for the insights UI). */
  id: 'time-of-day' | 'day-of-week' | 'consistency';
```

and change it to:

```ts
  /** Stable per-signal key (also a React key for the insights UI). */
  id: 'time-of-day' | 'day-of-week' | 'consistency' | 'sleep';
```

Then add the threshold constant near the other constants (after `ROUGH_STRONG`):

```ts
const REST_THRESHOLD_HOURS = 7; // sleep at/above this counts as a "rested" night
```

Then APPEND the detector (place it after `detectConsistency`, before `buildPatterns`):

```ts
/** Sleep: do sessions after a fuller night's sleep improve more? Compares mean
 *  improvement on rested (>= REST_THRESHOLD_HOURS) vs short nights. Only sessions
 *  that captured `sleepHoursLastNight` are considered, so it's silent until the
 *  per-session health capture has accrued enough data. */
export function detectSleep(sessions: Session[]): PatternItem | null {
  const rested: number[] = [];
  const short: number[] = [];
  for (const s of sessions) {
    if (typeof s.sleepHoursLastNight !== 'number') continue;
    (s.sleepHoursLastNight >= REST_THRESHOLD_HOURS ? rested : short).push(sessionImprovement(s));
  }
  const obs = Math.min(rested.length, short.length);
  const rMean = mean(rested);
  const sMean = mean(short);
  const effect = Math.abs(rMean - sMean);
  const tier = classifyTier(obs, MIN_OBS_PER_BUCKET, effect, EFFECT_GRAY, EFFECT_STRONG);
  if (tier === 'none') return null;

  const restedBetter = rMean >= sMean;
  const text =
    tier === 'finding'
      ? restedBetter
        ? 'You get more out of your sessions after a fuller night of sleep.'
        : 'Your sessions have been landing better on less sleep — worth a look.'
      : restedBetter
        ? 'A fuller night of sleep might be helping your sessions — worth watching?'
        : 'Shorter nights might be tracking with better sessions — odd, worth noticing?';
  return { id: 'sleep', text, kind: tier };
}
```

Finally, add `detectSleep` to the `buildPatterns` detector list. Find:

```ts
  const detected = [
    detectTimeOfDay(sessions),
    detectDayOfWeek(sessions),
    detectConsistency(sessions),
  ].filter((x): x is PatternItem => x !== null);
```

and change it to:

```ts
  const detected = [
    detectTimeOfDay(sessions),
    detectDayOfWeek(sessions),
    detectConsistency(sessions),
    detectSleep(sessions),
  ].filter((x): x is PatternItem => x !== null);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- patterns.test`
Expected: PASS — the 5 `detectSleep` cases + the `buildPatterns includes the sleep signal` case, and all prior patterns tests still green (the existing noise/ordering fixtures have no `sleepHoursLastNight`, so `detectSleep` returns null on them — unchanged behavior).

- [ ] **Step 5: Full suite + typecheck + lint**

Run: `npm test`
Expected: PASS — all suites.
Run: `npm run typecheck`
Expected: no errors.
Run: `npm run lint:ci`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/patterns.ts lib/__tests__/patterns.test.ts
git commit -m "feat(patterns): sleep signal (rested vs short nights)"
```

---

## Self-Review

**1. Spec coverage (Unit C + Unit A's sleep signal):**
- "At session-log time, attach the current Health snapshot (steps today, sleep last night, via the existing `getHealthSnapshot`) onto the persisted session record (new optional fields)" → Task 1 (`SessionHealthFields`, `Session extends`) + Task 2 (`captureSessionHealth` at all four log sites). ✓
- "On-device, privacy-clean — health data already on the device, stored locally with the session. No network, no new store declaration." → `captureSessionHealth` reads the existing on-device snapshot and stores it in the local session record; nothing transmitted. ✓ (No store-form change — the Health declaration already covers steps/sleep read on-device.)
- "Enables Unit A's sleep/steps signals over time" → Task 3 (`detectSleep` wired into `buildPatterns`). ✓
- "back-compat for existing records lacking them" (spec open item) → fields are optional and additive; `sanitizeSession`/versioned reads untouched; `detectSleep` skips sessions without `sleepHoursLastNight`. ✓
- "The `Session` health fields' shape" (spec open item) → `stepsToday?: number`, `sleepHoursLastNight?: number`, mirroring `HealthSnapshot` field names; `healthFieldsFromSnapshot` is the single mapper, unit-tested. ✓

**2. Correctly out of scope / deferred:** the insights UI rendering the sleep pattern + free/Pro gating → Plan 6; the steps *pattern detector* → deliberately deferred (YAGNI; weak causality), though `stepsToday` is captured for the future; the day-of-week finding-floor calibration carried over from Plan 3 → Plan 6.

**3. Placeholder scan:** none — every step has concrete code, exact edit targets, and commands. The two RN call-site edits that excerpt-cut a larger object literal (bad-day, post-workout) explicitly instruct "read the full object, add `...health,` as the last property, preserve all existing fields."

**4. Type consistency:** `SessionHealthFields { stepsToday?: number; sleepHoursLastNight?: number }` is defined once in `storage.ts`; `Session extends` it; `healthFieldsFromSnapshot` returns it; `captureSessionHealth` returns it; the call sites spread it (`...health`) into `Session` literals. `HealthSnapshot.stepsToday`/`.sleepHoursLastNight` (from `lib/health.ts`, both `number | null`) are the mapper's source fields — names match. `detectSleep` reads `Session.sleepHoursLastNight` and returns a `PatternItem` whose `id` union now includes `'sleep'`. `REST_THRESHOLD_HOURS`, `MIN_OBS_PER_BUCKET`, `EFFECT_GRAY`, `EFFECT_STRONG`, `classifyTier`, `sessionImprovement`, `mean` are all reused from the existing pattern engine.

**5. Test-graph safety:** `lib/session-health.ts` uses only `import type` (both `HealthSnapshot` and `SessionHealthFields`) → esbuild erases them → the module has zero runtime imports → vitest loads it under Node without ever touching `react-native`. `lib/patterns.ts` already loads under Node (existing alias/stub). Wiring code in `app/*.tsx` and `lib/health.ts` is not vitest-tested (RN) — verified by typecheck + lint here and on-device in Plan 7.
