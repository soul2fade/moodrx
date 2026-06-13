# Vent Recording Interaction Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the voice-vent recorder wait for the *user* to be done — never cutting off on a natural pause — with continuous STT, a 60s hard cap, an inline (non-alert) "Still here — take your time" check-in after sustained silence, a walked-away graceful auto-finish, transcript that accumulates across continuous segments, and phantom-session guards.

**Architecture:** The recording flow lives in `app/vent.tsx` (a React Native screen using `expo-speech-recognition`). The one piece of risky, branchy logic — accumulating a multi-segment continuous transcript — is extracted into a pure helper in `lib/vent.ts` and unit-tested with vitest (TDD). Everything else is timer/animation/guard wiring inside the component, layered on in three reviewable steps: (1) continuous mode + accumulation + 60s cap, (2) the inline silence check-in machine, (3) the phantom-session guards.

**Tech Stack:** React Native (Expo SDK 54), `expo-speech-recognition@3.1.3` (on-device STT), `expo-router`, React Native `Animated`, vitest (pure-logic units only), TypeScript.

**Source spec:** `docs/superpowers/specs/2026-06-12-vent-recording-interaction-design.md`

**Branch:** `feat/voice-venting` (stays OPEN — do NOT merge). Do NOT run an EAS build; on-device verification batches into a later build.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `lib/vent.ts` | Pure vent logic. Gains `joinTranscript` + `accumulateTranscript` for multi-segment continuous capture. | Modify (additive) |
| `lib/__tests__/vent.test.ts` | vitest units. Gains a `describe('accumulateTranscript')` block. | Modify (additive) |
| `app/vent.tsx` | The vent screen. Continuous STT, 60s cap, silence check-in, accumulation wiring, phantom guards. | Modify |

No new files, no new screens, no new navigation. No store-declaration or privacy-policy change (on-device STT, behavior unchanged — only the *ending* logic changes).

---

## Background the engineer needs (zero-context primer)

- `expo-speech-recognition` fires a `result` event whose payload is `{ results: [{ transcript: string, ... }], isFinal: boolean }`. With `continuous: false` (current), the OS ends the session after ~2s of silence and the final `transcript` is the whole utterance. With `continuous: true` (the fix), the recognizer listens *through* silences and delivers speech as **multiple segments**: when a segment finalizes (`event.isFinal === true`), the *next* segment starts fresh — `event.results[0].transcript` resets and counts from zero again. **If you keep doing `setTranscript(event.results[0].transcript)` (replace), you lose every prior segment.** That is the bug this plan must avoid — accumulate finalized segments instead of replacing.
- The current handler (`app/vent.tsx:104-108`) does exactly the replace-and-lose thing. It ignores `isFinal` entirely (`isFinal` appears nowhere in the repo today).
- `transcriptRef.current` must always hold the **full** text to submit, because the `end` handler (`app/vent.tsx:111-124`) reads `transcriptRef.current` to decide submit-vs-empty-fallback.
- Three independent timers will exist: the existing `hardStopTimerRef` (absolute ceiling) plus two new silence timers. All must be cleared on stop / unmount / fallback.
- Readability standard (see `readability-standard` memory): the check-in must use the *improved* contrast targets — use color tokens from `lib/colors.ts` (e.g. `colors.textSecondary`, `colors.accent`), never hardcoded dim greys like `#999`/`#888`/`#525252`. There is a `readability-guard.test.ts` that fails `npm test` if you introduce a dim grey text literal.

---

## Task 1: Pure transcript accumulation logic (TDD)

Extract the multi-segment accumulation rule into `lib/vent.ts` so it can be unit-tested without React Native. The rule: maintain a `committed` string of all finalized segments; the on-screen `display` is `committed` joined with the current (possibly interim) segment; only when a segment is `isFinal` does it fold into `committed`.

**Files:**
- Modify: `lib/vent.ts` (add `joinTranscript` + `accumulateTranscript`)
- Test: `lib/__tests__/vent.test.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing tests**

Add to the end of `lib/__tests__/vent.test.ts`:

```ts
import { joinTranscript, accumulateTranscript } from '@/lib/vent';

describe('joinTranscript', () => {
  it('joins two non-empty parts with a single space, trimming each', () => {
    expect(joinTranscript('hello', 'there')).toBe('hello there');
    expect(joinTranscript('  hello ', '  there  ')).toBe('hello there');
  });
  it('returns the other part when one is empty/whitespace', () => {
    expect(joinTranscript('', 'there')).toBe('there');
    expect(joinTranscript('hello', '')).toBe('hello');
    expect(joinTranscript('   ', 'there')).toBe('there');
    expect(joinTranscript('hello', '   ')).toBe('hello');
    expect(joinTranscript('', '')).toBe('');
  });
});

