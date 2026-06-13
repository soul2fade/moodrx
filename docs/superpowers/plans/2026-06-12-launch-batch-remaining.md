# Launch Batch — Remaining Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. Fresh subagent per task + two-stage review (spec, then quality). TDD the pure helpers.

**Goal:** Finish the remaining code items in the single-build batch so one EAS build covers everything: (#6) AI-coach toggle coupling, (#5) sleep-missing hint, (#3) insights "noticed" empty-state, (#4) field-notes voice-to-text.

**Architecture:** Four small, mostly independent features. Two have a pure-logic core extracted and vitest-TDD'd (`noticedEmptyState` in `lib/patterns.ts`; `appendDictation` in `lib/workout-ui.ts`); the rest is RN component wiring. All text colors use tokens from `lib/colors.ts` (the readability guard `lib/__tests__/readability-guard.test.ts` fails `npm test` on any dim-grey text literal).

**Tech Stack:** React Native (Expo SDK 54), `expo-speech-recognition@3.1.3` (on-device STT, already a dep), AsyncStorage-backed settings, vitest.

**Branch:** `feat/voice-venting` (stays OPEN — do NOT merge). Do NOT run an EAS build.

**Owner decisions captured:** #3 countdown threshold = **8 sessions**; #3 stage-2 line (8+ sessions but engine still empty) = **"Still listening. Clear patterns appear once your sessions spread across enough days and times to mean something."**

---

## Task A: #6 — AI-coach toggle auto-enables "Dr. MoodRx copy"

**Problem:** The post-workout AI coach builds its line on `postInsult`, which is `''` when the "Dr. MoodRx copy" toggle (`voiceEnabled`) is off — so enabling "AI coach (live)" alone silently does nothing. Fix: when AI coach is switched ON, also turn on "Dr. MoodRx copy".

**Files:**
- Modify: `app/settings.tsx`

- [ ] **Step 1: Update `handleAiCoachToggle`**

The current handler (around lines 206-215):
```ts
  const handleAiCoachToggle = async () => {
    const next = !aiCoachEnabled;
    setAiCoachEnabledState(next);
    await setAiCoachEnabled(next);
    Animated.timing(aiCoachToggleAnim, {
      toValue: next ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };
```
Replace with (adds the coupling — only when turning ON and the copy toggle is currently off):
```ts
  const handleAiCoachToggle = async () => {
    const next = !aiCoachEnabled;
    setAiCoachEnabledState(next);
    await setAiCoachEnabled(next);
    Animated.timing(aiCoachToggleAnim, {
      toValue: next ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    // The AI coach line builds on the "Dr. MoodRx copy" line (postInsult), which
    // is empty when that toggle is off — so AI coach alone would silently do
    // nothing. Auto-enable the copy when AI coach is switched on.
    if (next && !voiceEnabled) {
      setVoiceEnabledState(true);
      await setVoiceEnabled(true);
      Animated.timing(voiceToggleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };
```
(`voiceEnabled`, `setVoiceEnabledState`, `setVoiceEnabled`, and `voiceToggleAnim` are all already declared/imported in this file — they back the "Dr. MoodRx copy" toggle and `handleVoiceToggle`. Do NOT add new imports unless typecheck shows one missing.)

- [ ] **Step 2: Verify**

Run: `npm run typecheck` → clean.
Run: `npm test` → all pass (incl. readability-guard).
Run: `npm run lint` → clean.

- [ ] **Step 3: Commit**
```bash
git add app/settings.tsx
git commit -m "fix(settings): enabling AI coach auto-enables Dr. MoodRx copy (hidden dependency)"
```

---

## Task B: #5 — Sleep-missing hint on the health card

**Problem:** The insights health card shows steps and sleep, each only when non-null. When steps are present but sleep is null (e.g. the phone tracks steps but no source writes sleep), the card silently omits sleep with no explanation. Add a faint one-line hint in that specific case.

**Files:**
- Modify: `app/insights.tsx`

- [ ] **Step 1: Add the conditional hint inside the health card**

The health card currently ends with (around lines 236-238):
```tsx
    <Text style={styles.healthHint}>Cross-reference with your mood sessions below.</Text>
  </View>
)}
```
Insert the sleep-missing line BEFORE the `healthHint` Text, so it reads:
```tsx
    {healthSnapshot.stepsToday !== null && healthSnapshot.sleepHoursLastNight === null && (
      <Text style={styles.healthSleepMissing}>No sleep data — this source tracks steps only.</Text>
    )}
    <Text style={styles.healthHint}>Cross-reference with your mood sessions below.</Text>
  </View>
)}
```

- [ ] **Step 2: Add the style**

In the `StyleSheet.create({...})` for `app/insights.tsx`, near `healthHint`, add `healthSleepMissing`. Use a token color (NOT a hardcoded grey). Start with `colors.textSubtle`; if the readability guard test fails on it (too dim), use `colors.textMuted` instead:
```ts
  healthSleepMissing: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: colors.textSubtle,
    letterSpacing: 0.5,
    marginTop: 8,
    lineHeight: 17,
  },
```
(Confirm `fonts` and `colors` are already imported in `app/insights.tsx` — they are used throughout. Match the `fontFamily`/sizing idiom of the nearby `healthHint`/`healthStatLabel` styles if they differ.)

- [ ] **Step 3: Verify**

Run: `npm test` → all pass. **Critically, `readability-guard.test.ts` must pass** — if it fails pointing at `healthSleepMissing`, switch the color to `colors.textMuted` and re-run.
Run: `npm run typecheck` → clean.
Run: `npm run lint` → clean.

- [ ] **Step 4: Commit**
```bash
git add app/insights.tsx
git commit -m "feat(insights): faint 'no sleep data' hint when steps present but sleep missing"
```

---

## Task C: #3 — Insights "noticed" empty-state (two-stage)

**Problem:** The "WHAT I'VE NOTICED" section renders nothing when `buildPatterns(sessions)` is empty — confusing on a screen captioned "Data doesn't lie." Add a two-stage empty-state: below 8 sessions → a countdown; 8+ sessions but engine still empty → an honest "still listening" line.

**Files:**
- Modify: `lib/patterns.ts` (add `NOTICED_COUNTDOWN_THRESHOLD` + pure `noticedEmptyState`)
- Test: `lib/__tests__/patterns.test.ts` (add a `describe` block)
- Modify: `app/insights.tsx` (render the empty-state)

### Sub-part 1 — pure logic (TDD)

- [ ] **Step 1: Write the failing tests**

Append to `lib/__tests__/patterns.test.ts`. First ensure `noticedEmptyState` and `NOTICED_COUNTDOWN_THRESHOLD` are imported from `@/lib/patterns` (extend the existing import from that module rather than adding a duplicate import line):
```ts
describe('noticedEmptyState', () => {
  it('returns null when there are visible patterns (cards render instead)', () => {
    expect(noticedEmptyState(0, true)).toBeNull();
    expect(noticedEmptyState(20, true)).toBeNull();
  });
  it('countdown below the threshold, with remaining = threshold - count', () => {
    expect(noticedEmptyState(0, false)).toEqual({ stage: 'countdown', remaining: NOTICED_COUNTDOWN_THRESHOLD });
    expect(noticedEmptyState(1, false)).toEqual({ stage: 'countdown', remaining: NOTICED_COUNTDOWN_THRESHOLD - 1 });
    expect(noticedEmptyState(NOTICED_COUNTDOWN_THRESHOLD - 1, false)).toEqual({ stage: 'countdown', remaining: 1 });
  });
  it('listening at/above the threshold with no patterns', () => {
    expect(noticedEmptyState(NOTICED_COUNTDOWN_THRESHOLD, false)).toEqual({ stage: 'listening' });
    expect(noticedEmptyState(NOTICED_COUNTDOWN_THRESHOLD + 5, false)).toEqual({ stage: 'listening' });
  });
  it('threshold is 8', () => {
    expect(NOTICED_COUNTDOWN_THRESHOLD).toBe(8);
  });
});
```

- [ ] **Step 2: Run tests, verify they FAIL**

Run: `npm test -- patterns`
Expected: FAIL (`noticedEmptyState`/`NOTICED_COUNTDOWN_THRESHOLD` not exported).

- [ ] **Step 3: Implement in `lib/patterns.ts`**

Add near the other exports:
```ts
/** Below this many sessions the "noticed" empty-state shows a countdown;
 *  at/above it (with the engine still finding nothing) it shows the honest
 *  "still listening" line. 8 matches the pattern engine's finding-confidence
 *  comparison pool, so the countdown ends right when a finding can first fire. */
export const NOTICED_COUNTDOWN_THRESHOLD = 8;

export type NoticedEmptyState =
  | { stage: 'countdown'; remaining: number }
  | { stage: 'listening' };

/** What the insights "WHAT I'VE NOTICED" section should show when there are no
 *  visible patterns. Returns null when patterns exist (render the cards). Pure. */
export function noticedEmptyState(
  sessionCount: number,
  hasVisiblePatterns: boolean,
): NoticedEmptyState | null {
  if (hasVisiblePatterns) return null;
  if (sessionCount < NOTICED_COUNTDOWN_THRESHOLD) {
    return { stage: 'countdown', remaining: NOTICED_COUNTDOWN_THRESHOLD - sessionCount };
  }
  return { stage: 'listening' };
}
```

- [ ] **Step 4: Run tests, verify PASS**

Run: `npm test -- patterns`
Expected: PASS.

### Sub-part 2 — component wiring

- [ ] **Step 5: Compute the empty-state in the component**

In `app/insights.tsx`, the existing memos (around lines 95-99) compute `patterns`, `visiblePatterns`, `lockedPatternCount`. Add the import (extend the existing `@/lib/patterns` import to include the two new names) and a memo right after `visiblePatterns`:
```ts
  const noticed = useMemo(
    () => noticedEmptyState(sessionCount, visiblePatterns.length > 0),
    [sessionCount, visiblePatterns.length],
  );
```
(`sessionCount` already exists in this component — see around line 51. If the variable is named differently, use the existing session-count value; do not introduce a new count.)

- [ ] **Step 6: Render the empty-state**

The section currently renders only when patterns exist:
```tsx
{visiblePatterns.length > 0 && (
  <View style={styles.noticedSection}>
    ...cards + upsell...
  </View>
)}
```
Add an `else` path immediately AFTER that block (do NOT alter the existing card-rendering block) that renders the empty-state when `noticed` is non-null:
```tsx
{visiblePatterns.length === 0 && noticed && (
  <View style={styles.noticedSection}>
    <Text style={styles.noticedLabel}>WHAT I&apos;VE NOTICED</Text>
    <View style={styles.noticedEmptyCard}>
      {noticed.stage === 'countdown' ? (
        <Text style={styles.noticedEmptyText}>
          Patterns appear after {NOTICED_COUNTDOWN_THRESHOLD} sessions.{'\n'}
          {sessionCount > 0 ? `${noticed.remaining} more to go.` : 'Start logging below.'}
        </Text>
      ) : (
        <Text style={styles.noticedEmptyText}>
          Still listening. Clear patterns appear once your sessions spread across enough days and times to mean something.
        </Text>
      )}
    </View>
  </View>
)}
```

- [ ] **Step 7: Add the empty-state styles**

In `app/insights.tsx` `StyleSheet.create`, near `noticedSection`/`noticedLabel`, add (mirror the existing noticed card look; tokens only for text):
```ts
  noticedEmptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    marginTop: 4,
  },
  noticedEmptyText: {
    fontFamily: fonts.mono.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.5,
  },
```

- [ ] **Step 8: Verify**

Run: `npm test` → all pass (incl. patterns block + readability-guard).
Run: `npm run typecheck` → clean.
Run: `npm run lint` → clean.

- [ ] **Step 9: Commit**
```bash
git add lib/patterns.ts lib/__tests__/patterns.test.ts app/insights.tsx
git commit -m "feat(insights): two-stage 'noticed' empty-state (countdown <8, still-listening 8+)"
```

---

## Task D: #4 — Field-notes voice-to-text (tap-to-dictate)

**Problem:** The post-workout Field Notes input is keyboard-only. Add a tap-to-dictate mic button reusing the existing on-device `expo-speech-recognition` STT, appending dictated text to `note` and respecting the 140-char cap.

**Files:**
- Modify: `lib/workout-ui.ts` (add pure `appendDictation`)
- Test: `lib/__tests__/workout-ui.test.ts` (create or extend)
- Modify: `app/post-workout.tsx` (mic button + STT wiring)

### Sub-part 1 — pure logic (TDD)

- [ ] **Step 1: Write the failing tests**

Determine whether `lib/__tests__/workout-ui.test.ts` exists. If it does, append the `describe` block; if not, create it with the import header. Content:
```ts
import { describe, it, expect } from 'vitest';
import { appendDictation } from '@/lib/workout-ui';

describe('appendDictation', () => {
  it('uses the transcript when the base is empty', () => {
    expect(appendDictation('', 'hello there', 140)).toBe('hello there');
  });
  it('appends to existing text with a single space, trimming', () => {
    expect(appendDictation('rough day', 'felt better after', 140)).toBe('rough day felt better after');
    expect(appendDictation('  rough day ', '  felt better  ', 140)).toBe('rough day felt better');
  });
  it('returns the trimmed-capped base when the transcript is empty', () => {
    expect(appendDictation('note', '   ', 140)).toBe('note');
    expect(appendDictation('', '', 140)).toBe('');
  });
  it('truncates the result to the cap', () => {
    const base = 'a'.repeat(135);
    expect(appendDictation(base, 'bbbbbbbbbb', 140)).toHaveLength(140);
    expect(appendDictation(base, 'bbbbbbbbbb', 140).startsWith(base)).toBe(true);
  });
});
```
(If `lib/__tests__/workout-ui.test.ts` already exists and already imports from `@/lib/workout-ui`, EXTEND its import instead of adding a duplicate.)

- [ ] **Step 2: Run tests, verify FAIL**

Run: `npm test -- workout-ui`
Expected: FAIL (`appendDictation` not exported).

- [ ] **Step 3: Implement in `lib/workout-ui.ts`**
```ts
/** Append a dictated transcript onto an existing field-notes string, joined by a
 *  single space and hard-capped at `cap` characters. Trims both sides; an empty
 *  transcript just returns the trimmed/capped base. Pure — used by the
 *  tap-to-dictate field-notes mic. */
export function appendDictation(base: string, transcript: string, cap = 140): string {
  const t = transcript.trim();
  const b = base.trim();
  if (!t) return b.slice(0, cap);
  const joined = b.length ? `${b} ${t}` : t;
  return joined.slice(0, cap);
}
```

- [ ] **Step 4: Run tests, verify PASS**

Run: `npm test -- workout-ui`
Expected: PASS.

### Sub-part 2 — component wiring

- [ ] **Step 5: Add STT imports and dictation state to `app/post-workout.tsx`**

Add to the imports:
```ts
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { appendDictation } from '@/lib/workout-ui';
```
(If `lib/workout-ui` is already imported — `getFieldNotePlaceholder` comes from it — EXTEND that existing import to include `appendDictation` instead of adding a new line.)

Add state + refs near the existing `const [note, setNote] = useState('');` (line 79):
```ts
  const [isDictating, setIsDictating] = useState(false);
  const dictatingRef = useRef(false);
  // The note text as it was when dictation started; new speech appends onto this.
  const dictateBaseRef = useRef('');
```
(`useRef` must be imported from React — confirm it's already in the React import; it is used elsewhere in the file via `submittedRef`. If not present, add it.)

- [ ] **Step 6: Add the STT event handlers + start/stop + cleanup**

Add these near the other hooks (after the dynamic-line effect is fine). Mirror the guarded pattern from `app/vent.tsx`:
```ts
  useSpeechRecognitionEvent('result', (event) => {
    if (!dictatingRef.current) return;
    const transcript = event.results[0]?.transcript ?? '';
    setNote(appendDictation(dictateBaseRef.current, transcript, 140));
  });

  useSpeechRecognitionEvent('end', () => {
    if (!dictatingRef.current) return;
    dictatingRef.current = false;
    setIsDictating(false);
  });

  useSpeechRecognitionEvent('error', () => {
    if (!dictatingRef.current) return;
    dictatingRef.current = false;
    setIsDictating(false);
  });

  // Stop dictation on unmount.
  useEffect(() => {
    return () => {
      if (dictatingRef.current) {
        dictatingRef.current = false;
        try { ExpoSpeechRecognitionModule.stop(); } catch { /* guard */ }
      }
    };
  }, []);

  const handleDictateToggle = async () => {
    if (dictatingRef.current) {
      try { ExpoSpeechRecognitionModule.stop(); } catch { /* guard */ }
      return;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return; // no mic — keyboard still works; stay silent
    dictateBaseRef.current = note;
    dictatingRef.current = true;
    setIsDictating(true);
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: true,
      addsPunctuation: true,
    });
  };
```
(Place `handleDictateToggle` and the `useSpeechRecognitionEvent` calls inside the component body, before the returned JSX. Ensure `useEffect` is imported.)

- [ ] **Step 7: Add the mic button to the Field Notes header**

The note header is currently (around lines 476-479):
```tsx
    <View style={styles.noteHeader}>
      <Text style={styles.noteLabel}>FIELD NOTES</Text>
      <Text style={styles.noteCount}>{note.length}/140</Text>
    </View>
```
Replace with a header that includes a dictate button on the right alongside the count:
```tsx
    <View style={styles.noteHeader}>
      <Text style={styles.noteLabel}>FIELD NOTES</Text>
      <View style={styles.noteHeaderRight}>
        <TouchableOpacity
          onPress={handleDictateToggle}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={isDictating ? 'Stop dictation' : 'Dictate field notes'}
        >
          <Text style={[styles.dictateBtnText, isDictating && styles.dictateBtnTextActive]}>
            {isDictating ? '■ STOP' : '● DICTATE'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.noteCount}>{note.length}/140</Text>
      </View>
    </View>
```
(`TouchableOpacity` must be imported from `react-native` in this file — confirm; the screen has buttons already so it is almost certainly imported. If not, add it.)

- [ ] **Step 8: Add the button styles**

In `app/post-workout.tsx` `StyleSheet.create`, add (tokens only for text color; accent when active):
```ts
  noteHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dictateBtnText: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  dictateBtnTextActive: {
    color: colors.accent,
  },
```
(Confirm `fonts` and `colors` are imported in `app/post-workout.tsx`. If the file currently uses a hardcoded grey for `noteCount`/`noteLabel`, do NOT change those — only your new styles must use tokens. If `colors` is not imported, add `import { colors } from '@/lib/colors';`.)

- [ ] **Step 9: Verify**

Run: `npm test` → all pass (incl. workout-ui block + readability-guard — the new `dictateBtnText` must not trip the guard; `colors.textSecondary` is light enough, but confirm).
Run: `npm run typecheck` → clean.
Run: `npm run lint` → clean (watch for react-hooks/exhaustive-deps on the new handlers; the event handlers are registered via `useSpeechRecognitionEvent` which re-subscribes each render, and the cleanup effect uses an empty dep array intentionally — same pattern as vent.tsx).

- [ ] **Step 10: Commit**
```bash
git add lib/workout-ui.ts lib/__tests__/workout-ui.test.ts app/post-workout.tsx
git commit -m "feat(post-workout): tap-to-dictate voice-to-text for field notes"
```

---

## Final verification (after all tasks)

- [ ] `npm test` → PASS (incl. new `noticedEmptyState`, `appendDictation` blocks + readability-guard).
- [ ] `npm run typecheck` → clean.
- [ ] `npm run lint` → clean.
- [ ] `git log --oneline` shows the four feature commits on `feat/voice-venting`; branch NOT merged.
- [ ] Do NOT run `eas build`.

**Deferred to the on-device build (cannot verify here):**
- #6: enabling AI coach flips the "Dr. MoodRx copy" toggle visibly ON and the post-workout AI line now appears.
- #5: a device that tracks steps but not sleep shows the "No sleep data" hint (and a device with sleep does not).
- #3: <8 sessions shows the countdown with the right remaining number; 8+ with clustered/non-varied data shows "Still listening".
- #4: the DICTATE button requests mic permission, transcribes on-device into the field, respects the 140 cap, and STOP/auto-end works; keyboard entry still works when mic is denied.

## Spec coverage self-check

| Item | Task |
|---|---|
| #6 AI-coach toggle coupling (auto-enable Dr. MoodRx copy) | Task A |
| #5 sleep-missing hint (steps present, sleep null) | Task B |
| #3 noticed empty-state, threshold 8, "Still listening" stage-2 | Task C (pure `noticedEmptyState` + render) |
| #4 field-notes voice-to-text, reuse STT, 140 cap | Task D (pure `appendDictation` + mic wiring) |
| Tokens only / readability guard passes | Tasks B, C, D styles |
| No EAS build | Final verification |
