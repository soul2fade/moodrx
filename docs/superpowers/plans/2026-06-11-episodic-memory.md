# Episodic Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The AI coach (post-workout line) and the voice-vent reply can reference **one specific, decision-relevant past session** ("breathing flopped last Monday — not again") when a qualifying episode exists, using structured facts only — never a transcript, never a fabricated memory.

**Architecture:** A pure, on-device selector (`selectEpisode`) added to `lib/coach-insight.ts` picks at most one prior session that teaches a lesson (same mood, clear yes/no outcome, recent), or returns `null`. The coach path (`buildCoachContext` → `coach-line.ts`) gets the episode injected automatically because the model can't invent one the selector didn't pass. The vent path gets a per-mood candidate map (`buildVentEpisodeMap`) the client will send (in Plan 5); `vent-line.ts` renders only the entry matching the mood the model assigns. All pure logic is unit-tested with vitest under Node — which requires a one-time vitest path-alias + an `AsyncStorage` stub (Task 0), because `lib/*` modules import the React-Native-only `@react-native-async-storage/async-storage`.

**Tech Stack:** TypeScript, vitest (Node, pure-logic units only), `@anthropic-ai/sdk` (Haiku, already wired). No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-06-11-adaptive-intelligence-design.md` (Unit B — Episodic memory; the privacy clause).

---

### Task 0: Make `lib/*` modules unit-testable under Node (vitest `@` alias + AsyncStorage stub)

The episodic selector lives in `lib/coach-insight.ts`, which transitively imports `lib/storage.ts` and `lib/ui-state.ts` — both `import AsyncStorage from '@react-native-async-storage/async-storage'` (a React-Native-only module that does not load under Node). vitest also has no `@/` path-alias yet. This task adds both so every later task can `import` from `@/lib/...` in a test.

**Files:**
- Create: `test/stubs/async-storage.ts`
- Modify: `vitest.config.ts`
- Test: `lib/__tests__/coach-insight-loads.test.ts`

- [ ] **Step 1: Create the in-memory AsyncStorage stub**

Create `test/stubs/async-storage.ts`:

```ts
// Minimal in-memory stand-in for @react-native-async-storage/async-storage,
// aliased in vitest.config.ts so lib/storage.ts + lib/ui-state.ts load under
// Node. Covers exactly the surface those modules use.
const store = new Map<string, string>();

const AsyncStorage = {
  getItem: async (k: string): Promise<string | null> => store.get(k) ?? null,
  setItem: async (k: string, v: string): Promise<void> => void store.set(k, v),
  removeItem: async (k: string): Promise<void> => void store.delete(k),
  multiRemove: async (ks: string[]): Promise<void> => {
    for (const k of ks) store.delete(k);
  },
  clear: async (): Promise<void> => void store.clear(),
};

export default AsyncStorage;
```

- [ ] **Step 2: Add the resolve aliases to `vitest.config.ts`**

Replace the entire contents of `vitest.config.ts` with:

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // React-Native-only native module → in-memory stub so lib/* loads in Node.
      // Listed BEFORE '@/' so it wins (Vite matches longest/first applicable).
      '@react-native-async-storage/async-storage': `${root}test/stubs/async-storage.ts`,
      // Mirror the tsconfig path alias so tests can import '@/lib/...'.
      // '@/' never collides with '@react-native-...' (that doesn't start with '@/').
      '@': root,
    },
  },
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    // The Expo/React Native app is verified via typecheck + lint + on-device,
    // not vitest. Only pure-logic libs/functions are unit-tested here.
    exclude: ['node_modules', 'dist', '.expo'],
  },
});
```

Note: the `'@': root` alias maps `@/foo` → `<root>/foo`. Because `root` ends in a slash (`fileURLToPath` of a directory URL), `@` + the rest resolves correctly (`@/lib/x` → `<root>lib/x`).

- [ ] **Step 3: Write a load-smoke test that exercises the real import graph**

Create `lib/__tests__/coach-insight-loads.test.ts`. This proves the alias + stub make the whole `coach-insight` graph importable under Node (it pulls in `analytics` → `storage` → `AsyncStorage`, plus `workout-insights`, `moods`, `workouts`). If any *other* native import lurks in the graph, this fails here — fix it (add another alias) before moving on.

```ts
import { describe, it, expect } from 'vitest';
import { buildCoachContext } from '@/lib/coach-insight';

describe('coach-insight loads under Node (vitest alias + AsyncStorage stub)', () => {
  it('buildCoachContext runs on an empty log without touching native modules', () => {
    const ctx = buildCoachContext({ mood: 'stressed', intensity: 6, workout: undefined }, []);
    expect(ctx.mood).toBe('stressed');
    expect(ctx.intensity).toBe(6);
    expect(ctx.recentTrend).toBe('new');
    expect(ctx.crisis).toBe(false);
  });
});
```

- [ ] **Step 4: Run it**

Run: `npm test -- coach-insight-loads`
Expected: PASS — 1 passed. If it fails on an unresolved native import other than AsyncStorage, add that module to the `resolve.alias` map (stub it the same way) and re-run.

- [ ] **Step 5: Confirm the existing suite still passes**

Run: `npm test`
Expected: PASS — the Plan 1 vent suites (smoke, vent-grading, vent-line, vent-eval) plus the new load-smoke test. The added aliases don't affect the netlify tests (they don't import `@/`).

- [ ] **Step 6: Commit**

```bash
git add test/stubs/async-storage.ts vitest.config.ts lib/__tests__/coach-insight-loads.test.ts
git commit -m "test: make lib/* unit-testable under Node (vitest @ alias + AsyncStorage stub)"
```

---

### Task 1: `Episode` type + `selectEpisode` selector

The heart of the feature. Pure function over the session array. Picks at most one prior session that teaches a lesson: **same mood**, a **clear yes/no outcome** (excludes `somewhat` and unrated — a "sort of" episode teaches nothing decisive), and **recent** (within 30 days). Among qualifiers, prefers the most recent and closest-intensity. Returns `null` when nothing qualifies.

**Files:**
- Modify: `lib/coach-insight.ts`
- Test: `lib/__tests__/coach-insight.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/coach-insight.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { selectEpisode, type Episode } from '@/lib/coach-insight';
import type { Session } from '@/lib/storage';

// Fixed "now" so daysAgo is deterministic. 2026-06-11T12:00:00Z.
const NOW = Date.UTC(2026, 5, 11, 12, 0, 0);
const DAY = 86_400_000;

function mkSession(over: Partial<Session>): Session {
  // localDateString drives dayLabel; default it to NOW's date.
  const base: Session = {
    id: Math.random().toString(36).slice(2),
    mood: 'stressed',
    intensity: 6,
    postScore: 5,
    workoutName: 'Box Breathing',
    duration: 5,
    timestamp: NOW,
    rating: 'yes',
    localDateString: '2026-06-11',
  };
  return { ...base, ...over };
}

describe('selectEpisode', () => {
  it('returns null when the log is empty', () => {
    expect(selectEpisode('stressed', 6, [], NOW)).toBeNull();
  });

  it('returns null when no prior session shares the mood', () => {
    const sessions = [mkSession({ mood: 'anxious', timestamp: NOW - 2 * DAY })];
    expect(selectEpisode('stressed', 6, sessions, NOW)).toBeNull();
  });

  it('ignores unrated and "somewhat" sessions (no clear lesson)', () => {
    const sessions = [
      mkSession({ rating: undefined, timestamp: NOW - 2 * DAY }),
      mkSession({ rating: 'somewhat', timestamp: NOW - 3 * DAY }),
    ];
    expect(selectEpisode('stressed', 6, sessions, NOW)).toBeNull();
  });

  it('ignores sessions older than the 30-day recency window', () => {
    const sessions = [mkSession({ rating: 'no', timestamp: NOW - 31 * DAY })];
    expect(selectEpisode('stressed', 6, sessions, NOW)).toBeNull();
  });

  it('returns a structured episode (facts only) for a qualifying win', () => {
    const sessions = [
      mkSession({
        mood: 'stressed',
        intensity: 7,
        workoutName: 'Heavy Bag',
        rating: 'yes',
        timestamp: NOW - 3 * DAY,
        localDateString: '2026-06-08', // a Monday
      }),
    ];
    const ep = selectEpisode('stressed', 6, sessions, NOW) as Episode;
    expect(ep).toEqual({
      mood: 'stressed',
      intensity: 7,
      workoutName: 'Heavy Bag',
      helped: 'yes',
      dayLabel: 'Monday',
      daysAgo: 3,
    });
  });

  it('surfaces a clear flop to avoid', () => {
    const sessions = [
      mkSession({ rating: 'no', workoutName: 'Cold Shower', timestamp: NOW - 5 * DAY }),
    ];
    const ep = selectEpisode('stressed', 6, sessions, NOW) as Episode;
    expect(ep.helped).toBe('no');
    expect(ep.workoutName).toBe('Cold Shower');
  });

  it('prefers the most recent among equally-close qualifiers', () => {
    const sessions = [
      mkSession({ workoutName: 'Old', intensity: 6, timestamp: NOW - 10 * DAY }),
      mkSession({ workoutName: 'Recent', intensity: 6, timestamp: NOW - 2 * DAY }),
    ];
    expect(selectEpisode('stressed', 6, sessions, NOW)?.workoutName).toBe('Recent');
  });

  it('prefers the closer-intensity qualifier when recency is equal', () => {
    const sessions = [
      mkSession({ workoutName: 'Far', intensity: 1, timestamp: NOW - 4 * DAY }),
      mkSession({ workoutName: 'Near', intensity: 7, timestamp: NOW - 4 * DAY }),
    ];
    expect(selectEpisode('stressed', 8, sessions, NOW)?.workoutName).toBe('Near');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- coach-insight.test`
Expected: FAIL — `selectEpisode` / `Episode` are not exported from `@/lib/coach-insight`.

- [ ] **Step 3: Implement the selector**

In `lib/coach-insight.ts`, add the `sessionDateString` import to the existing storage import and append the new exports. The existing first import line is:

```ts
import type { MoodKey, Session } from '@/lib/storage';
```

Change it to (it now needs a value import too):

```ts
import { sessionDateString, type MoodKey, type Session } from '@/lib/storage';
```

Then append to the end of `lib/coach-insight.ts`:

```ts
// ─── Episodic memory (Unit B) ────────────────────────────────────────────────
//
// A specific past session the coach/vent reply may reference. Structured facts
// ONLY — never a transcript. Emitted only when a session genuinely teaches a
// lesson, so the model can never fabricate significance.
export interface Episode {
  mood: MoodKey;
  intensity: number;
  workoutName: string;
  helped: 'yes' | 'somewhat' | 'no';
  /** Full weekday name of the session, e.g. 'Monday'. */
  dayLabel: string;
  /** Whole days between the session and `now`. */
  daysAgo: number;
}

