# Emerald Accent Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's brand/chrome accent (anxious gold `#E8B84B`) with emerald `#10B981`, while keeping gold exclusively for premium/upgrade UI, via a two-token system.

**Architecture:** Add a `colors.accent` token (emerald) alongside the existing `colors.premium` (gold). Replace the 37 hardcoded `#E8B84B` literals with the correct token — brand chrome → `colors.accent`, premium/upgrade → `colors.premium`. Mood colors are untouched. Purely presentational; no logic/data/widget changes.

**Tech Stack:** React Native (Expo), TypeScript, StyleSheet. No unit-test runner in this repo.

**Reference spec:** `docs/superpowers/specs/2026-06-09-emerald-accent-rebrand-design.md`

---

## Verification note

This repo has **no unit-test runner**; every change is verified with `npm run typecheck` and `npm run lint:ci` (0-warning baseline), plus a grep audit and a visual pass on a Galaxy Tab `preview` build. Commit trailer for every commit: `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Corrections from the planning audit (refines the spec)

The per-line audit found two items the spec classified loosely:
- **`app/home.tsx` is mixed:** lines 610/616 are `proMemberBadge`/`proMemberBadgeText` → **stay gold** (premium); only 634/683 (streak labels) → emerald.
- **`components/WorkoutCalendar.tsx:12`** is the Anxious entry in a local `MOOD_COLORS` map → **stays gold** (mood color, not chrome). Not modified.

Final tally: **13 → emerald**, **20 → `colors.premium`**, **4 untouched** (`lib/moods.ts`, `lib/colors.ts` token, `components/WorkoutCalendar.tsx` mood map, `lib/widget.ts` comment).

## File structure

- Modify `lib/colors.ts` — add `accent` token (Task 1).
- Modify brand-only files → `colors.accent` (Task 2): `app/onboarding.tsx`, `app/prescription.tsx`, `app/insights.tsx`, `app/guided.tsx`, `app/bad-day.tsx`, `components/SessionWinCard.tsx`.
- Modify `app/home.tsx` — mixed (Task 3).
- Modify `app/settings.tsx` — mixed (Task 4).
- Modify premium-only files → `colors.premium` (Task 5): `app/premium.tsx`, `components/PremiumSheet.tsx`.
- Verify (Task 6).

The `colors` import style to use everywhere: `import { colors } from '@/lib/colors';` (matches `app/insights.tsx:27`).

---

## Task 1: Add the emerald `accent` token

**Files:**
- Modify: `lib/colors.ts`

- [ ] **Step 1: Add the token in the Semantic block**

In `lib/colors.ts`, change:
```ts
  // Semantic
  success: '#059669',
```
to:
```ts
  // Semantic
  accent: '#10B981',   // brand/chrome accent (emerald)
  success: '#059669',
```
(Leave `premium: '#E8B84B'` exactly as-is — it's now reserved for premium UI.)

- [ ] **Step 2: Verify typecheck + lint**

Run:
```bash
npm run typecheck
npm run lint:ci
```
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/colors.ts
git commit -m "feat(theme): add emerald brand accent token

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Recolor brand-only files → `colors.accent`

Each of these files has **only brand-chrome** gold, so every `#E8B84B` in them becomes `colors.accent`.

**Files:**
- Modify: `app/onboarding.tsx` (3), `app/prescription.tsx` (1), `app/guided.tsx` (1), `app/bad-day.tsx` (1), `components/SessionWinCard.tsx` (1) — add the `colors` import + replace.
- Modify: `app/insights.tsx` (1) — already imports `colors`, replace only.

- [ ] **Step 1: Add the `colors` import to the five files that lack it**

In each of `app/onboarding.tsx`, `app/prescription.tsx`, `app/guided.tsx`, `app/bad-day.tsx`, `components/SessionWinCard.tsx`, add this line with the other top-of-file imports (alongside the existing `@/lib/...` / typography imports):
```ts
import { colors } from '@/lib/colors';
```
`app/insights.tsx` already has it (line 27) — skip there.

- [ ] **Step 2: Replace every `#E8B84B` with `colors.accent` in these six files**

In each file, replace each occurrence of the literal `'#E8B84B'` with `colors.accent` (no quotes). These files contain only brand usages, so replacing all occurrences is correct. Exact occurrences:
- `app/onboarding.tsx` — 3 (a `...t.number` color, a `borderLeftColor`, a `...t.label` color)
- `app/prescription.tsx` — 1 (`...t.label` color)
- `app/insights.tsx` — 1 (`...t.label` color)
- `app/guided.tsx` — 1 (`stepLabel` color)
- `app/bad-day.tsx` — 1 (`label` color)
- `components/SessionWinCard.tsx` — 1 (`...t.label` color)

