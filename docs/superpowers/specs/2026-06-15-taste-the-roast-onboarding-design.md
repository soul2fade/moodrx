# "Taste the roast" — onboarding hook for the trash-talk persona

**Date:** 2026-06-15
**Status:** Design — approved in brainstorming, pending spec review
**Branch (proposed):** `feat/taste-the-roast` off `feat/pricing-clarity` (builds on the new onboarding carousel, which is not yet merged)

## Problem

The trash-talk persona (Dr. MoodRx) is the app's biggest differentiator for its target audience — people who want mood insights but have a cynical/sarcastic/dark sense of humor. Today that personality is **discovered only after install**, buried in a settings severity picker and the in-workout coach. The onboarding sells "how it works" and pricing, but never lets a prospect *feel* the humor — so the people who'd love it can't self-select in.

## Goal

Make the dark humor a **first-run moment**: let a new user tap a mood and get talked back to by Dr. MoodRx — see the line and optionally hear it — then set how hard it goes. The right people grin and lean in (and the wrong ones bail, which is fine). It also produces the app's most screenshot-able moment, feeding the [[distribution-short-form-video]] channel.

## Non-goals

- The **live AI coach** is not used here. The taste uses static, pre-vetted clips only (this sidesteps crisis-safety risk — those lines are human-reviewed, unlike live-generated ones).
- No new backend, no RevenueCat changes, no new audio infrastructure (reuses the existing voiced-clip pipeline).
- The tapped mood is a **demo only** — it does not carry into the user's first real session.

## Placement & flow

The onboarding carousel (built on `feat/pricing-clarity`, currently 2 tiles) becomes **3 tiles**, with the taste inserted in the middle:

```
How it works  →  Taste the roast  →  Pricing
   (tile 1)         (tile 2, NEW)      (tile 3)
```