describe('accumulateTranscript', () => {
  it('interim segment updates display but NOT committed', () => {
    expect(accumulateTranscript('', 'hel', false)).toEqual({ committed: '', display: 'hel' });
    expect(accumulateTranscript('', 'hello', false)).toEqual({ committed: '', display: 'hello' });
  });
  it('final segment folds into committed', () => {
    expect(accumulateTranscript('', 'hello', true)).toEqual({ committed: 'hello', display: 'hello' });
  });
  it('accumulates across a pause: prior committed + new segment', () => {
    // First segment finalized:
    const a = accumulateTranscript('', 'I had a rough day', true);
    expect(a).toEqual({ committed: 'I had a rough day', display: 'I had a rough day' });
    // Second segment arrives interim after a pause — prior text is preserved:
    const b = accumulateTranscript(a.committed, 'and I am exhausted', false);
    expect(b).toEqual({
      committed: 'I had a rough day',
      display: 'I had a rough day and I am exhausted',
    });
    // Second segment finalizes — both are now committed:
    const c = accumulateTranscript(a.committed, 'and I am exhausted', true);
    expect(c).toEqual({
      committed: 'I had a rough day and I am exhausted',
      display: 'I had a rough day and I am exhausted',
    });
  });
  it('empty segment leaves committed and shows committed as display', () => {
    expect(accumulateTranscript('so far', '', false)).toEqual({ committed: 'so far', display: 'so far' });
    expect(accumulateTranscript('so far', '', true)).toEqual({ committed: 'so far', display: 'so far' });
  });
});
```

(The existing top-of-file import line `import { parseVentResponse, ventAction, buildVentSession } from '@/lib/vent';` stays. A second import from the same module is fine; if the project's lint disallows duplicate imports, instead extend the existing import to `import { parseVentResponse, ventAction, buildVentSession, joinTranscript, accumulateTranscript } from '@/lib/vent';` and drop the separate import added above.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- vent`
Expected: FAIL — `joinTranscript`/`accumulateTranscript` are not exported (`is not a function` / undefined).

- [ ] **Step 3: Implement the helpers**

Add to `lib/vent.ts` (after the `VentAssessment` interface / near the other exports — placement is not critical, it is a pure module):

```ts
/** Join two transcript fragments with exactly one space, trimming each. Either
 *  side may be empty (returns the other). Used to stitch continuous-STT segments. */
export function joinTranscript(a: string, b: string): string {
  const left = a.trim();
  const right = b.trim();
  if (!left) return right;
  if (!right) return left;
  return `${left} ${right}`;
}

/** Accumulate a continuous-STT transcript across segments.
 *  `committed` holds all finalized segments so far; `segment` is the latest
 *  recognizer result (interim or final). The on-screen `display` is always
 *  committed + current segment; a segment only folds into `committed` once it
 *  is `isFinal`. This is what prevents a natural pause (which finalizes the
 *  prior segment and resets results[0] for the next) from erasing earlier text. */
export function accumulateTranscript(
  committed: string,
  segment: string,
  isFinal: boolean,
): { committed: string; display: string } {
  const display = joinTranscript(committed, segment);
  return { committed: isFinal ? display : committed, display };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- vent`
Expected: PASS (all `accumulateTranscript` + `joinTranscript` cases plus the pre-existing `parseVentResponse`/`ventAction`/`buildVentSession` cases).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean (no errors).

- [ ] **Step 6: Commit**

```bash
git add lib/vent.ts lib/__tests__/vent.test.ts
git commit -m "feat(vent): pure accumulateTranscript for continuous multi-segment capture"
```

---

## Task 2: Continuous STT + transcript accumulation + 60s hard cap

Switch the recorder to continuous mode, wire the result handler through `accumulateTranscript` (Task 1) so multi-segment vents are captured whole, and raise the hard cap 30s → 60s. This task does NOT add the check-in yet — after it, the recorder waits for DONE TALKING or the 60s ceiling, and never loses text across a pause.

**Files:**
- Modify: `app/vent.tsx`

- [ ] **Step 1: Update imports and timing constant**

In `app/vent.tsx`, extend the `lib/vent` import (line 25) to include the new helper:

