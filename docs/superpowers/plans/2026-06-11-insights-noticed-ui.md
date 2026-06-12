# Insights "Noticed" Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the on-device pattern engine (`buildPatterns`) in `app/insights.tsx` as a richer "What I've noticed" section — confident findings styled as statements, gray-zone items styled as the coach posing a question — with one teaser pattern free and the full set behind Pro; and tighten `detectDayOfWeek` so a *confident finding* requires a deeper weekday bucket and a non-thin comparison pool than a *hunch* does.

**Architecture:** Two units. (1) **Pure logic, vitest-TDD** — a finding-floor calibration inside `lib/patterns.ts`: the day-of-week signal currently can emit a confident finding on as few as 3 weekday sessions against a thin "others" pool; split the finding floor (≥5 weekday observations) above the question floor (≥3) and require a minimum comparison-pool size, so noise and thin evidence can only ever produce a hunch, never a claim. (2) **React-Native UI** — replace the thin static `patternBox` in `app/insights.tsx` (~line 370) with a section that maps `buildPatterns(sessions)` to two card styles, gated consistently with the screen's existing free/Pro pattern (teaser + `UNLOCK PRO →` upsell row). The engine is 100% on-device (templated, no LLM, no network), so **no store-declaration change**.

**Tech Stack:** TypeScript, React Native (Expo Router), vitest (Node, pure-logic units — the existing `@`-alias + AsyncStorage stub already make `lib/*` importable under Node). No new runtime deps.

**Spec:** `docs/superpowers/specs/2026-06-11-adaptive-intelligence-design.md` — "Unit (UI) — Insights 'noticed' section" + "Privacy, cost, gating" + the open item "the free-teaser selection rule (which one pattern shows to free users)". Carry-forward calibration is from `docs/superpowers/plans/2026-06-11-pattern-engine.md` (the day-of-week finding-floor note).

