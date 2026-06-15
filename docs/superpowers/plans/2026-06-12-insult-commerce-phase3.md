# Voiced Insult Commerce (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Settings "Coach voice" picker that lets the user select among 5 voices — Rachel free, the other 4 unlocked together by one "Unlock all voices" IAP bundle — with per-voice previews, and the chosen voice drives workout playback (safe fallback to Rachel).

**Architecture:** A pure voice registry (`lib/voices.ts`: `VOICES`, `normalizeVoice`, `effectiveVoice`) + a persisted selection (`lib/storage.ts`). A presentational `components/VoiceSheet.tsx` + a self-contained container `components/CoachVoicePicker.tsx` (owns ownership/price/preview/purchase, dropped into Settings). `app/workout.tsx` plays `effectiveVoice(selected, ownsBundle) × severity`. Reuses the existing RevenueCat `ownsPack`/`purchasePack`/offerings + the `__DEV__` mock-grant.

**Tech Stack:** TypeScript, React Native / Expo SDK 54, react-native-purchases (RevenueCat), expo-audio, AsyncStorage, vitest (pure logic). UI/purchase/preview verified on-device.

**Spec:** `docs/superpowers/specs/2026-06-12-insult-commerce-phase3-design.md`

---

## File Structure
- **Create** `lib/voices.ts` — pure: `VOICES`, `isVoiceName`, `normalizeVoice`, `effectiveVoice`. vitest-tested.
- **Create** `lib/__tests__/voices.test.ts`.
- **Modify** `lib/revenuecat.tsx` — add `VOICE_PACK_ID`.
- **Modify** `lib/storage.ts` — `getCoachVoice`/`setCoachVoice`.
- **Create** `components/VoiceSheet.tsx` — presentational picker modal.
- **Create** `components/CoachVoicePicker.tsx` — container (Settings row + modal + ownership/price/preview/purchase).
- **Modify** `app/settings.tsx` — render `<CoachVoicePicker/>` in the WORKOUT section.
- **Modify** `app/workout.tsx` — `DEFAULT_INSULT_VOICE` → `effectiveVoice(...)`.

---

## Task 1: Voice registry + bundle id (`lib/voices.ts`, TDD)

**Files:**
- Create: `lib/voices.ts`
- Create: `lib/__tests__/voices.test.ts`
- Modify: `lib/revenuecat.tsx`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/voices.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { VOICES, isVoiceName, normalizeVoice, effectiveVoice } from '../voices';

describe('VOICES', () => {
  it('has rachel free + four paid voices in order', () => {
    expect(VOICES.map((v) => v.name)).toEqual(['rachel', 'deadpan', 'grampa', 'ruthie', 'ed']);
    expect(VOICES.find((v) => v.name === 'rachel')!.free).toBe(true);
    expect(VOICES.filter((v) => !v.free).map((v) => v.name)).toEqual(['deadpan', 'grampa', 'ruthie', 'ed']);
    for (const v of VOICES) expect(v.label.length).toBeGreaterThan(0);
  });
});

describe('normalizeVoice', () => {
  it('passes known voices, defaults unknown/missing to rachel', () => {
    expect(normalizeVoice('grampa')).toBe('grampa');
    expect(normalizeVoice('nope')).toBe('rachel');
    expect(normalizeVoice(null)).toBe('rachel');
  });
});

