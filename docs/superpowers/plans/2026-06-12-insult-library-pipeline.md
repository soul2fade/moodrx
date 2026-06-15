# Voiced Insult Library — Generation Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline, re-runnable `scripts/` CLI pipeline that generates Dr. MoodRx insult **text** per severity tier (Claude/Haiku), gates it through a human text-review step, voices the approved lines via ElevenLabs into small mp3s, and emits a multi-voice manifest the app will later consume — all at **$0 runtime cost**.

**Architecture:** Three offline phases — `generate` (Claude → candidate text → per-tier review files), human review (edit `status` in the review JSON), `voice` (ElevenLabs TTS on approved+unvoiced lines → mp3 + manifest). Text generation/review is **voice-independent** (one review per tier); the voice phase fans the same approved text across N ElevenLabs voices, one library per (voice × tier). The manifest is the idempotency source of truth: a line already voiced for a (voice, tier) is skipped on re-run. The no-violence guardrail used by the two live LLM surfaces is factored into a single shared constant the generator imports, so the three surfaces cannot drift.

**Tech Stack:** TypeScript run via `tsx` (mirrors `scripts/eval-vent.ts`), `@anthropic-ai/sdk` (Haiku, reuses `MOODRX_COACH_KEY`), ElevenLabs REST TTS via global `fetch` (`xi-api-key`, `eleven_flash_v2_5`, `mp3_44100_96`), vitest for the pure-logic units. No app/runtime code is touched; nothing here affects an EAS build.

---

## Scope

**In scope (this plan):** the offline pipeline — generate → review → voice → manifest — runnable end-to-end given the owner's ElevenLabs voice IDs + key. Plus the shared-guardrail refactor (touches the two live prompt builders but is behavior-preserving, guarded by the existing suite).

**Explicitly OUT of scope (separate follow-on pieces — note, do not build):**
- App-side consumption: Settings "Coach voice" picker, fetch+cache playback at the selected tier, the severity sheet, RevenueCat voice-pack entitlements.
- The live Pro-gated **post-workout** roast (personalized → live TTS).
- Uploading the produced audio + manifest to remote hosting (Netlify Blobs). The pipeline writes local files + manifest; the remote upload is an ops step that also depends on the still-pending Netlify Blobs provisioning. A `--dry-run` and local output are the boundary of this plan.

## File Structure

**New — shared guardrail (live code, behavior-preserving refactor):**
- `netlify/functions/lib/safety-guardrail.ts` — exports `NO_VIOLENCE_GUARDRAIL` (single source of truth).
- `netlify/functions/__tests__/safety-guardrail.test.ts` — asserts the constant's required substrings.

**New — pipeline pure logic (unit-tested):**
- `scripts/insult-library/lib/tiers.ts` — the 3 tier definitions + per-tier voice guidance.
- `scripts/insult-library/lib/text.ts` — `normalizeInsult`, `insultId`, `dedupeNew`.
- `scripts/insult-library/lib/generation-prompt.ts` — `buildGenerationPrompt` (imports the shared guardrail).
- `scripts/insult-library/lib/review.ts` — review-file types, `mergeCandidates`, `selectApproved`.
- `scripts/insult-library/lib/manifest.ts` — manifest types, `emptyManifest`, `hasEntry`, `addEntry`, `validateManifest`.
- `scripts/insult-library/__tests__/text.test.ts`, `review.test.ts`, `manifest.test.ts`, `generation-prompt.test.ts`, `tiers.test.ts`.

**New — pipeline CLIs (impure, network; manual-run, NOT unit-tested — mirror `eval-vent.ts`):**
- `scripts/insult-library/generate.ts` — phase 1.
- `scripts/insult-library/voice.ts` — phase 3 (supports `--dry-run`).