Order rationale (user's call): orient them, *then* hit them with the personality while it's fresh, *then* ask for money. The taste hands off to pricing with a bridge line that turns the humor into the upsell.

## The taste tile — interaction

1. **Header:** "Meet your coach" / "How's your head today?"
2. **Mood chips** — the 6 moods from `lib/moods.ts` (`MOODS`). Tapping one is the check-in gesture (demonstrates that the product takes input).
3. **Dr. MoodRx fires back a real clip.** On mood tap, a line appears as **text** with a small **▶ hear it** button. The text shown **is** the clip that plays — selected by voice × burn-level via `pickClip(manifest, voice, tier)` ([lib/insult-library.ts](../../../lib/insult-library.ts)). So audio always matches text. (Accepted tradeoff: the line is a genuine Dr. MoodRx line in that voice/heat, not literally about the tapped mood — the voiced library is not mood-indexed.)
4. **▶ hear it** plays the clip via the existing, proven path — `fetchManifest` → `pickClip` → `ensureClip` → `expo-audio` `useAudioPlayer` (the same mechanism as the coach-voice picker's Sample button, [components/CoachVoicePicker.tsx](../../../components/CoachVoicePicker.tsx)). Graceful degradation: if `fetchManifest`/`ensureClip` returns null (offline or library unreachable), the **▶ button is hidden/disabled and the text still lands** — audio never blocks onboarding.
5. **Burn-level selector** — Glass House / Sticks and Stones / Roasted (from [lib/insult-severity.ts](../../../lib/insult-severity.ts) `SEVERITIES`). Changing it **re-rolls the displayed clip at that tier** (a live demo of the setting) **and persists** via `setInsultSeverity(tier)` ([lib/storage.ts](../../../lib/storage.ts)) so the user is not re-asked later.
   - **Roasted shows a small disclaimer:** "Contains strong language." (See Profanity below.)
   - A muted optional-ity line under the selector: *"Optional — Dr. MoodRx only chimes in when you turn trash talk on for a workout. Change or mute it anytime in Settings."*
6. **Two exits — opt-in is a choice, not a default:**
   - Primary CTA **"Bring it on →"** — proceeds to pricing; the picked burn level is saved as their preference.
   - Secondary, quiet **"Not for me — keep it clinical →"** — also proceeds to pricing, but makes the decline explicit. (No insult/severity is forced; see below.)

## Trash-talk is an option, not a default (design requirement)

The trash-talk is the *hook*, but it must never read as imposed — the target also includes people who just want clean mood insights. The app already treats it as opt-in (it "only plays when you turn it on during a workout," per the Settings copy + the per-workout enable). The taste must preserve that:

- Completing the taste **does not force trash-talk on**. The per-workout enable stays exactly as it is today — Dr. MoodRx is silent until the user turns trash talk on for a given workout. The burn-level pick only **presets the severity** for when they do.
- The **"Not for me — keep it clinical →"** exit is a first-class path, visually equal-weight enough to not feel like a dark pattern. Taking it leaves trash-talk off and severity untouched.
- The optional-ity line (step 5) states plainly that it's optional, per-workout, and changeable/mutable in Settings.

## Bridge to pricing

A single line connecting the taste to the upsell, shown on the CTA hand-off or atop the pricing tile:
> "That one's from a script. MoodRx+ writes fresh ones off your actual patterns — the live coach."

This makes the live AI coach (the MoodRx+ perk in the pricing comparison) the natural next want.

## Defaults (approved)

- **Voice:** **Rachel** (the free voice everyone gets) — the taste reflects what they actually have, not a paid tease.
- **Starting burn level:** **Sticks and Stones** (the middle) — a first tap never opens at "Roasted."
- **Mood is demo-only** — does not seed the first session.

## Profanity disclaimer + age-rating note

- The **Roasted** option shows a small muted disclaimer ("Contains strong language") in **both** the new taste tile selector **and** the existing [components/SeveritySheet.tsx](../../../components/SeveritySheet.tsx) (the settings severity picker), for consistency wherever the tier is chosen. Single-source the disclaimer text alongside `SEVERITIES` so both surfaces share it.
- **Open consideration (store submission, not this build):** if Roasted contains profanity, the current **9+ age rating** ([[ios-app-store-state]]) is too low — Apple requires 12+/17+ for profanity, and Google's IARC questionnaire will raise the rating. At submission: answer the profanity content question truthfully and accept the higher rating, OR gate profanity behind an explicit opt-in. Flagged here so it isn't forgotten; out of scope for this feature.

## Architecture / files

- **Create:** `components/onboarding/TasteTheRoast.tsx` — the taste tile. Owns the mood-tap → clip → burn-level interaction and the audio playback. Self-contained; props limited to an `onContinue` callback (advance to pricing) so it's testable/embeddable.
- **Modify:** `app/onboarding.tsx` — insert `<TasteTheRoast/>` as the middle page of the carousel; bump the pager from 2 → 3 dots; add the pricing-bridge line.
- **Modify:** `lib/insult-severity.ts` — add an optional `warning?: string` to `SeverityOption` (set on the `roast` tier); both the taste tile and `SeveritySheet` render it.
- **Modify:** `components/SeveritySheet.tsx` — render the new `warning` under the Roasted row.
- **Reuse (no change):** `lib/moods.ts`, `lib/insult-cache.ts`, `lib/insult-library.ts`, `lib/storage.ts` (`getCoachVoice`/`setInsultSeverity`/`getInsultSeverity`), `expo-audio`.

A small pure helper (e.g. `pickTasteClip(manifest, voice, tier, rng)`) wrapping `pickClip` keeps clip selection unit-testable and lets the tile stay focused on UI.

## Testing

- **Unit (vitest):** clip selection (`pickTasteClip` returns a clip for a present voice+tier, null when absent) and the severity `warning` wiring (`roast` has it, others don't). `pickClip` already has `rng` injection for determinism.
- **On-device (local debug build, Metro, no EAS):** tap each mood → a line appears; **▶ hear it** plays the matching clip; changing burn level re-rolls + persists (verify the setting sticks in Settings afterward); Roasted shows the disclaimer; offline → ▶ hidden, text still shows; "This is my coach →" advances to pricing.

## Open items for spec review

1. Voice default — Rachel (approved) vs. featuring a punchy paid personality (Deadpan Cynic) as an upsell tease. Currently: Rachel.
2. Whether the bridge line lives on the taste CTA hand-off or atop the pricing tile (minor; pick during implementation).
