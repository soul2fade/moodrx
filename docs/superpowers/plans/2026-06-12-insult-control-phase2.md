# Voiced Insult Control (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single user-chosen severity (Glass House / Sticks and Stones / Roasted) that drives BOTH the workout trash-talk audio tier and the AI coach's tone, via a "prepare to laugh" sheet — replacing the Phase-1 fixed default and the old volume→tone coupling.

**Architecture:** A pure severity module (`lib/insult-severity.ts`: ordered labels + normalize) + a persisted setting (`lib/storage.ts`). A presentational `components/SeveritySheet.tsx` opens on every TRASH TALK enable. `app/workout.tsx` plays `rachel × <severity>`. `CoachTone` widens to the three tier keys (= severity), `resolveTone()` reads severity not volume, and the server `coachSystemPrompt` renders 3 intensities while tolerating the legacy `teasing`/`roasting` values older app builds still send (so live users don't break during the redeploy gap).

**Tech Stack:** TypeScript, React Native / Expo SDK 54, AsyncStorage, vitest (pure logic), Netlify Functions (coach-line). Sheet UI + workout wiring verified on-device.

**Spec:** `docs/superpowers/specs/2026-06-12-insult-control-phase2-design.md`

---

## File Structure
- **Create** `lib/insult-severity.ts` — pure: `SEVERITIES` (ordered label/blurb), `isInsultTier`, `normalizeSeverity`. vitest-tested.
- **Create** `lib/__tests__/insult-severity.test.ts`.
- **Modify** `lib/storage.ts` — `getInsultSeverity`/`setInsultSeverity` (key `@moodrx_insult_severity`).
- **Modify** `netlify/functions/lib/coach-prompt.ts` — 3-tone + legacy normalize.
- **Modify** `netlify/functions/__tests__/coach-prompt.test.ts` — 3-tone + legacy tests.
- **Modify** `lib/coach-insight.ts` — widen `CoachTone`.
- **Modify** `lib/coach-client.ts` — `resolveTone()` reads severity.
- **Modify** `netlify/functions/coach-line.ts` — accept any string tone (tolerant validation).
- **Create** `components/SeveritySheet.tsx` — the "prepare to laugh" sheet.
- **Modify** `app/workout.tsx` — severity state + sheet + tier wiring.

---

## Task 1: Severity metadata + normalize (`lib/insult-severity.ts`, TDD)

**Files:**
- Create: `lib/insult-severity.ts`
- Create: `lib/__tests__/insult-severity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/insult-severity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SEVERITIES, isInsultTier, normalizeSeverity } from '../insult-severity';

describe('SEVERITIES', () => {
  it('lists the three tiers softest→sharpest with the exact labels', () => {
    expect(SEVERITIES.map((s) => s.key)).toEqual(['glass-house', 'sticks', 'roast']);
    expect(SEVERITIES.map((s) => s.label)).toEqual(['Glass House', 'Sticks and Stones', 'Roasted']);
    for (const s of SEVERITIES) expect(s.blurb.length).toBeGreaterThan(0);
  });
});

describe('isInsultTier', () => {
  it('narrows valid keys, rejects junk', () => {
    expect(isInsultTier('sticks')).toBe(true);
    expect(isInsultTier('x')).toBe(false);
    expect(isInsultTier(null)).toBe(false);
  });
});

describe('normalizeSeverity', () => {
  it('passes through valid tiers', () => {
    expect(normalizeSeverity('glass-house')).toBe('glass-house');
    expect(normalizeSeverity('roast')).toBe('roast');
  });
  it('defaults unknown/missing to sticks', () => {
    expect(normalizeSeverity('nope')).toBe('sticks');
    expect(normalizeSeverity(null)).toBe('sticks');
    expect(normalizeSeverity(undefined)).toBe('sticks');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/__tests__/insult-severity.test.ts`
Expected: FAIL — cannot resolve `../insult-severity`.

- [ ] **Step 3: Implement**

Create `lib/insult-severity.ts`:

```ts
import type { InsultTier } from './insult-library';

export interface SeverityOption {
  key: InsultTier;
  label: string;
  blurb: string;
}

/** Ordered softest → sharpest. Text-only (no emojis) per brand. */
export const SEVERITIES: SeverityOption[] = [
  { key: 'glass-house', label: 'Glass House', blurb: 'Gentle ribbing. Barely a scratch.' },
  { key: 'sticks', label: 'Sticks and Stones', blurb: 'Standard heat. The usual roast.' },
  { key: 'roast', label: 'Roasted', blurb: 'No mercy. Full send.' },
];

const KEYS = SEVERITIES.map((s) => s.key) as InsultTier[];

export function isInsultTier(v: unknown): v is InsultTier {
  return typeof v === 'string' && (KEYS as string[]).includes(v);
}

/** Coerce a stored/raw value to a tier, defaulting to 'sticks'. */
export function normalizeSeverity(raw: unknown, fallback: InsultTier = 'sticks'): InsultTier {
  return isInsultTier(raw) ? raw : fallback;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/__tests__/insult-severity.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck` (expected clean), then:

```bash
git add lib/insult-severity.ts lib/__tests__/insult-severity.test.ts
git commit -m "feat(insults): severity metadata + normalize (glass-house/sticks/roast)"
```

---

## Task 2: Persist the severity (`lib/storage.ts`)

**Files:**
- Modify: `lib/storage.ts`

Mirror the existing settings pattern (e.g. `getTrashTalkVolume`/`setTrashTalkVolume` and its `@moodrx_*` key). Verified by typecheck (the pure normalize logic is already tested in Task 1; this is a thin AsyncStorage wrapper consistent with the file's other getters/setters).

- [ ] **Step 1: Add the key + accessors**

In `lib/storage.ts`, add an import near the top (with the other `@/lib` imports if any, else just below the AsyncStorage import):

```ts
import type { InsultTier } from '@/lib/insult-library';
import { normalizeSeverity } from '@/lib/insult-severity';
```

Then, next to the trash-talk volume accessors (`TRASH_TALK_VOLUME_KEY` / `getTrashTalkVolume` / `setTrashTalkVolume`), add:

```ts
const INSULT_SEVERITY_KEY = '@moodrx_insult_severity';

/** The chosen trash-talk severity (drives the audio tier + coach tone). Defaults
 *  to 'sticks'; an unknown stored value is coerced to 'sticks'. */
export async function getInsultSeverity(): Promise<InsultTier> {
  try {
    return normalizeSeverity(await AsyncStorage.getItem(INSULT_SEVERITY_KEY));
  } catch {
    return 'sticks';
  }
}

export async function setInsultSeverity(tier: InsultTier): Promise<void> {
  try {
    await AsyncStorage.setItem(INSULT_SEVERITY_KEY, tier);
  } catch {
    // best-effort persistence
  }
}
```

(If `storage.ts` imports AsyncStorage under a different local name, use that name. Do not change any existing accessor.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/storage.ts
git commit -m "feat(insults): persist insult severity (@moodrx_insult_severity)"
```

---

## Task 3: Coach prompt — 3 tones + legacy tolerance (`coach-prompt.ts`, TDD)

**Files:**
- Modify: `netlify/functions/lib/coach-prompt.ts`
- Modify: `netlify/functions/__tests__/coach-prompt.test.ts`

The server prompt currently branches on `'teasing' | 'roasting'`. Make it accept any string tone, normalize to the 3 tier levels, and render 3 distinct intensities. Crucially, the **legacy** values older app builds still send must map to byte-identical copy: `teasing`→standard (`sticks`), `roasting`→sharpest (`roast`).

- [ ] **Step 1: Replace the test (write the new failing spec)**

Replace the entire contents of `netlify/functions/__tests__/coach-prompt.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { coachSystemPrompt } from '../lib/coach-prompt';

describe('coachSystemPrompt', () => {
  it('crisis mode drops jokes and never adds the episode rule', () => {
    const p = coachSystemPrompt('roast', true, true).toLowerCase();
    expect(p).toContain('distress');
    expect(p).toContain('drop the roasting');
    expect(p).not.toContain('sharper');
    expect(p).not.toContain('episode');
  });

  it('adds an episode rule only when an episode is present', () => {
    const withEp = coachSystemPrompt('sticks', false, true).toLowerCase();
    const without = coachSystemPrompt('sticks', false, false).toLowerCase();
    expect(withEp).toContain('episode');
    expect(withEp).toContain('never invent');
    expect(without).not.toContain('episode');
  });

  it('renders three distinct intensities for the three tones', () => {
    const glass = coachSystemPrompt('glass-house', false, false).toLowerCase();
    const sticks = coachSystemPrompt('sticks', false, false).toLowerCase();
    const roast = coachSystemPrompt('roast', false, false).toLowerCase();
    expect(roast).toContain('sharper');   // sharpest
    expect(sticks).toContain('teasing');  // standard
    expect(glass).toContain('gentle');    // softest
    expect(glass).not.toContain('sharper');
    expect(new Set([glass, sticks, roast]).size).toBe(3);
  });

  it('tolerates legacy teasing/roasting + unknown tones (older app builds)', () => {
    expect(coachSystemPrompt('teasing', false, false)).toBe(coachSystemPrompt('sticks', false, false));
    expect(coachSystemPrompt('roasting', false, false)).toBe(coachSystemPrompt('roast', false, false));
    expect(coachSystemPrompt('whatever', false, false)).toBe(coachSystemPrompt('sticks', false, false));
  });

  it('forbids violence/weapon/self-harm imagery in every non-crisis tone', () => {
    for (const t of ['glass-house', 'sticks', 'roast']) {
      expect(coachSystemPrompt(t, false, false).toLowerCase()).toContain('weapon');
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run netlify/functions/__tests__/coach-prompt.test.ts`
Expected: FAIL (the current `coachSystemPrompt` only knows teasing/roasting; `glass-house` won't render "gentle", legacy mapping isn't there).

- [ ] **Step 3: Implement the 3-tone prompt**

Replace the entire contents of `netlify/functions/lib/coach-prompt.ts` with:

```ts
import { NO_VIOLENCE_GUARDRAIL } from './safety-guardrail';

/** The three coach tones — same keys as the trash-talk severity tiers. */
export type PromptTone = 'glass-house' | 'sticks' | 'roast';

/** Normalize any incoming tone string to the 3 levels. Tolerates the legacy
 *  'teasing'/'roasting' values older app builds still send (teasing→sticks,
 *  roasting→roast — byte-identical to the pre-3-tone copy), and defaults any
 *  unknown value to the standard 'sticks'. */
function normalizeTone(tone: string): PromptTone {
  switch (tone) {
    case 'glass-house':
    case 'sticks':
    case 'roast':
      return tone;
    case 'roasting':
      return 'roast';
    case 'teasing':
      return 'sticks';
    default:
      return 'sticks';
  }
}

/** Builds the Dr. MoodRx post-workout system prompt. Pure — no SDK, no network
 *  — so it is unit-testable. The episode rule is appended only when the context
 *  actually carries an episode, so the model is never told to look for one that
 *  isn't there (and `buildCoachContext`/`selectEpisode` guarantee any present
 *  episode is real). */
export function coachSystemPrompt(
  tone: string,
  crisis: boolean,
  hasEpisode: boolean,
): string {
  if (crisis) {
    return `You are Dr. MoodRx, a darkly funny but ultimately caring fitness-for-mental-health coach. The user is showing signs of genuine distress right now. Drop the roasting entirely. In 1-2 sentences, acknowledge they showed up and gently encourage them — warm, not clinical, no diagnoses, no jokes at their expense. Use ONLY the facts provided. Never invent numbers.`;
  }
  const t = normalizeTone(tone);
  const intensity =
    t === 'roast'
      ? 'Sharper, funnier, more intense — but LIGHTHEARTED. Rib their resistance/excuses to work out, never their worth, body, or anything self-harm-adjacent.'
      : t === 'glass-house'
        ? 'Gentle and warm — the lightest ribbing, barely a jab; more encouraging than teasing.'
        : 'Playful, teasing, light jabs.';
  const episodeRule = hasEpisode
    ? ' If the context includes an `episode` object, you may briefly reference that specific past session — its workout name and whether it helped, on its day — in voice. Never invent a past session; use only the facts in `episode`.'
    : '';
  return `You are Dr. MoodRx, a darkly funny fitness-for-mental-health coach with a film-noir, deadpan voice. Tone: ${intensity} Speak directly to the user about the workout they just did. Use ONLY the facts provided — never invent statistics, numbers, or history. Never give clinical labels, diagnoses, or medical advice. ${NO_VIOLENCE_GUARDRAIL} 1-2 sentences. No preamble.${episodeRule}`;
}
```

- [ ] **Step 4: Run the coach-prompt test**

Run: `npx vitest run netlify/functions/__tests__/coach-prompt.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck` (expected clean), then:

```bash
git add netlify/functions/lib/coach-prompt.ts netlify/functions/__tests__/coach-prompt.test.ts
git commit -m "feat(coach): 3 tones (glass-house/sticks/roast) + legacy teasing/roasting tolerance"
```

---

## Task 4: Wire severity as the coach tone (type + resolveTone + coach-line)

**Files:**
- Modify: `lib/coach-insight.ts`
- Modify: `lib/coach-client.ts`
- Modify: `netlify/functions/coach-line.ts`

- [ ] **Step 1: Widen `CoachTone`**

In `lib/coach-insight.ts`, replace the line `export type CoachTone = 'teasing' | 'roasting';` with:

```ts
export type CoachTone = 'glass-house' | 'sticks' | 'roast';
```

- [ ] **Step 2: `resolveTone` reads severity, not volume**

In `lib/coach-client.ts`, replace the import `import { getTrashTalkVolume } from '@/lib/storage';` with:

```ts
import { getInsultSeverity } from '@/lib/storage';
```

and replace the whole `resolveTone` function (the one reading `getTrashTalkVolume`) with:

```ts
/** The coach's tone IS the chosen trash-talk severity (Glass House / Sticks and
 *  Stones / Roasted). Defaults to 'sticks' on any storage error. */
export async function resolveTone(): Promise<CoachTone> {
  return getInsultSeverity().catch(() => 'sticks');
}
```

- [ ] **Step 3: Make `coach-line` validation tolerant of any string tone**

In `netlify/functions/coach-line.ts`:
- Change the payload type (the `let payload: { ... }` line) so `tone` is `string`:
  ```ts
  let payload: { context?: any; tone?: string; appUserId?: string };
  ```
- Change the validation guard (currently `if (!context || !appUserId || (tone !== 'teasing' && tone !== 'roasting'))`) to:
  ```ts
  if (!context || !appUserId || typeof tone !== 'string' || !tone.trim()) {
    return { statusCode: 400, body: '' };
  }
  ```
The raw `tone` string is passed to `coachSystemPrompt`, which normalizes it (Task 3). This accepts the new severity values AND the legacy `teasing`/`roasting` from older app builds.

- [ ] **Step 4: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all tests pass (the Task-3 coach-prompt test + everything else).

- [ ] **Step 5: Commit**

```bash
git add lib/coach-insight.ts lib/coach-client.ts netlify/functions/coach-line.ts
git commit -m "feat(coach): tone = chosen severity; coach-line accepts any string tone"
```

---

## Task 5: The "prepare to laugh" sheet (`components/SeveritySheet.tsx`)

**Files:**
- Create: `components/SeveritySheet.tsx`

Presentational only — receives the current severity + callbacks, renders the three rows from `SEVERITIES`. RN component; verified on-device (not vitest). Text colors are kept near-white so the readability guard (`lib/__tests__/readability-guard.test.ts`, scans `components/`) stays green; borders/backgrounds are exempt.

- [ ] **Step 1: Implement the component**

Create `components/SeveritySheet.tsx`:

```tsx
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SEVERITIES } from '@/lib/insult-severity';
import type { InsultTier } from '@/lib/insult-library';

interface Props {
  visible: boolean;
  current: InsultTier;
  onConfirm: (tier: InsultTier) => void;
  onCancel: () => void;
}

const ACCENT = '#E11D48';

export function SeveritySheet({ visible, current, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.header}>PREPARE TO LAUGH</Text>
          <Text style={styles.sub}>How hard should Dr. MoodRx go?</Text>
          {SEVERITIES.map((s) => {
            const selected = s.key === current;
            return (
              <Pressable
                key={s.key}
                onPress={() => onConfirm(s.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.row, selected && styles.rowSelected]}
              >
                <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{s.label}</Text>
                <Text style={styles.rowBlurb}>{s.blurb}</Text>
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  header: {
    color: '#f5f5f5',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  sub: {
    color: '#cfcfcf',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  row: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  rowSelected: {
    borderColor: ACCENT,
    backgroundColor: '#E11D4818',
  },
  rowLabel: {
    color: '#f0f0f0',
    fontSize: 17,
    fontWeight: '700',
  },
  rowLabelSelected: {
    color: '#ffffff',
  },
  rowBlurb: {
    color: '#cfcfcf',
    fontSize: 13,
    marginTop: 3,
  },
});
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint:ci`
Expected: both clean.

- [ ] **Step 3: Run the readability guard (text colors light enough)**

Run: `npx vitest run lib/__tests__/readability-guard.test.ts`
Expected: PASS (text colors `#f5f5f5`/`#f0f0f0`/`#ffffff`/`#cfcfcf` are all ≥ the guard threshold; the dim values are borders/backgrounds only).

- [ ] **Step 4: Commit**

```bash
git add components/SeveritySheet.tsx
git commit -m "feat(insults): prepare-to-laugh severity sheet (3 rows)"
```

---

## Task 6: Wire the sheet + severity into the workout screen (`app/workout.tsx`)

**Files:**
- Modify: `app/workout.tsx`

- [ ] **Step 1: Add imports**

With the other `@/lib` / component imports in `app/workout.tsx`, add:

```ts
import { SeveritySheet } from '@/components/SeveritySheet';
import type { InsultTier } from '@/lib/insult-library';
```

and add `getInsultSeverity, setInsultSeverity` to the existing `@/lib/storage` import (the line that already imports `getTrashTalkVolume` etc.).

- [ ] **Step 2: Remove the Phase-1 default tier constant**

Delete the line `const DEFAULT_INSULT_TIER = 'sticks' as const;` (keep `DEFAULT_INSULT_VOICE = 'rachel';` — voice is still fixed until Phase 3).

- [ ] **Step 3: Add severity + sheet state**

With the component's other `useState` hooks (near `const [trashTalkOn, setTrashTalkOn] = useState(false);`), add:

```ts
  const [insultSeverity, setSeverity] = useState<InsultTier>('sticks');
  const [severitySheetOpen, setSeveritySheetOpen] = useState(false);
```

- [ ] **Step 4: Load the persisted severity on mount**

Next to the existing `getTrashTalkVolume().then(setTrashTalkVolume)` effect, add a sibling effect:

```ts
  useEffect(() => {
    getInsultSeverity().then(setSeverity).catch(() => {});
  }, []);
```

- [ ] **Step 5: Use the severity (not the constant) in the trash-talk effect**

In the trash-talk `useEffect` (deps currently `[trashTalkOn]`), replace BOTH uses of `DEFAULT_INSULT_TIER` with `insultSeverity`:
- `prefetchTier(m, DEFAULT_INSULT_VOICE, DEFAULT_INSULT_TIER)` → `prefetchTier(m, DEFAULT_INSULT_VOICE, insultSeverity)`
- `pickClip(m, DEFAULT_INSULT_VOICE, DEFAULT_INSULT_TIER)` → `pickClip(m, DEFAULT_INSULT_VOICE, insultSeverity)`

and change the dependency array from `[trashTalkOn]` to `[trashTalkOn, insultSeverity]` (keep the existing `// eslint-disable-next-line react-hooks/exhaustive-deps ...` comment immediately above it).

- [ ] **Step 6: Open the sheet on enable; confirm sets severity + turns on**

Replace the existing `handleTrashTalk`:

```ts
  const handleTrashTalk = () => {
    setTrashTalkOn((on) => !on);
  };
```

with:

```ts
  const handleTrashTalk = () => {
    if (trashTalkOn) {
      setTrashTalkOn(false);
      return;
    }
    setSeveritySheetOpen(true);
  };

  const handleSeverityConfirm = (tier: InsultTier) => {
    void setInsultSeverity(tier);
    setSeverity(tier);
    setSeveritySheetOpen(false);
    setTrashTalkOn(true);
  };
```

(The existing "off" control that calls `if (trashTalkOn) handleTrashTalk()` still turns trash talk off correctly — when on, `handleTrashTalk` now turns it off without a sheet.)

- [ ] **Step 7: Render the sheet**

In the screen's JSX (anywhere inside the top-level returned container, e.g. just before the closing wrapper alongside other overlays/modals like the quit confirm), add:

```tsx
        <SeveritySheet
          visible={severitySheetOpen}
          current={insultSeverity}
          onConfirm={handleSeverityConfirm}
          onCancel={() => setSeveritySheetOpen(false)}
        />
```

- [ ] **Step 8: Typecheck + lint + full suite**

Run: `npm run typecheck && npm run lint:ci && npm test`
Expected: typecheck clean, lint clean, all tests pass (119 + Task-1 severity tests; the Task-3 coach-prompt rewrite keeps its count).

- [ ] **Step 9: Commit**

```bash
git add app/workout.tsx
git commit -m "feat(insults): severity sheet drives trash-talk tier in workout"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full gates**

Run: `npm test && npm run typecheck && npm run lint:ci`
Expected: all tests pass (incl. `insult-severity.test.ts` and the rewritten `coach-prompt.test.ts`), typecheck + lint clean.

- [ ] **Step 2: Confirm the volume→tone coupling is gone**

Run: `grep -n "getTrashTalkVolume" lib/coach-client.ts` — Expected: NO match (resolveTone no longer reads volume). `grep -rn "tone !== 'teasing'" netlify/functions/coach-line.ts` — Expected: NO match (validation relaxed).

---

## Manual / on-device + ops verification (operator, after the build + redeploy)

Not code tasks:
1. **Redeploy the coach-line function** (the prompt change is server-side): `npx netlify deploy --prod --build` on `moodrx-api`. Curl-verify a `glass-house` tone returns 200 and a legacy `roasting` tone still returns 200 (no 400).
2. On-device: tap TRASH TALK (off) → "prepare to laugh" sheet opens with the last severity pre-selected → pick one → trash talk plays that tier; re-tap → off; re-open → remembered choice shown.
3. Post-workout (Pro): the AI coach's bite matches the chosen severity; changing the trash-talk volume no longer changes the tone.

---

## Self-Review (against the spec)

- **One set of three (Glass House/Sticks and Stones/Roasted), severity = tone:** Task 1 (`SEVERITIES`), Task 4 (`CoachTone` = the three keys; `resolveTone` returns severity). ✓
- **Persisted severity, default sticks, unknown→sticks:** Task 1 (`normalizeSeverity`), Task 2 (storage). ✓
- **"Prepare to laugh" sheet, 3 rows, last choice pre-selected, opens on enable / off-tap turns off:** Task 5 (component), Task 6 (`handleTrashTalk` + render). ✓
- **Severity drives the audio tier:** Task 6 Step 5. ✓
- **Coach tone expanded to 3 + volume decoupled + legacy tolerance:** Task 3 (prompt + normalize), Task 4 (type/resolveTone/coach-line). ✓
- **Server redeploy ops + 17+ note:** Manual section + spec. ✓
- **Testing (pure logic vitest; RN on-device):** Tasks 1/3 vitest; Tasks 5/6 typecheck+lint+on-device. ✓
- **Placeholder scan:** every code step has complete code; no TBD/TODO. ✓
- **Type consistency:** `InsultTier`/`SEVERITIES`/`normalizeSeverity`, `CoachTone`=3 keys, `getInsultSeverity`/`setInsultSeverity`, `insultSeverity`/`setSeverity` (state) vs `setInsultSeverity` (storage) kept distinct, `coachSystemPrompt(tone: string,...)` used consistently across Tasks 1–6. ✓
