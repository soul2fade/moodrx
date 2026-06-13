# Launch Polish Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. Fresh subagent per task + two-stage review (spec, then quality). TDD the pure logic.

**Goal:** Land seven on-device-feedback fixes in one build: (1) enforced readability, (2) deep-red accent, (3) trash-talk as a separate layer, (4) vent on-device→cloud fallback, (5) single-view screens fill the device, (6) bad-day step feedback, (7) bad-day mood-aware micro-workout.

**Architecture:** Mostly RN component + token edits, with pure-logic cores extracted and vitest-TDD'd where they exist (mood deep-colors, `microStepsForMood`, the vent recognition-mode decision). Readability is made *structural* via a new ESLint rule so small fonts fail CI, not just a sweep. All text colors use tokens; the existing `readability-guard.test.ts` color guard stays.

**Tech Stack:** React Native (Expo SDK 54), `expo-speech-recognition@3.1.3`, `expo-audio`, `expo-haptics@~15.0.8`, custom ESLint local rules, vitest, ffmpeg (installed at `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe`; also try `ffmpeg` on PATH).

**Branch:** `feat/voice-venting` (stays OPEN — do NOT merge). Do NOT run `eas build` (one batched build later).

**Owner decisions locked:** deep red = `#E11D48`; readability target = 15px mono labels, near-white greys, ≤1.5 tracking; trash-talk = separated toggle with "~once a minute, over your soundscape" copy; vent = on-device-first **with automatic cloud fallback** + one-time consent covering it; layout = **anchor CTA to bottom** (approach #1); bad-day feedback = progress dots + card animation + **soft chime + haptic** (both); bad-day exercise = **mood-aware (approach A)**.

---

## Task 1: Readability — font-size ESLint guard + sweep

**Problem:** Tokens are fine, but screens override `fontSize` down to 12–13px (esp. `app/workout.tsx`) and the existing guard only checks *colors*, not *sizes*. Add an ESLint rule that fails CI on text `fontSize < 14`, then bump offenders to 15 and cap small-label `letterSpacing` at 1.5.

**Files:**
- Modify: the local ESLint rules module (find it — the project already has `local/no-small-fontsize-without-lineheight` and `local/no-dark-text-color`; locate via `grep -rl "no-small-fontsize-without-lineheight" --include=*.js .` — likely `eslint-local-rules.js` or `eslint-rules/`).
- Modify: `app/workout.tsx` (the main offender) + any other `app/`/`components/` files the new rule flags.

- [ ] **Step 1: Locate the local ESLint rules file**

Run: `grep -rl "no-small-fontsize-without-lineheight" --include=*.js . --exclude-dir=node_modules`
Read it to learn the rule format (it's a standard ESLint rule object with `meta` + `create(context)` returning an `ObjectExpression`/`Property` visitor).

- [ ] **Step 2: Add a `no-tiny-fontsize` rule**

Add a sibling rule that flags a `fontSize` Property whose value is a numeric literal `< 14`. Mirror the existing `no-small-fontsize-without-lineheight` structure. The rule body:

```js
'no-tiny-fontsize': {
  meta: {
    type: 'problem',
    docs: { description: 'Text fontSize must be >= 14 (readability standard). Use an eslint-disable comment for deliberate non-text exceptions like icon glyphs.' },
    schema: [],
  },
  create(context) {
    return {
      Property(node) {
        if (
          node.key &&
          ((node.key.type === 'Identifier' && node.key.name === 'fontSize') ||
            (node.key.type === 'Literal' && node.key.value === 'fontSize')) &&
          node.value.type === 'Literal' &&
          typeof node.value.value === 'number' &&
          node.value.value < 14
        ) {
          context.report({ node, message: `fontSize ${node.value.value} is below the 14px readability floor — bump to >= 14 or eslint-disable for a deliberate non-text size.` });
        }
      },
    };
  },
},
```

Register it in the ESLint config the same way `no-small-fontsize-without-lineheight` is registered (find that registration in `eslint.config.js`/`.eslintrc` and add `'local/no-tiny-fontsize': 'error'`).

- [ ] **Step 3: Run lint to see it fail on current offenders**

Run: `npm run lint`
Expected: FAIL, listing `app/workout.tsx` lines (e.g. `focusBtnText` fontSize 12, `restLabel` 13, `soundBtnText` 12, `repLabel` 12, etc.) and any other sub-14 text styles.

- [ ] **Step 4: Fix every flagged style**

For each flagged `fontSize: 12` or `13` in a TEXT style, change to `fontSize: 15`. While in each style, if `letterSpacing` > 1.5 on a small mono label, reduce it to `1.5`. Concretely in `app/workout.tsx` (line numbers approximate — match by style name): `focusBtnText` 12→15; `restLabel` 13→15 + letterSpacing 4→1.5; `restSubtext` 12→15; `activeTimerDone` 12→15; `activeTimerHint` 12→15; `timerControlBtnText` 13→15; `sectionLabel` 13→15; `pbBadge` 13→15; `pbAlert` 13→15; `repLabel` 12→15; `repResetText` 13→15; `soundBtnText` 12→15; `soundOffText` 13→15; `keepAwakeBtnText` 13→15. Apply the same 14-floor fix to any other files the rule flags. Do NOT touch `size=` props on icons (those aren't `fontSize`). If a genuine non-text glyph uses `fontSize < 14` (e.g. a decorative dot/icon char), add `// eslint-disable-next-line local/no-tiny-fontsize` above it with a one-word reason — but prefer bumping.

- [ ] **Step 5: Lint + tests + typecheck green**

Run: `npm run lint` → clean.
Run: `npm test` → all pass (incl. `readability-guard.test.ts` color guard).
Run: `npm run typecheck` → clean.

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "feat(readability): no-tiny-fontsize ESLint guard + bump sub-14 text to 15"
```

---

## Task 2: Deep-red mood accent (deep/light split)

**Problem:** Stressed (`#F2547D`) and Low (`#7B7DF5`) were lightened to pass text contrast, which makes large accents (the workout timer, bad-day slider/borders) read as washed-out pink/lilac. Add a `colorDeep` per mood — a richer shade for LARGE/graphic accents — keeping the existing `color` for small text (which needs the contrast).

**Files:**
- Modify: `lib/moods.ts` (add `colorDeep` to `MoodData` + each mood)
- Test: `lib/__tests__/moods.test.ts` (create or extend — TDD the new field)
- Modify: `app/workout.tsx`, `app/bad-day.tsx`, `app/prescription.tsx` (use `colorDeep` for large accents)

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/moods.test.ts` (or extend if it exists — check first):
```ts
import { describe, it, expect } from 'vitest';
import { MOODS, MOOD_ORDER } from '@/lib/moods';

describe('mood colorDeep', () => {
  it('every mood has a colorDeep hex', () => {
    for (const k of MOOD_ORDER) {
      expect(MOODS[k].colorDeep).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
  it('stressed and low use richer deep variants than their light text color', () => {
    expect(MOODS.stressed.color).toBe('#F2547D');
    expect(MOODS.stressed.colorDeep).toBe('#E11D48');
    expect(MOODS.low.color).toBe('#7B7DF5');
    expect(MOODS.low.colorDeep).toBe('#6366F1');
  });
  it('non-lightened moods reuse their color as colorDeep', () => {
    expect(MOODS.anxious.colorDeep).toBe(MOODS.anxious.color);
    expect(MOODS.good.colorDeep).toBe(MOODS.good.color);
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- moods`
Expected: FAIL (`colorDeep` undefined).

- [ ] **Step 3: Implement in `lib/moods.ts`**

Add `colorDeep: string;` to the `MoodData` interface (after `color`). Add a `colorDeep` to each mood: `anxious` `'#E8B84B'`, `low` `'#6366F1'`, `foggy` `'#5EAAB5'`, `restless` `'#D97706'`, `stressed` `'#E11D48'`, `good` `'#059669'`. (Only `low` and `stressed` differ from `color`; the rest reuse it.)

- [ ] **Step 4: Run → PASS**

Run: `npm test -- moods` → PASS.

- [ ] **Step 5: Use `colorDeep` for large accents**

In `app/workout.tsx` change the accent source used for the **large/graphic** elements (timer text, progress bar, timer-control borders, the focus/voice button borders) from `MOODS[mood].color` to a new `const accentColorDeep = MOODS[mood].color === MOODS[mood].colorDeep ? accentColor : MOODS[mood].colorDeep;` — simplest: add `const accentColorDeep = MOODS[mood].colorDeep;` right after the existing `const accentColor = moodData.color;` (line ~174) and swap `accentColor` → `accentColorDeep` ONLY on: the progress bar `backgroundColor` (line ~565), the rest/active countdown `color` and progress `backgroundColor`, and the timer-control button `borderColor`/text `color`. Leave `accentColor` (light) on any small text labels. In `app/bad-day.tsx`: use `MOODS[mood].colorDeep` for the intensity-slider track/thumb, the step-card `borderLeftColor`, and the post-score number; keep `MOODS[mood].color` for the small mood-icon tint if it sits on dark as a tiny element. In `app/prescription.tsx`: use `colorDeep` for any large mood-colored headline/border, `color` for small text.

- [ ] **Step 6: Verify**

Run: `npm test` → pass. `npm run typecheck` → clean. `npm run lint` → clean.

- [ ] **Step 7: Commit**
```bash
git add lib/moods.ts lib/__tests__/moods.test.ts app/workout.tsx app/bad-day.tsx app/prescription.tsx
git commit -m "feat(moods): deep-color variant for large accents (deep red for stressed)"
```

---

## Task 3: Trash-talk as a separate layer (UI)

**Problem:** `TRASH TALK` sits in the soundscape row as if it's a 4th mutually-exclusive option, but it's an independent `trashTalkOn` toggle that layers over the soundscape and fires an insult every ~55s. Make the UI match: pull it out into its own toggle with frequency + layering copy, and add a line to the severity sheet.

**Files:**
- Modify: `app/workout.tsx` (soundscape row + new trash-talk toggle block)
- Modify: `components/SeveritySheet.tsx` (frequency line)

- [ ] **Step 1: Remove TRASH TALK from the soundscape row**

In `app/workout.tsx`, the soundscape buttons render `SOUNDSCAPES` (rain/forest/focus) plus a TRASH TALK button. Remove the TRASH TALK button from that row so the row holds only the three `SOUNDSCAPES` entries. (Keep the existing `trashTalkOn` state, `handleTrashTalkToggle`/severity-sheet logic, and the insult interval — only the *placement/visual* changes.)

- [ ] **Step 2: Add a dedicated trash-talk toggle block below the soundscape row**

Directly under the soundscape row, add:
```tsx
        <View style={styles.trashRow}>
          <View style={styles.trashLabelBlock}>
            <Text style={styles.trashLabel}>DR. MOODRX TRASH TALK</Text>
            <Text style={styles.trashHint}>A fresh roast about once a minute — plays over your soundscape.</Text>
          </View>
          <TouchableOpacity
            onPress={handleTrashTalkPress}
            activeOpacity={0.8}
            style={[styles.trashToggle, trashTalkOn ? styles.trashToggleOn : styles.trashToggleOff]}
            accessibilityRole="switch"
            accessibilityState={{ checked: trashTalkOn }}
            accessibilityLabel="Dr. MoodRx trash talk"
          >
            <View style={[styles.trashKnob, trashTalkOn && styles.trashKnobOn]} />
          </TouchableOpacity>
        </View>
```
Wire `handleTrashTalkPress` to the existing toggle handler (the one that currently opens the severity sheet on enable / turns off on tap-when-on — reuse it; if the existing handler is named differently, alias it). The switch is presentational (a track + knob); the severity sheet still appears on enable as today.

- [ ] **Step 3: Add the toggle styles (tokens only, fontSize >= 14)**
```ts
  trashRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, paddingVertical: 4 },
  trashLabelBlock: { flex: 1, paddingRight: 14 },
  trashLabel: { ...t.label, color: '#e2e2e2', fontSize: 15, letterSpacing: 1.5 },
  trashHint: { fontFamily: fonts.mono.regular, color: '#cfcfcf', fontSize: 14, lineHeight: 18, letterSpacing: 0.5, marginTop: 4, textTransform: 'none' },
  trashToggle: { width: 52, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center' },
  trashToggleOn: { backgroundColor: colors.danger },
  trashToggleOff: { backgroundColor: '#2a2a2a' },
  trashKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f0f0f0' },
  trashKnobOn: { alignSelf: 'flex-end' },
```
(Confirm `t`, `fonts`, `colors` are imported — they are.)

- [ ] **Step 4: Add the frequency line to the severity sheet**

In `components/SeveritySheet.tsx`, under the existing subtitle (`How hard should Dr. MoodRx go?`), add a small line:
```tsx
        <Text style={styles.frequencyNote}>He cuts in over your soundscape every minute or so.</Text>
```
with style:
```ts
  frequencyNote: { fontFamily: fonts.mono.regular, fontSize: 14, color: '#cfcfcf', textAlign: 'center', lineHeight: 18, letterSpacing: 0.5, marginTop: 6, marginBottom: 4 },
```
(Import `fonts` from `@/lib/typography` if not already.)

- [ ] **Step 5: Verify** — `npm run typecheck` clean, `npm test` pass (incl. guards), `npm run lint` clean.

- [ ] **Step 6: Commit**
```bash
git add app/workout.tsx components/SeveritySheet.tsx
git commit -m "feat(workout): trash talk is its own layer toggle with frequency/over-soundscape copy"
```

---

## Task 4: Vent on-device → cloud fallback

**Problem:** Vent forces `requiresOnDeviceRecognition: true`. When the device lacks the offline model, STT errors instantly → dead-end "Couldn't catch that." Fix: prefer on-device; if unavailable, fall back to cloud; update the one-time consent to cover it; replace the dead-end message.

**Files:**
- Modify: `lib/vent.ts` (pure `pickRecognitionMode` helper)
- Test: `lib/__tests__/vent.test.ts` (extend)
- Modify: `app/vent.tsx` (availability check, fallback, consent copy, messaging)

- [ ] **Step 1: Write the failing test for the decision helper**

Append to `lib/__tests__/vent.test.ts` (extend the existing `@/lib/vent` import to add `pickRecognitionMode`):
```ts
describe('pickRecognitionMode', () => {
  it('uses on-device when supported and the locale is on-device-available', () => {
    expect(pickRecognitionMode({ supportsOnDevice: true, onDeviceLocales: ['en-US'], locale: 'en-US' }))
      .toEqual({ requiresOnDeviceRecognition: true, usingCloud: false });
  });
  it('falls back to cloud when on-device is unsupported', () => {
    expect(pickRecognitionMode({ supportsOnDevice: false, onDeviceLocales: [], locale: 'en-US' }))
      .toEqual({ requiresOnDeviceRecognition: false, usingCloud: true });
  });
  it('falls back to cloud when the locale model is not available on-device', () => {
    expect(pickRecognitionMode({ supportsOnDevice: true, onDeviceLocales: ['fr-FR'], locale: 'en-US' }))
      .toEqual({ requiresOnDeviceRecognition: false, usingCloud: true });
  });
  it('treats locale case/region loosely (en matches en-US)', () => {
    expect(pickRecognitionMode({ supportsOnDevice: true, onDeviceLocales: ['en'], locale: 'en-US' }).usingCloud).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- vent` → FAIL (not exported).

- [ ] **Step 3: Implement in `lib/vent.ts`**
```ts
/** Decide whether to run STT on-device or fall back to cloud. On-device is
 *  preferred (privacy: audio never leaves the phone); we fall back to cloud only
 *  when the platform can't do on-device for this locale. Pure — the caller
 *  supplies the platform capability values it queried. */
export function pickRecognitionMode(input: {
  supportsOnDevice: boolean;
  onDeviceLocales: string[];
  locale: string;
}): { requiresOnDeviceRecognition: boolean; usingCloud: boolean } {
  const lang = input.locale.slice(0, 2).toLowerCase();
  const hasLocale = input.onDeviceLocales.some((l) => l.slice(0, 2).toLowerCase() === lang);
  const onDevice = input.supportsOnDevice && hasLocale;
  return { requiresOnDeviceRecognition: onDevice, usingCloud: !onDevice };
}
```

- [ ] **Step 4: Run → PASS** — `npm test -- vent` → PASS.

- [ ] **Step 5: Use it in `handleStartRecording`**

In `app/vent.tsx`, before `ExpoSpeechRecognitionModule.start(...)`, query capabilities and pick the mode:
```ts
    let mode = { requiresOnDeviceRecognition: true, usingCloud: false };
    try {
      const supportsOnDevice = await ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
      const onDeviceLocales = (await ExpoSpeechRecognitionModule.getSupportedLocales({ onDevice: true }).catch(() => ({ locales: [] as string[] }))).locales ?? [];
      mode = pickRecognitionMode({ supportsOnDevice, onDeviceLocales, locale: 'en-US' });
      if (mode.usingCloud) {
        // Best-effort: prompt the offline model download so future vents can go on-device.
        try { ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload?.({ locale: 'en-US' }); } catch { /* not on iOS / unsupported */ }
      }
    } catch { /* capability probe failed — default to on-device attempt */ }
```
Then change the `start({...})` call's `requiresOnDeviceRecognition: true` to `requiresOnDeviceRecognition: mode.requiresOnDeviceRecognition,`. (Import `pickRecognitionMode` by extending the existing `@/lib/vent` import.) If the `error` STT event still fires (e.g. on-device claimed support but failed), the existing `fallbackToForm` path remains — but update its message in Step 7.

- [ ] **Step 6: Update the consent copy to cover cloud fallback**

In the `consent` block of `app/vent.tsx`, replace the `consentText` body with:
```tsx
              <Text style={styles.consentText}>
                Your voice is turned into text on your phone when it can. If it can&apos;t, it&apos;s sent to {`${'Apple/Google'}`} to transcribe.{'\n'}
                That text goes to our AI for a reply — nothing is stored or used to train AI.
              </Text>
```
(Keep it one calm paragraph; the platform name can stay the literal "Apple/Google" — simplest and accurate cross-platform.)

- [ ] **Step 7: Replace the dead-end error message**

Where `fallbackToForm("Couldn't catch that — tap it in instead")` is called from the `end`/`error` handlers, change the copy to: `"Didn't catch your voice that time — tap it in instead."` (slightly warmer; still routes to the form). Leave the mic-denied message as-is.

- [ ] **Step 8: Verify** — `npm test` (incl. new `pickRecognitionMode` + readability guards) pass; `npm run typecheck` clean; `npm run lint` clean. Note: `supportsOnDeviceRecognition`/`getSupportedLocales`/`androidTriggerOfflineModelDownload` are on the module's type surface; if TS complains about `androidTriggerOfflineModelDownload` optional-call, keep the `?.` + try/catch.

- [ ] **Step 9: Commit**
```bash
git add lib/vent.ts lib/__tests__/vent.test.ts app/vent.tsx
git commit -m "feat(vent): on-device-first STT with automatic cloud fallback + consent copy"
```

---

## Task 5: Single-view screens fill the device (anchor-CTA layout)

**Problem:** Single-view screens are top-aligned, leaving dead space at the bottom on tall phones. Anchor the primary CTA to the bottom (safe-area aware) and let the upper content breathe, so the screen fills naturally on any device.

**Files:**
- Modify: `app/bad-day.tsx`, `app/vent.tsx`, `app/prescription.tsx` (single-view screens; leave `app/insights.tsx`/`app/settings.tsx` — they already scroll/fill).

- [ ] **Step 1: bad-day — anchor the CTA**

`app/bad-day.tsx` renders inside a ScrollView/View. Make the scroll content container fill and push the CTA down. On the `ScrollView`/content container, set `contentContainerStyle={[..., { flexGrow: 1 }]}`. Wrap the bottom CTA (the `LOG LIGHT DAY` button / the `NEXT` action area) so a flexible spacer sits above it: add `<View style={{ flex: 1, minHeight: 16 }} />` immediately before the final CTA block, and add bottom padding `paddingBottom: Math.max(insets.bottom + 16, 24)` to the content container (use `useSafeAreaInsets()` — already imported on similar screens; add if missing). Result: content stays top-aligned, the CTA sits at the bottom, the gap is the flexible spacer.

- [ ] **Step 2: vent — same treatment on the invite/reply states**

In `app/vent.tsx`, the `ScrollView` `contentContainerStyle` already has `flexGrow: 1`. Add a `<View style={{ flex: 1 }} />` spacer before the primary action(s) in the `invite` and `reply` states so the mic button / prescription buttons anchor lower, and ensure `paddingBottom` uses `insets.bottom`. (Do not change the `recording`/`thinking` states.)

- [ ] **Step 3: prescription — anchor its CTA**

In `app/prescription.tsx`, apply the same pattern: `flexGrow: 1` content container + a `flex: 1` spacer before the bottom CTA + safe-area bottom padding.

- [ ] **Step 4: Verify** — `npm run typecheck` clean; `npm test` pass; `npm run lint` clean. (Visual fill is device-verified on the build.)

- [ ] **Step 5: Commit**
```bash
git add app/bad-day.tsx app/vent.tsx app/prescription.tsx
git commit -m "feat(layout): anchor CTAs to the bottom so single-view screens fill the device"
```

---

## Task 6: Bad-day step feedback (dots + animation + chime + haptic)

**Problem:** Advancing a step only swaps small card text — no signal you did anything. Add progress dots, a card pulse on advance, a soft chime, and a haptic.

**Files:**
- Create: `assets/audio/step-chime.mp3` (generated)
- Modify: `app/bad-day.tsx`

- [ ] **Step 1: Generate the soft chime with ffmpeg**

Resolve ffmpeg: `FF=$(command -v ffmpeg || echo "/c/Users/zimme/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe")`. Generate a gentle two-note "done" chime (soft, ~250ms, faded):
```bash
"$FF" -y -f lavfi -i "sine=frequency=660:duration=0.18" -f lavfi -i "sine=frequency=880:duration=0.18" \
  -filter_complex "[0]adelay=0|0[a];[1]adelay=90|90[b];[a][b]amix=inputs=2:normalize=0,afade=t=out:st=0.18:d=0.09,volume=0.5" \
  -ac 1 -b:a 128k assets/audio/step-chime.mp3
```
Confirm the file exists and is small (`ls -la assets/audio/step-chime.mp3`, expect a few KB).

- [ ] **Step 2: Add haptics + audio + a pulse Animated value**

In `app/bad-day.tsx` add imports:
```ts
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
```
Near the other state/refs:
```ts
  const chimePlayer = useAudioPlayer(require('../assets/audio/step-chime.mp3'));
  const pulseAnim = useRef(new Animated.Value(0)).current;
```

- [ ] **Step 3: Fire feedback on advance**

In `handleNext` (the `setStep((s) => s + 1)` handler), before/after the step increment add:
```ts
    try { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    try { chimePlayer.seekTo(0); chimePlayer.play(); } catch {}
    pulseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 140, useNativeDriver: false }),
      Animated.timing(pulseAnim, { toValue: 0, duration: 320, useNativeDriver: false }),
    ]).start();
```
(`useNativeDriver: false` because we animate the card's `backgroundColor`.)

- [ ] **Step 4: Add progress dots above the step card**

Just above the `stepCard` View, render dots:
```tsx
        <View style={styles.dotsRow}>
          {MICRO_WORKOUT_STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i <= step ? { backgroundColor: MOODS[mood].colorDeep } : styles.dotEmpty]}
            />
          ))}
        </View>
```

- [ ] **Step 5: Animate the step-card background on advance**

Wrap/ągment the existing `stepCard` View into an `Animated.View` whose `backgroundColor` interpolates with `pulseAnim`:
```tsx
        <Animated.View style={[styles.stepCard, { borderLeftColor: MOODS[mood].colorDeep, backgroundColor: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: ['#111111', MOODS[mood].colorDeep + '26'] }) }]}>
          <Text style={styles.stepLabel}>STEP {step + 1} / {MICRO_WORKOUT_STEPS.length}</Text>
          <Text style={styles.stepText}>{MICRO_WORKOUT_STEPS[step]}</Text>
        </Animated.View>
```
(`+ '26'` = ~15% alpha flash of the deep mood color. Replace the old `<View style={[styles.stepCard, ...]}>` block with this `<Animated.View>`.)

- [ ] **Step 6: Add dot styles**
```ts
  dotsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotEmpty: { backgroundColor: '#2a2a2a' },
```

- [ ] **Step 7: Verify** — `npm run typecheck` clean; `npm test` pass; `npm run lint` clean (the dot/styles have no sub-14 fontSize).

- [ ] **Step 8: Commit**
```bash
git add app/bad-day.tsx assets/audio/step-chime.mp3
git commit -m "feat(bad-day): step-advance feedback — progress dots, card pulse, chime + haptic"
```

---

## Task 7: Bad-day mood-aware micro-workout

**Problem:** Bad-day runs the same 4 generic steps for every mood, contradicting the app's mood→exercise premise. Make the 2-min routine mood-specific, drawn from the spirit of each mood's real workouts.

**Files:**
- Modify: `lib/micro-workout.ts` (add `MICRO_WORKOUTS_BY_MOOD` + `microStepsForMood`)
- Test: `lib/__tests__/micro-workout.test.ts` (create)
- Modify: `app/bad-day.tsx` (use `microStepsForMood(mood)` reactively)

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/micro-workout.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { microStepsForMood, MICRO_WORKOUTS_BY_MOOD, MICRO_WORKOUT_STEPS } from '@/lib/micro-workout';
import { MOOD_ORDER } from '@/lib/moods';

describe('microStepsForMood', () => {
  it('returns a non-empty, distinct routine for every mood', () => {
    for (const m of MOOD_ORDER) {
      const steps = microStepsForMood(m);
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThanOrEqual(3);
      expect(steps.every((s) => typeof s === 'string' && s.trim().length > 0)).toBe(true);
    }
  });
  it('restless and stressed get different routines', () => {
    expect(microStepsForMood('restless')).not.toEqual(microStepsForMood('stressed'));
  });
  it('falls back to the generic steps for an unknown mood', () => {
    // @ts-expect-error testing the runtime fallback
    expect(microStepsForMood('bogus')).toEqual(MICRO_WORKOUT_STEPS);
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- micro-workout` → FAIL.

- [ ] **Step 3: Implement in `lib/micro-workout.ts`**

Keep `MICRO_WORKOUT_STEPS` (now the fallback). Add:
```ts
import type { MoodKey } from './storage';

// Each mood gets a 2-minute routine matching the *character* of its real
// workouts (see lib/workouts.ts): anxious → rhythmic/breath, low → activation,
// foggy → sharp wake-up, restless → burn it off, stressed → release tension,
// good → bank the win. Copy is Dr. MoodRx voice; tunable by the owner.
export const MICRO_WORKOUTS_BY_MOOD: Record<MoodKey, string[]> = {
  anxious: [
    '4-7-8 breath × 3. In for 4, hold 7, out for 8. No performance review.',
    'Roll your shoulders back 5 times and unclench your jaw.',
    '20 slow steps — count them in 4s. Gives your anxious brain a job.',
    'Done. Alarm system got a break. Your streak survives.',
  ],
  low: [
    'Stand up. The workout starts the second your feet hit the floor.',
    '10 slow bodyweight squats. Stand up taller than you sat down.',
    'Shake your arms out, roll your neck. Wake the engine.',
    'Done. You forced the reboot. Your streak survives.',
  ],
  foggy: [
    '20 fast jumping jacks. Blow the dust off.',
    '10 sharp shadowbox jabs — left, right, repeat. Eyes up.',
    'Cold water on your face, or step outside for 20 breaths.',
    'Done. Tabs cleared. Your streak survives.',
  ],
  restless: [
    '30 seconds of the fastest squats you can do. Burn it off.',
    'Shake every limb out, hard, for 15 seconds. Rattle the can.',
    '10 push-ups — knees are fine. Spend the leftover voltage.',
    'Done. Pressure released, safely. Your streak survives.',
  ],
  stressed: [
    'Forward fold. Let your head and arms just hang for 30 seconds.',
    'Roll your shoulders back 10 times. Drop them from your ears.',
    '4-7-8 breath × 3. In for 4, hold 7, out for 8.',
    'Done. Shoulders came down. Your streak survives.',
  ],
  good: [
    'You showed up functional — let us not waste it. Stand up.',
    '15 bodyweight squats, a little faster than comfortable.',
    '10 push-ups or a 20-second plank. Bank the good day.',
    'Done. Momentum logged. Your streak survives.',
  ],
};

/** The mood-specific 2-minute routine, or the generic steps for an unknown mood. */
export function microStepsForMood(mood: MoodKey): string[] {
  return MICRO_WORKOUTS_BY_MOOD[mood] ?? MICRO_WORKOUT_STEPS;
}
```

- [ ] **Step 4: Run → PASS** — `npm test -- micro-workout` → PASS.

- [ ] **Step 5: Use it in `app/bad-day.tsx`**

Replace direct uses of `MICRO_WORKOUT_STEPS` with a memoized mood-specific list. After `const [mood, setMood] = useState...`, add:
```ts
  const microSteps = useMemo(() => microStepsForMood(mood), [mood]);
```
Then swap every `MICRO_WORKOUT_STEPS` reference in the component (the `onLastStep` check at line ~52, `STEP {step+1} / {MICRO_WORKOUT_STEPS.length}`, `MICRO_WORKOUT_STEPS[step]`, and the Task-6 dots `.map`) to use `microSteps`. Import `microStepsForMood` (extend the existing `@/lib/micro-workout` import) and `useMemo` (extend the React import). Also reset `step` to 0 when the mood changes so a mid-flow mood switch restarts cleanly: add `useEffect(() => { setStep(0); }, [mood]);`.

- [ ] **Step 6: Verify** — `npm test` (incl. micro-workout block + guards) pass; `npm run typecheck` clean; `npm run lint` clean.

- [ ] **Step 7: Commit**
```bash
git add lib/micro-workout.ts lib/__tests__/micro-workout.test.ts app/bad-day.tsx
git commit -m "feat(bad-day): mood-aware 2-minute micro-workout (matches each mood's exercise)"
```

---

## Final verification (after all tasks)

- [ ] `npm test` → PASS (new units: `moods`, `pickRecognitionMode`, `microStepsForMood`; guards: readability color + tests).
- [ ] `npm run typecheck` → clean.
- [ ] `npm run lint` → clean (incl. the new `no-tiny-fontsize` rule).
- [ ] `git log --oneline` shows the seven feature commits on `feat/voice-venting`; branch NOT merged.
- [ ] Do NOT run `eas build`.

**Owner-ops / compliance follow-ups (flag at submission, not blockers for a test build):**
- Privacy policy "Voice Venting" section needs the cloud-fallback caveat (audio may be sent to Apple/Google to transcribe) + redeploy.
- Play Data Safety + iOS App Privacy: declare audio may be processed by the platform speech provider.
- The bad-day micro-workout copy + the step chime are tunable — owner can swap.

**Deferred to the on-device build:** readability legibility, deep-red look, trash-talk toggle clarity, vent cloud fallback on a device without the offline model, screen-fill on various devices, bad-day chime/haptic/animation, mood-specific routines.

## Spec coverage self-check

| Item | Task |
|---|---|
| Readability: 15px labels, ≤1.5 tracking, near-white greys, **enforced** | Task 1 (ESLint guard + sweep) |
| Deep red `#E11D48` on large accents | Task 2 |
| Trash-talk separated toggle + frequency/layering copy + sheet line | Task 3 |
| Vent on-device→cloud fallback + consent copy + better message | Task 4 |
| Single-view screens fill (anchor CTA) | Task 5 |
| Bad-day step feedback (dots + animation + chime + haptic) | Task 6 |
| Bad-day mood-aware micro-workout (approach A) | Task 7 |
| No EAS build | Final verification |