**New — config / data / docs:**
- `scripts/insult-library/voices.config.example.json` — committed placeholder.
- `scripts/insult-library/voices.config.json` — **gitignored** (owner's real voice IDs).
- `scripts/insult-library/data/<tier>.review.json` — committed curated text + approval decisions (created by `generate`).
- `scripts/insult-library/output/` — **gitignored** build artifacts (audio + manifest).
- `scripts/insult-library/README.md` — the 3-phase runbook.

**Modified:**
- `netlify/functions/lib/vent-grading.ts` — `VENT_SYSTEM_PROMPT` interpolates `NO_VIOLENCE_GUARDRAIL`.
- `netlify/functions/lib/coach-prompt.ts` — `coachSystemPrompt` interpolates `NO_VIOLENCE_GUARDRAIL`.
- `.env.example` — add `ELEVENLABS_API_KEY=`.
- `.gitignore` — add `scripts/insult-library/output/` and `scripts/insult-library/voices.config.json`.
- `package.json` — add `insults:generate` and `insults:voice` scripts.

---

## Task 1: Setup — env, config scaffolding, gitignore

**Files:**
- Modify: `.env.example`
- Modify: `.gitignore`
- Create: `scripts/insult-library/voices.config.example.json`
- Create: `scripts/insult-library/.gitkeep` (ensures the dir exists; harmless)

- [ ] **Step 1: Add the ElevenLabs key to `.env.example`**

Append to `.env.example`:

```
# ElevenLabs TTS (scripts/insult-library/voice.ts only — never in mobile builds)
ELEVENLABS_API_KEY=
```

- [ ] **Step 2: Gitignore the build output + the real voice config**

Append to `.gitignore`:

```
# Insult-library pipeline: build artifacts (large audio + regenerable manifest) and real voice IDs
scripts/insult-library/output/
scripts/insult-library/voices.config.json
```

- [ ] **Step 3: Create the committed example voice config**

Create `scripts/insult-library/voices.config.example.json`:

```json
[
  {
    "name": "noir",
    "label": "Dr. MoodRx",
    "voiceId": "REPLACE_WITH_ELEVENLABS_VOICE_ID",
    "free": true
  },
  {
    "name": "velvet",
    "label": "Velvet",
    "voiceId": "REPLACE_WITH_ELEVENLABS_VOICE_ID",
    "free": false
  }
]
```

- [ ] **Step 4: Verify the gitignore rules work**

Run: `git check-ignore scripts/insult-library/output/x.mp3 scripts/insult-library/voices.config.json`
Expected: both paths printed (i.e. both are ignored).

- [ ] **Step 5: Commit**

```bash
git add .env.example .gitignore scripts/insult-library/voices.config.example.json scripts/insult-library/.gitkeep
git commit -m "chore(insults): pipeline env/config scaffolding + gitignore"
```

---

## Task 2: Shared no-violence guardrail constant (behavior-preserving refactor, TDD)

**Files:**
- Create: `netlify/functions/lib/safety-guardrail.ts`
- Create: `netlify/functions/__tests__/safety-guardrail.test.ts`
- Modify: `netlify/functions/lib/vent-grading.ts` (`VENT_SYSTEM_PROMPT`)
- Modify: `netlify/functions/lib/coach-prompt.ts` (`coachSystemPrompt`)

The two live prompts currently inline near-identical "no violence/weapon/self-harm imagery" text. Factor it into one constant both import, so the generator reuses the **exact same** rule. This must stay behavior-preserving: the existing suite asserts `VENT_SYSTEM_PROMPT` contains `weapon` and `self-harm imagery`, and `coachSystemPrompt` contains `weapon` — the constant preserves those literal substrings.

- [ ] **Step 1: Write the failing test for the constant**

Create `netlify/functions/__tests__/safety-guardrail.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NO_VIOLENCE_GUARDRAIL } from '../lib/safety-guardrail';

describe('NO_VIOLENCE_GUARDRAIL', () => {
  it('names violence, weapons, and self-harm imagery and bans metaphor', () => {
    const g = NO_VIOLENCE_GUARDRAIL;
    expect(g).toContain('weapon');
    expect(g).toContain('self-harm imagery');
    expect(g.toLowerCase()).toContain('violence');
    expect(g.toLowerCase()).toContain('metaphor');
  });

  it('is a single non-trivial sentence-ish constant (no newlines that would break prompt structure)', () => {
    expect(NO_VIOLENCE_GUARDRAIL.length).toBeGreaterThan(80);
    expect(NO_VIOLENCE_GUARDRAIL).not.toContain('\n');
    expect(NO_VIOLENCE_GUARDRAIL).not.toContain('`');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run netlify/functions/__tests__/safety-guardrail.test.ts`
Expected: FAIL — cannot resolve `../lib/safety-guardrail`.

- [ ] **Step 3: Create the constant**

Create `netlify/functions/lib/safety-guardrail.ts`:

```ts
/** Single source of truth for the no-violence/weapon/self-harm-imagery rule.
 *  Imported by every surface that asks an LLM to speak in the Dr. MoodRx voice
 *  — the vent grader, the post-workout coach, and the offline insult generator —
 *  so the three can never drift. Must remain a single line (no newlines/backticks)
 *  so it can be interpolated into prompts without breaking their structure, and
 *  must keep the literal substrings "weapon" and "self-harm imagery" that the
 *  prompt tests assert on. */
export const NO_VIOLENCE_GUARDRAIL =
  'Never use violence, weapon, or self-harm imagery — no guns, shooting, knives, blades, hanging, jumping, "off yourself", "blow your brains out", "end it", "kill", etc. Not literally, not ironically, not as a joke or metaphor. This is a mental-health app; that language can land hard even when meant lightly.';
```

- [ ] **Step 4: Run the constant test to verify it passes**

Run: `npx vitest run netlify/functions/__tests__/safety-guardrail.test.ts`
Expected: PASS.

- [ ] **Step 5: Refactor `VENT_SYSTEM_PROMPT` to interpolate the constant**

In `netlify/functions/lib/vent-grading.ts`, add the import at the top:

```ts
import { NO_VIOLENCE_GUARDRAIL } from './safety-guardrail';
```

Replace the bullet-4 "EVERY tier" line and the trailing "NEVER ... imagery" clause so the guardrail text comes from the constant. The new `VENT_SYSTEM_PROMPT` (replace the whole template literal):

```ts
export const VENT_SYSTEM_PROMPT = `You are Dr. MoodRx, a darkly funny but ultimately caring fitness-for-mental-health coach with a film-noir, deadpan voice. The user just spoke for ~20 seconds about how they feel. From their words ONLY, do four things via the record_assessment tool.

1. mood: pick the single best-fit from: anxious, low, foggy, restless, stressed, good.
2. intensity: 1 (mild) to 10 (overwhelming).
3. risk — grade carefully; this gates the user experience:
   - "none": ordinary venting — frustration, anger, sadness, hyperbole, profanity, "I hate my job", "I'm so done". This is the DEFAULT. Hyperbole like "this is killing me" or "I could die" is NOT crisis.
   - "elevated": heavy distress with NO self-harm intent — hopelessness, "what's the point", crying, overwhelmed beyond venting.
   - "acute": genuine self-harm or suicidal ideation/intent. Reserve for real risk, not figures of speech.
   When unsure between two tiers, choose the LOWER one — except never downgrade genuine self-harm intent.
4. reply: 1-2 sentences, in voice, using ONLY what they said.
   - risk "none": teasing/deadpan, rib their resistance, never their worth or body.
   - risk "elevated": drop the teasing entirely. Warm, plain, supportive. No jokes at their expense.
   - risk "acute": brief, warm, non-clinical. Acknowledge them; do not joke; do not give medical advice.
   - EVERY tier: ${NO_VIOLENCE_GUARDRAIL}

NEVER invent facts, numbers, or history. NEVER give clinical labels, diagnoses, or medical advice. ${NO_VIOLENCE_GUARDRAIL} Use only what the user said.`;
```

- [ ] **Step 6: Refactor `coachSystemPrompt` to interpolate the constant**

In `netlify/functions/lib/coach-prompt.ts`, add at the top:

```ts
import { NO_VIOLENCE_GUARDRAIL } from './safety-guardrail';
```

In the non-crisis return, replace the inline "Never use violence, weapon, or self-harm imagery — ... this is a mental-health app." sentence with `${NO_VIOLENCE_GUARDRAIL}`. The non-crisis `return` becomes:

```ts
  return `You are Dr. MoodRx, a darkly funny fitness-for-mental-health coach with a film-noir, deadpan voice. Tone: ${intensity} Speak directly to the user about the workout they just did. Use ONLY the facts provided — never invent statistics, numbers, or history. Never give clinical labels, diagnoses, or medical advice. ${NO_VIOLENCE_GUARDRAIL} 1-2 sentences. No preamble.${episodeRule}`;
```

- [ ] **Step 7: Run the FULL suite — the refactor must regress nothing**

Run: `npm test`
Expected: PASS — all previously-passing tests stay green, including `vent-grading.test.ts` ("system prompt forbids violence/weapon/self-harm imagery" → `weapon` + `self-harm imagery`) and `coach-prompt.test.ts` ("forbids violence/weapon/self-harm imagery" → `weapon`), plus the new constant test.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: clean (no errors).

- [ ] **Step 9: Commit**

```bash
git add netlify/functions/lib/safety-guardrail.ts netlify/functions/__tests__/safety-guardrail.test.ts netlify/functions/lib/vent-grading.ts netlify/functions/lib/coach-prompt.ts
git commit -m "refactor(safety): factor no-violence guardrail into one shared constant"
```

---

## Task 3: Tier definitions (pure, TDD)

**Files:**
- Create: `scripts/insult-library/lib/tiers.ts`
- Create: `scripts/insult-library/__tests__/tiers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/insult-library/__tests__/tiers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TIERS, TIER_KEYS, isTierKey } from '../lib/tiers';

describe('tiers', () => {
  it('defines exactly the three severity tiers in ascending bite', () => {
    expect(TIER_KEYS).toEqual(['glass-house', 'sticks', 'roast']);
    expect(TIERS).toHaveLength(3);
  });

  it('every tier has a key, a human label, and non-empty generation guidance', () => {
    for (const t of TIERS) {
      expect(t.key.length).toBeGreaterThan(0);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.guidance.length).toBeGreaterThan(20);
    }
  });

  it('isTierKey narrows valid keys and rejects junk', () => {
    expect(isTierKey('roast')).toBe(true);
    expect(isTierKey('nuclear')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/insult-library/__tests__/tiers.test.ts`
Expected: FAIL — cannot resolve `../lib/tiers`.

- [ ] **Step 3: Implement the tiers**

Create `scripts/insult-library/lib/tiers.ts`:

```ts
/** The three severity tiers, matching the trash-talk severity slider:
 *  "I'm in a glass house" (light) / "Sticks and Stones" (normal) / "Roast me"
 *  (intense). Text generation + human review are per-tier and voice-independent;
 *  the voice phase fans each tier's approved lines across every configured voice. */
export interface Tier {
  /** Stable key used in file paths, the manifest, and the app. */
  key: 'glass-house' | 'sticks' | 'roast';
  /** Human-facing slider label (text-only, no emojis — per brand). */
  label: string;
  /** Persona/intensity guidance injected into the generation prompt. */
  guidance: string;
}

export const TIERS: Tier[] = [
  {
    key: 'glass-house',
    label: "I'm in a glass house",
    guidance:
      'Gentle ribbing. Soft, affectionate teasing about their reluctance to work out — the kind you would aim at a friend you like. Never sharp, never about their body or worth.',
  },
  {
    key: 'sticks',
    label: 'Sticks and Stones',
    guidance:
      'Standard Dr. MoodRx bite. Deadpan, film-noir, confidently sarcastic about their excuses and resistance. Funny first, mean never — still about the workout, not the person.',
  },
  {
    key: 'roast',
    label: 'Roast me',
    guidance:
      'Sharper and funnier, dialed up — but still LIGHTHEARTED and affectionate underneath. Rib their excuses hard; never cruel about their body, weight, intelligence, or worth.',
  },
];

export const TIER_KEYS = TIERS.map((t) => t.key) as Tier['key'][];

export function isTierKey(s: string): s is Tier['key'] {
  return (TIER_KEYS as string[]).includes(s);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/insult-library/__tests__/tiers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/insult-library/lib/tiers.ts scripts/insult-library/__tests__/tiers.test.ts
git commit -m "feat(insults): tier definitions + guidance"
```

---

## Task 4: Text normalize, stable id, dedup (pure, TDD)

**Files:**
- Create: `scripts/insult-library/lib/text.ts`
- Create: `scripts/insult-library/__tests__/text.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/insult-library/__tests__/text.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeInsult, insultId, dedupeNew } from '../lib/text';

describe('normalizeInsult', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    expect(normalizeInsult('  Oh, GREAT.   Another "rest" day?! ')).toBe('oh great another rest day');
  });
  it('treats casing/punctuation-only differences as equal', () => {
    expect(normalizeInsult('Quit stalling!')).toBe(normalizeInsult('quit   stalling'));
  });
});

describe('insultId', () => {
  it('is stable for the same normalized text across calls', () => {
    expect(insultId('Quit stalling!')).toBe(insultId('quit stalling'));
  });
  it('differs for different text and is a short hex string', () => {
    expect(insultId('a')).not.toBe(insultId('b'));
    expect(insultId('whatever')).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('dedupeNew', () => {
  it('drops candidates already present (by normalized form) and intra-batch dupes', () => {
    const existing = ['Quit stalling.'];
    const candidates = ['quit STALLING!', 'Get up.', 'get up', 'Move it.'];
    expect(dedupeNew(existing, candidates)).toEqual(['Get up.', 'Move it.']);
  });
  it('returns all candidates when nothing overlaps', () => {
    expect(dedupeNew([], ['One', 'Two'])).toEqual(['One', 'Two']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/insult-library/__tests__/text.test.ts`
Expected: FAIL — cannot resolve `../lib/text`.

- [ ] **Step 3: Implement**

Create `scripts/insult-library/lib/text.ts`:

```ts
import { createHash } from 'node:crypto';

/** Canonical form for comparison/dedup: lowercase, punctuation stripped to
 *  spaces, whitespace collapsed, trimmed. Intentionally lossy — two lines that
 *  differ only in casing/punctuation are the "same" insult. */
export function normalizeInsult(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stable 12-hex-char id derived from the normalized text, so the same insult
 *  always maps to the same id (and audio filename) across runs. */
export function insultId(text: string): string {
  return createHash('sha1').update(normalizeInsult(text)).digest('hex').slice(0, 12);
}

/** Return only the candidates whose normalized form is neither already in
 *  `existing` nor an earlier duplicate within the same batch. Preserves the
 *  original (un-normalized) candidate strings and their order. */
export function dedupeNew(existing: string[], candidates: string[]): string[] {
  const seen = new Set(existing.map(normalizeInsult));
  const out: string[] = [];
  for (const c of candidates) {
    const n = normalizeInsult(c);
    if (n.length === 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(c);
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/insult-library/__tests__/text.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/insult-library/lib/text.ts scripts/insult-library/__tests__/text.test.ts
git commit -m "feat(insults): text normalize, stable id, dedup"
```

---

## Task 5: Generation prompt builder (pure, TDD)

**Files:**
- Create: `scripts/insult-library/lib/generation-prompt.ts`
- Create: `scripts/insult-library/__tests__/generation-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/insult-library/__tests__/generation-prompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildGenerationPrompt } from '../lib/generation-prompt';
import { TIERS } from '../lib/tiers';
import { NO_VIOLENCE_GUARDRAIL } from '../../../netlify/functions/lib/safety-guardrail';

const roast = TIERS.find((t) => t.key === 'roast')!;

describe('buildGenerationPrompt', () => {
  it('embeds the shared guardrail verbatim (cannot drift from the live surfaces)', () => {
    expect(buildGenerationPrompt(roast, 50, [])).toContain(NO_VIOLENCE_GUARDRAIL);
  });

  it('includes the tier guidance, the persona, and the requested count', () => {
    const p = buildGenerationPrompt(roast, 42, []);
    expect(p).toContain(roast.guidance);
    expect(p.toLowerCase()).toContain('dr. moodrx');
    expect(p).toContain('42');
  });

  it('passes an avoid-list of existing lines so re-runs add novelty', () => {
    const p = buildGenerationPrompt(roast, 10, ['Quit stalling.', 'Move it.']);
    expect(p).toContain('Quit stalling.');
    expect(p).toContain('Move it.');
    expect(p.toLowerCase()).toContain('avoid');
  });

  it('omits the avoid-list section entirely when there are no existing lines', () => {
    const p = buildGenerationPrompt(roast, 10, []);
    expect(p.toLowerCase()).not.toContain('avoid repeating');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/insult-library/__tests__/generation-prompt.test.ts`
Expected: FAIL — cannot resolve `../lib/generation-prompt`.

- [ ] **Step 3: Implement**

Create `scripts/insult-library/lib/generation-prompt.ts`:

```ts
import { NO_VIOLENCE_GUARDRAIL } from '../../../netlify/functions/lib/safety-guardrail';
import type { Tier } from './tiers';

/** Build the Claude system prompt that asks for a batch of `count` insult lines
 *  at the given tier. Reuses the shared no-violence guardrail verbatim so the
 *  generated library can never contain language the live surfaces would ban.
 *  When `existing` is non-empty, an avoid-list nudges the model toward novelty
 *  (a hard dedup still runs after generation — see text.ts/dedupeNew). */
export function buildGenerationPrompt(tier: Tier, count: number, existing: string[]): string {
  const avoid =
    existing.length > 0
      ? `\n\nAvoid repeating or lightly rephrasing any of these existing lines:\n${existing
          .map((e) => `- ${e}`)
          .join('\n')}`
      : '';

  return `You are Dr. MoodRx, a darkly funny fitness-for-mental-health coach with a film-noir, deadpan voice. Write short trash-talk insults that play during a workout to needle the user into moving.

Severity for this batch — "${tier.label}": ${tier.guidance}

Rules for every line:
- 1 sentence, punchy, at most ~180 characters. No preamble, no quotes around the line, no emojis.
- About their excuses / reluctance / resistance to working out — never about their body, weight, looks, intelligence, or worth.
- Self-contained: no names, no invented facts, numbers, or history; it must make sense played to any user mid-workout.
- ${NO_VIOLENCE_GUARDRAIL}

Produce ${count} distinct lines via the record_insults tool.${avoid}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/insult-library/__tests__/generation-prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/insult-library/lib/generation-prompt.ts scripts/insult-library/__tests__/generation-prompt.test.ts
git commit -m "feat(insults): generation prompt builder reusing shared guardrail"
```

---

## Task 6: Review-file model (pure, TDD)

**Files:**
- Create: `scripts/insult-library/lib/review.ts`
- Create: `scripts/insult-library/__tests__/review.test.ts`

The review file is the human gate. `generate` appends new candidates as `pending`; a human edits `status` to `approved`/`rejected` (and may tweak `text`); `voice` only ever voices `approved` lines. Review state is **voice-independent** (the same approved text is voiced by every voice).

- [ ] **Step 1: Write the failing test**

Create `scripts/insult-library/__tests__/review.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mergeCandidates, selectApproved, type ReviewEntry } from '../lib/review';

