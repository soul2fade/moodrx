# Voiced Insult Delivery (Phase 1) — Design Spec

**Date:** 2026-06-12
**Status:** Approved design, pre-plan.
**Sub-project 1 of 3** in the "voiced trash-talk app-side wiring" build (full scope chosen by owner):
1. **Delivery (this spec)** — host the library + fetch/cache playback, swapping the 15 bundled clips for the 960-clip library.
2. **Control** (later spec) — the severity "bite" slider + the Settings voice picker.
3. **Commerce** (later spec) — RevenueCat voice-pack entitlements.

Each phase gets its own spec → plan → implementation. This spec covers **Delivery only**.

## Context

The offline pipeline (`docs/superpowers/specs/2026-06-12-insult-library-pipeline-design.md`) has produced a curated, fully-voiced library: **5 voices × 3 tiers × 192 lines = 960 mp3 clips + a manifest** (`scripts/insult-library/output/`, gitignored, ~82 MB). The app today plays **15 hardcoded bundled clips** at random during a workout when "trash talk" is toggled on (`app/workout.tsx`: `INSULT_AUDIO` array, `insultIdxRef`, `insultPlayer`). Phase 1 replaces that hardcoded set with the hosted library, delivered remotely and cached on-device, while keeping the 15 bundled clips as an offline fallback.

## Goals

- Serve the library from **static CDN hosting** (no per-fetch serverless cost; immutable files cache hard).
- Play clips that **feel bundled-fast** via aggressive on-device caching + background prefetch.
- **Never produce silence**: if the manifest or a clip can't be fetched, fall back to the 15 bundled clips.
- Keep the app slim (82 MB stays on the CDN, never in git or the app bundle).
- Be **forward-compatible** with Phase 2 (voice + tier become user-chosen) and Phase 3 (pack gating) without rework.

## Non-goals (deferred to later phases / out of scope)

- The severity "bite" sheet and the Settings voice picker (Phase 2). Phase 1 uses a **fixed default voice + tier**.
- RevenueCat voice-pack gating / purchase (Phase 3). Phase 1 serves all voices' files statically; only the default voice is actually played.
- The live Pro-gated post-workout roast (separate, live-TTS piece — unrelated).
- Cache eviction / size-capping (not needed at this scale; see Hosting/Cost note). Revisit only if the cache footprint becomes a problem.

## Architecture

```
[build]   scripts/insult-library/output/  (audio/ + insult-library.json)
   │  netlify deploy --dir=...output --prod   (one-time / on content change)
   ▼
[CDN]     https://<assets-site>.netlify.app/  → insult-library.json, audio/<voice>/<tier>/<id>.mp3
   │  fetch + cache
   ▼
[app]     lib/insult-library.ts  (manifest fetch+cache, clip download+cache, prefetch, pick)
   │
   ▼
[screen]  app/workout.tsx  → plays the local cached file via the existing insultPlayer
                            → falls back to the bundled INSULT_AUDIO on any failure
```

### Component 1 — Static hosting + upload
- Deploy the **contents of `scripts/insult-library/output/`** as static files to a **dedicated Netlify assets site** (keeps 82 MB off the api/function site and out of git). Result: a CDN base URL, e.g. `https://moodrx-assets.netlify.app/`.
- URL contract (the manifest already stores relative paths):
  - Manifest: `${BASE}/insult-library.json`
  - Clip: `${BASE}/${entry.file}` where `entry.file = "audio/<voice>/<tier>/<id>.mp3"`
- Upload command (owner-run; an npm script + short runbook is added):
  `npx netlify deploy --dir=scripts/insult-library/output --prod` (linked to the assets site).