**Decisions resolved by this plan (the spec's open items):**
- **Free-teaser selection rule:** the free teaser is `buildPatterns(sessions)[0]`. `buildPatterns` already orders confident findings ahead of hedged questions, so `items[0]` is the single strongest signal the user has earned — a finding if one exists, otherwise the best hunch. Free users always see exactly one item; Pro unlocks the rest. (Documented in code at the `useMemo` site and reflected in the UI tests' intent.)
- **Day-of-week finding floor:** question floor stays at 3 weekday observations; a finding additionally requires ≥5 observations on that weekday **and** ≥8 sessions in the comparison ("others") pool. Below either, a would-be finding is downgraded to a question. (Calibrated with fixtures in Task 1.)

---

## File Structure

- `lib/patterns.ts` (modify) — add the finding-floor constants and the downgrade step inside `detectDayOfWeek`; everything else (the gate, the other three detectors, `buildPatterns`) is unchanged.
- `lib/__tests__/patterns.test.ts` (modify) — update the one existing day-of-week *finding* fixture to clear the new floor; add downgrade/threshold cases; reaffirm the zero-findings noise guarantee and the `buildPatterns` ordering invariant still hold.
- `app/insights.tsx` (modify) — replace the `patternBox` block (~lines 370–379) with the "noticed" section; add styles; drop the now-unused `mostCommonMood`/`getMostCommonMood`.

No new files. No new dependencies. No store/privacy change (on-device only).

---

### Task 1: Day-of-week finding-floor calibration (`detectDayOfWeek`)

**Why:** Today `detectDayOfWeek` runs its single `classifyTier` gate with `MIN_OBS_PER_WEEKDAY = 3` for *both* tiers, so a strong intensity gap on just 3 sessions of a weekday — measured against a possibly-thin pool of other days — can be asserted as a confident finding ("Mondays run rough"). The tiered-honesty discipline wants a confident *claim* to rest on more evidence than a *hunch*. This task raises the finding bar (≥5 weekday observations **and** ≥8 comparison-pool sessions) while leaving the question bar at 3, and downgrades a would-be finding that doesn't clear it. Pure logic → vitest TDD.

**Files:**
- Modify: `lib/patterns.ts`
- Test: `lib/__tests__/patterns.test.ts`

- [ ] **Step 1: Update the existing finding fixture + add the failing calibration tests**

Two edits to `lib/__tests__/patterns.test.ts`.

**(a)** The existing `detectDayOfWeek` test `'emits a finding when one weekday runs much rougher'` uses 4 Wednesdays vs 6 others — under the new floor that becomes a *question*, which is the intended behavior change. Replace that single `it(...)` block with a fixture that clears the new finding floor (5 Mondays — June 1/8/15/22/29 2026 are Mondays — vs an 8-session comparison pool). Find this block:

```ts
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
```

Replace it with:

```ts
  it('emits a finding when a weekday runs much rougher with enough evidence', () => {
    const sessions = [
      // 5 Mondays at intensity 9 (June 1/8/15/22/29 2026 are Mondays) → clears
      // the finding floor of 5 weekday observations.
      sess(1, 9, 9, 4), sess(8, 9, 9, 4), sess(15, 9, 9, 4), sess(22, 9, 9, 4), sess(29, 9, 9, 4),
      // 8 other-day sessions at intensity 5: a non-thin comparison pool (≥8) and
      // ≤2 per weekday so no other day is eligible. Monday mean 9 vs others 5 → effect 4.
      sess(2, 9, 5, 4), sess(3, 9, 5, 4), sess(4, 9, 5, 4), sess(5, 9, 5, 4),
      sess(9, 9, 5, 4), sess(10, 9, 5, 4), sess(11, 9, 5, 4), sess(12, 9, 5, 4),
    ];
    const item = detectDayOfWeek(sessions);
    expect(item?.kind).toBe('finding');
    expect(item?.id).toBe('day-of-week');
    expect(item?.text.toLowerCase()).toContain('monday');
  });
```

**(b)** Append a new `describe` block (the genuinely new calibration coverage — the first two cases FAIL against current code, which would emit `'finding'`):

```ts
describe('detectDayOfWeek finding-floor calibration', () => {
  it('downgrades a strong-effect spike to a question when the weekday bucket is too shallow', () => {
    // 4 Wednesdays at intensity 9 vs 8 others at 5 → effect 4 (≥ ROUGH_STRONG),
    // but only 4 weekday observations (< the finding floor of 5) → at most a hunch.
    const sessions = [
      sess(3, 9, 9, 4), sess(10, 9, 9, 4), sess(17, 9, 9, 4), sess(24, 9, 9, 4),
      sess(1, 9, 5, 4), sess(2, 9, 5, 4), sess(4, 9, 5, 4), sess(5, 9, 5, 4),
      sess(8, 9, 5, 4), sess(9, 9, 5, 4), sess(11, 9, 5, 4), sess(12, 9, 5, 4),
    ];
    const item = detectDayOfWeek(sessions);
    expect(item?.kind).toBe('question');
    expect(item?.text.toLowerCase()).toContain('wednesday');
  });

  it('downgrades a strong-effect spike to a question when the comparison pool is thin', () => {
    // 5 Mondays at intensity 9 (clears the 5-observation floor) but only 4 other-day
    // sessions (< the 8-session pool floor) → not enough baseline to claim a finding.
    const sessions = [
      sess(1, 9, 9, 4), sess(8, 9, 9, 4), sess(15, 9, 9, 4), sess(22, 9, 9, 4), sess(29, 9, 9, 4),
      sess(2, 9, 5, 4), sess(9, 9, 5, 4), sess(16, 9, 5, 4), sess(23, 9, 5, 4), // 4 Tuesdays → not eligible (effect would be negative), thin pool
    ];
    const item = detectDayOfWeek(sessions);
    expect(item?.kind).toBe('question');
    expect(item?.text.toLowerCase()).toContain('monday');
  });

  it('still emits a question at the entry floor of 3 weekday observations', () => {
    // Unchanged behavior: 3 Wednesdays at 7 vs others at 5 → effect 2.0 ∈ [1.5, 2.5) → question.
    const sessions = [
      sess(3, 9, 7, 4), sess(10, 9, 7, 4), sess(17, 9, 7, 4),
      sess(1, 9, 5, 4), sess(2, 9, 5, 4), sess(4, 9, 5, 4), sess(5, 9, 5, 4),
    ];
    expect(detectDayOfWeek(sessions)?.kind).toBe('question');
  });
});
```

- [ ] **Step 2: Run the tests to verify the new cases fail**

Run: `npm test -- patterns.test`
Expected: FAIL — `'downgrades a strong-effect spike … shallow'` and `'… thin'` currently receive `'finding'` (current code has no finding-specific floor). The updated `'… enough evidence'` finding test PASSES already (5 Mondays/8 others clears even the current gate), and the entry-floor question test PASSES already — they're here to lock the behavior.

- [ ] **Step 3: Implement the finding-floor downgrade**

In `lib/patterns.ts`, add two constants next to the existing day-of-week thresholds. Find:

```ts
const MIN_OBS_PER_WEEKDAY = 3;  // day-of-week: sessions needed on a weekday
const ROUGH_GRAY = 1.5;         // intensity-point gap above other days → question
const ROUGH_STRONG = 2.5;       // intensity-point gap above other days → finding
```

Replace with:

```ts
const MIN_OBS_PER_WEEKDAY = 3;         // day-of-week: entry floor → at most a question
const MIN_FINDING_OBS_PER_WEEKDAY = 5; // a confident finding needs a deeper weekday bucket
const MIN_OTHERS_FOR_FINDING = 8;      // …measured against a non-thin comparison pool
const ROUGH_GRAY = 1.5;                // intensity-point gap above other days → question
const ROUGH_STRONG = 2.5;              // intensity-point gap above other days → finding
```

Then update `detectDayOfWeek` to track the winning day's comparison-pool size and downgrade a finding that doesn't clear both finding floors. Find:

```ts
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
```

Replace with:

```ts
  let best = -1;
  let bestEffect = 0; // only a strictly-rougher weekday qualifies
  let bestOthersLen = 0;
  for (let dow = 0; dow < 7; dow++) {
    if (byDow[dow].length < MIN_OBS_PER_WEEKDAY) continue;
    const others = byDow.filter((_, i) => i !== dow).flat();
    if (others.length === 0) continue;
    const effect = mean(byDow[dow]) - mean(others);
    if (effect > bestEffect) {
      bestEffect = effect;
      best = dow;
      bestOthersLen = others.length;
    }
  }
  if (best === -1) return null;

  const tier = classifyTier(byDow[best].length, MIN_OBS_PER_WEEKDAY, bestEffect, ROUGH_GRAY, ROUGH_STRONG);
  if (tier === 'none') return null;

  // Honesty downgrade: a confident weekday claim needs a deeper bucket AND a
  // non-thin comparison pool; thin evidence is at most a hunch (question).
  const earnedFinding =
    byDow[best].length >= MIN_FINDING_OBS_PER_WEEKDAY && bestOthersLen >= MIN_OTHERS_FOR_FINDING;
  const finalTier: 'finding' | 'question' = tier === 'finding' && earnedFinding ? 'finding' : 'question';

  const day = WEEKDAY_NAMES[best];
  const text =
    finalTier === 'finding'
      ? `${day}s run rough — you show up more wound up than on your other days.`
      : `Your ${day}s have been running a little rough — anything recurring?`;
  return { id: 'day-of-week', text, kind: finalTier };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- patterns.test`
Expected: PASS — the calibration `describe` (both downgrade cases now `'question'`), the updated finding case (`'monday'`, `'finding'`), the entry-floor question case, **and** the pre-existing day-of-week/noise/ordering tests (the Task-5 noise set has no weekday at the floor → still zero findings; the ordering fixture's 3 Saturdays were already a `question`, unaffected).

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
git commit -m "feat(patterns): split day-of-week finding floor above the question floor"
```

---

### Task 2: Insights "What I've noticed" section (render + gating + styling)

**Why:** The spec's "Unit (UI)" replaces the thin static `patternBox` (which just restates the most-common mood + average change) with a section rendering `buildPatterns(sessions)`: findings as confident statements, questions as the coach posing a question. Gating mirrors the screen's existing free/Pro convention (free sees one teaser; a `UNLOCK PRO →` row reveals the rest), satisfying "one basic pattern free … full pattern set behind Pro." Pure RN UI — verified by typecheck + lint here; on-device E2E is Plan 7.

**Files:**
- Modify: `app/insights.tsx`

There is no vitest for screen components in this project, so this task is structured as edit → typecheck → lint (not red/green TDD). Make the edits exactly as written.

- [ ] **Step 1: Import the pattern engine**

In `app/insights.tsx`, find the storage import:

```ts
import {
  Session,
} from '@/lib/storage';
import { getTopEffectiveCombinations } from '@/lib/workout-insights';
```

Replace with (adds the `buildPatterns`/`PatternItem` import):

```ts
import {
  Session,
} from '@/lib/storage';
import { buildPatterns, type PatternItem } from '@/lib/patterns';
import { getTopEffectiveCombinations } from '@/lib/workout-insights';
```

- [ ] **Step 2: Remove the now-unused most-common-mood derivation and its import**

The old `patternBox` is the only consumer of `mostCommonMood` / `getMostCommonMood`; removing the box would leave them unused (a lint failure). Remove them now.

Find and delete this line (~line 112):

```ts
  const mostCommonMood = useMemo(() => sessionCount >= 3 ? getMostCommonMood(sessions) : null, [sessions, sessionCount]);
```

Then update the analytics import to drop `getMostCommonMood` (keep `formatChange` and `getLastNDays`, both still used by the stats row and chart). Find:

```ts
import { getMostCommonMood, formatChange, getLastNDays } from '@/lib/analytics';
```

Replace with:

```ts
import { formatChange, getLastNDays } from '@/lib/analytics';
```

Note: `MOODS` (line 21) stays imported — it's still used by the case-history rows and the case-file panel. Only `getMostCommonMood` and `mostCommonMood` are removed.

- [ ] **Step 3: Compute patterns + the free/Pro split**

Add a `useMemo` near the other derived values (e.g. right after the `recentSessions` memo, ~line 88). The teaser rule is documented inline:

```ts
  /** On-device pattern engine (templated, no LLM, no network). `buildPatterns`
   *  already orders confident findings ahead of hedged questions, so items[0]
   *  is the single strongest signal the user has earned. Free users see exactly
   *  that one teaser ("it notices me"); Pro unlocks the full set. */
  const patterns = useMemo<PatternItem[]>(() => buildPatterns(sessions), [sessions]);
  const visiblePatterns = useMemo(
    () => (isPremium ? patterns : patterns.slice(0, 1)),
    [patterns, isPremium],
  );
  const lockedPatternCount = isPremium ? 0 : Math.max(patterns.length - 1, 0);
```

- [ ] **Step 4: Replace the `patternBox` block with the "noticed" section**

Find the existing block (~lines 370–379):

```tsx
        {/* Pattern section */}
        {sessionCount >= 3 && mostCommonMood && (
          <View style={styles.patternBox}>
            <Text style={styles.patternLabel}>PATTERN</Text>
            <Text style={styles.patternText}>
              Your most common mood is {MOODS[mostCommonMood].name}. Your average improvement
              is {formatChange(avgChange)} points.
            </Text>
          </View>
        )}
```

Replace with:

```tsx
        {/* What I've noticed — on-device pattern engine (findings vs hunches) */}
        {visiblePatterns.length > 0 && (
          <View style={styles.noticedSection}>
            <Text style={styles.noticedLabel}>WHAT I&apos;VE NOTICED</Text>
            {visiblePatterns.map((p) => (
              <View
                key={p.id}
                style={[styles.noticedCard, p.kind === 'finding' ? styles.noticedFinding : styles.noticedQuestion]}
                accessible={true}
                accessibilityLabel={p.kind === 'finding' ? `Pattern: ${p.text}` : `Dr. MoodRx asks: ${p.text}`}
              >
                <Text style={p.kind === 'finding' ? styles.noticedFindingTag : styles.noticedQuestionTag}>
                  {p.kind === 'finding' ? 'PATTERN' : 'DR. MOODRX ASKS'}
                </Text>
                <Text style={styles.noticedText}>{p.text}</Text>
              </View>
            ))}
            {!subLoading && lockedPatternCount > 0 && (
              <TouchableOpacity
                style={styles.historyUpsellRow}
                onPress={() => setShowPremiumSheet(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`See ${lockedPatternCount} more ${lockedPatternCount === 1 ? 'pattern' : 'patterns'} with Pro`}
              >
                <Text style={styles.historyUpsellText}>
                  +{lockedPatternCount} MORE {lockedPatternCount === 1 ? 'PATTERN' : 'PATTERNS'} — UNLOCK PRO →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
```

- [ ] **Step 5: Replace the `patternBox` styles with the "noticed" styles**

In the `StyleSheet.create({...})`, find the three old style entries:

```ts
  patternBox: {
    borderLeftWidth: 2,
    borderLeftColor: '#059669',
    backgroundColor: '#111111',
    padding: 16,
    marginTop: 24,
  },
  patternLabel: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
  },
  patternText: {
    ...t.body,
    fontSize: 16,
    marginTop: 8,
  },
```

Replace with (matches the dark insights language: `#111` card, mono labels, green for confident findings / amber for hunches — the screen already uses `#059669` and `#D97706` as its success/warning accents):

```ts
  noticedSection: {
    marginTop: 32,
  },
  noticedLabel: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
    marginBottom: 12,
  },
  noticedCard: {
    backgroundColor: '#111111',
    borderLeftWidth: 2,
    padding: 16,
    marginBottom: 10,
  },
  noticedFinding: {
    borderLeftColor: '#059669',
  },
  noticedQuestion: {
    borderLeftColor: '#D97706',
  },
  noticedFindingTag: {
    ...t.label,
    color: '#059669',
    letterSpacing: 2,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  noticedQuestionTag: {
    ...t.label,
    color: '#D97706',
    letterSpacing: 2,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  noticedText: {
    ...t.body,
    fontSize: 16,
    lineHeight: 23,
  },
```

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck`
Expected: no errors (notably: no "unused `mostCommonMood`/`getMostCommonMood`/`patternBox`" and no missing-import errors).
Run: `npm run lint:ci`
Expected: clean — including no `no-unused-vars` for the removed symbols and no leftover references to `styles.patternBox` / `styles.patternLabel` / `styles.patternText`.

- [ ] **Step 7: Manual grep for stale references**

Run: `git grep -n "patternBox\|patternLabel\|patternText\|mostCommonMood\|getMostCommonMood" -- app/insights.tsx`
Expected: no output (all removed). If anything prints, delete the stragglers and re-run Step 6.

- [ ] **Step 8: Commit**

```bash
git add app/insights.tsx
git commit -m "feat(insights): render pattern engine as the 'noticed' section with free teaser + Pro gating"
```

---

## Self-Review

**1. Spec coverage** (`2026-06-11-adaptive-intelligence-design.md`):
- "Replace the thin 'PATTERN' box with a richer section rendering Unit A's items — confident findings styled as statements, gray-zone items styled as the coach posing a question. Keep everything else on the screen as-is." → Task 2 Steps 4–5: the `patternBox` block is replaced by `noticedSection`; `kind:'finding'` → green `PATTERN` card, `kind:'question'` → amber `DR. MOODRX ASKS` card; no other section on the screen is touched. ✓
- Gating: "one basic pattern free … full pattern set behind Pro — consistent with existing insights gating (calendar/full-history are Pro)." → `visiblePatterns = isPremium ? patterns : patterns.slice(0,1)` + the `+N MORE … UNLOCK PRO →` row reusing the screen's existing `historyUpsellRow`/`historyUpsellText` styles and `PremiumSheet`. ✓
- Open item "the free-teaser selection rule (which one pattern shows to free users)" → resolved + documented: `items[0]`, leaning on `buildPatterns`' findings-first ordering. ✓
- Carry-forward calibration (pattern-engine plan): "split the finding observation floor higher than the question floor (e.g. question@3, finding@5+) and/or require a minimum others.length." → Task 1: `MIN_OBS_PER_WEEKDAY=3` (question), `MIN_FINDING_OBS_PER_WEEKDAY=5` **and** `MIN_OTHERS_FOR_FINDING=8` (finding), with a downgrade step; fixtures cover the shallow-bucket and thin-pool downgrades, the cleared-floor finding, and the entry-floor question. ✓
- "noise set must produce zero findings" reaffirmed → Task 1 Step 4 notes the Task-5 noise fixture still yields zero items (the new floors only make findings *harder*); `npm test` in Step 5 runs it. ✓
- Privacy/cost/store: "Patterns entirely on-device → zero new data leaves the phone, $0 model cost, no store-declaration change." → no network/LLM added; no manifest/privacy edit in this plan. ✓

**2. Placeholder scan:** none. Every code step shows the exact before/after text; every run step has a command + expected result. No "TBD"/"handle edge cases"/"similar to Task N".

**3. Type consistency:**
- `PatternItem` (`{ id, text, kind: 'finding' | 'question' }`) is imported in Task 2 Step 1 and consumed in Steps 3–4 exactly as exported from `lib/patterns.ts` (verified against the current file). `buildPatterns(sessions: Session[]): PatternItem[]` matches the call site. `p.id` is the React key (the existing `PatternItem.id` union is unique per signal). ✓
- Task 1: `finalTier` is typed `'finding' | 'question'` (never `'none'` — the `tier === 'none'` early-return precedes it), matching `PatternItem.kind`. `bestOthersLen` is initialized to `0` and only assigned alongside `best`/`bestEffect`, so it always reflects the winning day. The constants `MIN_FINDING_OBS_PER_WEEKDAY`/`MIN_OTHERS_FOR_FINDING` are defined once and used once. ✓
- Removed symbols (`mostCommonMood`, `getMostCommonMood`, `styles.patternBox`/`patternLabel`/`patternText`) are scrubbed in Task 2 Steps 2/5 and grep-verified in Step 7, so no dangling reference remains. `formatChange`/`getLastNDays`/`MOODS` are explicitly retained because other sections still use them. ✓
