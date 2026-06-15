# Voice-Vent App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The `/vent` screen task additionally uses **frontend-design** for the UI, and is verified by typecheck + lint here (real device verification is Plan 7's on-device E2E — STT cannot run under Node/CI).

**Goal:** Ship the app side of voice-first venting — a standalone `/vent` screen (tap → talk ~20s → on-device transcript → backend `vent-line` infers mood+intensity and writes a Dr. MoodRx reply → instant catharsis → correctable mood chip → log + optional prescription handoff), the native on-device speech-recognition module + permissions, first-run consent, the Home "Need to vent? →" link, and graceful fallback to the existing mood form.

**Architecture:** A new pure module `lib/vent.ts` (response validation, crisis routing, the vent check-in record) carries the TDD-able logic. `lib/vent-client.ts` calls the already-deployed `vent-line` function, attaching the per-mood episode map from `buildVentEpisodeMap` (Plan 2). The `app/vent.tsx` screen drives a four-state machine over `expo-speech-recognition` (on-device), routes by graded risk via `ventAction` (only `acute` → crisis screen), logs through the existing `useSessions` store tagged `source:'vent'`, and falls back to the mood form on any failure. The backend (`vent-line` + crisis grading + eval) is already done (Plan 1).

**Tech Stack:** TypeScript, Expo SDK 54, `expo-speech-recognition` (jamsch — native iOS SFSpeechRecognizer / Android SpeechRecognizer, on-device, config-plugin), `react-native-purchases` (anon app-user-id for rate-limiting), vitest (pure logic only). The RN screen/native config is verified by typecheck + lint + on-device (Plan 7), per the project's RN testing posture.

**Spec:** `docs/superpowers/specs/2026-06-11-voice-venting-design.md`. The `vent-line` backend, crisis grading, keyword backstop, and eval set are already built (`docs/superpowers/plans/2026-06-11-vent-line-backend.md`).

**Build-critical note:** EAS credits are exhausted — exactly one final build (Plan 7). Native correctness here (the STT module config + the strip-plugin fix) must be right the first time; it cannot be device-verified until that build. Task 1 handles the one subtle trap: the existing `plugins/withStripUnusedAudioPermissions.js` strips `RECORD_AUDIO`, which voice venting now genuinely needs.

---

### Task 1: Native — add on-device speech recognition; stop stripping `RECORD_AUDIO`

Install the STT module, register its config plugin (sets iOS usage strings + Android `RECORD_AUDIO` + speech-service `<queries>`), and fix the strip plugin so the now-used microphone permission survives the Android manifest merge. No EAS build here — that's Plan 7.

**Files:**
- Modify: `package.json` (+ lockfile, via `expo install`)
- Modify: `app.json`
- Modify: `plugins/withStripUnusedAudioPermissions.js`

- [ ] **Step 1: Install the module (Expo-pinned version)**

Run: `npx expo install expo-speech-recognition`
Expected: adds `expo-speech-recognition` to `package.json` dependencies at the version Expo pins for SDK 54, updates the lockfile. No native build is triggered.

- [ ] **Step 2: Register the config plugin in `app.json`**

In `app.json`, the `expo.plugins` array currently ends with `"@bacons/apple-targets"` then `"./plugins/withStripUnusedAudioPermissions"`. Insert the speech-recognition plugin entry **before** `"./plugins/withStripUnusedAudioPermissions"` (so the strip plugin still runs last). Add this array element:

```json
      [
        "expo-speech-recognition",
        {
          "microphonePermission": "MoodRx uses the microphone only while you're venting, to turn your words into text on your device.",
          "speechRecognitionPermission": "MoodRx transcribes your venting on your device so you can talk instead of typing. Audio is never saved.",
          "androidSpeechServicePackages": ["com.google.android.googlequicksearchbox"]
        }
      ],
```

So the tail of the plugins array becomes:

```json
      "@bacons/apple-targets",
      [
        "expo-speech-recognition",
        {
          "microphonePermission": "MoodRx uses the microphone only while you're venting, to turn your words into text on your device.",
          "speechRecognitionPermission": "MoodRx transcribes your venting on your device so you can talk instead of typing. Audio is never saved.",
          "androidSpeechServicePackages": ["com.google.android.googlequicksearchbox"]
        }
      ],
      "./plugins/withStripUnusedAudioPermissions"
```