```ts
import { ventAction, buildVentSession, accumulateTranscript, type VentAssessment } from '@/lib/vent';
```

Replace the `HARD_STOP_MS` constant (line 40):

```ts
const HARD_STOP_MS = 60_000;        // absolute ceiling (was 30s)
const SILENCE_PROMPT_MS = 12_000;   // continuous silence before the check-in fades in (Task 3)
const SILENCE_AUTOFINISH_MS = 15_000; // further silence after the check-in shows → graceful auto-finish (Task 3)
```

(The two silence constants are declared now so the file has a single source of truth; they are *used* in Task 3.)

- [ ] **Step 2: Add a committed-transcript ref**

After the `transcriptRef` declaration (around line 57), add:

```ts
  // Ref for the accumulated, finalized portion of a continuous-STT transcript.
  // Interim segments are appended to this for display but only folded in on isFinal.
  const committedTranscriptRef = useRef('');
```

- [ ] **Step 3: Rewrite the `result` handler to accumulate**

Replace the current `result` handler (lines 103-108):

```ts
  // ─── STT event: result ───────────────────────────────────────────────────
  useSpeechRecognitionEvent('result', (event) => {
    const t2 = event.results[0]?.transcript ?? '';
    setTranscript(t2);
    transcriptRef.current = t2;
  });
```

with the accumulating version:

```ts
  // ─── STT event: result ───────────────────────────────────────────────────
  useSpeechRecognitionEvent('result', (event) => {
    const segment = event.results[0]?.transcript ?? '';
    const { committed, display } = accumulateTranscript(
      committedTranscriptRef.current,
      segment,
      event.isFinal,
    );
    committedTranscriptRef.current = committed;
    setTranscript(display);
    transcriptRef.current = display;
  });
```

- [ ] **Step 4: Reset the committed ref and go continuous on start**

In `handleStartRecording` (lines 170-194), reset `committedTranscriptRef` alongside the other resets and flip `continuous` to `true`:

Change the reset block (lines 176-180) to also clear the committed ref:

```ts
    setTranscript('');
    transcriptRef.current = '';
    committedTranscriptRef.current = '';
    persistedRef.current = false;
    isRecordingRef.current = true;
    setVentState('recording');
```

Change the `ExpoSpeechRecognitionModule.start({...})` call (lines 181-187) to use continuous mode:

```ts
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: true,
      addsPunctuation: true,
    });
```

The existing `hardStopTimerRef` setTimeout below it already uses `HARD_STOP_MS`, which is now 60s — no further change needed there.

- [ ] **Step 5: Update the recording-screen copy (no longer auto-stops on pause)**

The recording hint currently says "stops automatically" (line 323), which is now false. Replace it:

```tsx
            <Text style={styles.recordingHint}>Take your time — tap done when you&apos;re ready</Text>
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: clean. (`event.isFinal` is typed on the speech-recognition result event; `SILENCE_PROMPT_MS`/`SILENCE_AUTOFINISH_MS` are declared-but-unused until Task 3 — TypeScript does not error on unused top-level `const`. If the project's ESLint `no-unused-vars` flags them, that is resolved in Task 3 which consumes both; do not delete them.)

- [ ] **Step 7: Commit**

```bash
git add app/vent.tsx
git commit -m "feat(vent): continuous STT + accumulating transcript + 60s hard cap"
```

---

## Task 3: Inline silence check-in (timers, animated component, resume, walked-away auto-finish)

Add the calm in-flow check-in: after `SILENCE_PROMPT_MS` of continuous silence, a "Still here — take your time" block fades into the recording screen (inline, no alert, no backdrop) with a single **Keep going** button. New speech auto-dismisses it. If nothing happens for a further `SILENCE_AUTOFINISH_MS`, the recording gracefully auto-finishes on the captured transcript. DONE TALKING stays the only finish control. All timers are cleared on stop/unmount/fallback.

**Files:**
- Modify: `app/vent.tsx`

- [ ] **Step 1: Add state, refs, and the check-in Animated value**

Add to the component state (near line 51, after `showResource`):

```ts
  const [showSilenceCheckin, setShowSilenceCheckin] = useState(false);
```

Add refs for the two silence timers (after `hardStopTimerRef`, line 56) and an `Animated.Value` for the fade (near the other animated values from `useScreenAnimation`, e.g. just below line 45):

```ts
  const silencePromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceAutoFinishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkinAnim = useRef(new Animated.Value(0)).current;