describe('effectiveVoice', () => {
  it('a free voice always plays', () => {
    expect(effectiveVoice('rachel', false)).toBe('rachel');
  });
  it('a paid voice plays only when the bundle is owned', () => {
    expect(effectiveVoice('grampa', true)).toBe('grampa');
    expect(effectiveVoice('grampa', false)).toBe('rachel');
  });
  it('an unknown voice falls back to rachel', () => {
    expect(effectiveVoice('mystery', true)).toBe('rachel');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/__tests__/voices.test.ts`
Expected: FAIL — cannot resolve `../voices`.

- [ ] **Step 3: Implement the registry**

Create `lib/voices.ts`:

```ts
export interface VoiceOption {
  /** Matches the manifest voice keys + the audio folder names. */
  name: string;
  label: string;
  free: boolean;
}

/** The 5 coach voices, in picker order. Rachel is free; the other four unlock
 *  together via the VOICE_PACK_ID bundle. Static so the picker renders even
 *  before the library is hosted (the manifest is only needed for playback). */
export const VOICES: VoiceOption[] = [
  { name: 'rachel', label: 'Rachel', free: true },
  { name: 'deadpan', label: 'Deadpan Cynic', free: false },
  { name: 'grampa', label: 'Grampa Werthers', free: false },
  { name: 'ruthie', label: 'Ruthie Jo', free: false },
  { name: 'ed', label: 'Ed', free: false },
];

const NAMES = VOICES.map((v) => v.name);

export function isVoiceName(v: unknown): v is string {
  return typeof v === 'string' && NAMES.includes(v);
}

export function normalizeVoice(raw: unknown, fallback = 'rachel'): string {
  return isVoiceName(raw) ? raw : fallback;
}

/** Which voice actually plays: a free voice as-is; a paid voice only when the
 *  bundle is owned; otherwise fall back to 'rachel' (refund / unknown / unbought). */
export function effectiveVoice(selected: string, ownsBundle: boolean): string {
  const v = VOICES.find((x) => x.name === selected);
  if (!v) return 'rachel';
  return v.free || ownsBundle ? selected : 'rachel';
}
```

- [ ] **Step 4: Add the bundle pack id**

In `lib/revenuecat.tsx`, after the `PACKS_OFFERING_ID` export, add:

```ts
/** Pack id for the one-time "unlock all voices" bundle (a package in the
 *  `packs` offering). ownsPack(VOICE_PACK_ID) === owns all 4 paid coach voices.
 *  Its entitlement is packEntitlementId('voice_pack') === 'pack_voice_pack'. */
export const VOICE_PACK_ID = 'voice_pack';
```

- [ ] **Step 5: Run to verify it passes + typecheck**

Run: `npx vitest run lib/__tests__/voices.test.ts` (expected PASS), then `npm run typecheck` (expected clean).

- [ ] **Step 6: Commit**

```bash
git add lib/voices.ts lib/__tests__/voices.test.ts lib/revenuecat.tsx
git commit -m "feat(voices): voice registry + effectiveVoice + VOICE_PACK_ID bundle"
```

---

## Task 2: Persist the selected voice (`lib/storage.ts`)

**Files:**
- Modify: `lib/storage.ts`

Mirror the Phase-2 severity accessors (`getInsultSeverity`/`setInsultSeverity` + the `@moodrx_*` key + the `clearAllData` multiRemove). Verified by typecheck (the `normalizeVoice` logic is already unit-tested in Task 1).

- [ ] **Step 1: Add the key + accessors**

In `lib/storage.ts`, add the import (with the existing `@/lib/insult-severity` import added in Phase 2, or as its own line):

```ts
import { normalizeVoice } from '@/lib/voices';
```

Next to the `INSULT_SEVERITY_KEY` / `getInsultSeverity` / `setInsultSeverity` block, add:

```ts
const COACH_VOICE_KEY = '@moodrx_coach_voice';

/** The chosen coach voice name (drives workout playback). Defaults to 'rachel';
 *  an unknown stored value is coerced to 'rachel'. */
export async function getCoachVoice(): Promise<string> {
  try {
    return normalizeVoice(await AsyncStorage.getItem(COACH_VOICE_KEY));
  } catch {
    return 'rachel';
  }
}

export async function setCoachVoice(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(COACH_VOICE_KEY, name);
  } catch {
    // best-effort persistence
  }
}
```

Add `COACH_VOICE_KEY` to the `clearAllData` multiRemove array (alongside `INSULT_SEVERITY_KEY` and the other `@moodrx_*` keys).

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck` (expected clean), then:

```bash
git add lib/storage.ts
git commit -m "feat(voices): persist coach voice (@moodrx_coach_voice)"
```

---

## Task 3: The picker modal (`components/VoiceSheet.tsx`, presentational)

**Files:**
- Create: `components/VoiceSheet.tsx`

Presentational only — receives ownership/price/selection + callbacks, renders the 5 `VOICES` rows + the bundle CTA. RN component (on-device verified). Text colors kept light so the readability guard (scans `components/`) stays green.

- [ ] **Step 1: Implement**

Create `components/VoiceSheet.tsx`:

```tsx
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { VOICES } from '@/lib/voices';

interface Props {
  visible: boolean;
  selected: string;
  ownsBundle: boolean;
  priceLabel: string | null;
  onSelect: (name: string) => void;
  onPreview: (name: string) => void;
  onBuy: () => void;
  onClose: () => void;
}

const ACCENT = '#E11D48';

export function VoiceSheet({ visible, selected, ownsBundle, priceLabel, onSelect, onPreview, onBuy, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.header}>COACH VOICE</Text>
          <Text style={styles.sub}>Who trash-talks you during a workout?</Text>
          {VOICES.map((v) => {
            const owned = v.free || ownsBundle;
            const isSelected = v.name === selected;
            return (
              <View key={v.name} style={[styles.row, isSelected && styles.rowSelected]}>
                <Pressable
                  style={styles.rowMain}
                  onPress={() => owned && onSelect(v.name)}
                  disabled={!owned}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: !owned }}
                >
                  <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>{v.label}</Text>
                  <Text style={styles.rowState}>{isSelected ? 'Selected' : owned ? 'Tap to use' : 'Locked'}</Text>
                </Pressable>
                <Pressable
                  style={styles.sampleBtn}
                  onPress={() => onPreview(v.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${v.label} sample`}
                >
                  <Text style={styles.sampleText}>Sample</Text>
                </Pressable>
              </View>
            );
          })}
          {!ownsBundle && (
            <Pressable style={styles.cta} onPress={onBuy} accessibilityRole="button">
              <Text style={styles.ctaText}>Unlock all voices{priceLabel ? ` — ${priceLabel}` : ''}</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', paddingHorizontal: 24 },
  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', paddingVertical: 22, paddingHorizontal: 18 },
  header: { color: '#f5f5f5', fontSize: 20, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  sub: { color: '#cfcfcf', fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#333333', borderRadius: 12, marginTop: 10, paddingRight: 10 },
  rowSelected: { borderColor: ACCENT, backgroundColor: '#E11D4818' },
  rowMain: { flex: 1, paddingVertical: 13, paddingLeft: 16 },
  rowLabel: { color: '#f0f0f0', fontSize: 17, fontWeight: '700' },
  rowLabelSelected: { color: '#ffffff' },
  rowState: { color: '#cfcfcf', fontSize: 12, marginTop: 2 },
  sampleBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#3a3a3a' },
  sampleText: { color: '#e8e8e8', fontSize: 13, fontWeight: '600' },
  cta: { marginTop: 18, backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
});
```

- [ ] **Step 2: Typecheck + lint + readability guard**

Run: `npm run typecheck && npm run lint:ci && npx vitest run lib/__tests__/readability-guard.test.ts`
Expected: typecheck clean, lint clean, guard PASS (text colors `#f5f5f5`/`#f0f0f0`/`#ffffff`/`#cfcfcf`/`#e8e8e8` are all light enough; dim values are borders only). If lint flags an unused import, remove it and report.

- [ ] **Step 3: Commit**

```bash
git add components/VoiceSheet.tsx
git commit -m "feat(voices): coach-voice picker modal (5 rows + unlock-all CTA)"
```

---

## Task 4: The picker container + Settings row (`components/CoachVoicePicker.tsx`)

**Files:**
- Create: `components/CoachVoicePicker.tsx`
- Modify: `app/settings.tsx`

Self-contained: renders a Settings-style "Coach voice" row + the `VoiceSheet`, and owns the ownership/price/preview/purchase logic. On-device verified.

- [ ] **Step 1: Implement the container**

Create `components/CoachVoicePicker.tsx`:

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PACKS_OFFERING_ID, VOICE_PACK_ID } from '@/lib/revenuecat';
import { VOICES } from '@/lib/voices';
import { getCoachVoice, setCoachVoice, getInsultSeverity } from '@/lib/storage';
import { fetchManifest, ensureClip } from '@/lib/insult-cache';
import { pickClip, type Manifest } from '@/lib/insult-library';
import { VoiceSheet } from '@/components/VoiceSheet';

export function CoachVoicePicker() {
  const { ownsPack, purchasePack, offerings } = useSubscription();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('rachel');
  const [previewSrc, setPreviewSrc] = useState<{ uri: string } | null>(null);
  const manifestRef = useRef<Manifest | null>(null);
  const previewPlayer = useAudioPlayer(previewSrc);

  useEffect(() => {
    getCoachVoice().then(setSelected).catch(() => {});
  }, []);

  useEffect(() => {
    if (previewSrc) {
      try { previewPlayer.seekTo(0); previewPlayer.play(); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previewPlayer is a stable expo-audio ref; src change drives playback.
  }, [previewSrc]);

  const ownsBundle = ownsPack(VOICE_PACK_ID);
  const priceLabel =
    offerings?.all?.[PACKS_OFFERING_ID]?.availablePackages?.find((p) => p.identifier === VOICE_PACK_ID)
      ?.product?.priceString ?? null;
  const currentLabel = VOICES.find((v) => v.name === selected)?.label ?? 'Rachel';

  const handleOpen = useCallback(async () => {
    setOpen(true);
    if (!manifestRef.current) manifestRef.current = await fetchManifest().catch(() => null);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    try { previewPlayer.pause(); } catch {}
  }, [previewPlayer]);

  const handleSelect = useCallback((name: string) => {
    void setCoachVoice(name);
    setSelected(name);
  }, []);

  const handlePreview = useCallback(async (name: string) => {
    const m = manifestRef.current;
    if (!m) return;
    const severity = await getInsultSeverity();
    const entry = pickClip(m, name, severity);
    if (!entry) return;
    const uri = await ensureClip(entry).catch(() => null);
    if (uri) setPreviewSrc({ uri });
  }, []);

  const handleBuy = useCallback(() => {
    void purchasePack(VOICE_PACK_ID);
  }, [purchasePack]);

  return (
    <>
      <Pressable style={styles.row} onPress={handleOpen} accessibilityRole="button" accessibilityLabel="Coach voice">
        <View style={styles.labelBlock}>
          <Text style={styles.label}>Coach voice</Text>
          <Text style={styles.hint}>The voice that trash-talks you during a workout.</Text>
        </View>
        <Text style={styles.value}>{currentLabel}</Text>
      </Pressable>
      <VoiceSheet
        visible={open}
        selected={selected}
        ownsBundle={ownsBundle}
        priceLabel={priceLabel}
        onSelect={handleSelect}
        onPreview={handlePreview}
        onBuy={handleBuy}
        onClose={handleClose}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  labelBlock: { flex: 1, paddingRight: 12 },
  label: { color: '#f0f0f0', fontSize: 16, fontWeight: '600' },
  hint: { color: '#cfcfcf', fontSize: 12, marginTop: 3 },
  value: { color: '#e8e8e8', fontSize: 15, fontWeight: '700' },
});
```

- [ ] **Step 2: Render it in Settings**

In `app/settings.tsx`, add the import with the other component imports:

```ts
import { CoachVoicePicker } from '@/components/CoachVoicePicker';
```

Then in the WORKOUT section JSX, immediately AFTER the `TRASH TALK VOLUME` block (the `<View style={styles.volumeRow}>…</View>` that ends the volume slider) and BEFORE the next toggle row (the "AI coach (live)" `<View style={styles.toggleRow}>`), add:

```tsx
        <CoachVoicePicker />
```

- [ ] **Step 3: Typecheck + lint + readability guard + full suite**

Run: `npm run typecheck && npm run lint:ci && npm test`
Expected: typecheck clean, lint clean, all tests pass (the readability guard within `npm test` stays green — `CoachVoicePicker` text colors are light).

- [ ] **Step 4: Commit**

```bash
git add components/CoachVoicePicker.tsx app/settings.tsx
git commit -m "feat(voices): Settings coach-voice picker (ownership, price, preview, purchase)"
```

---

## Task 5: Play the chosen voice in the workout (`app/workout.tsx`)

**Files:**
- Modify: `app/workout.tsx`

- [ ] **Step 1: Add imports**

With the other `@/lib` / context imports in `app/workout.tsx`, add:

```ts
import { effectiveVoice } from '@/lib/voices';
import { getCoachVoice } from '@/lib/storage';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { VOICE_PACK_ID } from '@/lib/revenuecat';
```

(If `app/workout.tsx` already imports from `@/lib/storage`, add `getCoachVoice` to that existing line instead of a new one.)

- [ ] **Step 2: Remove the fixed voice constant**

Delete the line `const DEFAULT_INSULT_VOICE = 'rachel';`.

- [ ] **Step 3: Add selected-voice state + ownership, derive the effective voice**

Inside the component, with the other `useState`/hook calls (near `const [insultSeverity, setSeverity] = useState<InsultTier>('sticks');`), add:

```ts
  const { ownsPack } = useSubscription();
  const [selectedVoice, setSelectedVoice] = useState('rachel');
  const voice = effectiveVoice(selectedVoice, ownsPack(VOICE_PACK_ID));
```

and load the persisted selection on mount, next to the `getInsultSeverity().then(setSeverity)` effect:

```ts
  useEffect(() => {
    getCoachVoice().then(setSelectedVoice).catch(() => {});
  }, []);
```

- [ ] **Step 4: Use `voice` in the trash-talk effect**

In the trash-talk `useEffect`, replace BOTH uses of `DEFAULT_INSULT_VOICE` with `voice`:
- `prefetchTier(m, DEFAULT_INSULT_VOICE, insultSeverity)` → `prefetchTier(m, voice, insultSeverity)`
- `pickClip(m, DEFAULT_INSULT_VOICE, insultSeverity)` → `pickClip(m, voice, insultSeverity)`

and change the dependency array from `[trashTalkOn, insultSeverity]` to `[trashTalkOn, insultSeverity, voice]` (keep the existing `// eslint-disable-next-line react-hooks/exhaustive-deps …` comment above it).

- [ ] **Step 5: Typecheck + lint + full suite**

Run: `npm run typecheck && npm run lint:ci && npm test`
Expected: typecheck clean, lint clean, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/workout.tsx
git commit -m "feat(voices): workout plays the chosen coach voice (effectiveVoice + bundled fallback)"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full gates**

Run: `npm test && npm run typecheck && npm run lint:ci`
Expected: all tests pass (incl. `voices.test.ts`), typecheck + lint clean.

- [ ] **Step 2: Confirm the fixed-voice constant is gone + fallback intact**

Run: `grep -n "DEFAULT_INSULT_VOICE" app/workout.tsx` — Expected: NO match (replaced by `voice`). Read the trash-talk `playNext` and confirm the bundled `INSULT_AUDIO` fallback path is still present (a paid voice whose clip can't be fetched still plays a bundled clip — never silent).

---

## Manual / on-device + ops verification (operator)

Not code tasks:
1. **Create the `voice_pack` bundle product** in RevenueCat (`packs` offering, package identifier `voice_pack`) + both stores, attach entitlement `pack_voice_pack`, set the price. Until then, the `__DEV__` mock-grant exercises the flow.
2. On-device (or `__DEV__`): Settings → "Coach voice" opens the picker showing 5 voices; Rachel selectable, the 4 paid locked; tap "Sample" plays a clip (incl. locked, once the library is hosted); tap "Unlock all voices" → (mock or real) grant → the 4 unlock + become selectable; select one → it persists; start a workout with trash talk on → the chosen voice plays; an un-owned/unknown selection falls back to Rachel/bundled.
3. Carry-over Phase-1 ops: deploy `output/` to the Netlify assets site + set `EXPO_PUBLIC_INSULTS_BASE_URL` so paid voices + previews actually play.

---

## Self-Review (against the spec)

- **Static voice registry + `effectiveVoice` (safe Rachel fallback) + `VOICE_PACK_ID`:** Task 1. ✓
- **Persisted `@moodrx_coach_voice`, default Rachel, unknown→Rachel, cleared on reset:** Task 1 (`normalizeVoice`) + Task 2. ✓
- **Picker modal: 5 rows, select/locked states, single "Unlock all voices — price" CTA:** Task 3 (sheet) + Task 4 (price from offerings, `ownsBundle`). ✓
- **Per-voice previews incl. locked, via `ensureClip`, no-op when unhosted:** Task 4 (`handlePreview` returns early when manifest null / `pickClip`/`ensureClip` null). ✓
- **Workout plays `effectiveVoice × severity`, bundled fallback:** Task 5 + Task 6 Step 2. ✓
- **Reuse RevenueCat plumbing + `__DEV__` mock-grant:** Task 4 (`ownsPack`/`purchasePack`/`offerings` from `useSubscription`). ✓
- **Standalone bundle (no base requirement):** nothing checks base — `ownsPack(VOICE_PACK_ID)` only. ✓
- **Owner-ops (create product) + Phase-1 hosting carry-over:** Manual section. ✓
- **Testing (pure logic vitest; UI/purchase on-device):** Task 1 vitest; Tasks 3/4/5 typecheck+lint+on-device. ✓
- **Placeholder scan:** every code step has complete code; no TBD/TODO. ✓
- **Type consistency:** `VOICES`/`effectiveVoice`/`normalizeVoice`, `VOICE_PACK_ID`, `getCoachVoice`/`setCoachVoice`, `selected`/`ownsBundle`/`priceLabel`/`onSelect`/`onPreview`/`onBuy`/`onClose` (sheet props), `voice`/`selectedVoice` consistent across Tasks 1–5. ✓
