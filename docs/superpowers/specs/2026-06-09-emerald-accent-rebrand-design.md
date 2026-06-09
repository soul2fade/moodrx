# MoodRx Accent Rebrand — Design Spec

**Date:** 2026-06-09
**Status:** Approved (design); ready for implementation planning
**Goal:** Replace the app's de-facto brand accent — anxious gold `#E8B84B` — with
**emerald `#10B981`**, so the UI reads "positive / growth" instead of "anxious
yellow," while keeping gold as a deliberate **premium** signal.

## Problem

The gold `#E8B84B` is hardcoded as the brand/chrome accent in 37 places across 14
files (labels, borders, badges, CTAs, slider tints). It is the **exact same hex
as the Anxious mood color**, so the whole app reads "anxious yellow" — even on
screens that have nothing to do with the Anxious mood. For a wellness app, a
positive green accent is a better fit.

## Decisions (locked with the user)

- **New brand accent:** emerald **`#10B981`** (chosen over the literal "Good"
  green `#059669`, which collides with the Good mood and is a bit dark on the
  `#0a0a0a` background; emerald is brighter, passes contrast for normal text, and
  isn't a literal mood swatch). Blue/teal options were considered and rejected in
  favor of emerald's energetic "take action, get better" tone.
- **Two-tone system:** **emerald = app/brand**, **gold `#E8B84B` = premium only.**
  Gold is upgraded from "accidental everywhere-color" to an intentional premium /
  upgrade signal, which also makes the paywall pop.
- **Mood colors are untouched.** All six mood colors stay exactly as they are;
  Anxious keeps `#E8B84B` *as a mood*. We are only changing the app chrome accent.

## Approach: tokenize, then reclassify

**1. Add a brand-accent token** in `lib/colors.ts`:
- `accent: '#10B981'`  ← new emerald brand accent
- `premium: '#E8B84B'` ← unchanged value, now reserved for premium/upgrade UI

**2. Replace the 37 hardcoded `#E8B84B` literals** with the correct token
(`colors.accent` or `colors.premium`) rather than swapping the raw hex. Tokenizing
makes any future accent change a one-line edit and removes the literal/mood
ambiguity.

### Classification (which gold becomes what)

**→ `colors.accent` (emerald) — brand chrome:**
- `app/home.tsx` (4)
- `app/onboarding.tsx` (3)
- `app/prescription.tsx` (1)
- `app/insights.tsx` (1)
- `app/guided.tsx` (1)
- `app/bad-day.tsx` (1)
- `components/WorkoutCalendar.tsx` (1)
- `components/SessionWinCard.tsx` (1)
- `app/settings.tsx` — slider tints (lines ~480/482) + the section label (~898) ≈ 3

**→ `colors.premium` (stays gold) — premium / upgrade:**
- `app/premium.tsx` (9)
- `components/PremiumSheet.tsx` (5)
- `app/settings.tsx` — trial / PRO-badge / upgrade-button styles (lines ~809/813/817/825) ≈ 4

**Untouched:**
- `lib/moods.ts` — Anxious mood color `#E8B84B` (mood identity).
- `lib/colors.ts` — `premium` token keeps its value.
- `lib/widget.ts` — the lone hit is a comment example (`// e.g. "#E8B84B"`);
  optionally update the comment, no behavioral effect.

### Borderline calls

A few `settings.tsx` lines sit near the premium/brand boundary (e.g. the section
label at ~898). Rule: **brand → emerald unless the element is visibly premium /
upgrade-related.** The implementation plan will confirm each settings.tsx line
against its rendered element and note the call.

## Scope

- **In scope:** the token addition + the 37 literal replacements — roughly **16 →
  emerald** (brand chrome), **18 → `colors.premium`** (premium, tokenized but still
  gold), and **3 untouched** (Anxious mood, the `premium` token itself, the
  `widget.ts` comment).
- **Out of scope:** mood colors; widget behavior (it renders mood colors with a
  neutral default and never used the brand gold); any layout, copy, or logic
  changes; the dark background / text palette.

## Nature of change & risk

Purely presentational — no logic, no data, no mood, no widget behavior. Low risk.
The main risk is mis-classifying a premium element as brand (or vice-versa); the
per-line audit in the plan mitigates it.

## Verification

- `npm run typecheck` and `npm run lint:ci` — clean (0-warning baseline).
- Grep check: **no remaining `#E8B84B` literals** outside `lib/colors.ts` (token),
  `lib/moods.ts` (Anxious), and the optional `lib/widget.ts` comment.
- Visual pass on a **Galaxy Tab `preview` build**: confirm brand surfaces (home,
  onboarding, insights, prescription, guided, bad-day, settings slider) are
  emerald, and the **premium/PRO screens + upgrade rows remain gold**. These are
  shared RN screens, so Android coverage is representative; iOS renders identically.

## Out of scope (explicitly)

- Changing any of the six mood colors.
- Widget visuals (mood-driven; unaffected).
- Introducing a full theming system beyond the two accent tokens.
