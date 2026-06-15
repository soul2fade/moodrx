# "Taste the roast" onboarding tile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a middle "taste the roast" tile to the onboarding carousel — tap a mood, see (and optionally hear) a real Dr. MoodRx line, set the burn level — so new users feel the trash-talk persona, framed as an option, not a default.

**Architecture:** A new self-contained `TasteTheRoast` tile component reuses the existing voiced-clip path (`fetchManifest`/`pickClip`/`ensureClip`/`expo-audio`) and the severity store. It's inserted as the middle page of the existing horizontal onboarding pager (how it works → **taste** → pricing). When online the shown text is the clip that plays (audio matches text); offline it falls back to the bundled `MOODS[mood].drMoodRx` line with no audio button. Completing the taste never force-enables trash-talk — it only presets the severity.

**Tech Stack:** React Native (Expo), TypeScript, vitest, expo-audio. JS-only — verifies on the local debug build over Metro, no EAS build. No backend / RevenueCat / audio-infra changes.

**Spec:** [docs/superpowers/specs/2026-06-15-taste-the-roast-onboarding-design.md](../specs/2026-06-15-taste-the-roast-onboarding-design.md)

---

## File structure

**Create:**
- `components/onboarding/TasteTheRoast.tsx` — the taste tile (mood tap → clip → burn level → two exits).

**Modify:**
- `lib/insult-severity.ts` — add optional `warning` to `SeverityOption`; set it on `roast`.
- `lib/__tests__/insult-severity.test.ts` — assert the warning wiring.
- `components/SeveritySheet.tsx` — render the warning under the Roasted row.
- `app/onboarding.tsx` — insert the taste page; fix pager nav (2→3 pages + dots); add the pricing bridge line.

**Reuse (no change):** `lib/moods.ts`, `lib/insult-cache.ts`, `lib/insult-library.ts`, `lib/storage.ts`, `expo-audio`.

---

## Task 1: Severity `warning` field (TDD)

**Files:**
- Modify: `lib/insult-severity.ts`
- Test: `lib/__tests__/insult-severity.test.ts`

- [ ] **Step 1: Write the failing test.** Append to `lib/__tests__/insult-severity.test.ts`:

```ts
import { SEVERITIES } from '@/lib/insult-severity';

describe('severity warnings', () => {
  it('only Roasted carries a strong-language warning', () => {
    const roast = SEVERITIES.find((s) => s.key === 'roast');
    expect(roast?.warning).toBe('Contains strong language');
    for (const s of SEVERITIES.filter((x) => x.key !== 'roast')) {
      expect(s.warning).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test -- insult-severity`
Expected: FAIL — `warning` does not exist on `SeverityOption` (typecheck/assertion error).

- [ ] **Step 3: Implement.** In `lib/insult-severity.ts`, add the optional field to the interface and set it on the roast entry:

```ts
export interface SeverityOption {
  key: InsultTier;
  label: string;
  blurb: string;
  /** Optional content warning shown under this tier (e.g. profanity at Roasted). */
  warning?: string;
}

/** Ordered softest → sharpest. Text-only (no emojis) per brand. */
export const SEVERITIES: SeverityOption[] = [
  { key: 'glass-house', label: 'Glass House', blurb: 'Gentle ribbing. Barely a scratch.' },
  { key: 'sticks', label: 'Sticks and Stones', blurb: 'Standard heat. The usual roast.' },
  { key: 'roast', label: 'Roasted', blurb: 'No mercy. Full send.', warning: 'Contains strong language' },
];
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `npm test -- insult-severity`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add lib/insult-severity.ts lib/__tests__/insult-severity.test.ts
git commit -m "feat(severity): add Roasted strong-language warning" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Render the warning in SeveritySheet

**Files:**
- Modify: `components/SeveritySheet.tsx`

- [ ] **Step 1: Render the warning under each row's blurb.** In `components/SeveritySheet.tsx`, inside the `SEVERITIES.map(...)` row, after the blurb `<Text>`, add the conditional warning:

```tsx
                <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{s.label}</Text>
                <Text style={styles.rowBlurb}>{s.blurb}</Text>
                {s.warning ? <Text style={styles.rowWarning}>{s.warning}</Text> : null}
```

- [ ] **Step 2: Add the warning style.** In the `StyleSheet.create({...})`, add:

```tsx
  rowWarning: { color: colors.premium, fontSize: 16, marginTop: 4, fontFamily: fonts.mono.regular, letterSpacing: 0.5 },
```

Add `import { colors } from '@/lib/colors';` if not already imported (the file already imports `fonts` from `@/lib/typography`).

- [ ] **Step 3: Verify typecheck + lint.**

Run: `npm run typecheck && npm run lint:ci`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit.**

```bash
git add components/SeveritySheet.tsx
git commit -m "feat(severity): surface the Roasted warning in the picker" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: The TasteTheRoast tile component

