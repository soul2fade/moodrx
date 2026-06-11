# Voice-First Venting — Design Spec

**Date:** 2026-06-11
**Status:** Approved design, pre-plan
**Decision context:** v1 launch intentionally delayed to fold this in as the flagship (see memory `voice-venting-flagship`). All store/RevenueCat/privacy launch config from 2026-06-11 is done and waiting on this feature + the single production build.

## Summary

A new, **standalone** voice-first entry point — a sibling to the existing "Need to breathe first? →" link on Home. The user taps once, talks for ~20 seconds, and the app: (1) transcribes on-device, (2) sends the **transcript** (never audio) to a backend that uses Claude to infer the user's mood + intensity *and* write an in-character "Dr. MoodRx" reply, (3) shows the reply as instant catharsis, (4) logs the inferred mood+intensity as a normal data point so personalization keeps growing, and (5) optionally hands off into the existing prescription/workout flow.

Hook: *"Vent for 20 seconds, get talked off the ledge by an idiot who loves you."* Demo-able differentiator tailored to the short-form-video distribution channel.

The mood check-in **form is NOT removed** — voice venting is an additional front door, exactly like the breathe link. The form remains for users who can't/won't talk aloud (accessibility, public spaces, noise) and as the offline/failure fallback.

## Goals

- Lowest-friction emotional check-in in the category: one tap, talk, done.
- Preserve the structured data model — every vent yields a quantified mood (one of the 6 mood types) + intensity (1–10), tagged `source: 'vent'`, feeding insights/prescriptions/personalization.
- Deliver immediate in-character catharsis (the reply) before any workout ask.
- Free for everyone (no paywall on the help itself), with bounded cost/abuse exposure.
- Well-calibrated crisis safety that does NOT eject normal venters to a crisis screen.

## Non-goals (v1 scope guardrail)

- **No saved audio.** On-device STT produces a transcript; audio is never recorded, stored, or transmitted.
- **No multi-turn conversation.** Single shot: one vent → one reply.
- **No spoken/voice reply.** Text reply only.
- **No removal of the mood form.** Form stays as alternative + fallback.
- No new mood taxonomy — map to the existing 6 moods (`anxious | low | foggy | restless | stressed | good`) + intensity 1–10.

## Architecture

### Entry point
A subtle link on Home next to "Need to breathe first? →" ([app/home.tsx:461](../../app/home.tsx)), above the safety-net link, same styling. Label: **"Need to vent? →"**. Routes to a new `/vent` screen (`app/vent.tsx`). The mood form and all other Home affordances are unchanged.

### `/vent` screen — four states
1. **Invite** — large mic button: *"Tap and talk. 20 seconds. Dr. MoodRx is listening."*
2. **Recording** — on-device speech recognition runs; live partial transcript renders; ~20s soft target, hard auto-stop ~30s, tap-to-stop early.
3. **Thinking** — instant in-character placeholder while the transcript is sent to the backend. Never blocks more than a few seconds; on timeout/error → graceful fallback (see Failure handling).
4. **Reply** — the in-character coach line (catharsis) + a small **tappable** mood chip ("Sounds like: stressed · 7/10") for one-tap correction, then two actions: **"Get my prescription →"** (into the existing prescription/workout flow with the inferred mood+intensity) or **"I'm good"** (end).

### Speech-to-text (on-device)
A native on-device speech-recognition module (Expo-compatible — exact module chosen in planning, e.g. `expo-speech-recognition`). Produces a transcript only. Requires microphone + speech-recognition permissions (Info.plist usage strings on iOS, `RECORD_AUDIO` on Android). **This native addition is the only reason the feature touches the production build.**