- The CDN base URL is read from app config: **`EXPO_PUBLIC_INSULTS_BASE_URL`** (so it's swappable without a code change). If unset/empty → the app stays on the bundled fallback (graceful).

### Component 2 — On-device delivery module (`lib/insult-library.ts`)
A new, focused module. Public surface:
- `Manifest` / `VoiceLibrary` / `ClipEntry` types (mirror the manifest wire shape — the app does not import from `scripts/`).
- `validateManifest(raw): raw is Manifest` — shape guard (version, format, voices map).
- `fetchManifest(): Promise<Manifest | null>` — GET `${BASE}/insult-library.json`; on success validate + write a copy to `${documentDirectory}insults/insult-library.json` and return it; on network failure read the cached copy if present; else `null`.
- `pickClip(manifest, voice, tier, rng?): ClipEntry | null` — **pure**; returns a random entry from `manifest.voices[voice]?.tiers[tier]`, or `null` if absent. `rng` injectable for tests.
- `clipUri(entry, voice, tier): Promise<string | null>` — local path `${documentDirectory}insults/audio/<voice>/<tier>/<id>.mp3`; if the file exists return it; else `downloadAsync(${BASE}/${entry.file})` → return the local path; on failure → `null`.
- `prefetchTier(manifest, voice, tier): void` — fire-and-forget; downloads all not-yet-cached clips for that voice×tier with a small concurrency cap. Best-effort; failures are swallowed (playback still downloads on demand).
- `remoteUrl(file)` / `cachePath(voice, tier, id)` — **pure** URL/path builders (unit-tested).

### Component 3 — Workout-screen integration (`app/workout.tsx`)
- Phase-1 constants: `DEFAULT_VOICE = 'rachel'`, `DEFAULT_TIER = 'sticks'` (transient — Phase 2 supplies the user's chosen voice + severity).
- On trash-talk **on**: `fetchManifest()` once (cached), then `prefetchTier(manifest, voice, tier)`.
- On each insult cue (the existing trigger points): `pickClip` → `clipUri`; if it returns a local uri, set `insultAudioSrc` to that uri (the existing `insultPlayer` already plays a source + volume). If manifest is `null` or `clipUri` is `null`, fall back to the existing **bundled `INSULT_AUDIO`** random pick (kept exactly as today).
- The bundled `INSULT_AUDIO` array, `insultPlayer`, volume handling, and on/off toggle are **unchanged** except for where the source comes from.

## Data flow (happy path)
1. User toggles trash talk on → `fetchManifest()` (cached after first time) → `prefetchTier(rachel, sticks)` kicks off in the background.
2. Insult cue fires → `pickClip(manifest, rachel, sticks)` → `clipUri(entry)` → file already prefetched → returns local uri instantly → `insultPlayer` plays it.
3. Subsequent cues are instant (cached). Offline next session: cached manifest + cached clips still play.

## Error handling / fallback
- No `EXPO_PUBLIC_INSULTS_BASE_URL`, manifest fetch fails with no cache, voice/tier missing, or a clip download fails → **bundled `INSULT_AUDIO`** is used. There is never a silent insult cue.
- `prefetchTier` failures are non-fatal (on-demand `clipUri` still tries per clip).
- All file-system / network calls are wrapped; a thrown error degrades to the fallback, never crashes the workout screen.

## Testing
Pure logic via **vitest** (the project's convention — RN/expo verified on-device, not in vitest):
- `validateManifest` — accepts a good manifest, rejects null/missing-field/wrong-type.
- `pickClip` — deterministic with an injected `rng`; returns `null` for an unknown voice/tier; never returns an entry from the wrong tier.
- `remoteUrl` / `cachePath` — correct URL + local-path construction from `(voice, tier, id)` / `entry.file`, including base-URL join (no double slashes).
- Fallback selection logic (choose-remote-else-bundled) — pure helper unit-tested.
- expo-audio / expo-file-system / the `workout.tsx` wiring are verified **on-device** at the Phase-2/build step.

## Existing code this builds on / touches
- `app/workout.tsx` — `INSULT_AUDIO` (becomes fallback), `insultPlayer`, `insultAudioSrc`, `insultIdxRef`, trash-talk toggle. Source selection changes; player/volume/toggle unchanged.
- `scripts/insult-library/output/insult-library.json` — the wire contract the app consumes (voices → tiers → `{id,text,file}`, `format`, `version`; **no `voiceId`** — app never calls ElevenLabs).
- `lib/storage.ts` pattern (AsyncStorage) — only if a cached-manifest-timestamp is wanted later; not required for v1.
- **expo-file-system `~19.0.23`** (already installed) for download + cache, and **expo-audio `~1.1.1`** (already used) for playback. NOTE: expo-file-system 19 (SDK 54) reworked its API — the implementation must use the v19 surface (the new `File`/`Directory`/`Paths` API, or the back-compat `expo-file-system/legacy` import for `downloadAsync`/`documentDirectory`), NOT the pre-19 top-level legacy names. The plan resolves which to use; the function names in Component 2 (`downloadAsync`, `documentDirectory`) are illustrative of behavior, not a locked API.

## Owner-ops steps (not agent-buildable)
- Create the Netlify **assets site** (or pick an existing one) and run the deploy command to publish `output/`.
- Set `EXPO_PUBLIC_INSULTS_BASE_URL` to that site's URL in `.env` / EAS env before the build.

## Open decisions — resolved
1. **Hosting:** static CDN (Netlify static deploy), not Blobs+function — fastest/most-reliable for immutable audio; Blobs only wins for server-side paid-voice gating, judged overkill (hash URLs, non-sensitive audio).
2. **Default voice/tier (Phase 1):** `rachel` / `sticks` — transient until Phase 2.
3. **Fallback:** keep the existing 15 bundled clips; used on any fetch failure.
4. **Cache:** persist downloaded clips + manifest in `documentDirectory`; no eviction in v1 (footprint ≈ a few MB per used voice×tier).

## Success criteria
- With `EXPO_PUBLIC_INSULTS_BASE_URL` set and the library deployed, toggling trash talk plays **Rachel `sticks` clips from the hosted library**, cached after first play (instant + offline-capable on relaunch).
- With the URL unset or the network down, trash talk still plays the **bundled 15** — never silent.
- 82 MB stays on the CDN — not in git, not in the app bundle.
- Pure-logic units pass under vitest; typecheck + lint clean. Forward-compatible: Phase 2 only needs to supply `(voice, tier)` from user state instead of the constants.
