# Voiced Insult Library — Generation Pipeline Design Spec

**Date:** 2026-06-12
**Status:** Approved design, pre-plan. **No external blocker** — the voices are ElevenLabs voices (premade/Voice-Library), not a recording of a real person, so there is NO cloning, consent, or 30-min-audio requirement. The owner is on the Creator plan (commercial license). The only prep is choosing the voice(s) + confirming each is commercial-cleared.
**Decision context:** Owner wants the AI trash-talk *spoken* in the same voice as the 15 pre-recorded insults. Live per-insult TTS is incompatible with MoodRx's **$9.99 one-time** pricing (recurring, user-scaling cost vs a one-time fee). So the during-workout trash talk is delivered from a **pre-generated, pre-voiced library** (one-time build cost, $0 marginal at runtime). This spec covers the **offline pipeline** that builds that library. (The personalized **post-workout** roast — voiced live, Pro-gated — is a separate, later piece.)

## Summary

A re-runnable **offline dev tool** (a `scripts/` CLI, not app runtime) that, per intensity tier, generates AI-written insult **text** in the Dr. MoodRx voice, gates it through a **human review step**, then voices the approved lines via **ElevenLabs** (the cloned voice) into audio files + a manifest the app plays during workouts. It evolves the fixed 15 clips into a large, expandable, AI-written, her-voiced set — without any live API cost at runtime.

## Goals

- Produce a library of voiced insults across the 3 severity tiers (glass house / sticks & stones / roast me) that match the existing recorded voice.
- **$0 runtime cost**: all generation + TTS happen offline; the app serves cached audio.
- **Safe + on-brand**: every line passes the existing no-violence/weapon/self-harm guardrail AND a human review before it's voiced (TTS credits are only spent on approved lines).
- **Re-runnable / incremental**: top up the library later without regenerating or re-voicing existing lines.

## Non-goals

- The live post-workout roast voicing (separate; personalized → live TTS, Pro-gated).
- The app-side playback UI / the severity slider (separate plan; this spec defines only the **library + manifest contract** the app consumes).
- Voice cloning itself (done in the ElevenLabs dashboard; the pipeline just consumes a `voice_id`).

## Architecture — three phases (text → review → voice)

```
[generate]  Claude (Haiku) → candidate insult TEXT per tier → review file (status: pending)
   ↓  (human reviews texts, marks approved / rejected — cheap, no TTS spent yet)
[voice]     ElevenLabs TTS (cloned voice) on APPROVED+unvoiced lines → mp3 + manifest entry
   ↓
[output]    audio files + insult-library.json  →  consumed by the app at the chosen tier
```

Splitting **generate** from **voice** is deliberate: comedic insults can go off-brand or cross the line, so a human approves the **text** before any credits are spent voicing it.