Example (onboarding `borderLeftColor`): change `borderLeftColor: '#E8B84B',` → `borderLeftColor: colors.accent,`. Apply the same literal→token swap to each `color: '#E8B84B',` in these files.

- [ ] **Step 3: Verify typecheck + lint**

```bash
npm run typecheck
npm run lint:ci
```
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/onboarding.tsx app/prescription.tsx app/insights.tsx app/guided.tsx app/bad-day.tsx components/SessionWinCard.tsx
git commit -m "feat(theme): brand-only screens to emerald accent

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: `app/home.tsx` (mixed — 2 gold stay, 2 → emerald)

**Files:**
- Modify: `app/home.tsx`

- [ ] **Step 1: Add the `colors` import**

Add with the other top-of-file imports:
```ts
import { colors } from '@/lib/colors';
```

- [ ] **Step 2: Premium → `colors.premium` (proMemberBadge)**

Change:
```ts
  proMemberBadge: {
    borderWidth: 1,
    borderColor: '#E8B84B',
```
to:
```ts
  proMemberBadge: {
    borderWidth: 1,
    borderColor: colors.premium,
```

- [ ] **Step 3: Premium → `colors.premium` (proMemberBadgeText)**

Change:
```ts
  proMemberBadgeText: {
    ...t.label,
    color: '#E8B84B',
```
to:
```ts
  proMemberBadgeText: {
    ...t.label,
    color: colors.premium,
```

- [ ] **Step 4: Brand → `colors.accent` (streakPillLabel)**

Change:
```ts
  streakPillLabel: {
    ...t.label,
    color: '#E8B84B',
```
to:
```ts
  streakPillLabel: {
    ...t.label,
    color: colors.accent,
```

- [ ] **Step 5: Brand → `colors.accent` (streakBadgeText)**

Change:
```ts
  streakBadgeText: {
    ...t.number,
    color: '#E8B84B',
```
to:
```ts
  streakBadgeText: {
    ...t.number,
    color: colors.accent,
```

- [ ] **Step 6: Verify there are no remaining `#E8B84B` in home.tsx**

Run:
```bash
grep -n "#E8B84B" app/home.tsx
```
Expected: no output.

- [ ] **Step 7: Verify typecheck + lint**

```bash
npm run typecheck
npm run lint:ci
```
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add app/home.tsx
git commit -m "feat(theme): home accent emerald; keep PRO badge gold

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: `app/settings.tsx` (mixed — slider/value → emerald, premium → gold)

**Files:**
- Modify: `app/settings.tsx`

- [ ] **Step 1: Add the `colors` import**

Add with the other top-of-file imports:
```ts
import { colors } from '@/lib/colors';
```

- [ ] **Step 2: Brand → `colors.accent` (slider track tint)**

Change:
```tsx
            minimumTrackTintColor="#E8B84B"
```
to:
```tsx
            minimumTrackTintColor={colors.accent}
```

- [ ] **Step 3: Brand → `colors.accent` (slider thumb tint)**

Change:
```tsx
            thumbTintColor="#E8B84B"
```
to:
```tsx
            thumbTintColor={colors.accent}
```

- [ ] **Step 4: Brand → `colors.accent` (volumeValue label)**

Change:
```ts
  volumeValue: {
    ...t.label,
    color: '#E8B84B',
```
to:
```ts
  volumeValue: {
    ...t.label,
    color: colors.accent,
```

- [ ] **Step 5: Premium → `colors.premium` (trialDaysText)**

Change:
```ts
  trialDaysText: { ...t.bodySm, color: '#E8B84B', marginTop: 4 },
```
to:
```ts
  trialDaysText: { ...t.bodySm, color: colors.premium, marginTop: 4 },
```

- [ ] **Step 6: Premium → `colors.premium` (proBadge border)**

Change:
```ts
  proBadge: {
    borderWidth: 1,
    borderColor: '#E8B84B',
```
to:
```ts
  proBadge: {
    borderWidth: 1,
    borderColor: colors.premium,
```

- [ ] **Step 7: Premium → `colors.premium` (proBadgeText)**

Change:
```ts
  proBadgeText: { ...t.label, color: '#E8B84B', letterSpacing: 2 },
```
to:
```ts
  proBadgeText: { ...t.label, color: colors.premium, letterSpacing: 2 },
```