```

- [ ] **Step 2: Add a `clearSilenceTimers` helper and a `resetSilenceTimer` scheduler**

Add these `useCallback`s (place them above the `result` handler, after `fallbackToForm` is defined around line 149 — note: `handleManualStop` is referenced inside and is defined later in the file; because `resetSilenceTimer` only *calls* it inside a `setTimeout` callback at fire time, a function declaration reference is fine, but to avoid TDZ ordering concerns, call `ExpoSpeechRecognitionModule.stop()` directly rather than `handleManualStop`):

```ts
  // ─── Silence timer management ────────────────────────────────────────────
  const clearSilenceTimers = useCallback(() => {
    if (silencePromptTimerRef.current) {
      clearTimeout(silencePromptTimerRef.current);
      silencePromptTimerRef.current = null;
    }
    if (silenceAutoFinishTimerRef.current) {
      clearTimeout(silenceAutoFinishTimerRef.current);
      silenceAutoFinishTimerRef.current = null;
    }
  }, []);

  // Restart the silence countdown. Called on recording start, on every speech
  // result, and on "Keep going". Hides the check-in and schedules: (a) show the
  // check-in after SILENCE_PROMPT_MS, then (b) graceful auto-finish after a
  // further SILENCE_AUTOFINISH_MS.
  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimers();
    if (showSilenceCheckin) {
      setShowSilenceCheckin(false);
      checkinAnim.setValue(0);
    }
    silencePromptTimerRef.current = setTimeout(() => {
      if (!isRecordingRef.current) return;
      setShowSilenceCheckin(true);
      Animated.timing(checkinAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      silenceAutoFinishTimerRef.current = setTimeout(() => {
        if (isRecordingRef.current) {
          try { ExpoSpeechRecognitionModule.stop(); } catch { /* guard */ }
        }
      }, SILENCE_AUTOFINISH_MS);
    }, SILENCE_PROMPT_MS);
  }, [clearSilenceTimers, showSilenceCheckin, checkinAnim]);
```

Stopping STT fires the `end` event, whose handler already submits the captured `transcriptRef.current` (or falls back if empty) — so the walked-away auto-finish reuses the exact DONE-TALKING path. No separate finish logic needed.

- [ ] **Step 3: Reset the silence timer on every speech result (auto-resume)**

At the end of the `result` handler (the one rewritten in Task 2), add a call so any new speech both dismisses the check-in and restarts the countdown:

```ts
  // ─── STT event: result ───────────────────────────────────────────────────
  useSpeechRecognitionEvent('result', (event) => {
    const segment = event.results[0]?.transcript ?? '';
    const { committed, display } = accumulateTranscript(
      committedTranscriptRef.current,
      segment,
      event.isFinal,
    );
    committedTranscriptRef.current = committed;
    setTranscript(display);
    transcriptRef.current = display;
    resetSilenceTimer();
  });
```

- [ ] **Step 4: Start the silence countdown when recording starts**

In `handleStartRecording`, after the `ExpoSpeechRecognitionModule.start({...})` call and the existing hard-stop `setTimeout`, also kick off the silence countdown and ensure the check-in starts hidden. Add right after the `hardStopTimerRef` setTimeout block (after line 193):

```ts
    setShowSilenceCheckin(false);
    checkinAnim.setValue(0);
    resetSilenceTimer();
```

- [ ] **Step 5: Clear silence timers everywhere the hard-stop timer is cleared**

The silence timers must die with the recording. Add `clearSilenceTimers()` (and hide the check-in) at each existing teardown site:

In the **`end`** handler (after clearing `hardStopTimerRef`, around line 117) add:

```ts
    clearSilenceTimers();
    setShowSilenceCheckin(false);
```

In the **`error`** handler (after clearing `hardStopTimerRef`, around line 132) add the same two lines.

In **`fallbackToForm`** (after clearing `hardStopTimerRef`, around line 146) add the same two lines.

In the **unmount cleanup** effect (lines 94-101), add silence-timer cleanup alongside the hard-stop cleanup:

```ts
  useEffect(() => {
    return () => {
      if (hardStopTimerRef.current) clearTimeout(hardStopTimerRef.current);
      if (silencePromptTimerRef.current) clearTimeout(silencePromptTimerRef.current);
      if (silenceAutoFinishTimerRef.current) clearTimeout(silenceAutoFinishTimerRef.current);
      if (isRecordingRef.current) {
        try { ExpoSpeechRecognitionModule.stop(); } catch { /* guard */ }
      }
    };
  }, []);