**Files:**
- Create: `components/onboarding/TasteTheRoast.tsx`

Mirrors the proven audio pattern in `components/CoachVoicePicker.tsx` (manifest ref + `useAudioPlayer` + play-on-src-change). All font sizes are ≥16 and colors use tokens / vivid mood colors, to satisfy the `no-tiny-fontsize` + `readability-guard` rules without eslint-disables.

- [ ] **Step 1: Create the component.** Create `components/onboarding/TasteTheRoast.tsx`:

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { MOODS, MOOD_ORDER } from '@/lib/moods';
import { SEVERITIES } from '@/lib/insult-severity';
import { pickClip } from '@/lib/insult-library';
import type { ClipEntry, InsultTier, Manifest } from '@/lib/insult-library';
import { fetchManifest, ensureClip } from '@/lib/insult-cache';
import { getCoachVoice, setInsultSeverity } from '@/lib/storage';
import { fonts } from '@/lib/typography';
import { colors } from '@/lib/colors';

const DEFAULT_TIER: InsultTier = 'sticks';

/** Onboarding "taste the roast" tile. Self-contained; `onContinue` advances the
 *  carousel to the pricing tile. Both exits call it — declining just doesn't
 *  persist a severity (trash-talk stays off by default; the per-workout enable
 *  is unchanged). */