(The config plugin writes `NSMicrophoneUsageDescription` + `NSSpeechRecognitionUsageDescription` into the iOS Info.plist and adds `RECORD_AUDIO` + the speech-service `<queries>` to the Android manifest. We do NOT hand-edit `ios.infoPlist` for these — the plugin owns them.)

- [ ] **Step 3: Stop the strip plugin from removing `RECORD_AUDIO`**

In `plugins/withStripUnusedAudioPermissions.js`, the `PERMISSIONS_TO_REMOVE` array removes `RECORD_AUDIO`. Voice venting now uses the microphone (on-device STT), so it must survive. Change the array from:

```js
const PERMISSIONS_TO_REMOVE = [
  'android.permission.RECORD_AUDIO',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'com.google.android.gms.permission.AD_ID',
];
```

to:

```js
// RECORD_AUDIO is intentionally NOT stripped: voice venting (on-device STT via
// expo-speech-recognition) genuinely uses the microphone. Audio is never stored
// or transmitted — only an on-device transcript leaves the recorder. The other
// permissions remain unused and are still removed. (Play Data Safety must now
// reflect microphone use — handled in the privacy/store-declaration plan.)
const PERMISSIONS_TO_REMOVE = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'com.google.android.gms.permission.AD_ID',
];
```

Also update the file's top-of-file comment block: change the line documenting `RECORD_AUDIO → no recording feature (microphone)` to note it is now KEPT for voice venting (so the file's docs don't contradict the behavior). Specifically, replace the comment line:

```js
//   RECORD_AUDIO                       → no recording feature (microphone)
```

with:

```js
//   (RECORD_AUDIO is KEPT — voice venting uses on-device STT; see array below)
```

- [ ] **Step 4: Verify config integrity (no build)**

Run: `node -e "const a=require('./app.json').expo.plugins; const has=JSON.stringify(a).includes('expo-speech-recognition'); if(!has) throw new Error('speech plugin missing'); const strip=require('./plugins/withStripUnusedAudioPermissions.js'); console.log('speech plugin registered:', has);"`
Expected: prints `speech plugin registered: true` with no throw.

Run: `node -e "const s=require('fs').readFileSync('plugins/withStripUnusedAudioPermissions.js','utf8'); if(/'android.permission.RECORD_AUDIO'/.test(s.split('PERMISSIONS_TO_REMOVE')[1]||'')) throw new Error('RECORD_AUDIO still stripped'); console.log('RECORD_AUDIO no longer stripped');"`
Expected: prints `RECORD_AUDIO no longer stripped`.

Run: `npm run typecheck`
Expected: no errors (the dep adds types; nothing imports it yet).
Run: `npm test`
Expected: all suites still green (unchanged).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app.json plugins/withStripUnusedAudioPermissions.js
git commit -m "feat(vent): add on-device speech recognition; keep RECORD_AUDIO for mic use"
```

---

### Task 2: `lib/vent.ts` pure logic + `Session.source` field (TDD)

The TDD-able heart of the app side: validate the backend response, map graded risk → UI action, and build the workout-less vent check-in record. All pure, vitest-tested under Node.

**Files:**
- Modify: `lib/storage.ts`
- Create: `lib/vent.ts`
- Test: `lib/__tests__/vent.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/vent.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseVentResponse, ventAction, buildVentSession } from '@/lib/vent';

describe('parseVentResponse', () => {
  const ok = { mood: 'stressed', intensity: 7, reply: 'You showed up.', risk: 'none' };

  it('accepts a well-formed response', () => {
    expect(parseVentResponse(ok)).toEqual(ok);
  });
  it('clamps/rounds intensity and trims reply', () => {
    expect(parseVentResponse({ ...ok, intensity: 7.6, reply: '  hi  ' })).toEqual({
      mood: 'stressed', intensity: 8, reply: 'hi', risk: 'none',
    });
    expect(parseVentResponse({ ...ok, intensity: 0 })?.intensity).toBe(1);
    expect(parseVentResponse({ ...ok, intensity: 99 })?.intensity).toBe(10);
  });
  it('rejects bad mood, non-finite intensity, empty reply, bad risk, non-object', () => {
    expect(parseVentResponse({ ...ok, mood: 'sad' })).toBeNull();
    expect(parseVentResponse({ ...ok, intensity: NaN })).toBeNull();
    expect(parseVentResponse({ ...ok, reply: '   ' })).toBeNull();
    expect(parseVentResponse({ ...ok, risk: 'panic' })).toBeNull();
    expect(parseVentResponse(null)).toBeNull();
    expect(parseVentResponse('nope')).toBeNull();
  });
});

