# Dynamic Dr. MoodRx Coach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> ⚠️ **DO NOT EXECUTE YET.** This is a **post-launch** feature. Build only after v1 ships (monetization PR #33 merged + app live). It also changes the privacy posture (mood data leaves the device), which requires the policy/store-declaration updates in Task 7 to land *before* a build that includes it.

**Goal:** At the post-workout moment, replace the static Dr. MoodRx line with a dynamic, AI-generated line built from the user's real on-device facts — opt-in, paid-gated, with a static fallback so the app never depends on the network.

**Architecture:** A pure on-device insight-builder assembles true facts → a thin client posts them to a Netlify function (the only holder of the Anthropic key) → the function verifies a RevenueCat entitlement, enforces rate/budget caps, calls `claude-haiku-4-5` with a persona+tone+safety system prompt, and returns one line. The post-workout screen shows the static line instantly and swaps in the dynamic one if it arrives.

**Tech Stack:** React Native/Expo (client), Netlify Functions + `@anthropic-ai/sdk` + Netlify Blobs (server), RevenueCat REST API (entitlement check), `claude-haiku-4-5`.

**Verification:** No test framework exists in this repo — verify with `npm run typecheck` + `npm run lint` + manual/dev checks. Do NOT add a test harness (matches repo convention). The pure units (`lib/coach-insight.ts`, the function's tone/crisis logic) are unit-testable if a harness is ever added — noted, not required.

**🔎 Verify against current vendor docs during implementation:** the RevenueCat REST subscriber/entitlement response shape, and the Netlify Blobs API. Both may have changed.

---

## File structure

**New:**
- `lib/coach-insight.ts` — pure: `buildCoachContext()` + `CoachContext` type + crisis-signal detection.
- `lib/coach-client.ts` — `fetchDynamicLine()` (network, timeout, fallback to null).
- `netlify/functions/coach-line.ts` — server: entitlement check, rate/budget caps, Anthropic call.
- `netlify.toml` — Netlify config (if not already present from Task 0).

**Modified:**
- `lib/storage.ts` — add `getAiCoachEnabled` / `setAiCoachEnabled` (mirror `getVoiceEnabled`); confirm `getTrashTalkVolume` exists for tone.
- `app/post-workout.tsx` — swap `postInsult` with the dynamic line when eligible.
- `app/settings.tsx` — new "AI coach" opt-in toggle (default OFF).
- `docs/privacy-policy.html` + `docs/play-health-and-data-safety.md` — privacy/data-safety updates.

---

## Task 0: Confirm/stand up Netlify Functions (prerequisite)

**Files:** `netlify.toml` (maybe new), `package.json` (devDep), Netlify site link.

- [ ] **Step 1: Establish the deploy target.** Confirm whether a Netlify site is actually linked to this repo with Functions enabled. (The repo currently has **no `netlify/` directory**, and the privacy policy is on GitHub Pages, so do not assume Netlify Functions exist.) Run:

Run: `npx netlify status`
Expected: shows a linked site, or "Not linked." If not linked, run `npx netlify link` (or `npx netlify init`) to connect/create the site. If the user prefers a different serverless host, stop and confirm — the rest of this plan assumes Netlify Functions.

- [ ] **Step 2: Add `netlify.toml`** at repo root (if absent):

```toml
[build]
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"
```

- [ ] **Step 3: Add the SDK as a dependency** the function needs:

Run: `npm install @anthropic-ai/sdk @netlify/blobs`
Expected: both added to `package.json` dependencies.

- [ ] **Step 4: Set function env vars** (Netlify dashboard → Site settings → Environment variables, or CLI):
  - `ANTHROPIC_API_KEY` — the Anthropic key (server-only).
  - `REVENUECAT_SECRET_KEY` — RevenueCat **secret** REST API key (server-only).

Run: `npx netlify env:list`
Expected: both keys present, not exposed to the client (no `EXPO_PUBLIC_` prefix).

- [ ] **Step 5: Commit** `netlify.toml` + the dependency additions:

```bash
git add netlify.toml package.json package-lock.json
git commit -m "chore(coach): netlify functions scaffolding + deps for AI coach"
```

---

## Task 1: Opt-in setting + tone derivation

**Files:** Modify `lib/storage.ts`; confirm `getTrashTalkVolume`.

- [ ] **Step 1: Add the AI-coach opt-in flag** to `lib/storage.ts`, mirroring the existing `getVoiceEnabled`/`setVoiceEnabled` pattern. Default OFF:

```ts
const AI_COACH_KEY = '@moodrx_ai_coach_enabled';

/** Opt-in for the dynamic AI coach. Default false — sending mood facts
 *  off-device is a separate consent from the trash-talk toggle. */
export async function getAiCoachEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(AI_COACH_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setAiCoachEnabled(value: boolean): Promise<void> {
  await AsyncStorage.setItem(AI_COACH_KEY, value ? 'true' : 'false');
}
```

- [ ] **Step 2: Confirm the tone source.** Grep for the trash-talk volume getter:

Run: `npx grep -rn "TrashTalkVolume" lib/ app/` (or use the editor search)
Expected: a `getTrashTalkVolume(): Promise<number>` (0–1). If the getter is named differently, use that name in Task 3's tone mapping. Do NOT add a new tone setting — tone rides on this existing value.

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck` → clean.
```bash
git add lib/storage.ts
git commit -m "feat(coach): add AI-coach opt-in storage flag (default off)"
```

---

## Task 2: Insight-builder (pure, on-device)

**Files:** Create `lib/coach-insight.ts`.

- [ ] **Step 1: Create `lib/coach-insight.ts`** with the context type, a crisis detector, and the builder. Facts come only from existing helpers + the current session's pre-score data (post-score is not yet entered when the post line renders):

```ts
import type { MoodKey, Session } from '@/lib/storage';
import type { Workout } from '@/lib/workouts';
import { getWorkoutEffectiveness, getBestPatternCallout } from '@/lib/workout-insights';
import { getLastNDays } from '@/lib/analytics';

export type CoachTone = 'teasing' | 'roasting';

export interface CoachContext {
  mood: MoodKey;
  intensity: number;          // pre-workout 0–10
  workoutName: string;
  /** How often this workout has helped this user for this mood, if rated. */
  workoutHelpedRate: string | null;   // e.g. "helped 3/4 times" or null
  /** The user's single strongest mood→workout pattern, if any. */
  bestPattern: string | null;          // e.g. "Low lifts most after Dance It Out"
  /** Short recent-trend descriptor over the last logged days. */
  recentTrend: 'improving' | 'flat' | 'declining' | 'new';
  /** True when signals suggest genuine distress — the coach pulls its punch. */
  crisis: boolean;
}

/** Crisis floor: only the extreme tail, NOT everyday low moods.
 *  High pre-intensity on a distress mood, with no recent improvement. */
function isCrisisSignal(mood: MoodKey, intensity: number, sessions: Session[]): boolean {
  const distressMood = mood === 'anxious' || mood === 'low' || mood === 'stressed';
  if (!distressMood || intensity < 9) return false;
  // No improvement in the last 2 rated sessions = downward/stuck.
  const recentRated = [...sessions].reverse().filter((s) => s.rating).slice(0, 2);
  const noneHelped = recentRated.length >= 2 && recentRated.every((s) => s.rating === 'no');
  return noneHelped;
}

function trend(sessions: Session[]): CoachContext['recentTrend'] {
  const days = getLastNDays(sessions, 5);
  if (days.length < 2) return 'new';
  const deltas = days.map((d) => d.postScore - d.intensity);
  const first = deltas[0];
  const last = deltas[deltas.length - 1];
  if (last - first > 0.5) return 'improving';
  if (first - last > 0.5) return 'declining';
  return 'flat';
}

export function buildCoachContext(
  args: { mood: MoodKey; intensity: number; workout: Workout | undefined },
  sessions: Session[],
): CoachContext {
  const { mood, intensity, workout } = args;
  const helped =
    workout != null ? getWorkoutEffectiveness(sessions, workout) : null;
  const workoutHelpedRate =
    helped && helped.ratedCount > 0 && helped.yesCount > 0
      ? `helped ${helped.yesCount}/${helped.ratedCount} times`
      : null;
  const best = getBestPatternCallout(sessions);
  return {
    mood,
    intensity,
    workoutName: workout?.name ?? 'that workout',
    workoutHelpedRate,
    bestPattern: best ? best.text : null,
    recentTrend: trend(sessions),
    crisis: isCrisisSignal(mood, intensity, sessions),
  };
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck` → clean (confirm `getWorkoutEffectiveness`, `getBestPatternCallout`, `getLastNDays` import correctly).
```bash
git add lib/coach-insight.ts
git commit -m "feat(coach): pure on-device insight-builder (true facts only)"
```

---

## Task 3: Coach client (network + fallback)

**Files:** Create `lib/coach-client.ts`.

- [ ] **Step 1: Create `lib/coach-client.ts`.** It derives the tone from the existing trash-talk volume, gets the RevenueCat app-user-id, POSTs with a 4s timeout, and returns the line or `null` on any failure:

```ts
import Purchases from 'react-native-purchases';
import { getTrashTalkVolume } from '@/lib/storage'; // confirm name in Task 1 Step 2
import type { CoachContext, CoachTone } from '@/lib/coach-insight';

// Set to the deployed function URL (Netlify). Keep in one place.
const COACH_ENDPOINT = 'https://<your-netlify-site>.netlify.app/.netlify/functions/coach-line';
const TIMEOUT_MS = 4000;

export async function resolveTone(): Promise<CoachTone> {
  const volume = await getTrashTalkVolume().catch(() => 0.5);
  return volume >= 0.5 ? 'roasting' : 'teasing';
}

/** Returns a dynamic coach line, or null on offline/timeout/any error.
 *  Callers must fall back to the static line on null. */
export async function fetchDynamicLine(context: CoachContext): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const [tone, appUserId] = await Promise.all([resolveTone(), Purchases.getAppUserID()]);
    const res = await fetch(COACH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, tone, appUserId }),
      signal: controller.signal,
    });
    if (!res.ok) return null; // 403 not-entitled, 429 capped, 5xx, etc.
    const data = (await res.json()) as { line?: string };
    return typeof data.line === 'string' && data.line.trim() ? data.line.trim() : null;
  } catch {
    return null; // offline, timeout (abort), parse error — fall back to static
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck` + `npm run lint` → clean.
```bash
git add lib/coach-client.ts
git commit -m "feat(coach): client with timeout + static-fallback semantics"
```

---

## Task 4: Netlify function (entitlement, caps, Anthropic call)

**Files:** Create `netlify/functions/coach-line.ts`.

- [ ] **Step 1: Create the function.** It is the only holder of the keys. Order: parse → verify RevenueCat entitlement → rate/budget caps via Netlify Blobs → Anthropic call with persona+tone+safety system prompt → return `{ line }`. Any gate failure returns a non-200 so the client falls back.

```ts
import type { Handler } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import Anthropic from '@anthropic-ai/sdk';

const PER_USER_DAILY_CAP = 25;
const GLOBAL_MONTHLY_CAP = 5000; // hard ceiling on total calls/month

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function isEntitled(appUserId: string): Promise<boolean> {
  // 🔎 verify shape against current RevenueCat REST docs before shipping
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${process.env.REVENUECAT_SECRET_KEY}` },
  });
  if (!res.ok) return false;
  const data = await res.json();
  const ent = data?.subscriber?.entitlements?.premium;
  if (!ent) return false;
  // Non-consumable base unlock: present + no expiry (or future expiry).
  return ent.expires_date == null || new Date(ent.expires_date).getTime() > Date.now();
}

function systemPrompt(tone: 'teasing' | 'roasting', crisis: boolean): string {
  if (crisis) {
    return `You are Dr. MoodRx, a darkly funny but ultimately caring fitness-for-mental-health coach. The user is showing signs of genuine distress right now. Drop the roasting entirely. In 1-2 sentences, acknowledge they showed up and gently encourage them — warm, not clinical, no diagnoses, no jokes at their expense. Use ONLY the facts provided. Never invent numbers.`;
  }
  const intensity = tone === 'roasting'
    ? 'Sharper, funnier, more intense — but LIGHTHEARTED. Rib their resistance/excuses to work out, never their worth, body, or anything self-harm-adjacent.'
    : 'Playful, teasing, light jabs.';
  return `You are Dr. MoodRx, a darkly funny fitness-for-mental-health coach with a film-noir, deadpan voice. Tone: ${intensity} Speak directly to the user about the workout they just did. Use ONLY the facts provided — never invent statistics, numbers, or history. Never give clinical labels, diagnoses, or medical advice. 1-2 sentences. No preamble.`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST' || !event.body) return { statusCode: 400, body: '' };
  let payload: { context?: any; tone?: 'teasing' | 'roasting'; appUserId?: string };
  try { payload = JSON.parse(event.body); } catch { return { statusCode: 400, body: '' }; }
  const { context, tone, appUserId } = payload;
  if (!context || !appUserId || (tone !== 'teasing' && tone !== 'roasting')) {
    return { statusCode: 400, body: '' };
  }

  // 1. Entitlement
  if (!(await isEntitled(appUserId))) return { statusCode: 403, body: '' };

  // 2. Rate + budget caps (Netlify Blobs as counter store)
  const store = getStore('coach-usage');
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const userKey = `user:${appUserId}:${today}`;
  const globalKey = `global:${month}`;
  const userCount = Number((await store.get(userKey)) ?? 0);
  const globalCount = Number((await store.get(globalKey)) ?? 0);
  if (userCount >= PER_USER_DAILY_CAP || globalCount >= GLOBAL_MONTHLY_CAP) {
    return { statusCode: 429, body: '' };
  }

  // 3. Anthropic call
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      temperature: 0.9,
      system: systemPrompt(tone, Boolean(context.crisis)),
      messages: [{ role: 'user', content: JSON.stringify(context) }],
    });
    const block = msg.content.find((b) => b.type === 'text');
    const line = block && block.type === 'text' ? block.text.trim() : '';
    if (!line) return { statusCode: 502, body: '' };

    // 4. Increment counters only on a successful, billed call
    await store.set(userKey, String(userCount + 1));
    await store.set(globalKey, String(globalCount + 1));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line }),
    };
  } catch {
    return { statusCode: 502, body: '' };
  }
};
```

- [ ] **Step 2: Verify** types compile (the function is bundled by Netlify, but it should still typecheck under the project's `tsc`). Run: `npm run typecheck` → clean. If `@netlify/functions` types aren't picked up, ensure it's installed (Task 0).

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/coach-line.ts
git commit -m "feat(coach): netlify function — entitlement + caps + haiku call"
```

---

## Task 5: Post-workout integration (static-first, swap-in)

**Files:** Modify `app/post-workout.tsx`.

- [ ] **Step 1: Wire the dynamic line.** The static line is already at line 92 (`const postInsult = useDrMoodRxLine(mood, 'post')`) and rendered at line 261. Add a `dynamicLine` state; on mount (after sessions load), if the user is opted-in and the static line is non-empty (trash-talk on), build the context and fetch — swap in on success. Display `dynamicLine ?? postInsult`.

Add imports:
```tsx
import { getAiCoachEnabled, getSessions } from '@/lib/storage';
import { buildCoachContext } from '@/lib/coach-insight';
import { fetchDynamicLine } from '@/lib/coach-client';
```

Add state + effect (near the other `useState`s and the existing load effect):
```tsx
const [dynamicLine, setDynamicLine] = useState<string | null>(null);

useEffect(() => {
  let cancelled = false;
  (async () => {
    const enabled = await getAiCoachEnabled();
    if (!enabled || postInsult === '') return; // opt-out or trash-talk off
    const sessions = await getSessions();
    const context = buildCoachContext({ mood, intensity, workout }, sessions);
    const line = await fetchDynamicLine(context);
    if (!cancelled && line) setDynamicLine(line);
  })().catch(() => {});
  return () => { cancelled = true; };
  // postInsult gates on trash-talk/voice; mood/intensity/workout are mount-fixed route params
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [postInsult]);
```

Change the render at line 261–263 from `postInsult` to the dynamic-preferred value:
```tsx
{(dynamicLine ?? postInsult) !== '' && (
  <Text style={styles.insultLine}>{dynamicLine ?? postInsult}</Text>
)}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck` + `npm run lint` → clean.
Manual (dev): with the AI-coach toggle OFF → static line only (no network call). With it ON + a reachable function + an entitled sandbox user → the line swaps to a dynamic one after a beat; with the function unreachable → static line stays, no error, no spinner.

- [ ] **Step 3: Commit**

```bash
git add app/post-workout.tsx
git commit -m "feat(coach): post-workout dynamic line with static fallback"
```

---

## Task 6: Settings opt-in toggle

**Files:** Modify `app/settings.tsx`.

- [ ] **Step 1: Add an "AI coach" toggle** mirroring the existing voice/health toggle pattern in `settings.tsx` (which already uses `getVoiceEnabled`/`setVoiceEnabled` + an animated switch). Read `getAiCoachEnabled()` on load into state; on toggle call `setAiCoachEnabled(next)`. Label it clearly and include a one-line disclosure that turning it on sends mood data off-device for a live coach line. Default OFF. Place it near the trash-talk / voice controls.

(Follow the file's existing toggle JSX + `Animated` switch pattern exactly — do not introduce a new control style. Read the voice-toggle block first and copy its shape.)

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck` + `npm run lint` → clean. Manual: toggle persists across app restarts; default is OFF on a fresh install.
```bash
git add app/settings.tsx
git commit -m "feat(coach): settings opt-in toggle with off-device disclosure"
```

---

## Task 7: Privacy & store-declaration updates (REQUIRED before any build that ships this)

**Files:** Modify `docs/privacy-policy.html`, `docs/play-health-and-data-safety.md`.

- [ ] **Step 1: Privacy policy.** Add a section stating that, **only for users who opt in to the AI coach**, a minimal set of mood-derived facts (current mood, pre-workout intensity, workout name, and derived effectiveness/trend descriptors — no free-text notes) is sent to a MoodRx serverless function and to Anthropic to generate a coaching line; that it is not used for ads or sold; and link Anthropic's privacy terms. Re-deploy the policy (GitHub Pages) and confirm the live URL reflects it.

- [ ] **Step 2: Data Safety / App Privacy.** Update `docs/play-health-and-data-safety.md`: the prior "health/mood data never leaves the device" statement now has an **opt-in exception**. For Play Data Safety, "Health and fitness" / "Personal info" may now need to be declared as **collected** (transmitted) **for the opted-in subset** — re-derive the exact declaration against Google's definitions and RevenueCat/Anthropic processor status. Mirror the change in the App Store privacy labels notes.

- [ ] **Step 3: Commit**

```bash
git add docs/privacy-policy.html docs/play-health-and-data-safety.md
git commit -m "docs(coach): privacy policy + data-safety updates for opt-in AI coach"
```

---

## Task 8: Deploy + end-to-end verify

- [ ] **Step 1: Set the real endpoint URL** in `lib/coach-client.ts` (`COACH_ENDPOINT`) to the deployed Netlify site's function URL. Commit.
- [ ] **Step 2: Deploy the function.** Run: `npx netlify deploy --build --prod` (or push to the connected branch). Confirm the function is live: `curl -X POST <endpoint>` with a dummy body returns 400 (not 404).
- [ ] **Step 3: Static gate.** `npm run typecheck` + `npm run lint` → clean.
- [ ] **Step 4: On-device E2E** (needs the production build per the iOS/Android testing workflow): opt in, complete a workout while entitled + online → dynamic line appears; revoke network → static line; not entitled → static line; exceed the per-user cap → static line. Confirm a crisis-signal session pulls the punch.
- [ ] **Step 5: Cost check.** After testing, confirm Anthropic usage matches the number of test calls (no runaway), and the Blobs counters incremented.

---

## Notes for the implementer
- **`pre`/`mid` and all other surfaces stay static** — only the post-workout line goes dynamic in v1.
- The line shows **before** the user enters their post-score, so the context is pre-score facts (mood/intensity/workout/history), not this session's delta. Don't try to use `postScore` in the context.
- Every failure path must leave the static line on screen. There is no loading spinner and no error UI for the coach.
- Do NOT add a test framework. Verify with typecheck + lint + manual.
- 🔎 Re-verify the RevenueCat REST entitlement shape and Netlify Blobs API against current docs before shipping.
