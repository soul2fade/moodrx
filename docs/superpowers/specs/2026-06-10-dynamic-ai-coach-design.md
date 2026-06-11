# Dynamic Dr. MoodRx Coach — Design (v1)

**Date:** 2026-06-10
**Status:** Draft for review (brainstorm output)
**Scope:** Make the Dr. MoodRx coach speak DYNAMICALLY (via an AI call) at the **post-workout moment**, enhancing — never replacing — the existing static line system. Offline-first, opt-in, gated to paying users. **Post-launch feature** — do not build before v1 ships (monetization redesign is on PR #33, unmerged). Companion memory: `ai-coach-feature`.

---

## 1. Context & problem

Today the coach line comes from a **static lookup**: `useDrMoodRxLine(mood, moment)` → `getInsult()` picks a random pre-written line by mood + `moment` (`pre`/`mid`/`post`), from `constants/insults.ts` (roast tone) or `constants/coach-lines.ts` (gentler tone). Static lines run dry and never reference the user's actual data. Goal: have the coach speak to the user's *real* computed patterns — infinite freshness + personalization — without breaking the offline-first, on-device design.

## 2. Goals

- At the **post-workout moment only**, replace the static line with a dynamic, in-character line generated from the user's real, app-computed facts.
- True-data only — the model is fed facts and forbidden from inventing any.
- Enhancement, not replacement: static line shows instantly; dynamic swaps in if available; static stays on any failure/offline.
- Two user-chosen tones (teasing / roasting) with a narrow crisis-safety floor.
- Pay for itself and protect margin: gated to entitled users, rate-limited, hard budget cap.
- Opt-in, with the privacy-policy / store-declaration changes that sending data off-device requires.

## 3. Non-goals (v1) — explicitly deferred

- `pre`/`mid` workout moments, the Insights "case file", a daily briefing surface — **static stays** there. (Post-launch expansion candidates.)
- Sonnet upgrade (start on Haiku), conversational/multi-turn coach, selling it as a separate pack.
- Any change to the existing static-line content or the `pre`/`mid` flow.

## 4. Behavior / UX

- On the **post-workout screen** (`app/post-workout.tsx`), the static line renders **instantly** via the existing path (zero wait, no spinner).
- If **all** of these hold — trash-talk enabled, AI-coach opt-in ON, device online, user entitled — the screen fires one background request and **swaps in** the dynamic line when it returns (short timeout, e.g. 4s).
- On offline / timeout / error / over-budget / not-entitled → the static line simply remains. The coach never blocks, never shows an error.
- The dynamic line is **cached in memory for that post-workout view** so re-renders don't re-call. One call per completed workout, max.

## 5. Components (small, single-purpose units)

1. **`lib/coach-insight.ts` (on-device, pure):** `buildCoachContext(session, sessions)` → a small plain object of TRUE facts: today's `mood`, `intensity`, `postScore`, the delta (`postScore − intensity`), the workout name, this workout's effectiveness for this mood (`getWorkoutEffectiveness`), the best pattern (`getBestPatternCallout`), and recent trend (from `getLastNDays`). No AI, no network. This object is the single source of truth passed to the function.
2. **`lib/coach-client.ts` (on-device):** `fetchDynamicLine(context, tone, appUserId)` → POSTs to the Netlify function with a short timeout; returns the line or `null` on any failure. Knows nothing about API keys.
3. **Post-workout integration:** the post-workout screen shows the static line, then (if eligible) calls `fetchDynamicLine` and swaps the text. The existing `useDrMoodRxLine` (used by `pre`/`mid`) is untouched.
4. **Netlify function `netlify/functions/coach-line.ts` (server):** the ONLY place with the Anthropic key. Steps: verify entitlement → check rate limit + budget → build persona system prompt from the tone + facts → call Claude → return `{ line }`.
5. **Settings:** a new **"AI coach" opt-in toggle** (default OFF), separate from the existing trash-talk toggle/volume.

## 6. Facts sent to the function (the only data that leaves the device)

A compact JSON object, e.g.: `{ mood, intensity, postScore, delta, workoutName, workoutHelpedRate, bestPattern, recentTrend, tone }`. No raw notes, no identifiers beyond the RevenueCat app-user-id (sent for entitlement verification). Numbers are pre-computed on-device; the model may not introduce new numbers.

## 7. Netlify function contract

- **Request:** `{ context, tone, appUserId }`.
- **Auth/entitlement:** call RevenueCat's REST API (`GET /v1/subscribers/{appUserId}` with the **RevenueCat secret key** from function env) and confirm the base-unlock `premium` entitlement is active. If not → `403` → client falls back to static.
- **Rate limit + budget:** using **Netlify Blobs** as the counter store — a per-app-user daily cap and a global monthly spend cap. Over either cap → return `204`/`429` → client falls back to static. (Protects margin: a one-time $9.99 unlock can never cause unbounded API cost.)
- **Model call:** `claude-haiku-4-5`, `max_tokens: 150`, `temperature: 0.9`, no thinking/effort. System prompt = persona + tone + safety rules (§8); user content = the facts object.
- **Response:** `{ line: string }` on success; non-200 / empty on any gate failure.
- **Endpoint is narrow:** it accepts only the facts shape and returns only a coach line — never a free-form prompt passthrough.

## 8. Tone & safety

- **Two tones, user-chosen**, derived from the existing trash-talk volume (lower half → **teasing**, upper half → **roasting**). Roasting is sharper and funnier but, by system-prompt definition, **lighthearted** — it ribs the user's *resistance/excuse to work out*, never the person's worth, body, or anything self-harm-adjacent.
- **No everyday softening.** Anxious/low/foggy/etc. are normal mood picks; the user opted into the tone, so the coach uses the full chosen tone for them.
- **Crisis floor (the one override):** when signals indicate **genuine crisis-level distress** (e.g. max-intensity combined with a sustained downward streak, or states in the territory that already routes to the crisis screen), the coach pulls its punch for that single line regardless of chosen tone — not therapist-soft, just "doesn't kick someone who's actually down." It never bypasses or replaces the existing crisis screen. Rationale: dynamic lines aren't human-vetted like the static ones, opting into roasting on a normal day isn't consent to be roasted in a crisis, and app reviewers scrutinize crisis handling in mental-health apps.
- **System-prompt hard rules (every call):** stay in the Dr. MoodRx voice; use ONLY the provided facts; NEVER invent statistics or numbers; NEVER give clinical labels, diagnoses, or medical advice; 1–2 sentences; honor the crisis floor.

## 9. Privacy & compliance

- **Opt-in, default OFF.** A dynamic line only fires when the user has explicitly enabled the AI-coach toggle (separate from trash-talk).
- Sending mood facts off-device **changes the current "data never leaves the device" promise.** Before shipping: update the privacy policy (name what's sent — mood/intensity/derived facts — to the function + Anthropic, and that it's only for opted-in users), and revise **Play Data Safety** + **App Store privacy labels** to reflect the new transmission. ([[privacy-policy-url]])
- Facts are minimal and contain no free-text notes; the app-user-id is RevenueCat's anonymous id, used only for entitlement verification.

## 10. Gating

- The dynamic coach is a **base-unlock (Pro)** capability, verified server-side via the RevenueCat entitlement check (§7). This both authenticates the caller and aligns cost with revenue. Not a separate pack in v1.

## 11. Error handling / fallback (the safety net)

Every failure path → **show the static line** (already on screen): offline, request timeout, function `403` (not entitled), `429`/`204` (rate/budget), 5xx, malformed response, or AI-coach toggle off. The app must be fully functional with the function unreachable.

## 12. Model & cost

`claude-haiku-4-5` ($1/$5 per 1M in/out) — ~$0.001/call. ~150 output tokens. Prompt caching not applicable (system prompt below the cacheable minimum). A/B against `claude-sonnet-4-6` only if Haiku can't hold the voice.

## 13. Dependencies

- Netlify env vars: `ANTHROPIC_API_KEY`, RevenueCat **secret** REST key.
- Netlify Blobs (for rate-limit / budget counters).
- Client access to the RevenueCat app-user-id (`Purchases.getAppUserID()` / customerInfo) — already present via `react-native-purchases`.
- Anthropic TypeScript SDK (`@anthropic-ai/sdk`) in the function, model `claude-haiku-4-5`.

## 14. Risks / open items

- **Margin** on a one-time-purchase feature with per-call cost — handled by per-user rate limit + global budget cap (§7).
- **Crisis-signal definition** — the exact threshold for the crisis floor needs concrete rules in the plan (intensity threshold + streak length). Defined at implementation.
- **Voice quality on Haiku** — validate during build; Sonnet is the fallback.
- **Verify before shipping:** RevenueCat REST entitlement-check shape and Netlify Blobs usage against current vendor docs.

## 15. Out of scope / future roadmap

`pre`/`mid` and other surfaces going dynamic; a daily briefing; conversational coach; Sonnet; selling as a pack; richer personalization. All post-v1.