describe('mergeCandidates', () => {
  it('adds new candidates as pending with stable ids', () => {
    const merged = mergeCandidates([], ['Get up.', 'Move it.']);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ text: 'Get up.', status: 'pending' });
    expect(merged[0].id).toMatch(/^[0-9a-f]{12}$/);
  });

  it('never duplicates an existing line and never resets its review status', () => {
    const existing: ReviewEntry[] = [{ id: 'x', text: 'Get up.', status: 'rejected' }];
    const merged = mergeCandidates(existing, ['get UP!', 'Move it.']);
    expect(merged).toHaveLength(2); // 'get UP!' is a dup of 'Get up.' → skipped
    expect(merged.find((e) => e.text === 'Get up.')!.status).toBe('rejected');
    expect(merged.find((e) => e.text === 'Move it.')!.status).toBe('pending');
  });
});

describe('selectApproved', () => {
  it('returns only approved entries, in order', () => {
    const entries: ReviewEntry[] = [
      { id: 'a', text: 'one', status: 'approved' },
      { id: 'b', text: 'two', status: 'pending' },
      { id: 'c', text: 'three', status: 'rejected' },
      { id: 'd', text: 'four', status: 'approved' },
    ];
    expect(selectApproved(entries).map((e) => e.text)).toEqual(['one', 'four']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/insult-library/__tests__/review.test.ts`
Expected: FAIL — cannot resolve `../lib/review`.

- [ ] **Step 3: Implement**

Create `scripts/insult-library/lib/review.ts`:

```ts
import { insultId, normalizeInsult } from './text';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewEntry {
  id: string;
  text: string;
  status: ReviewStatus;
}

/** The on-disk shape of a `<tier>.review.json` file. */
export interface ReviewFile {
  tier: string;
  entries: ReviewEntry[];
}

/** Append new candidate texts to an existing entry list as `pending`, skipping
 *  any whose normalized form already exists (dedup) so a re-run never duplicates
 *  a line or resets a human's prior approve/reject decision. Returns a new array;
 *  inputs are not mutated. */
export function mergeCandidates(existing: ReviewEntry[], candidates: string[]): ReviewEntry[] {
  const seen = new Set(existing.map((e) => normalizeInsult(e.text)));
  const additions: ReviewEntry[] = [];
  for (const text of candidates) {
    const n = normalizeInsult(text);
    if (n.length === 0 || seen.has(n)) continue;
    seen.add(n);
    additions.push({ id: insultId(text), text, status: 'pending' });
  }
  return [...existing, ...additions];
}

/** Only `approved` lines are ever voiced. */
export function selectApproved(entries: ReviewEntry[]): ReviewEntry[] {
  return entries.filter((e) => e.status === 'approved');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/insult-library/__tests__/review.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/insult-library/lib/review.ts scripts/insult-library/__tests__/review.test.ts
git commit -m "feat(insults): review-file model (merge candidates, select approved)"
```

---

## Task 7: Manifest model (pure, TDD)

**Files:**
- Create: `scripts/insult-library/lib/manifest.ts`
- Create: `scripts/insult-library/__tests__/manifest.test.ts`

The manifest is the voiced-state source of truth (idempotency): an entry exists per (voice, tier, id) only after that line is successfully voiced for that voice. It deliberately **omits `voiceId`** — the app never calls ElevenLabs, it only plays cached files, so the build-time voice id stays out of the shipped artifact.

- [ ] **Step 1: Write the failing test**

Create `scripts/insult-library/__tests__/manifest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { emptyManifest, hasEntry, addEntry, validateManifest } from '../lib/manifest';

describe('manifest', () => {
  it('emptyManifest is valid and versioned with no voices', () => {
    const m = emptyManifest('mp3_44100_96');
    expect(m.version).toBe(1);
    expect(m.format).toBe('mp3_44100_96');
    expect(Object.keys(m.voices)).toHaveLength(0);
    expect(validateManifest(m)).toBe(true);
  });

  it('addEntry creates the voice/tier and records the clip; hasEntry then finds it', () => {
    let m = emptyManifest('mp3_44100_96');
    expect(hasEntry(m, 'noir', 'roast', 'abc')).toBe(false);
    m = addEntry(m, { name: 'noir', label: 'Dr. MoodRx', free: true }, 'roast', {
      id: 'abc',
      text: 'Move it.',
      file: 'audio/noir/roast/abc.mp3',
    });
    expect(hasEntry(m, 'noir', 'roast', 'abc')).toBe(true);
    expect(m.voices.noir.free).toBe(true);
    expect(m.voices.noir.tiers.roast[0]).toMatchObject({ id: 'abc', file: 'audio/noir/roast/abc.mp3' });
    expect(validateManifest(m)).toBe(true);
  });

  it('addEntry is idempotent — re-adding the same id does not duplicate', () => {
    let m = emptyManifest('mp3_44100_96');
    const meta = { name: 'noir', label: 'Dr. MoodRx', free: true };
    const clip = { id: 'abc', text: 'Move it.', file: 'audio/noir/roast/abc.mp3' };
    m = addEntry(m, meta, 'roast', clip);
    m = addEntry(m, meta, 'roast', clip);
    expect(m.voices.noir.tiers.roast).toHaveLength(1);
  });

  it('validateManifest rejects malformed input', () => {
    expect(validateManifest(null)).toBe(false);
    expect(validateManifest({ version: 1 })).toBe(false);
    expect(validateManifest({ version: 1, format: 'x', voices: 'nope' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/insult-library/__tests__/manifest.test.ts`
Expected: FAIL — cannot resolve `../lib/manifest`.

- [ ] **Step 3: Implement**

Create `scripts/insult-library/lib/manifest.ts`:

```ts
import { TIER_KEYS, type Tier } from './tiers';

export interface ClipEntry {
  id: string;
  text: string;
  /** Path relative to the manifest, e.g. audio/<voice>/<tier>/<id>.mp3 */
  file: string;
}

export interface VoiceMeta {
  name: string;
  label: string;
  free: boolean;
}

export interface VoiceLibrary {
  label: string;
  free: boolean;
  tiers: Record<Tier['key'], ClipEntry[]>;
}

export interface Manifest {
  version: 1;
  /** ElevenLabs output_format the clips were rendered at (provenance only). */
  format: string;
  voices: Record<string, VoiceLibrary>;
}

function emptyTiers(): Record<Tier['key'], ClipEntry[]> {
  return TIER_KEYS.reduce(
    (acc, k) => {
      acc[k] = [];
      return acc;
    },
    {} as Record<Tier['key'], ClipEntry[]>,
  );
}

export function emptyManifest(format: string): Manifest {
  return { version: 1, format, voices: {} };
}

export function hasEntry(m: Manifest, voice: string, tier: Tier['key'], id: string): boolean {
  return Boolean(m.voices[voice]?.tiers[tier]?.some((c) => c.id === id));
}

/** Add a voiced clip under (voice, tier). Creates the voice/tier scaffold on
 *  first use. Idempotent: re-adding an existing id is a no-op. Returns a new
 *  manifest; the input is not mutated. */
export function addEntry(m: Manifest, voice: VoiceMeta, tier: Tier['key'], clip: ClipEntry): Manifest {
  const next: Manifest = { ...m, voices: { ...m.voices } };
  const lib = next.voices[voice.name]
    ? { ...next.voices[voice.name], tiers: { ...next.voices[voice.name].tiers } }
    : { label: voice.label, free: voice.free, tiers: emptyTiers() };
  const list = lib.tiers[tier];
  if (!list.some((c) => c.id === clip.id)) {
    lib.tiers[tier] = [...list, clip];
  }
  next.voices[voice.name] = lib;
  return next;
}

export function validateManifest(raw: unknown): raw is Manifest {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (typeof o.format !== 'string') return false;
  if (!o.voices || typeof o.voices !== 'object' || Array.isArray(o.voices)) return false;
  return true;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/insult-library/__tests__/manifest.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite + typecheck (all pure logic together)**

Run: `npm test && npm run typecheck`
Expected: PASS — every test (existing + the 5 new pure-logic files) green, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add scripts/insult-library/lib/manifest.ts scripts/insult-library/__tests__/manifest.test.ts
git commit -m "feat(insults): manifest model (idempotent add, hasEntry, validate)"
```

---

## Task 8: Generate CLI — phase 1 (impure; manual-run, mirrors eval-vent.ts)

**Files:**
- Create: `scripts/insult-library/generate.ts`
- Modify: `package.json` (add `insults:generate` script)

This is a network CLI (not unit-tested). It reads any existing `data/<tier>.review.json`, asks Claude (Haiku) for a batch per tier, dedups against existing text, and appends new `pending` entries. Re-running only adds novelty and never disturbs human decisions.

- [ ] **Step 1: Add the npm script**

In `package.json` `scripts`, add after `"eval:vent"`:

```json
    "insults:generate": "tsx scripts/insult-library/generate.ts",
    "insults:voice": "tsx scripts/insult-library/voice.ts"
```

(Add both now; `voice.ts` lands in Task 9.)

- [ ] **Step 2: Implement the generate CLI**

Create `scripts/insult-library/generate.ts`:

```ts
/* Phase 1 — generate candidate insult TEXT per tier (no TTS spend).
 * Requires MOODRX_COACH_KEY + network. Re-runnable: only appends novel lines as
 * `pending`; never touches existing approve/reject decisions.
 *
 * Usage:
 *   MOODRX_COACH_KEY=sk-... npm run insults:generate                 # 60/tier, all tiers
 *   MOODRX_COACH_KEY=sk-... npm run insults:generate -- --count=80
 *   MOODRX_COACH_KEY=sk-... npm run insults:generate -- --tier=roast --count=40
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { TIERS, isTierKey, type Tier } from './lib/tiers';
import { buildGenerationPrompt } from './lib/generation-prompt';
import { dedupeNew } from './lib/text';
import { mergeCandidates, type ReviewFile, type ReviewEntry } from './lib/review';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(ROOT, 'data');

const RECORD_INSULTS_TOOL = {
  name: 'record_insults',
  description: 'Record the batch of generated insult lines.',
  input_schema: {
    type: 'object' as const,
    properties: {
      insults: {
        type: 'array',
        items: { type: 'string' },
        description: 'The distinct insult lines, one string each, no numbering or quotes.',
      },
    },
    required: ['insults'],
    additionalProperties: false,
  },
};

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
}

function reviewPath(tier: Tier['key']): string {
  return resolve(DATA_DIR, `${tier}.review.json`);
}

function loadReview(tier: Tier['key']): ReviewFile {
  const p = reviewPath(tier);
  if (!existsSync(p)) return { tier, entries: [] };
  return JSON.parse(readFileSync(p, 'utf8')) as ReviewFile;
}

function saveReview(file: ReviewFile): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(reviewPath(file.tier as Tier['key']), JSON.stringify(file, null, 2) + '\n');
}

async function generateForTier(client: Anthropic, tier: Tier, count: number): Promise<void> {
  const file = loadReview(tier.key);
  const existingTexts = file.entries.map((e: ReviewEntry) => e.text);

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    temperature: 1,
    system: buildGenerationPrompt(tier, count, existingTexts),
    tools: [RECORD_INSULTS_TOOL],
    tool_choice: { type: 'tool', name: RECORD_INSULTS_TOOL.name },
    messages: [{ role: 'user', content: `Write ${count} fresh "${tier.label}" lines.` }],
  });

  const block = msg.content.find((b) => b.type === 'tool_use');
  const raw = block && block.type === 'tool_use' ? (block.input as { insults?: unknown }) : {};
  const lines = Array.isArray(raw.insults) ? raw.insults.filter((x): x is string => typeof x === 'string') : [];

  const cleaned = lines
    .map((l) => l.trim().replace(/^["'\s-]+|["'\s]+$/g, ''))
    .filter((l) => l.length > 0 && l.length <= 180);

  const novel = dedupeNew(existingTexts, cleaned);
  const merged = mergeCandidates(file.entries, novel);
  saveReview({ tier: tier.key, entries: merged });

  console.log(
    `[${tier.key.padEnd(11)}] model:${lines.length} cleaned:${cleaned.length} novel:${novel.length} → total ${merged.length} (pending now: ${merged.filter((e) => e.status === 'pending').length})`,
  );
}

async function main() {
  const key = process.env.MOODRX_COACH_KEY;
  if (!key) throw new Error('Set MOODRX_COACH_KEY');
  const count = Math.max(1, parseInt(arg('count', '60'), 10) || 60);
  const tierArg = arg('tier', '');
  const tiers = tierArg ? TIERS.filter((t) => t.key === tierArg) : TIERS;
  if (tierArg && !isTierKey(tierArg)) throw new Error(`Unknown tier "${tierArg}"`);

  const client = new Anthropic({ apiKey: key });
  for (const tier of tiers) {
    await generateForTier(client, tier, count);
  }
  console.log('\nDone. Review the lines in scripts/insult-library/data/*.review.json — set each status to "approved" or "rejected" before running insults:voice.');
}

main();
```

- [ ] **Step 3: Typecheck the new script**

Run: `npm run typecheck`
Expected: clean. (No unit test — this hits the network; it is exercised by the manual run below.)

- [ ] **Step 4: Commit**

```bash
git add package.json scripts/insult-library/generate.ts
git commit -m "feat(insults): phase-1 generate CLI (Claude → per-tier review files)"
```

---

## Task 9: Voice CLI — phase 3 (impure; ElevenLabs; manual-run)

**Files:**
- Create: `scripts/insult-library/voice.ts`

Reads `voices.config.json` + each `data/<tier>.review.json`, and for every (voice × tier × approved line) not already in the manifest, calls ElevenLabs (Flash model, mp3) and writes the clip + appends the manifest entry. Idempotent via `manifest.hasEntry`. Supports `--dry-run` to print exactly what would be voiced + a character/credit estimate **without spending anything** (important: TTS credits are real money).

- [ ] **Step 1: Implement the voice CLI**

Create `scripts/insult-library/voice.ts`:

```ts
/* Phase 3 — voice APPROVED lines via ElevenLabs into mp3 + manifest.
 * Requires ELEVENLABS_API_KEY + network + scripts/insult-library/voices.config.json.
 * Idempotent: a line already in the manifest for a (voice, tier) is skipped.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... npm run insults:voice -- --dry-run   # estimate only, no spend
 *   ELEVENLABS_API_KEY=... npm run insults:voice                # voice approved+unvoiced
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIERS, type Tier } from './lib/tiers';
import { selectApproved, type ReviewFile } from './lib/review';
import {
  emptyManifest,
  hasEntry,
  addEntry,
  validateManifest,
  type Manifest,
  type VoiceMeta,
} from './lib/manifest';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(ROOT, 'data');
const OUTPUT_DIR = resolve(ROOT, 'output');
const AUDIO_DIR = resolve(OUTPUT_DIR, 'audio');
const MANIFEST_PATH = resolve(OUTPUT_DIR, 'insult-library.json');

const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5';
const FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_96';

interface VoiceConfig extends VoiceMeta {
  voiceId: string;
}

function loadVoices(): VoiceConfig[] {
  const p = resolve(ROOT, 'voices.config.json');
  if (!existsSync(p)) {
    throw new Error('Missing scripts/insult-library/voices.config.json (copy voices.config.example.json and fill in real voice IDs).');
  }
  const arr = JSON.parse(readFileSync(p, 'utf8')) as VoiceConfig[];
  if (!Array.isArray(arr) || arr.some((v) => !v.name || !v.voiceId)) {
    throw new Error('voices.config.json must be an array of { name, label, voiceId, free }.');
  }
  return arr;
}

function loadReview(tier: Tier['key']): ReviewFile {
  const p = resolve(DATA_DIR, `${tier}.review.json`);
  if (!existsSync(p)) return { tier, entries: [] };
  return JSON.parse(readFileSync(p, 'utf8')) as ReviewFile;
}

function loadManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) return emptyManifest(FORMAT);
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  if (!validateManifest(raw)) throw new Error('Existing manifest is malformed; move it aside.');
  return raw;
}

function saveManifest(m: Manifest): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2) + '\n');
}

async function tts(voiceId: string, text: string, apiKey: string): Promise<Buffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${FORMAT}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL }),
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!dryRun && !apiKey) throw new Error('Set ELEVENLABS_API_KEY (or pass --dry-run).');

  const voices = loadVoices();
  let manifest = loadManifest();

  let toVoice = 0;
  let chars = 0;
  let voiced = 0;

  for (const voice of voices) {
    const meta: VoiceMeta = { name: voice.name, label: voice.label, free: voice.free };
    for (const tier of TIERS) {
      const approved = selectApproved(loadReview(tier.key).entries);
      for (const entry of approved) {
        if (hasEntry(manifest, voice.name, tier.key, entry.id)) continue;
        toVoice++;
        chars += entry.text.length;
        if (dryRun) {
          console.log(`[would voice] ${voice.name}/${tier.key}/${entry.id}  "${entry.text}"`);
          continue;
        }
        const audio = await tts(voice.voiceId, entry.text, apiKey!);
        const dir = resolve(AUDIO_DIR, voice.name, tier.key);
        mkdirSync(dir, { recursive: true });
        const rel = `audio/${voice.name}/${tier.key}/${entry.id}.mp3`;
        writeFileSync(resolve(dir, `${entry.id}.mp3`), audio);
        manifest = addEntry(manifest, meta, tier.key, { id: entry.id, text: entry.text, file: rel });
        saveManifest(manifest); // persist after each clip → crash-resumable
        voiced++;
        console.log(`[voiced ${voiced}] ${rel}  (${audio.length} bytes)`);
      }
    }
  }

  if (dryRun) {
    console.log(`\nDRY RUN: ${toVoice} clips would be voiced across ${voices.length} voice(s); ~${chars} characters (≈ ElevenLabs credits, Flash ≈ half). No spend, no files written.`);
  } else {
    saveManifest(manifest);
    console.log(`\nDone. Voiced ${voiced} new clip(s); ~${chars} characters spent. Manifest: ${MANIFEST_PATH}`);
  }
}

main();
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add scripts/insult-library/voice.ts
git commit -m "feat(insults): phase-3 voice CLI (ElevenLabs → mp3 + manifest, --dry-run)"
```

---

## Task 10: Runbook + final verification

**Files:**
- Create: `scripts/insult-library/README.md`

- [ ] **Step 1: Write the runbook**

Create `scripts/insult-library/README.md`:

````markdown
# Voiced Insult Library — Pipeline

Offline, re-runnable, $0-runtime pipeline that builds the during-workout trash-talk
library: Claude writes insult **text** per severity tier → a human approves the text →
ElevenLabs voices the approved lines → cached mp3s + a manifest the app plays.

Spec: `docs/superpowers/specs/2026-06-12-insult-library-pipeline-design.md`.

## Tiers
`glass-house` (light) · `sticks` (normal) · `roast` (intense) — match the severity slider.

## Secrets / config
- `MOODRX_COACH_KEY` — Claude (existing, in `.env`).
- `ELEVENLABS_API_KEY` — ElevenLabs (add to `.env`, gitignored).
- `scripts/insult-library/voices.config.json` — gitignored; copy from
  `voices.config.example.json` and fill in real `voiceId`s + which is `free: true`.
- Optional overrides: `ELEVENLABS_MODEL` (default `eleven_flash_v2_5`),
  `ELEVENLABS_OUTPUT_FORMAT` (default `mp3_44100_96`).

## Phase 1 — generate text (cheap; no TTS spend)
```
npm run insults:generate                      # 60 lines/tier, all tiers
npm run insults:generate -- --tier=roast --count=40
```
Writes/extends `scripts/insult-library/data/<tier>.review.json`. Re-runs only add
novel lines as `pending`; existing decisions are never disturbed. **Commit the
review files** — the approved text is the curated asset.

## Phase 2 — human review (the gate; do this before voicing)
Open each `data/<tier>.review.json`. For every entry set `"status"` to
`"approved"` or `"rejected"` (you may also tweak `"text"`). Only `approved`
lines are ever voiced — no un-reviewed line spends credits.

## Phase 3 — voice approved lines (spends ElevenLabs credits)
```
npm run insults:voice -- --dry-run            # estimate chars/credits, write nothing
npm run insults:voice                         # voice approved+unvoiced, all voices
```
Writes `output/audio/<voice>/<tier>/<id>.mp3` + `output/insult-library.json`.
Idempotent: a line already in the manifest for a (voice, tier) is skipped, so
re-runs only voice new approvals / new voices. `output/` is gitignored
(destined for remote hosting).

## Out of scope here (separate pieces)
App-side voice picker + fetch/cache playback + severity sheet + RevenueCat voice
packs; the live Pro-gated post-workout roast; uploading `output/` to remote
hosting (Netlify Blobs — also pending Blobs provisioning).
````

- [ ] **Step 2: Final full verification**

Run: `npm test && npm run typecheck`
Expected: PASS — full suite green (existing + all new pure-logic tests), typecheck clean.

- [ ] **Step 3: Commit**

```bash
git add scripts/insult-library/README.md
git commit -m "docs(insults): pipeline runbook"
```

---

## Manual end-to-end run (after the owner drops in the key + voices.config.json)

Not a code task — the operator runs this once secrets are in place. Listed so the build is provably runnable end-to-end:

1. Put `ELEVENLABS_API_KEY=...` in `.env`; copy `voices.config.example.json` → `voices.config.json` and fill in real voice IDs (mark one `free: true`).
2. `npm run insults:generate` → review `data/*.review.json`, set statuses.
3. `npm run insults:voice -- --dry-run` → sanity-check the count/estimate.
4. `npm run insults:voice` → produces `output/audio/...` + `output/insult-library.json`.
5. Spot-check a few clips; confirm the manifest validates and re-running voices nothing new (idempotency).

---

## Self-Review (against the design spec)

- **Three phases (text → review → voice):** Tasks 8 (generate), human review (Task 10 runbook + the `pending`/`approved` model in Task 6), 9 (voice). ✓
- **Reuse the shared guardrail; factor into a constant so the 3 surfaces can't drift:** Task 2 creates `NO_VIOLENCE_GUARDRAIL`, rewires both live prompts, and Task 5's generator imports it (test asserts verbatim inclusion). ✓
- **Claude via `MOODRX_COACH_KEY`, Haiku, forced tool; mirror `eval-vent.ts` tsx pattern:** Task 8. ✓
- **ElevenLabs Flash model, ~96–128 kbps mono mp3, key+voiceId from config/env, never hardcoded:** Task 9 (`eleven_flash_v2_5`, `mp3_44100_96`, `xi-api-key`). ✓
- **Dedup + idempotent re-runs:** `dedupeNew`/`mergeCandidates` (text never duplicated, decisions preserved) + `manifest.hasEntry` (clips never re-voiced). Tasks 4/6/7. ✓
- **Multi-voice; manifest carries voice dimension + `free` flag:** Task 7 manifest shape; Task 9 fans across voices. ✓ (voiceId deliberately omitted from the shipped manifest — app plays cached files, never calls ElevenLabs.)
- **3 tiers matching the slider:** Task 3. ✓
- **Size ~50–75 lines/tier, expandable:** `--count` default 60, re-runnable. Task 8. ✓
- **$0 runtime / offline dev script, does not affect the app build:** everything under `scripts/` + `netlify/functions/lib`; no app/runtime code touched; no EAS build. ✓
- **Human review before any TTS spend:** only `approved` lines voiced; `--dry-run` estimate. Tasks 6/9. ✓
- **Hosting (remote+cache) / app-side consumption / live post-workout roast:** explicitly out of scope, noted. ✓
- **TDD on pure logic (text dedup, manifest shape, shared guardrail):** Tasks 2/4/6/7 are test-first; CLIs (8/9) are network/manual per the `eval-vent.ts` convention. ✓
- **Placeholder scan:** every code step contains complete code; no TBD/TODO. ✓
- **Type consistency:** `ReviewEntry`/`ReviewStatus`/`ReviewFile`, `Tier['key']`, `Manifest`/`VoiceMeta`/`ClipEntry`/`VoiceLibrary`, `NO_VIOLENCE_GUARDRAIL` used consistently across tasks. ✓