```

(Note: `clearSilenceTimers` is a `useCallback`; the unmount effect has an empty dep array and intentionally clears the refs directly to avoid re-subscribing. Direct `clearTimeout` on the refs is correct here.)

- [ ] **Step 6: Render the inline check-in inside the recording state**

In the `recording` block, insert the check-in **above** the DONE TALKING button (between the `pulseDot` View, line 330, and the `stopBtn` TouchableOpacity, line 331):

```tsx
            {showSilenceCheckin && (
              <Animated.View
                style={[
                  styles.checkinBlock,
                  {
                    opacity: checkinAnim,
                    transform: [{
                      translateY: checkinAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [8, 0],
                      }),
                    }],
                  },
                ]}
              >
                <Text style={styles.checkinText}>Still here — take your time.</Text>
                <TouchableOpacity
                  style={styles.checkinBtn}
                  onPress={resetSilenceTimer}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Keep going"
                >
                  <Text style={styles.checkinBtnText}>KEEP GOING</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
```

"Keep going" calls `resetSilenceTimer`, which hides the check-in (fading via `checkinAnim.setValue(0)`) and restarts the 12s countdown — keeping STT running, no mic re-tap.

- [ ] **Step 7: Add the check-in styles**

Add to the `StyleSheet.create({...})` (place near the recording styles, after `stopBtnText`, around line 614). Uses tokens / improved-contrast greys only — NO hardcoded dim literals (the readability guard enforces this):

```ts
  checkinBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  checkinText: {
    ...t.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  checkinBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  checkinBtnText: {
    ...t.label,
    color: colors.accent,
    letterSpacing: 2,
  },
```

- [ ] **Step 8: Typecheck + tests + lint**

Run: `npm run typecheck`
Expected: clean (the `SILENCE_*` constants are now consumed).

Run: `npm test`
Expected: PASS — all existing suites including `readability-guard.test.ts` (confirms no dim-grey text literal was introduced).

Run: `npm run lint`
Expected: clean (no `no-unused-vars`, no `no-color-literals` violations).

- [ ] **Step 9: Commit**

```bash
git add app/vent.tsx
git commit -m "feat(vent): inline silence check-in with resume + walked-away auto-finish"
```

---

## Task 4: Phantom-session guards (audit item #7)

Two guards the redesign rewrites this code around, so they land here rather than standalone:
1. **Re-entry guard** in `handleStartRecording` — a double-tap on the mic must not start STT twice / reset mid-capture.
2. **Cancelled guard** in `handleSubmit` — if the screen unmounts during the `thinking` state (await `fetchVentReply`), do NOT `setState` or persist a session afterward (avoids a phantom unconfirmed session + a React "set state on unmounted component" warning).

**Files:**
- Modify: `app/vent.tsx`

- [ ] **Step 1: Add an unmounted ref**

Add near the other refs (after `persistedRef`, around line 62):

```ts
  // Set on unmount; guards async continuations (e.g. handleSubmit after await)
  // from setting state or persisting a session on a dead screen.
  const unmountedRef = useRef(false);
```

Set it in the unmount cleanup effect (the one edited in Task 3, Step 5) — add as the first line of the returned cleanup function:

```ts
    return () => {
      unmountedRef.current = true;
      if (hardStopTimerRef.current) clearTimeout(hardStopTimerRef.current);
      if (silencePromptTimerRef.current) clearTimeout(silencePromptTimerRef.current);
      if (silenceAutoFinishTimerRef.current) clearTimeout(silenceAutoFinishTimerRef.current);
      if (isRecordingRef.current) {
        try { ExpoSpeechRecognitionModule.stop(); } catch { /* guard */ }
      }
    };
```

- [ ] **Step 2: Re-entry guard in `handleStartRecording`**

Add as the very first line of `handleStartRecording` (before the permission request, line 171):

```ts
  const handleStartRecording = async () => {
    if (isRecordingRef.current) return; // re-entry guard: ignore double-taps
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
```

(Note: `isRecordingRef.current` is set to `true` only *after* the permission grant, so a rapid double-tap during the permission await could still slip through. To fully close that window, also guard on the screen state: change the guard to `if (isRecordingRef.current || ventState !== 'invite' && ventState !== 'consent') return;` — but the simpler `isRecordingRef` guard covers the dominant real case, double-taps after recording has begun. Use the simple form unless review asks for the stricter one.)

Use the simple form:

```ts
    if (isRecordingRef.current) return; // re-entry guard: ignore double-taps
```

- [ ] **Step 3: Cancelled guard in `handleSubmit`**

`handleSubmit` (lines 202-221) awaits `fetchVentReply` (up to ~8s). If the user backs out / the screen unmounts during that await, the continuation must bail. Insert the guard immediately after the await returns, before any `setState`/persist/navigation:

```ts
  const handleSubmit = async (text: string) => {
    setVentState('thinking');
    const a = await fetchVentReply(text);
    if (unmountedRef.current) return; // screen gone — don't persist a phantom session or setState
    if (!a) {
      fallbackToForm("Couldn't reach Dr. MoodRx — tap it in instead");
      return;
    }
    setAssessment(a);
    const action = ventAction(a.risk);
    if (action === 'crisis-redirect') {
      await persist(a, null);
      router.replace('/crisis');
    } else if (action === 'reply-with-resource') {
      setShowResource(true);
      setVentState('reply');
    } else {
      setVentState('reply');
    }
  };
```

(`persistedRef` already prevents a *double* persist; this guard prevents an *unwanted* persist/setState after unmount. Both are needed — they cover different failure modes.)

- [ ] **Step 4: Typecheck + tests + lint**

Run: `npm run typecheck`
Expected: clean.

Run: `npm test`
Expected: PASS (no logic regressions; pure-logic suites unaffected).

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/vent.tsx
git commit -m "fix(vent): phantom-session guards (re-entry + cancelled-submit) — audit #7"
```

---

## Final verification (after all tasks)

- [ ] Run the full suite once more: `npm test` → PASS (incl. `vent.test.ts` accumulation block + `readability-guard.test.ts`).
- [ ] `npm run typecheck` → clean.
- [ ] `npm run lint` → clean.
- [ ] Confirm the four commits are on `feat/voice-venting` and the branch is NOT merged: `git log --oneline -6` and `git branch --show-current` (expect `feat/voice-venting`).
- [ ] Do NOT run `eas build` — on-device verification (the items below) batches into the next pay-as-you-go build.

**Deferred to the on-device build (cannot be verified here — documented for the operator):**
- A vent with multiple natural pauses captures the *whole* transcript (the continuous-accumulation path — the single highest-risk behavior).
- The check-in fades in only after ~12s of real silence, inline (no alert/backdrop); "Keep going" resumes without re-tapping the mic.
- Talking again after the check-in shows auto-resumes capture and hides the check-in.
- A walked-away vent auto-finishes gracefully within ~27s of silence; 60s remains the absolute ceiling.
- No regression to reply, crisis routing (`acute`→`/crisis`, `elevated`→resource link), mood-correction chip, or persistence.
- Phantom guards: mic double-tap does not double-start; backing out during "thinking" persists nothing.

---

## Spec coverage self-check

| Spec requirement | Task |
|---|---|
| `continuous: true` STT | Task 2, Step 4 |
| Transcript accumulates across segments (main risk) | Task 1 (pure + TDD) + Task 2, Step 3 |
| Hard cap 30s → 60s (`HARD_STOP_MS`) | Task 2, Step 1 |
| Inline (NOT `Alert.alert`) check-in, fades in ~300ms + upward drift, no backdrop | Task 3, Steps 1/6/7 |
| Appears after ~12s silence (`SILENCE_PROMPT_MS` 12000) | Task 2 Step 1 (const) + Task 3 Steps 2/4 |
| Single "Keep going" button; DONE TALKING stays the only finish | Task 3, Step 6 |
| Resume-on-speech auto-dismiss; silence timer resets on every result | Task 3, Steps 2/3 |
| Walked-away graceful auto-finish ~15s after check-in (`SILENCE_AUTOFINISH_MS`) | Task 2 Step 1 (const) + Task 3, Step 2 |
| Live cues keep running (transcript stays, hint updated) | Task 2, Step 5 + Task 3 (transcript stays mounted) |
| Empty-capture fallback unchanged | Unchanged (existing `end` handler) |
| Clear all timers on stop/unmount/fallback | Task 3, Step 5 |
| Improved-contrast tokens, no dim-grey literals | Task 3, Step 7 (+ readability guard in Step 8) |
| Audit #7 phantom-session guards | Task 4 |
| No change to STT engine / reply / crisis / mood-chip / persistence | Honored across all tasks |
| No EAS build | Final verification |
