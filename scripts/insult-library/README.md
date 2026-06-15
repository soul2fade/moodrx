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
`"approved"` or `"rejected"`. Only `approved` lines are ever voiced — no
un-reviewed line spends credits. **Don't edit a line's `"text"` in place** —
its `"id"` (and audio filename) is derived from the original text and is not
recomputed, and a later re-generate would no longer dedup against the edit. To
change a line, `"rejected"` it and let the next `insults:generate` propose a
fresh one.

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
The app-side **severity sheet** + **voice picker** (Phase 2 of the app wiring) and
**RevenueCat voice packs** (Phase 3); plus the live Pro-gated post-workout roast.
(Phase 1 — static hosting + on-device fetch/cache playback — is covered in the
Hosting section below.)

## Hosting (Phase 1 — static CDN)

The app fetches the library from a static CDN and caches it on device. Host the
**contents of `output/`** (the `audio/` tree + `insult-library.json`) on a
**dedicated Netlify site** (keeps the ~82 MB off git and off the function site).

One-time setup (owner):
1. Create a Netlify site for assets (e.g. `moodrx-assets`) — `npx netlify sites:create` or the dashboard.
2. Deploy the built library to it:
   ```
   npx netlify deploy --dir scripts/insult-library/output --site <assets-site-id> --prod
   ```
   (Run `npm run insults:deploy` for a preview deploy first; add `--site` + `--prod` to publish.)
3. Set the app env var to the site's URL, in `.env` and EAS:
   ```
   EXPO_PUBLIC_INSULTS_BASE_URL=https://<assets-site>.netlify.app
   ```

The manifest is then at `${BASE}/insult-library.json` and clips at
`${BASE}/audio/<voice>/<tier>/<id>.mp3`. Re-deploy after topping up the library
(`insults:voice`). If the env var is unset, the app silently uses the bundled
fallback clips.
