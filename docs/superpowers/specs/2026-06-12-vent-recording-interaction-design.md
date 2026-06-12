# Voice-Vent Recording Interaction — Design Spec

**Date:** 2026-06-12
**Status:** Approved design, pre-plan
**Decision context:** On-device E2E of build 111 (Play Internal testing) revealed the vent recorder **cuts the user off after their first thought** — it finalizes on ~2s of OS silence detection. For a venting feature, being cut off mid-thought is the worst possible failure: it makes the user feel unheard, the opposite of the emotional goal. This redesign makes the recorder wait for the *user* to be done, with a calm silence check-in instead of a guess. Ships in the next batched app build (alongside the readability pass and any other E2E findings — see the `voice-venting-flagship` memory).

## Problem

`app/vent.tsx` starts STT with `continuous: false`, which hands the end-of-recording decision to the OS's end-of-speech silence timer (~2s on Android). Result: a natural "gathering my next thought" pause ends the recording and submits a half-formed vent. Secondary issues: the 30s hard cap is short, and the in-flow prompts would feel like alarms if built as `Alert.alert()`.

## Goals

- The recorder never ends on a *normal* pause — it waits for the user to signal they're done.
- When silence genuinely stretches, the app checks in *calmly* (reassures it's still listening; offers an easy exit) rather than guessing "done" or interrupting.
- The whole interaction feels like the app patiently leaning in, not tapping its foot or pinging an alert.

## Non-goals

- No change to STT engine, on-device transcription, the reply flow, crisis routing, mood-correction chip, or persistence.
- No change to the terminal-error fallbacks (mic denied, API failure) — those remain `Alert.alert` (they end the flow; they're not in-flow check-ins).
- No new screen or navigation.

## Design

### 1. Continuous listening (the core fix)
Start STT with **`continuous: true`**. The recognizer then listens *through* silences and never self-finalizes — the user (or our backstops) decide when it ends. The transcript **accumulates across pauses/segments** for the whole session (see Implementation note — this is the main technical risk).

### 2. Primary control: tap-to-finish
The existing **"■ DONE TALKING"** button stays the main way to end. Always visible. Tapping it stops STT and submits the captured transcript — unchanged behavior, it's just now the *intended* primary path rather than a fallback to the silence timer.

### 3. Hard cap → 60s
Raise the absolute backstop from 30s to **60s** (`HARD_STOP_MS` 30000 → 60000). Covers the "kept talking" case. It's a single constant, easy to tune.

### 4. Silence check-in — inline, not an alert
After **~12s of continuous silence** (no new speech results), a soft check-in **fades into the recording screen** (in-place; ~300ms opacity + slight upward drift; no backdrop, no OS chrome, transcript stays visible above it). It is an **inline component, NOT `Alert.alert()`** — the container and motion are what make it read as a calm presence rather than an alarm.

Content (calm line + a single quiet inline button):
- Line: **"Still here — take your time."**
- **"Keep going"** (emerald) → dismisses the check-in and keeps listening seamlessly (no re-tapping the mic).

Finishing is handled **solely** by the always-visible **"■ DONE TALKING"** button. The check-in deliberately does **not** offer its own "done" option — a second finish control next to DONE TALKING is redundant. The check-in is purely reassurance ("I'm still listening") plus a way to stay.

While the app waits out the 12s (and while the check-in is shown), the **live recording cues keep running** — the recording dot keeps pulsing, the timer keeps ticking, the transcript stays on screen — so the wait reads as "patiently listening," never "frozen."

### 5. Resume-on-speech
If the user starts talking again while the check-in is shown, it **auto-dismisses** and capture continues (new speech = implicit "keep going"). The silence timer resets on every speech result.

### 6. Walked-away backstop
If the check-in is shown and there's **no interaction and no new speech for a further ~15s** (≈27s total silence), the recording **auto-finishes gracefully** on the captured transcript (same as "I'm done"). The 60s hard cap remains the absolute ceiling regardless. This handles "put the phone down and wandered off" without hanging.

### 7. Empty-capture handling (unchanged)
If the recording ends (any path) with an empty transcript, keep the existing **"Couldn't catch that — tap it in instead"** fallback.

## The rhythm (summary)

talk → pause (keeps listening; dot pulsing, timer ticking) → ~12s of real silence → soft inline **"Still here — take your time"** fades in → **Keep going** (resume) / start talking again (auto-resume) / tap **DONE TALKING** to finish / ignore ~15s (graceful auto-finish) → 60s hard cap as the absolute ceiling.

## Timing constants

| Constant | Value | Meaning |
|---|---|---|
| `HARD_STOP_MS` | 60000 | Absolute max recording length. |
| `SILENCE_PROMPT_MS` | 12000 | Continuous silence before the check-in fades in. |
| `SILENCE_AUTOFINISH_MS` | 15000 | Further silence after the check-in shows → graceful auto-finish. |

(All three are single tunable constants in `app/vent.tsx`.)

## Implementation notes (for the plan)

- **Transcript accumulation is the main risk.** In `continuous: true` mode, Android can deliver speech as multiple segments and reset `event.results[0].transcript` per segment. The current `result` handler does `setTranscript(t2)` (replace). It must instead **accumulate** finalized segments so a long, multi-pause vent captures everything — not just the latest segment. Validate this explicitly on-device (it's the thing most likely to misbehave across the continuous boundary).
- **Silence tracking:** reset a silence timer on every `result` event; when it reaches `SILENCE_PROMPT_MS`, show the inline check-in; after a further `SILENCE_AUTOFINISH_MS` with no result/interaction, finish. Keep the `HARD_STOP_MS` timer independent as the ceiling.
- **New UI state:** a `showSilenceCheckin` boolean within the `recording` state (not a new top-level vent state). The check-in is an inline block above the DONE button.
- **Cleanup:** clear all three timers on stop/unmount/fallback (extend the existing `hardStopTimerRef` cleanup).
- **Reuse the existing dark visual language** (`#0a0a0a` screen, mono labels, emerald accent). The check-in is a thin top-hairline block, low-contrast text, two outline buttons — consistent with the rest of the vent screen. (Note: the broader app-wide readability/contrast pass is a separate batched item; this check-in should be built to the *improved* contrast targets, not the current dim greys.)

## Success criteria

- A vent with multiple natural pauses captures the *whole* thing (no early cut-off); verified on-device.
- The check-in only appears after sustained (~12s) silence, fades in inline (no alert/backdrop), and "Keep going" resumes capture without re-tapping the mic.
- Talking again after the check-in shows auto-resumes capture.
- A walked-away vent auto-finishes gracefully within ~27s of silence; nothing hangs; 60s is the hard ceiling.
- No regression to reply, crisis routing, mood-correction, or persistence.