### Component 1 — Insult text generation (Claude)
- For each tier, call Claude (Haiku, reuse `MOODRX_COACH_KEY`) to produce a batch of short insults (1–2 sentences, ~≤180 chars) in the Dr. MoodRx film-noir persona at that intensity.
- **Reuse the shared guardrail**: the same "no violence/weapon/self-harm imagery, not even as metaphor" rule already in `netlify/functions/lib/vent-grading.ts` / `coach-prompt.ts` MUST be in this generation prompt. (Factor the guardrail text into a shared constant so the three surfaces can't drift.)
- Tier voice guidance: glass house = gentle ribbing; sticks & stones = standard; roast me = sharper but still lighthearted, never cruel about worth/body.
- **Dedup** against already-generated lines (normalize + compare) so re-runs add novelty.

### Component 2 — Human review gate
- Phase 1 writes candidates to a review file (`scripts/insult-library/<tier>.review.json`) with `status: 'pending'`.
- A human edits each entry's status to `approved` or `rejected` (and may tweak the text). Rejected/edited lines never silently ship.
- Only `approved` + not-yet-voiced lines proceed to Phase 2.

### Component 3 — TTS (ElevenLabs, cloned voice)
- `POST /v1/text-to-speech/{voice_id}` with the approved text; use the **low-latency/Flash model** (≈half the credit cost) — runtime quality on phone speakers doesn't need the top model.
- Output **mp3, modest bitrate (~96–128 kbps mono)** so each clip is small (the app already has an asset-size sensitivity — see the soundscape-size lesson).
- Key + voice id come from env (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`); never hardcoded.
- Save audio; append a manifest entry; mark the review entry `voiced: true` so re-runs skip it (idempotent).

### Output — files + manifest (the app's consumption contract)
- Audio: `assets/audio/insults/<tier>/<id>.mp3` (or an uploaded CDN/Blobs path — see open decision).
- Manifest: `insult-library.json` —
  ```json
  { "tiers": { "glass-house": [{ "id": "...", "text": "...", "file": "..." }], "sticks": [...], "roast": [...] } }
  ```
- The app loads the manifest, and during a workout plays random clips from the **selected tier** (replacing the fixed 15). The 15 existing clips remain as an **offline/fallback** set.

## Hosting (open decision — recommend remote)
A few-hundred-clip library bundled in the app would balloon its size (we just fought ~10 MB of soundscapes). **Recommended: host the audio + manifest remotely** (Netlify Blobs or a CDN), fetched + cached on-device on first use, with a **small bundled starter set** (e.g. the existing 15) as offline fallback. Alternative: bundle everything (simpler, no network, larger app). Decide before the app-side plan.

## Env / secrets
- `MOODRX_COACH_KEY` (existing) — Claude.
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` (new) — used by the script only; not shipped in the app.

## Cost (one-time build)
- Generation: Claude Haiku, fractions of a cent per line — negligible.
- Voicing: ElevenLabs credits ≈ characters (Flash ≈ half). A 300-line library × ~150 chars ≈ ~45k characters ≈ fits one month of the **Creator** tier (121k credits) or ~2 months of **Starter** (30k). I.e. a **~$11–22 one-time** spend, after which the subscription can be cancelled and runtime cost is **$0**. Top-ups are similarly cheap.

## Multiple voices + monetization (decided 2026-06-12)

The "voice" is an **ElevenLabs voice** (premade/Voice-Library), NOT a recording of a real person — so **no cloning, no consent, no 30-min audio**. The pipeline just consumes a `voice_id`. Owner is on the **Creator** plan ($11/mo first month; has commercial license + 121k credits + pay-as-you-go).

- **2–3 selectable voices, user picks** (a "Coach voice" picker in Settings). Run the pipeline **once per voice** → a library per (voice × tier). Cost scales one-time with voice count (~45k chars/voice; 3 voices ≈ 135k ≈ ~1 month of Creator, less with the Flash model). Runtime cost stays $0 (cached audio).
- **Monetization = freemium voice packs** (fits the `$9.99 one-time base + content packs` model): **one default voice FREE**, additional voices as **one-time IAP packs via RevenueCat** (new entitlements; RevenueCat already wired). Because the audio is pre-generated/cached, free-vs-paid is a pure product choice — $0 to serve either way.
- **Per-voice commercial clearance** is required: ElevenLabs *premade* voices are commercial-OK on a paid plan; *Voice Library* (community) voices vary — verify each one's terms (premade safest). Note: you are selling **your generated audio content**, not the voice — users never touch ElevenLabs (allowed under the Creator commercial license).
- Manifest gains a voice dimension: `{ voices: { "<voiceName>": { voice_id, free: bool, tiers: { ... } } } }`. The app filters to owned/free voices.

## Open decisions for the plan
1. **Hosting**: remote-fetch+cache (recommended) vs bundled.
2. **Library size** per tier to start (e.g. 50–100) and tier count (3, matching the slider).
3. **Which voices** (names + `voice_id`s), which one is the free default, and pack pricing for the rest.
4. **During-workout library access** — free to all, or also gated? (The live post-workout roast stays Pro-gated regardless; the cached library is $0 to serve so it *can* be free.)

## Success criteria
- Running the pipeline produces, per tier, approved + voiced clips + a valid manifest, with no un-reviewed line ever voiced.
- Every generated line passes the shared no-violence/self-harm guardrail.
- Re-running is idempotent (skips already-voiced lines; only adds novelty).
- The voiced clips are indistinguishable in voice from the existing 15 recorded insults (the whole point of cloning *her*).
- Zero runtime API cost: the app plays cached library audio, no live calls during workouts.

## Existing code this builds on / touches
- `netlify/functions/lib/vent-grading.ts` + `coach-prompt.ts` — the no-violence guardrail (factor into a shared constant the pipeline reuses).
- `scripts/eval-vent.ts` — existing `tsx` script pattern to mirror for the CLI.
- `assets/audio/insults/insult_01–15.mp3` — current fixed clips → become the fallback/starter set.
- `app/workout.tsx` — the insult playback (the app-side consumer; its integration is a separate plan).