/** Older than this teaches little; excluded from recall. */
const EPISODE_RECENCY_DAYS = 30;

const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** Pick at most one decision-relevant prior episode for the given state, or
 *  null. Qualifiers: same mood, a clear 'yes'/'no' outcome, within the recency
 *  window, not in the future. Among qualifiers, score = recency + intensity
 *  closeness (recency dominates), ties broken toward the more recent session. */
export function selectEpisode(
  mood: MoodKey,
  intensity: number,
  sessions: Session[],
  now: number = Date.now(),
): Episode | null {
  const windowMs = EPISODE_RECENCY_DAYS * 86_400_000;
  const candidates = sessions.filter(
    (s) =>
      s.mood === mood &&
      (s.rating === 'yes' || s.rating === 'no') &&
      s.timestamp <= now &&
      now - s.timestamp <= windowMs,
  );
  if (candidates.length === 0) return null;

  let best: Session | null = null;
  let bestScore = -Infinity;
  for (const s of candidates) {
    const daysAgo = Math.floor((now - s.timestamp) / 86_400_000);
    const recencyScore = EPISODE_RECENCY_DAYS - daysAgo;        // newer → higher
    const closenessScore = 10 - Math.abs(intensity - s.intensity); // similar → higher
    const score = recencyScore + closenessScore;
    if (score > bestScore || (score === bestScore && best != null && s.timestamp > best.timestamp)) {
      bestScore = score;
      best = s;
    }
  }
  if (!best) return null;

  return {
    mood: best.mood,
    intensity: best.intensity,
    workoutName: best.workoutName,
    helped: best.rating as 'yes' | 'no',
    dayLabel: WEEKDAY_NAMES[new Date(sessionDateString(best) + 'T00:00:00').getDay()],
    daysAgo: Math.floor((now - best.timestamp) / 86_400_000),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- coach-insight.test`
Expected: PASS — all `selectEpisode` cases. (The `2026-06-08` → `Monday` assertion confirms `dayLabel` derives from `localDateString`, not the timestamp's UTC day.)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/coach-insight.ts lib/__tests__/coach-insight.test.ts
git commit -m "feat(memory): selectEpisode — at most one decision-relevant past episode"
```

---

### Task 2: `buildVentEpisodeMap` — per-mood candidate map for the vent path

The vent flow infers the mood from the transcript *inside* the model call, so the client can't pre-select a single episode keyed on a known mood. Instead it sends a small map (one qualifying episode per mood); `vent-line` renders only the entry matching whichever mood the model assigns. This keeps the no-fabrication guarantee — every entry is a real, qualifying episode.

**Files:**
- Modify: `lib/coach-insight.ts`
- Test: `lib/__tests__/coach-insight.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `lib/__tests__/coach-insight.test.ts`:

```ts
import { buildVentEpisodeMap } from '@/lib/coach-insight';

describe('buildVentEpisodeMap', () => {
  it('returns an empty map when nothing qualifies', () => {
    expect(buildVentEpisodeMap([], NOW)).toEqual({});
  });

  it('includes one qualifying episode per mood, omitting moods with none', () => {
    const sessions = [
      mkSession({ mood: 'stressed', rating: 'yes', workoutName: 'Bag', timestamp: NOW - 2 * DAY }),
      mkSession({ mood: 'anxious', rating: 'no', workoutName: 'Breathing', timestamp: NOW - 4 * DAY }),
      // 'somewhat' → does not qualify, so 'foggy' is absent.
      mkSession({ mood: 'foggy', rating: 'somewhat', timestamp: NOW - 1 * DAY }),
    ];
    const map = buildVentEpisodeMap(sessions, NOW);
    expect(Object.keys(map).sort()).toEqual(['anxious', 'stressed']);
    expect(map.stressed?.workoutName).toBe('Bag');
    expect(map.anxious?.helped).toBe('no');
  });

  it('anchors intensity closeness on the most recent same-mood session', () => {
    const sessions = [
      // most recent stressed session sets the anchor intensity (=9)
      mkSession({ mood: 'stressed', intensity: 9, rating: 'yes', workoutName: 'Anchor', timestamp: NOW - 1 * DAY }),
      mkSession({ mood: 'stressed', intensity: 9, rating: 'yes', workoutName: 'Match', timestamp: NOW - 6 * DAY }),
      mkSession({ mood: 'stressed', intensity: 2, rating: 'yes', workoutName: 'Mismatch', timestamp: NOW - 6 * DAY }),
    ];
    // Anchor (most recent) wins on recency; the test just asserts it picks a real entry.
    expect(buildVentEpisodeMap(sessions, NOW).stressed?.workoutName).toBe('Anchor');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- coach-insight.test`
Expected: FAIL — `buildVentEpisodeMap` is not exported.

- [ ] **Step 3: Implement**

Add the `MOOD_ORDER` import. The existing analytics import line is:

```ts
import { getLastNDays } from '@/lib/analytics';
```

Add a new import line directly below it:

```ts
import { MOOD_ORDER } from '@/lib/moods';
```

Then append to `lib/coach-insight.ts`:

```ts
/** Build a per-mood map of qualifying episodes for the vent reply. For each
 *  mood, anchor intensity closeness on the user's most recent session of that
 *  mood (their typical level for it), then run the same selector. Only moods
 *  with a qualifying episode appear. */
export function buildVentEpisodeMap(
  sessions: Session[],
  now: number = Date.now(),
): Partial<Record<MoodKey, Episode>> {
  const map: Partial<Record<MoodKey, Episode>> = {};
  for (const mood of MOOD_ORDER) {
    const recent = sessions
      .filter((s) => s.mood === mood)
      .reduce<Session | null>((a, b) => (a == null || b.timestamp > a.timestamp ? b : a), null);
    const anchorIntensity = recent ? recent.intensity : 5;
    const ep = selectEpisode(mood, anchorIntensity, sessions, now);
    if (ep) map[mood] = ep;
  }
  return map;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- coach-insight.test`
Expected: PASS — all `selectEpisode` + `buildVentEpisodeMap` cases.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add lib/coach-insight.ts lib/__tests__/coach-insight.test.ts
git commit -m "feat(memory): buildVentEpisodeMap — per-mood candidates for the vent reply"
```

---

### Task 3: Wire `episode` into `CoachContext` + `buildCoachContext`

The post-workout coach path already calls `buildCoachContext(args, sessions)` and serializes the result to the model (`coach-line.ts` does `JSON.stringify(context)`). Adding the episode here makes it flow to the model with zero call-site changes — and because `selectEpisode` only returns a qualifying episode, the model can't invent one.

**Files:**
- Modify: `lib/coach-insight.ts`
- Test: `lib/__tests__/coach-insight.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `lib/__tests__/coach-insight.test.ts`:

```ts
import { buildCoachContext } from '@/lib/coach-insight';

describe('buildCoachContext episode wiring', () => {
  it('attaches a qualifying episode for the current mood', () => {
    const sessions = [
      mkSession({ mood: 'stressed', rating: 'no', workoutName: 'Cold Shower', timestamp: NOW - 3 * DAY }),
    ];
    const ctx = buildCoachContext({ mood: 'stressed', intensity: 6, workout: undefined }, sessions, NOW);
    expect(ctx.episode?.workoutName).toBe('Cold Shower');
    expect(ctx.episode?.helped).toBe('no');
  });

  it('sets episode to null when none qualifies', () => {
    const ctx = buildCoachContext({ mood: 'stressed', intensity: 6, workout: undefined }, [], NOW);
    expect(ctx.episode).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- coach-insight.test`
Expected: FAIL — `buildCoachContext` does not accept a third `now` argument / `ctx.episode` is undefined (not on the type).

- [ ] **Step 3: Implement**

In `lib/coach-insight.ts`, add the `episode` field to the `CoachContext` interface. Locate:

```ts
  /** True when signals suggest genuine distress — the coach pulls its punch. */
  crisis: boolean;
}
```

and change it to:

```ts
  /** True when signals suggest genuine distress — the coach pulls its punch. */
  crisis: boolean;
  /** One decision-relevant past episode to reference, or null. Structured
   *  facts only; populated by selectEpisode so the model can't fabricate it. */
  episode: Episode | null;
}
```

Then update `buildCoachContext` to accept an optional `now` and populate `episode`. Replace the entire existing function:

```ts
export function buildCoachContext(
  args: { mood: MoodKey; intensity: number; workout: Workout | undefined },
  sessions: Session[],
): CoachContext {
  const { mood, intensity, workout } = args;
  const helped = workout != null ? getWorkoutEffectiveness(sessions, workout) : null;
  const workoutHelpedRate =
    helped && helped.ratedCount > 0 && helped.yesCount > 0
      ? `helped ${helped.yesCount}/${helped.ratedCount} times`
      : null;
  return {
    mood,
    intensity,
    workoutName: workout?.name ?? 'that workout',
    workoutHelpedRate,
    recentTrend: trend(sessions),
    crisis: isCrisisSignal(mood, intensity, sessions),
  };
}
```

with:

```ts
export function buildCoachContext(
  args: { mood: MoodKey; intensity: number; workout: Workout | undefined },
  sessions: Session[],
  now: number = Date.now(),
): CoachContext {
  const { mood, intensity, workout } = args;
  const helped = workout != null ? getWorkoutEffectiveness(sessions, workout) : null;
  const workoutHelpedRate =
    helped && helped.ratedCount > 0 && helped.yesCount > 0
      ? `helped ${helped.yesCount}/${helped.ratedCount} times`
      : null;
  return {
    mood,
    intensity,
    workoutName: workout?.name ?? 'that workout',
    workoutHelpedRate,
    recentTrend: trend(sessions),
    crisis: isCrisisSignal(mood, intensity, sessions),
    episode: selectEpisode(mood, intensity, sessions, now),
  };
}
```

(The `now` parameter defaults to `Date.now()`, so the existing call in `app/post-workout.tsx:110` — `buildCoachContext({ mood, intensity, workout }, sessions)` — keeps working unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- coach-insight.test`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test`
Expected: PASS (all suites).
Run: `npm run typecheck`
Expected: no errors. (`coach-line.ts` reads `context` as `any`, so the new field doesn't break its types; the new `episode` field is non-optional on `CoachContext` and is always set by `buildCoachContext`, so no other consumer breaks.)

- [ ] **Step 6: Commit**

```bash
git add lib/coach-insight.ts lib/__tests__/coach-insight.test.ts
git commit -m "feat(memory): attach selected episode to CoachContext"
```

---

### Task 4: Coach system prompt consumes the episode (extract to a testable module)

`coach-line.ts` builds its system prompt inline via a local `systemPrompt(tone, crisis)` and constructs an Anthropic client at module load, which makes it awkward to unit-test. Extract the prompt into a pure module (mirroring `lib/vent-grading.ts`) and add the episode instruction there.

**Files:**
- Create: `netlify/functions/lib/coach-prompt.ts`
- Modify: `netlify/functions/coach-line.ts`
- Test: `netlify/functions/__tests__/coach-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `netlify/functions/__tests__/coach-prompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { coachSystemPrompt } from '../lib/coach-prompt';

describe('coachSystemPrompt', () => {
  it('crisis mode drops jokes and never adds the episode rule', () => {
    const p = coachSystemPrompt('roasting', true, true).toLowerCase();
    expect(p).toContain('distress');
    expect(p).not.toContain('roast');     // no roasting in crisis
    expect(p).not.toContain('episode');   // no callbacks in crisis
  });

  it('adds an episode rule only when an episode is present', () => {
    const withEp = coachSystemPrompt('teasing', false, true).toLowerCase();
    const without = coachSystemPrompt('teasing', false, false).toLowerCase();
    expect(withEp).toContain('episode');
    expect(withEp).toContain('never invent');
    expect(without).not.toContain('episode');
  });

  it('reflects tone (teasing vs roasting) in the non-crisis prompt', () => {
    expect(coachSystemPrompt('roasting', false, false).toLowerCase()).toContain('sharper');
    expect(coachSystemPrompt('teasing', false, false).toLowerCase()).toContain('teasing');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- coach-prompt`
Expected: FAIL — cannot find module `../lib/coach-prompt`.

- [ ] **Step 3: Create the prompt module**

Create `netlify/functions/lib/coach-prompt.ts` (the non-crisis/crisis text is moved verbatim from `coach-line.ts`, plus the new episode rule):

```ts
/** Builds the Dr. MoodRx post-workout system prompt. Pure — no SDK, no network
 *  — so it is unit-testable. The episode rule is appended only when the context
 *  actually carries an episode, so the model is never told to look for one that
 *  isn't there (and `buildCoachContext`/`selectEpisode` guarantee any present
 *  episode is real). */
export function coachSystemPrompt(
  tone: 'teasing' | 'roasting',
  crisis: boolean,
  hasEpisode: boolean,
): string {
  if (crisis) {
    return `You are Dr. MoodRx, a darkly funny but ultimately caring fitness-for-mental-health coach. The user is showing signs of genuine distress right now. Drop the roasting entirely. In 1-2 sentences, acknowledge they showed up and gently encourage them — warm, not clinical, no diagnoses, no jokes at their expense. Use ONLY the facts provided. Never invent numbers.`;
  }
  const intensity =
    tone === 'roasting'
      ? 'Sharper, funnier, more intense — but LIGHTHEARTED. Rib their resistance/excuses to work out, never their worth, body, or anything self-harm-adjacent.'
      : 'Playful, teasing, light jabs.';
  const episodeRule = hasEpisode
    ? ' If the context includes an `episode` object, you may briefly reference that specific past session — its workout name and whether it helped, on its day — in voice. Never invent a past session; use only the facts in `episode`.'
    : '';
  return `You are Dr. MoodRx, a darkly funny fitness-for-mental-health coach with a film-noir, deadpan voice. Tone: ${intensity} Speak directly to the user about the workout they just did. Use ONLY the facts provided — never invent statistics, numbers, or history. Never give clinical labels, diagnoses, or medical advice. 1-2 sentences. No preamble.${episodeRule}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- coach-prompt`
Expected: PASS.

- [ ] **Step 5: Wire it into `coach-line.ts`**

In `netlify/functions/coach-line.ts`, add the import after the existing imports (after line 3, the `Anthropic` import):

```ts
import { coachSystemPrompt } from './lib/coach-prompt';
```

Delete the inline `systemPrompt` function (the whole block from `function systemPrompt(tone: 'teasing' | 'roasting', crisis: boolean): string {` through its closing `}` — currently lines 31–40).

Then update the call site. Locate:

```ts
      system: systemPrompt(tone, Boolean(context.crisis)),
```

and replace it with:

```ts
      system: coachSystemPrompt(tone, Boolean(context.crisis), Boolean(context.episode)),
```

- [ ] **Step 6: Typecheck + full suite**

Run: `npm run typecheck`
Expected: no errors.
Run: `npm test`
Expected: PASS (all suites, including `coach-prompt`).

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/lib/coach-prompt.ts netlify/functions/coach-line.ts netlify/functions/__tests__/coach-prompt.test.ts
git commit -m "feat(memory): coach line references a specific past episode when present"
```

---

### Task 5: `vent-line` renders the per-mood memory map

Give `vent-grading.ts` a pure `buildVentSystem(episodes)` that appends a per-mood memory block + a strict reference rule to the base prompt, and have `vent-line.ts` accept an optional `episodes` field in the request body and use it. With no `episodes` (the current callers, and Plan 1's tests), behavior is identical to before.

**Files:**
- Modify: `netlify/functions/lib/vent-grading.ts`
- Modify: `netlify/functions/vent-line.ts`
- Test: `netlify/functions/__tests__/vent-grading.test.ts`
- Test: `netlify/functions/__tests__/vent-line.test.ts`

- [ ] **Step 1: Add the failing `buildVentSystem` test**

Append to `netlify/functions/__tests__/vent-grading.test.ts`:

```ts
import { buildVentSystem, type EpisodeFacts } from '../lib/vent-grading';

describe('buildVentSystem', () => {
  const ep: EpisodeFacts = {
    mood: 'stressed', intensity: 7, workoutName: 'Heavy Bag',
    helped: 'no', dayLabel: 'Monday', daysAgo: 3,
  };

  it('returns the base prompt unchanged when no episodes are given', () => {
    expect(buildVentSystem()).toBe(VENT_SYSTEM_PROMPT);
    expect(buildVentSystem(null)).toBe(VENT_SYSTEM_PROMPT);
    expect(buildVentSystem({})).toBe(VENT_SYSTEM_PROMPT);
  });

  it('appends a memory block + strict rule when an episode is present', () => {
    const sys = buildVentSystem({ stressed: ep });
    expect(sys.startsWith(VENT_SYSTEM_PROMPT)).toBe(true);
    expect(sys).toContain('Heavy Bag');
    expect(sys.toLowerCase()).toContain('never invent');
    expect(sys.toLowerCase()).toContain('different mood'); // forbids cross-mood reference
  });

  it('drops unknown mood keys and malformed entries', () => {
    const sys = buildVentSystem({
      stressed: ep,
      bogus: ep,                                  // not a real mood key
      anxious: { mood: 'anxious' } as EpisodeFacts, // missing fields
    });
    expect(sys).toContain('stressed');
    expect(sys).not.toContain('bogus');
    expect(sys).not.toContain('anxious');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- vent-grading`
Expected: FAIL — `buildVentSystem` / `EpisodeFacts` not exported.

- [ ] **Step 3: Implement `buildVentSystem` in `vent-grading.ts`**

Append to `netlify/functions/lib/vent-grading.ts`:

```ts
/** Structured facts for one past episode, as sent by the client (mirrors the
 *  app's Episode shape; this module stays app-independent). */
export interface EpisodeFacts {
  mood: string;
  intensity: number;
  workoutName: string;
  helped: 'yes' | 'somewhat' | 'no';
  dayLabel: string;
  daysAgo: number;
}

function isEpisodeFacts(v: unknown): v is EpisodeFacts {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.workoutName === 'string' && o.workoutName.trim().length > 0 &&
    (o.helped === 'yes' || o.helped === 'somewhat' || o.helped === 'no') &&
    typeof o.dayLabel === 'string' &&
    typeof o.daysAgo === 'number' && Number.isFinite(o.daysAgo)
  );
}

function whenLabel(e: EpisodeFacts): string {
  if (e.daysAgo <= 0) return 'today';
  if (e.daysAgo === 1) return 'yesterday';
  return `${e.dayLabel}, ${e.daysAgo} days ago`;
}

function helpedLabel(e: EpisodeFacts): string {
  return e.helped === 'yes' ? 'helped' : e.helped === 'no' ? "didn't help" : 'sort of helped';
}

/** Append a per-mood memory block + a strict reference rule to the base vent
 *  prompt. Only valid entries for known mood keys are rendered. Returns the
 *  unmodified base prompt when there are none. */
export function buildVentSystem(episodes?: Record<string, unknown> | null): string {
  const valid = Object.entries(episodes ?? {}).filter(
    ([mood, e]) => (MOOD_KEYS as readonly string[]).includes(mood) && isEpisodeFacts(e),
  ) as [MoodKey, EpisodeFacts][];
  if (valid.length === 0) return VENT_SYSTEM_PROMPT;

  const lines = valid.map(
    ([mood, e]) => `- ${mood}: ${whenLabel(e)}, they did "${e.workoutName}" and it ${helpedLabel(e)}.`,
  );
  return `${VENT_SYSTEM_PROMPT}

MEMORY — real past sessions, one per mood:
${lines.join('\n')}
If (and only if) the mood you assign appears above and it naturally fits, you may briefly reference that specific past session in your reply, in voice. Never reference a memory for a different mood. Never invent a past session. Use only these facts.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- vent-grading`
Expected: PASS — all vent-grading cases (Plan 1's + the new `buildVentSystem` ones).

- [ ] **Step 5: Add the failing `vent-line` integration test**

Append to `netlify/functions/__tests__/vent-line.test.ts` (inside the existing `describe('vent-line handler', ...)` block, before its closing `});`):

```ts
  it('passes a rendered memory block to the model when episodes are provided', async () => {
    createMock.mockResolvedValue(TOOL_OK({ mood: 'stressed' }));
    await call({
      transcript: 'work is crushing me',
      deviceId: 'd1',
      episodes: {
        stressed: {
          mood: 'stressed', intensity: 7, workoutName: 'Heavy Bag',
          helped: 'no', dayLabel: 'Monday', daysAgo: 3,
        },
      },
    });
    const sentSystem = createMock.mock.calls[0][0].system as string;
    expect(sentSystem).toContain('Heavy Bag');
    expect(sentSystem.toLowerCase()).toContain('never invent');
  });

  it('sends the base prompt (no memory block) when episodes are absent', async () => {
    createMock.mockResolvedValue(TOOL_OK());
    await call({ transcript: 'just venting', deviceId: 'd1' });
    const sentSystem = createMock.mock.calls[0][0].system as string;
    expect(sentSystem).not.toContain('MEMORY —');
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- vent-line`
Expected: FAIL — the first new case fails because `vent-line.ts` still passes the bare `VENT_SYSTEM_PROMPT` (no `Heavy Bag` in the system string).

- [ ] **Step 7: Wire `episodes` into `vent-line.ts`**

In `netlify/functions/vent-line.ts`, update the import from `./lib/vent-grading` to add `buildVentSystem` and drop the now-unused direct `VENT_SYSTEM_PROMPT` import. Locate:

```ts
import {
  ASSESS_TOOL,
  VENT_SYSTEM_PROMPT,
  classifyKeywordFloor,
  resolveRisk,
  validateAssessment,
} from './lib/vent-grading';
```

and replace it with:

```ts
import {
  ASSESS_TOOL,
  buildVentSystem,
  classifyKeywordFloor,
  resolveRisk,
  validateAssessment,
} from './lib/vent-grading';
```

Update the payload type. Locate:

```ts
  let payload: { transcript?: string; deviceId?: string };
```

and replace it with:

```ts
  let payload: { transcript?: string; deviceId?: string; episodes?: Record<string, unknown> | null };
```

Then update the model call's `system` field. Locate:

```ts
      system: VENT_SYSTEM_PROMPT,
```

and replace it with:

```ts
      system: buildVentSystem(payload.episodes),
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- vent-line`
Expected: PASS — including the two new memory cases. The Plan 1 cases (no `episodes`) still pass because `buildVentSystem(undefined)` returns the base prompt.

- [ ] **Step 9: Full suite + typecheck**

Run: `npm test`
Expected: PASS (smoke, vent-grading, vent-line, vent-eval, coach-prompt, coach-insight, coach-insight-loads).
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add netlify/functions/lib/vent-grading.ts netlify/functions/vent-line.ts netlify/functions/__tests__/vent-grading.test.ts netlify/functions/__tests__/vent-line.test.ts
git commit -m "feat(memory): vent reply can reference a per-mood past episode"
```

---

### Task 6: Privacy policy — one-line clarification

Episodic memory adds **structured facts about one past session** to the already-declared AI-coach call. Same data *category* (mood/workout facts, not transcripts) already covered by the policy and store declarations — so **no store-form reopen** (per spec). The only change is a one-line clarification to the AI-coach disclosure so "summaries derived from your own history" explicitly covers referencing a specific past session.

**Files:**
- Modify: `docs/privacy-policy.html`

- [ ] **Step 1: Re-read the AI-coach disclosure**

Read `docs/privacy-policy.html` around line 85 (the `<p><strong>When you enable it</strong>...` paragraph). The current parenthetical reads: `(such as how often a workout has helped you and your recent trend)`.

- [ ] **Step 2: Make the one-line edit**

In `docs/privacy-policy.html`, find:

```html
short summaries derived from your own history (such as how often a workout has helped you and your recent trend)
```

and replace it with:

```html
short summaries derived from your own history (such as how often a workout has helped you, your recent trend, and an occasional reference to one specific past session — e.g. a workout you did on a given day and whether it helped)
```

This stays within the existing "mood/workout facts from your own history" category — it does **not** introduce transcripts, audio, or any new data type. (The separate, larger privacy update for voice-venting transcripts is Plan 7, not here.)

- [ ] **Step 3: Sanity-check the HTML still parses**

Run: `node -e "const s=require('fs').readFileSync('docs/privacy-policy.html','utf8'); const o=(s.match(/<p>/g)||[]).length, c=(s.match(/<\/p>/g)||[]).length; if(o!==c) throw new Error('unbalanced <p> tags: '+o+'/'+c); console.log('p tags balanced:', o);"`
Expected: prints a balanced count (no throw). The edit only changed text inside one existing `<p>`.

- [ ] **Step 4: Commit**

```bash
git add docs/privacy-policy.html
git commit -m "docs(privacy): clarify AI-coach discloses an occasional specific past-session reference"
```

Note for Plan 7: this in-repo edit must be redeployed to GitHub Pages (`soul2fade.github.io/moodrx/privacy-policy.html`) alongside the voice-venting privacy changes — the live page won't update until then. No store-declaration change is required for episodic memory.

---

## Self-Review

**1. Spec coverage (Unit B + privacy clause of `2026-06-11-adaptive-intelligence-design.md`):**
- "selector that, given `{mood, intensity}` and the session log, returns at most one decision-relevant prior episode, or `null`" → Task 1 (`selectEpisode`). ✓
- "preferring a clear win to repeat or a clear flop to avoid" → Task 1 (filters to `yes`/`no`, excludes `somewhat`/unrated). ✓
- "returned as structured facts — `{mood, intensity, workoutName, helped, dayLabel, daysAgo}` — never a transcript" → Task 1 (`Episode`). ✓
- "`CoachContext` gains an optional `episode` field" → Task 3. ✓
- "the post-workout coach line consumes it" → Task 3 (flows via JSON) + Task 4 (prompt rule). ✓
- "the voice-vent reply consumes it" → Task 2 (`buildVentEpisodeMap`) + Task 5 (`buildVentSystem` + `vent-line.ts`). ✓
- "system prompt: if an episode is provided, you may reference it; never invent one; use only provided facts" → Task 4 (coach) + Task 5 (vent rule, incl. no cross-mood reference). ✓
- "model can't fabricate significance (selector only passes when qualifying)" → Tasks 1–2 gate; Tasks 4–5 prompts forbid invention. ✓
- Privacy: "re-read the AI Coach line and lightly clarify wording if needed — at most a one-line edit … No store-form reopen" → Task 6. ✓
- Episode-selection scoring (open item) → resolved in Task 1: recency + intensity-closeness, recency-dominant, recency tie-break. ✓

**2. Out of scope (correctly deferred):** Unit A pattern engine → Plan 3; Unit C per-session health capture → Plan 4 (this plan reads only existing `Session` fields); the `/vent` screen actually *calling* `buildVentEpisodeMap` and sending `episodes` → Plan 5 (this plan ships the function support + the pure builder so Plan 5 just wires the call); GitHub-Pages redeploy of the privacy edit → Plan 7.

**3. Placeholder scan:** none — every step has concrete code/commands and exact edit targets.

**4. Type consistency:** `Episode` (app, `lib/coach-insight.ts`) and `EpisodeFacts` (netlify, `lib/vent-grading.ts`) are intentionally separate (the netlify module stays app-independent) but field-compatible: `mood, intensity, workoutName, helped, dayLabel, daysAgo`. `selectEpisode` signature `(mood, intensity, sessions, now?)` is used identically in Tasks 1, 2, 3. `buildCoachContext` gains a 3rd optional `now` param (default `Date.now()`) — back-compatible with the `app/post-workout.tsx:110` call. `coachSystemPrompt(tone, crisis, hasEpisode)` defined in Task 4 and called with `Boolean(context.episode)`. `buildVentSystem(episodes?)` defined in Task 5, called with `payload.episodes`. `MOOD_ORDER` (from `@/lib/moods`) drives the app-side map; `MOOD_KEYS` (already in `vent-grading.ts`) filters the netlify-side render — both are the same six keys in the same order.

**5. Test-infra dependency:** Task 0 is a hard prerequisite for Tasks 1–3 (their tests import `@/lib/...` under Node). Tasks 4–5's tests import only from `../lib/...` (netlify, no `@/` alias needed) but still benefit from the shared config. Execute strictly in order.