export function TasteTheRoast({ onContinue }: { onContinue: () => void }) {
  const [voice, setVoice] = useState('rachel');
  const [mood, setMood] = useState<string | null>(null);
  const [tier, setTier] = useState<InsultTier>(DEFAULT_TIER);
  const [line, setLine] = useState<string | null>(null);
  const [clip, setClip] = useState<ClipEntry | null>(null);
  const [previewSrc, setPreviewSrc] = useState<{ uri: string } | null>(null);
  const manifestRef = useRef<Manifest | null>(null);
  const player = useAudioPlayer(previewSrc);

  useEffect(() => {
    getCoachVoice().then(setVoice).catch(() => {});
    fetchManifest().then((m) => { manifestRef.current = m; }).catch(() => {});
  }, []);

  useEffect(() => {
    if (previewSrc) { try { player.seekTo(0); player.play(); } catch {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- player is a stable expo-audio ref; src drives playback
  }, [previewSrc]);

  // Online: the displayed line IS a clip (text + audio match). Offline / no
  // manifest: fall back to the bundled, mood-specific drMoodRx line with no audio.
  const roll = useCallback((m: string, t: InsultTier) => {
    const manifest = manifestRef.current;
    const picked = manifest ? pickClip(manifest, voice, t) : null;
    if (picked) { setClip(picked); setLine(picked.text); return; }
    setClip(null);
    setLine(MOODS[m as keyof typeof MOODS]?.drMoodRx ?? null);
  }, [voice]);

  const onMood = useCallback((m: string) => { setMood(m); roll(m, tier); }, [roll, tier]);
  const onTier = useCallback((t: InsultTier) => { setTier(t); if (mood) roll(mood, t); }, [mood, roll]);

  const hearIt = useCallback(async () => {
    if (!clip) return;
    const uri = await ensureClip(clip).catch(() => null);
    if (uri) setPreviewSrc({ uri });
  }, [clip]);

  const bringItOn = useCallback(async () => {
    await setInsultSeverity(tier).catch(() => {});
    onContinue();
  }, [tier, onContinue]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>MEET YOUR COACH</Text>
      <Text style={styles.headline}>How&apos;s your head today?</Text>

      <View style={styles.chips}>
        {MOOD_ORDER.map((k) => {
          const m = MOODS[k];
          const selected = mood === k;
          return (
            <Pressable
              key={k}
              onPress={() => onMood(k)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && { borderColor: m.color, backgroundColor: m.color + '22' }]}
            >
              <Text style={[styles.chipText, selected && { color: m.color }]}>{m.name}</Text>
            </Pressable>
          );
        })}
      </View>

      {line ? (
        <View style={styles.roastBox}>
          <Text style={styles.roastWho}>DR. MOODRX</Text>
          <Text style={styles.roastLine}>&ldquo;{line}&rdquo;</Text>
          {clip ? (
            <Pressable onPress={hearIt} accessibilityRole="button" accessibilityLabel="Hear it" style={styles.hearBtn}>
              <Text style={styles.hearText}>▶ Hear it</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Text style={styles.prompt}>Tap a mood. He&apos;ll have something to say about it.</Text>
      )}

      <Text style={styles.burnLabel}>Too soft? Too mean? Set the burn level.</Text>
      {SEVERITIES.map((s) => {
        const selected = s.key === tier;
        return (
          <Pressable
            key={s.key}
            onPress={() => onTier(s.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.tierRow, selected && styles.tierRowSelected]}
          >
            <Text style={[styles.tierName, selected && styles.tierNameSelected]}>{s.label}</Text>
            <Text style={styles.tierBlurb}>{s.blurb}</Text>
            {s.warning ? <Text style={styles.tierWarning}>{s.warning}</Text> : null}
          </Pressable>
        );
      })}

      <Text style={styles.optional}>
        Optional — Dr. MoodRx only chimes in when you turn trash talk on for a workout. Change or mute it anytime in Settings.
      </Text>

      <Pressable onPress={bringItOn} accessibilityRole="button" accessibilityLabel="Bring it on" style={styles.primaryCta}>
        <Text style={styles.primaryCtaText}>Bring it on →</Text>
      </Pressable>
      <Pressable onPress={onContinue} accessibilityRole="button" accessibilityLabel="Not for me, keep it clinical" style={styles.secondaryCta}>
        <Text style={styles.secondaryCtaText}>Not for me — keep it clinical →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 8 },
  kicker: { fontFamily: fonts.mono.regular, fontSize: 16, color: colors.premium, letterSpacing: 3, lineHeight: 18 },
  headline: { fontFamily: fonts.primary.bold, fontSize: 28, color: '#ffffff', lineHeight: 34, marginTop: 8, marginBottom: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: { borderWidth: 1, borderColor: '#333333', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { fontFamily: fonts.primary.regular, fontSize: 16, color: colors.textSubtle },
  prompt: { fontFamily: fonts.primary.regular, fontSize: 16, color: colors.textSubtle, lineHeight: 22, marginBottom: 20 },
  roastBox: { borderLeftWidth: 3, borderLeftColor: '#E11D48', backgroundColor: '#120c0e', borderRadius: 8, padding: 14, marginBottom: 20 },
  roastWho: { fontFamily: fonts.mono.regular, fontSize: 16, color: colors.premium, letterSpacing: 2, lineHeight: 18 },
  roastLine: { fontFamily: fonts.primary.regular, fontSize: 17, color: '#ededea', lineHeight: 24, marginTop: 8 },
  hearBtn: { marginTop: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#3a3a3a', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  hearText: { fontFamily: fonts.primary.bold, fontSize: 16, color: '#ffffff' },
  burnLabel: { fontFamily: fonts.primary.regular, fontSize: 16, color: colors.textSubtle, marginBottom: 10 },
  tierRow: { borderWidth: 1, borderColor: '#333333', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 10 },
  tierRowSelected: { borderColor: '#E11D48', backgroundColor: '#E11D4818' },
  tierName: { fontFamily: fonts.primary.bold, fontSize: 17, color: '#f0f0f0' },
  tierNameSelected: { color: '#ffffff' },
  tierBlurb: { fontFamily: fonts.primary.regular, fontSize: 16, color: colors.textSubtle, marginTop: 3 },
  tierWarning: { fontFamily: fonts.mono.regular, fontSize: 16, color: colors.premium, marginTop: 4, letterSpacing: 0.5 },
  optional: { fontFamily: fonts.primary.regular, fontSize: 16, color: colors.textSubtle, lineHeight: 22, marginTop: 8, marginBottom: 20 },
  primaryCta: { borderWidth: 1, borderColor: colors.premium, borderRadius: 4, paddingVertical: 14, alignItems: 'center' },
  primaryCtaText: { fontFamily: fonts.primary.bold, fontSize: 16, color: colors.premium, letterSpacing: 1 },
  secondaryCta: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  secondaryCtaText: { fontFamily: fonts.primary.regular, fontSize: 16, color: colors.textSubtle },
});
```

- [ ] **Step 2: Verify typecheck + lint.**

Run: `npm run typecheck && npm run lint:ci`
Expected: PASS (0 errors, no new warnings). If lint flags the play-on-src-change effect, keep the single inline `eslint-disable-next-line react-hooks/exhaustive-deps` shown (it mirrors the established `CoachVoicePicker` pattern) — add no others.

- [ ] **Step 3: Commit.**

```bash
git add components/onboarding/TasteTheRoast.tsx
git commit -m "feat(onboarding): taste-the-roast tile (mood tap, hear a clip, set burn level)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Insert the taste tile into the onboarding carousel

**Files:**
- Modify: `app/onboarding.tsx`

The pager currently has 2 pages (how it works @ index 0, pricing @ index 1). Insert the taste at index 1, pushing pricing to index 2.

- [ ] **Step 1: Import the tile.** Add to the imports in `app/onboarding.tsx`:

```tsx
import { TasteTheRoast } from '@/components/onboarding/TasteTheRoast';
```

- [ ] **Step 2: Generalize the page-scroll helper.** Replace the `goToPricing` line:

```tsx
  const goToPricing = () => scrollRef.current?.scrollTo({ x: SCREEN_W, animated: true });
```

with:

```tsx
  const goToPage = (i: number) => scrollRef.current?.scrollTo({ x: i * SCREEN_W, animated: true });
```

- [ ] **Step 3: Repoint the page-1 CTA to the taste.** Change the page-1 swipe CTA (currently "See what it costs →" → `goToPricing`):

```tsx
          <TouchableOpacity style={styles.swipeCta} onPress={() => goToPage(1)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Meet your coach">
            <Text style={styles.swipeCtaText}>Meet your coach →</Text>
          </TouchableOpacity>
```

- [ ] **Step 4: Insert the taste page.** Between the page-1 `</ScrollView>` (the how-it-works page, ends ~line 173) and the `{/* PAGE 2 — pricing */}` comment, insert:

```tsx
        {/* PAGE 2 — taste the roast */}
        <ScrollView style={[styles.scroll, { width: SCREEN_W }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TasteTheRoast onContinue={() => goToPage(2)} />
        </ScrollView>

```

- [ ] **Step 5: Add the pricing bridge line.** On the pricing page, after the existing subtext line (`Simple. No surprises. Only MoodRx+ ever renews.`), add:

```tsx
          <Text style={styles.bridgeLine}>That one was from a script. MoodRx+ writes fresh ones off your actual patterns — the live coach.</Text>
```

- [ ] **Step 6: Update the pager dots to 3.** Change the dots map from `{[0, 1].map(...)}` to:

```tsx
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, page === i && styles.dotActive]} />
        ))}
```

- [ ] **Step 7: Add the bridge-line style.** In the `StyleSheet.create({...})`, add:

```tsx
  bridgeLine: { fontFamily: fonts.primary.regular, fontSize: 16, color: colors.textSubtle, lineHeight: 22, marginTop: 10 },
```

- [ ] **Step 8: Verify typecheck + lint + tests.**

Run: `npm run typecheck && npm run lint:ci && npm test`
Expected: PASS — typecheck clean, 0 lint errors, all vitest suites pass.

- [ ] **Step 9: Commit.**

```bash
git add app/onboarding.tsx
git commit -m "feat(onboarding): 3-tile carousel — insert taste between how-it-works and pricing" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Static checks.**

Run: `npm run typecheck && npm run lint:ci && npm test`
Expected: typecheck clean, lint 0 errors, all tests pass (including `insult-severity`).

- [ ] **Step 2: On-device (local debug build, Metro over wifi — no EAS):**
  - Fresh onboarding: swipe **how it works → taste → pricing** (3 dots).
  - Tap each mood → a Dr. MoodRx line appears; **▶ Hear it** plays the matching clip (online); changing the burn level re-rolls the line.
  - **Roasted** shows "Contains strong language."
  - **Bring it on →** advances to pricing; afterward, Settings shows the chosen severity persisted.
  - **Not for me — keep it clinical →** advances to pricing without changing the severity.
  - Airplane mode: tapping a mood still shows a (bundled) line, ▶ is hidden, nothing breaks.
  - Settings severity picker also shows the Roasted warning.

- [ ] **Step 3: Final commit (if verification fixes were needed).**

```bash
git add -A
git commit -m "test(onboarding): taste-the-roast on-device fixes" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** 3-tile carousel + middle taste (Task 4) ✓; mood tap → see/hear clip, audio-matches-text with bundled offline fallback (Task 3 `roll`) ✓; burn-level selector + persist-on-"Bring it on" (Task 3 `bringItOn`) ✓; Roasted disclaimer on taste + SeveritySheet, single-sourced in `SEVERITIES` (Tasks 1–3) ✓; "option not default" — two exits, decline persists nothing, optional-ity copy, no force-enable (Task 3) ✓; Rachel default / Sticks default / mood demo-only (Task 3 defaults) ✓; pricing bridge line (Task 4) ✓; reuse-only, live coach unused (Task 3 imports) ✓.
- **Out of scope (flagged in spec):** age-rating bump for profanity at submission.
- **Type consistency:** `InsultTier` and `SEVERITIES`/`SeverityOption.warning` are defined in Task 1 and consumed in Tasks 2–3; `pickClip(manifest, voice, tier)` and `ClipEntry`/`Manifest` match `lib/insult-library.ts`; `getCoachVoice`/`setInsultSeverity`/`fetchManifest`/`ensureClip` match their `lib/` signatures; `goToPage` replaces `goToPricing` everywhere it was used (Task 4 Steps 2–3).
