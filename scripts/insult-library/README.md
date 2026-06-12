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