describe('ventAction', () => {
  it('routes only acute to the crisis screen', () => {
    expect(ventAction('none')).toBe('reply');
    expect(ventAction('elevated')).toBe('reply-with-resource');
    expect(ventAction('acute')).toBe('crisis-redirect');
  });
});

describe('buildVentSession', () => {
  it('builds a workout-less check-in tagged source:vent (postScore = intensity)', () => {
    const s = buildVentSession({ id: 'v1', mood: 'low', intensity: 6, timestamp: 1234 });
    expect(s).toEqual({
      id: 'v1',
      mood: 'low',
      intensity: 6,
      postScore: 6,
      workoutName: 'Vent',
      duration: 0,
      timestamp: 1234,
      lightDay: true,
      source: 'vent',
    });
  });
  it('spreads captured health fields when provided', () => {
    const s = buildVentSession({
      id: 'v2', mood: 'anxious', intensity: 8, timestamp: 9,
      health: { stepsToday: 5000, sleepHoursLastNight: 7 },
    });
    expect(s.stepsToday).toBe(5000);
    expect(s.sleepHoursLastNight).toBe(7);
    expect(s.source).toBe('vent');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- vent.test`
Expected: FAIL — cannot import from `@/lib/vent`.

- [ ] **Step 3: Add `source` to `Session` in `lib/storage.ts`**

In `lib/storage.ts`, the `Session` interface has optional fields (`note?`, `lightDay?`, `localDateString?`). Add a `source` field alongside them — find:

```ts
  lightDay?: boolean;
```

and add directly after it:

```ts
  lightDay?: boolean;
  /** Origin of the check-in. 'vent' = logged from the voice-vent flow. Absent
   *  for the normal prescription/form/quick-log paths. Additive + optional, so
   *  old records remain valid. */
  source?: 'vent';
```

(Do not change `sanitizeSession` etc. — the field is optional and passes through.)

- [ ] **Step 4: Create `lib/vent.ts`**

```ts
import type { MoodKey, Session, SessionHealthFields } from '@/lib/storage';

export type Risk = 'none' | 'elevated' | 'acute';

export interface VentAssessment {
  mood: MoodKey;
  intensity: number; // 1–10
  reply: string;
  risk: Risk;
}

// MUST match lib/storage MoodKey and the vent-line function's MOOD_KEYS.
const MOODS: MoodKey[] = ['anxious', 'low', 'foggy', 'restless', 'stressed', 'good'];
const RISKS: Risk[] = ['none', 'elevated', 'acute'];

/** Validate/normalize the vent-line JSON response. Returns null on any shape
 *  error so callers fall back to the mood form. (vent-line already validates
 *  server-side; this guards the client against a malformed/changed payload.) */
export function parseVentResponse(raw: unknown): VentAssessment | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const reply = typeof o.reply === 'string' ? o.reply.trim() : '';
  if (typeof o.mood !== 'string' || !MOODS.includes(o.mood as MoodKey)) return null;
  if (typeof o.intensity !== 'number' || !Number.isFinite(o.intensity)) return null;
  if (typeof o.risk !== 'string' || !RISKS.includes(o.risk as Risk)) return null;
  if (reply.length === 0) return null;
  const intensity = Math.min(10, Math.max(1, Math.round(o.intensity)));
  return { mood: o.mood as MoodKey, intensity, reply, risk: o.risk as Risk };
}

export type VentAction = 'reply' | 'reply-with-resource' | 'crisis-redirect';

/** Graded crisis routing: only 'acute' takes over to the crisis screen;
 *  'elevated' shows a warm reply with a small inline resource; 'none' is a
 *  normal reply. (The reply tone itself is set by the model server-side.) */
export function ventAction(risk: Risk): VentAction {
  if (risk === 'acute') return 'crisis-redirect';
  if (risk === 'elevated') return 'reply-with-resource';
  return 'reply';
}

/** The workout-less check-in a completed vent persists. Mirrors the quick-log
 *  shape (postScore = intensity, lightDay, duration 0) so it doesn't distort
 *  improvement stats, and tags source:'vent'. Pure — caller supplies id,
 *  timestamp, and optional captured health fields. */
export function buildVentSession(args: {
  id: string;
  mood: MoodKey;
  intensity: number;
  timestamp: number;
  health?: SessionHealthFields;
}): Session {
  return {
    id: args.id,
    mood: args.mood,
    intensity: args.intensity,
    postScore: args.intensity,
    workoutName: 'Vent',
    duration: 0,
    timestamp: args.timestamp,
    lightDay: true,
    source: 'vent',
    ...(args.health ?? {}),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- vent.test`
Expected: PASS — all parseVentResponse / ventAction / buildVentSession cases.

- [ ] **Step 6: Full suite + typecheck + lint + commit**

Run: `npm test` (all green), `npm run typecheck` (clean), `npm run lint:ci` (clean).

```bash
git add lib/storage.ts lib/vent.ts lib/__tests__/vent.test.ts
git commit -m "feat(vent): pure vent logic (response parse, crisis routing, check-in record)"
```

---

### Task 3: `lib/vent-client.ts` + consent/enable storage flags

The network client (mirrors `lib/coach-client.ts`) that POSTs the transcript + episode map to the deployed `vent-line` function and returns a validated assessment or `null`. Plus the consent + enable flags. RN code (imports `react-native-purchases`) — verified by typecheck + lint, not vitest (the pure parsing it relies on is already tested in Task 2).

**Files:**
- Create: `lib/vent-client.ts`
- Modify: `lib/storage.ts`

- [ ] **Step 1: Add consent + enable flags to `lib/storage.ts`**

Mirror the existing `getAiCoachEnabled`/`setAiCoachEnabled` pattern (search for `AI_COACH_KEY` in `lib/storage.ts`). Add near it:

```ts
const VENT_CONSENT_KEY = '@moodrx_vent_consent';
const VENT_ENABLED_KEY = '@moodrx_vent_enabled';

/** One-time first-run consent for voice venting (sending the transcript to the
 *  AI). Gates the first tap on "Need to vent?". */
export async function getVentConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(VENT_CONSENT_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setVentConsent(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(VENT_CONSENT_KEY, value ? 'true' : 'false');
  } catch {
    // non-critical
  }
}

/** Settings toggle to disable voice venting after consent (defaults ON once
 *  consent is given — absence of the key is treated as enabled). */
export async function getVentEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VENT_ENABLED_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export async function setVentEnabled(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(VENT_ENABLED_KEY, value ? 'true' : 'false');
  } catch {
    // non-critical
  }
}
```

Add `VENT_CONSENT_KEY` and `VENT_ENABLED_KEY` to the `AsyncStorage.multiRemove([...])` list inside `clearAllData()` (so "Reset all data" clears them too) — find the `multiRemove` array and add both keys to it.

- [ ] **Step 2: Create `lib/vent-client.ts`**

This mirrors `lib/coach-client.ts` (read it first for the exact patterns: `AbortController` timeout, `Purchases.getAppUserID()`, returning `null` on any failure). It attaches the per-mood episode map from `buildVentEpisodeMap` (Plan 2 — wired here for the first time).

```ts
import Purchases from 'react-native-purchases';
import { getSessions } from '@/lib/storage';
import { buildVentEpisodeMap } from '@/lib/coach-insight';
import { parseVentResponse, type VentAssessment } from '@/lib/vent';

/** Deployed Netlify function (free, ungated; same site as the coach). */
const VENT_ENDPOINT = 'https://moodrx-api.netlify.app/.netlify/functions/vent-line';
const TIMEOUT_MS = 8000; // STT + model; the screen shows a static placeholder meanwhile

/** Send a vent transcript; return a validated assessment, or null on
 *  offline/timeout/cap/any error (caller falls back to the mood form). */
export async function fetchVentReply(transcript: string): Promise<VentAssessment | null> {
  const text = transcript.trim();
  if (!text) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const [deviceId, sessions] = await Promise.all([
      Purchases.getAppUserID().catch(() => 'anon'),
      getSessions().catch(() => []),
    ]);
    const episodes = buildVentEpisodeMap(sessions);
    const res = await fetch(VENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: text, deviceId, episodes }),
      signal: controller.signal,
    });
    if (!res.ok) return null; // 400/429 (capped)/5xx → fall back to the form
    return parseVentResponse(await res.json());
  } catch {
    return null; // offline, timeout (abort), parse error
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 3: Typecheck + lint + full suite**

Run: `npm run typecheck` (clean — confirm `buildVentEpisodeMap` and `parseVentResponse` import cleanly), `npm run lint:ci` (clean), `npm test` (unchanged, green).

- [ ] **Step 4: Commit**

```bash
git add lib/vent-client.ts lib/storage.ts
git commit -m "feat(vent): vent client (episode map + validated reply) and consent flags"
```

---

### Task 4: `app/vent.tsx` — the four-state voice screen

The screen: Invite → Recording → Thinking → Reply, over `expo-speech-recognition` (on-device), with graded crisis routing, a tappable mood-correction chip, vent→session logging, first-run consent, and graceful fallback. This is RN/UI work — **use the frontend-design skill** for the presentation, but implement the integration/logic contract below exactly. Verified by typecheck + lint; device behavior (mic, STT, crisis redirect) is Plan 7's on-device E2E.

**Files:**
- Create: `app/vent.tsx`

- [ ] **Step 1: Read the references**

Read these for exact existing patterns to match (styling, navigation, store usage, crisis screen):
- `app/bad-day.tsx` — a comparable single-purpose flow that logs a check-in and uses `useHardwareBack`, `useSessions`, dark styling.
- `app/crisis.tsx` — the crisis screen this redirects to (note its route path and any params it expects).
- `app/post-workout.tsx` — how `useSessions().addSession` is called and how the prescription handoff / navigation works.
- `lib/moods.ts` (`MOODS[mood].name`/`.color`) for rendering the mood chip; `lib/health.ts` `captureSessionHealth`.

- [ ] **Step 2: Implement the screen to this contract**

State machine (`type VentState = 'invite' | 'recording' | 'thinking' | 'reply' | 'error'`):

1. **Consent gate (on mount / first entry):** if `await getVentConsent()` is false, show the one-time disclosure first: *"This sends your words to our AI to write a response. It's not stored or used to train AI."* with a single **"Got it — let's go"** button that calls `setVentConsent(true)` then proceeds to `invite`. (After consent, subsequent visits skip straight to `invite`.) If `getVentEnabled()` is false, the screen shouldn't be reachable — but guard anyway by routing back.

2. **Invite:** large mic button — *"Tap and talk. 20 seconds. Dr. MoodRx is listening."* On tap → request permission and start recognition:
   ```ts
   const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
   if (!perm.granted) { fallbackToForm("MoodRx needs the mic to hear you — tap it in instead"); return; }
   setState('recording');
   ExpoSpeechRecognitionModule.start({
     lang: 'en-US',
     interimResults: true,
     continuous: false,
     requiresOnDeviceRecognition: true, // privacy: audio never leaves the device
     addsPunctuation: true,
   });
   ```

3. **Recording:** wire `useSpeechRecognitionEvent`:
   - `'result'` → keep the latest `event.results[0]?.transcript` in state (live partial display).
   - `'end'` → recognition stopped (either user tapped stop, the ~30s hard cap fired, or natural end) → transition to `submit` (Step: send transcript).
   - `'error'` → `fallbackToForm("Couldn't catch that — tap it in instead")`.
   Show a tap-to-stop control (`ExpoSpeechRecognitionModule.stop()`), a soft ~20s hint, and a hard auto-stop timer (~30s) that calls `.stop()`. Clear timers on unmount; stop recognition on unmount.

4. **Submit / Thinking:** on `'end'` with a non-empty transcript → `setState('thinking')`, show an **instant** in-character placeholder line immediately (e.g. a static "Let me hear you out…" — never blank), then `const assessment = await fetchVentReply(transcript)`. If `null` → `fallbackToForm("Couldn't reach Dr. MoodRx — tap it in instead")`. If the transcript was empty at `'end'` → fallback too.

5. **Route by risk** using `ventAction(assessment.risk)`:
   - `'crisis-redirect'` (acute) → `router.replace('/crisis')` (match the actual crisis route/params from `app/crisis.tsx`). Do NOT show the reply or the workout upsell. Skip logging the upsell, but DO still persist the mood data point (a vent that surfaced acute risk is still a real check-in) — log via Step 6 before redirecting. (If `crisis.tsx` is a modal/replace, follow its established invocation in the codebase.)
   - `'reply-with-resource'` (elevated) → show the reply (Reply state) PLUS a small, dismissible inline affordance: **"Want to talk to someone? →"** linking to the same crisis/resources route. No takeover.
   - `'reply'` (none) → show the reply normally.

6. **Persist the data point** (for `reply` and `reply-with-resource`, and also before the acute redirect): capture health and log through the store:
   ```ts
   const health = await captureSessionHealth();
   const session = buildVentSession({
     id: createSessionId(),
     mood: corrected?.mood ?? assessment.mood,
     intensity: corrected?.intensity ?? assessment.intensity,
     timestamp: Date.now(),
     health,
   });
   await addSession(session); // from useSessions()
   ```
   Persist AFTER any correction is applied (see Step 7). Persist exactly once per completed vent.

7. **Reply state UI:**
   - The reply line (catharsis), prominent, in Dr. MoodRx styling.
   - A **tappable mood chip**: `Sounds like: {MOODS[mood].name} · {intensity}/10`. Tapping opens a lightweight correction control (reuse the existing mood selector / intensity stepper patterns from `app/home.tsx` if practical, or a compact inline picker) that updates a local `corrected` state. The data point is persisted using the corrected values (Step 6) — so wire persistence to fire when the user leaves the screen via either action, using the latest corrected values.
   - Two actions: **"Get my prescription →"** → navigate into the existing prescription flow with `{ mood, intensity }` (match `app/home.tsx`'s `router.push({ pathname: '/prescription', params: {...} })`), and **"I'm good"** → go Home. Both persist the (corrected) data point first if not already.

8. **`fallbackToForm(note)` helper:** navigate to the mood-form entry (Home with the panel, or wherever the form lives) carrying a brief toast/note. Never lose the user — offline/failure always lands on the form. (If there's no param channel for the note, a simple `Alert`/toast then route Home is acceptable.)

**Imports** (representative): `expo-speech-recognition` (`ExpoSpeechRecognitionModule`, `useSpeechRecognitionEvent`), `expo-router` (`router`), `@/lib/vent` (`ventAction`, `buildVentSession`), `@/lib/vent-client` (`fetchVentReply`), `@/lib/storage` (`getVentConsent`, `setVentConsent`, `getVentEnabled`), `@/lib/health` (`captureSessionHealth`), `@/lib/session-utils` (`createSessionId`), `@/contexts/SessionsContext` (`useSessions`), `@/lib/moods` (`MOODS`).

**Discipline:** the screen must compile and lint clean. Don't invent backend behavior — `fetchVentReply` returns the validated assessment or null. Crisis routing is `ventAction`-driven (acute-only takeover). Always provide the static placeholder during `thinking` (never a blank/spinner-only). Stop recognition + clear timers on unmount.

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck`
Expected: no errors.
Run: `npm run lint:ci`
Expected: clean.
Run: `npm test`
Expected: unchanged, green (the screen has no vitest; it must not break the build).

- [ ] **Step 4: Commit**

```bash
git add app/vent.tsx
git commit -m "feat(vent): /vent four-state voice screen with graded crisis routing"
```

---

### Task 5: Home "Need to vent? →" link + Settings toggle

Surface the entry point next to the existing "Need to breathe first? →" link, gated by consent/enable, and add a Settings toggle to disable voice venting.

**Files:**
- Modify: `app/home.tsx`
- Modify: the Settings screen (find it — likely `app/settings.tsx` or under `app/(tabs)`/a settings route)

- [ ] **Step 1: Add the Home link**

In `app/home.tsx`, find the existing "Need to breathe first? →" link (around line 461 per the spec; search for `breathe`). Add a sibling **"Need to vent? →"** link with the same styling/placement (above the safety-net link). On press, route to `/vent`:

```tsx
<Pressable onPress={() => router.push('/vent')} /* match the breathe link's style/props */>
  <Text /* same style as the breathe link text */>Need to vent? →</Text>
</Pressable>
```

Render it only when voice venting is enabled — read `getVentEnabled()` once (e.g., in the same effect that loads other Home prefs) into local state and conditionally render the link. (Do NOT gate on consent here — consent is collected on first tap inside `/vent`, preserving the hook; gate only on the Settings `enabled` flag.)

- [ ] **Step 2: Add the Settings toggle**

Locate the Settings screen that renders the existing AI-coach opt-in toggle (search for `getAiCoachEnabled`/`setAiCoachEnabled`). Add a sibling toggle for voice venting using `getVentEnabled`/`setVentEnabled`, labeled e.g. **"Voice venting"** with a one-line subtitle *"Talk it out; we transcribe on your device and never save audio."* Match the existing toggle row's component/pattern exactly.

- [ ] **Step 3: Typecheck + lint + full suite + commit**

Run: `npm run typecheck` (clean), `npm run lint:ci` (clean), `npm test` (green).

```bash
git add app/home.tsx <the settings file>
git commit -m "feat(vent): Home 'Need to vent?' link + Settings toggle"
```

---

## Self-Review

**1. Spec coverage (`2026-06-11-voice-venting-design.md`):**
- Standalone `/vent` entry next to the breathe link → Task 5 (link) + Task 4 (screen). ✓
- Four states (Invite/Recording/Thinking/Reply) → Task 4 contract. ✓
- On-device STT, transcript only, no audio off-device → Task 1 (`expo-speech-recognition`) + `requiresOnDeviceRecognition: true` (Task 4). ✓
- Backend `vent-line` (free, episodes, structured output, crisis grading) → already done (Plan 1); wired via `fetchVentReply` (Task 3), now attaching `buildVentEpisodeMap` (Plan 2). ✓
- Mood inference → logged data point tagged `source:'vent'`, correctable via chip → `buildVentSession` (Task 2) + the chip + persist-after-correction (Task 4). ✓
- Graded crisis: none→reply, elevated→reply+inline resource, acute-only→crisis screen → `ventAction` (Task 2) + routing (Task 4). Keyword backstop / acute determination is server-side (Plan 1). ✓
- First-run consent (chosen over buried toggle) + later Settings toggle → `getVentConsent`/`setVentConsent` + `getVentEnabled`/`setVentEnabled` (Task 3), consent gate (Task 4), toggle (Task 5). ✓
- Failure/offline → graceful fallback to the mood form; offline-first never broken → `fetchVentReply` returns null on any failure; `fallbackToForm` (Task 4). ✓
- Permissions (mic + speech; iOS usage strings, Android RECORD_AUDIO) → Task 1 config plugin; the strip-plugin fix keeps RECORD_AUDIO. ✓
- "No audio leaves the device" success criterion → on-device flag + transcript-only client payload. ✓

**2. Spec "open items" resolved:** STT module = `expo-speech-recognition` (SDK-54, on-device, config-plugin) — Task 1; persisted vent record shape = workout-less quick-log clone tagged `source:'vent'` (`buildVentSession`) — Task 2; crisis prompt/anchors/eval + structured output = already done server-side (Plan 1). ✓

**3. Correctly out of scope / deferred:** privacy-policy "Voice Venting" section redeploy + re-verify iOS App Privacy / Android Data Safety (now incl. microphone) + the single EAS build + on-device E2E → **Plan 7** (and flagged in Task 1's strip-plugin comment). The insights "noticed" UI is Plan 6.

**4. Placeholder scan:** Tasks 1–3 are fully verbatim (config, pure logic, client). Task 4 (the screen) is an integration **contract** with the exact lib calls + STT lifecycle + routing/logging code, with presentation latitude (frontend-design) — appropriate for a large creative UI surface that can only be truly verified on-device (Plan 7); it is not a vague "build the screen" placeholder. Task 5 specifies exact links/toggles with "match the existing pattern" anchors (the precise file lines are discovered by the implementer via the given search terms, since Home/Settings line numbers drift).

**5. Type consistency:** `Risk`/`VentAssessment`/`VentAction` are defined in `lib/vent.ts`; `parseVentResponse` returns `VentAssessment | null`; `fetchVentReply` returns the same; `ventAction(risk)` consumes `Risk`. `buildVentSession` returns a `Session` (with the new optional `source?: 'vent'` from `storage.ts`) and spreads `SessionHealthFields` (Plan 4). `buildVentEpisodeMap` (Plan 2) feeds the `episodes` payload `vent-line` already accepts (Plan 2 Task 5). `MOODS`/`MoodKey` order matches `lib/storage` and the vent-line `MOOD_KEYS`. Storage flag helpers mirror the existing `getAiCoachEnabled`/`setAiCoachEnabled` shape.