### Backend — new Netlify function `vent-line`
Sibling to the existing `coach-line` function ([netlify/functions/coach-line.ts](../../netlify/functions/coach-line.ts)). Differences from `coach-line`:
- **No RevenueCat entitlement gate** — this feature is free. Abuse/cost is bounded by **per-device rate limit + hard global daily budget cap + kill switch** (reuse the Netlify Blobs counter scaffolding already built for the coach).
- Input: the transcript (+ optional anonymous RC app-user-id for rate-limiting only; no audio).
- Model: **`claude-haiku-4-5`** (same as coach; ~$0.002/vent; A/B to `claude-sonnet-4-6` only if Haiku can't infer mood or hold voice).
- **Structured output** (forced schema): `{ mood: <enum of 6>, intensity: <int 1–10>, reply: <string, 1–2 sentences>, risk: 'none' | 'elevated' | 'acute' }`.
- System prompt carries: the Dr. MoodRx persona, the 6-mood taxonomy + intensity rubric, tone-by-severity rules (reuse coach rules — never roast at distress), and the crisis grading definitions + few-shot anchors (see Crisis safety).
- Deploys independently of the app build.

### Mood inference → data
On a successful reply, log an inferred mood+intensity data point through the existing session/check-in mechanism (the same store the mood form and `bad-day` flow write to — `useSessions`/`SessionsContext`), tagged `source: 'vent'`. Exact record shape (a workout-less check-in vs. a session stub) is an implementation detail for the plan; `bad-day` logging a session is precedent. The tappable mood chip lets the user correct the inferred mood/intensity before it's persisted.

### Crisis safety (calibrated, graded)
Crisis is **graded, not boolean**, because only a context-aware model reliably separates hyperbole/frustration from real risk:

- **`none`** — normal venting (anger, sadness, hyperbole, profanity, "I hate my job"). → normal in-character reply, no interruption.
- **`elevated`** — heavy distress, no self-harm intent (hopelessness, "what's the point," overwhelmed). → model drops teasing, gives a **warm supportive** reply, plus a **small dismissible** "want to talk to someone? →" inline affordance. **No takeover, no redirect.**
- **`acute`** — genuine self-harm/suicidal ideation or intent. → **only this** routes to the existing crisis screen ([app/crisis.tsx](../../app/crisis.tsx) / safety-net path). Skips the reply and the workout upsell.

**Keyword backstop:** narrow, high-precision list of unambiguous self-harm phrasings. It can only **escalate the floor** (force at least `elevated`) as a guard against a model under-flag — it can **never** unilaterally trigger the crisis-screen takeover (that requires the model to independently return `acute`). No single word ("kill", "die") forces anything.

**Bias:** ambiguous cases resolve to `elevated` (gentle inline resource), never to a screen takeover. A missed `acute` is mitigated by the inline resource being one tap away in `elevated`.

**Calibration:** the grading prompt + few-shot anchors live server-side (in the function), tunable and re-deployable **without an app build**. Because transcripts are never stored, calibration is measured against an **internal eval set written during implementation** (realistic vents across the spectrum), so the false-positive (over-redirect) rate is measured before launch.

### Failure / offline handling
If STT is unavailable, the transcript is empty, or the backend errors/times out → fall back gracefully to the existing tap mood-form check-in with a brief note ("Couldn't catch that — tap it in instead"). Offline-first is never broken; the vent path is an enhancement, not a dependency.

## Privacy, consent & store declarations

This sends a transcript of free-form mental-state venting off-device — the most sensitive data the app handles — so it reopens the declarations locked on 2026-06-11.

- **No audio leaves the device** (on-device STT → text). So no "Audio" data category; the *content* is mental-state data, covered by the **Health** declaration already added for the coach (collected, not shared, optional/opt-in, App functionality).
- **First-run consent** (chosen over a buried off-by-default toggle): first tap on "Need to vent?" shows a one-time disclosure — *"This sends your words to our AI to write a response. It's not stored or used to train AI. Tap to continue."* One tap, honest, preserves the hook. A Settings toggle allows disabling later (defaults on after consent).
- **Reopen before submission:** privacy policy gets a "Voice Venting" section; re-verify iOS App Privacy + Android Data Safety wording still matches (Health declaration should cover it); add microphone usage strings (Info.plist + Android manifest).

## What lands in the single production build

- **Native (build-gated):** on-device speech-recognition module + mic/speech permissions.
- **App:** `/vent` screen, vent client lib, vent→mood logging, first-run consent, Home link, fallback wiring.
- **Backend:** new `vent-line` function (deployable anytime, no build).
- **Store/privacy:** privacy-policy redeploy + re-verify both stores' declarations.

## Risks & mitigations

- **Crisis false positives** (over-redirect) → graded tiers + `acute`-only redirect + narrow keyword backstop + pre-launch eval set measuring the rate.
- **Crisis false negatives** (missed `acute`) → keyword floor-escalation + inline resource always present at `elevated`.
- **Open-endpoint cost/abuse** (free, ungated) → per-device rate limit + hard global daily budget cap + kill switch (fall back to a generic static reply when capped).
- **Mood mis-inference degrading data** → tappable correction chip before persistence.
- **STT quality/availability variance** → graceful fallback to the mood form; on-device preferred for privacy.
- **One-shot build risk** (new native dep on the otherwise-ready launch build) → covered by pre-build verification before building.

## Success criteria

- Tap → talk → in-character reply round-trips on-device in a few seconds, with the static placeholder shown instantly.
- Every completed vent persists a corrected-or-confirmed mood + intensity (`source: 'vent'`).
- Crisis eval set: normal/elevated vents do **not** trigger the crisis-screen redirect; acute cases do.
- No audio is ever transmitted or stored (verified).
- Free for all users; global budget cap demonstrably bounds spend.
- Offline/failure falls back to the form without data loss.

## Open items for the plan

- Choose the on-device STT module (Expo config-plugin compatible) and confirm offline recognition behavior per platform.
- Exact persisted record shape for a workout-less vent check-in (reuse vs. extend the sessions store).
- Author the crisis-grading system prompt + few-shot anchors + the internal eval set.
- Structured-output schema wiring on Haiku 4.5 (`output_config.format`), reply temperature for variety.