- [ ] **Step 8: Premium → `colors.premium` (upgradeBtnUrgent)**

Change:
```ts
  upgradeBtnUrgent: {
    borderColor: '#E8B84B',
  },
```
to:
```ts
  upgradeBtnUrgent: {
    borderColor: colors.premium,
  },
```

- [ ] **Step 9: Verify no remaining `#E8B84B` in settings.tsx**

```bash
grep -n "#E8B84B" app/settings.tsx
```
Expected: no output.

- [ ] **Step 10: Verify typecheck + lint**

```bash
npm run typecheck
npm run lint:ci
```
Expected: both exit 0.

- [ ] **Step 11: Commit**

```bash
git add app/settings.tsx
git commit -m "feat(theme): settings slider emerald; keep trial/PRO/upgrade gold

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Premium-only files → `colors.premium`

Both files contain **only premium** gold, so every `#E8B84B` becomes `colors.premium` (no visual change — it tokenizes the gold so the two-tone system is explicit and the grep audit stays clean).

**Files:**
- Modify: `app/premium.tsx` (9), `components/PremiumSheet.tsx` (5)

- [ ] **Step 1: Add the `colors` import to both files**

Add with the other top-of-file imports in each:
```ts
import { colors } from '@/lib/colors';
```

- [ ] **Step 2: Replace every `#E8B84B` with `colors.premium` in both files**

In `app/premium.tsx` and `components/PremiumSheet.tsx`, replace each occurrence of `'#E8B84B'` with `colors.premium`. (Leave the gold rgba `'rgba(232, 184, 75, 0.08)'` in `premium.tsx` as-is — it's the trial badge tint and stays gold.)

- [ ] **Step 3: Verify no remaining `#E8B84B` in these files**

```bash
grep -n "#E8B84B" app/premium.tsx components/PremiumSheet.tsx
```
Expected: no output.

- [ ] **Step 4: Verify typecheck + lint**

```bash
npm run typecheck
npm run lint:ci
```
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/premium.tsx components/PremiumSheet.tsx
git commit -m "refactor(theme): tokenize premium gold to colors.premium

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Grep audit — only the allowed `#E8B84B` literals remain**

Run:
```bash
grep -rn "#E8B84B" app/ components/ lib/ | grep -v node_modules
```
Expected: exactly these (and nothing else):
- `lib/colors.ts` — the `premium` token value
- `lib/moods.ts` — the Anxious mood color
- `components/WorkoutCalendar.tsx` — the Anxious entry in `MOOD_COLORS`
- `lib/widget.ts` — the `// e.g. "#E8B84B"` comment

- [ ] **Step 2: Confirm the emerald token is wired**

```bash
grep -rn "colors.accent" app/ components/ | grep -v node_modules | wc -l
```
Expected: 13 (the brand usages).

- [ ] **Step 3: Final typecheck + lint**

```bash
npm run typecheck
npm run lint:ci
```
Expected: both exit 0.

- [ ] **Step 4: Visual pass on a Galaxy Tab `preview` build**

Build + install per `docs/launch-submission-checklist.md` flow:
```bash
eas build --profile preview --platform android
```
On the device, confirm:
- **Emerald** on: home streak pill/badge, onboarding labels, prescription/insights/guided/bad-day labels, settings trash-talk slider + value, session-win card.
- **Still gold** on: home **PRO member badge**, settings **trial/PRO/upgrade** row, the **premium screen** + **PremiumSheet** (badges, prices, upgrade CTA).
- Mood colors unchanged (Anxious still gold *as a mood*, e.g. in the workout calendar).

---

## Self-review (completed)

- **Spec coverage:** token added (Task 1) ✓; brand → emerald (Tasks 2–4) ✓; premium → gold tokenized (Tasks 3–5) ✓; moods untouched ✓; grep + visual verification (Task 6) ✓.
- **Token consistency:** `colors.accent` (defined Task 1) used identically in Tasks 2–4; `colors.premium` (pre-existing) used in Tasks 3–5; import string `import { colors } from '@/lib/colors';` identical everywhere.
- **Placeholder scan:** every edit shows exact old/new code; no TBD/TODO.
- **Audit corrections folded in:** home.tsx mixed; WorkoutCalendar mood map left gold.

## Deferred / out of scope

- Updating the `lib/widget.ts` comment example (cosmetic; allowed to remain).
- Refactoring `WorkoutCalendar.tsx`'s local `MOOD_COLORS` to import from `lib/moods.ts` (separate cleanup).
- Any widget visual change (widget renders mood colors; unaffected).
