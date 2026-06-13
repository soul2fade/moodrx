# Voiced Insult Delivery (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the workout screen's hardcoded bundled insult clips with the hosted 960-clip voiced library — fetched from a static CDN, cached on-device, with the bundled clips kept as a never-silent fallback.

**Architecture:** A pure, vitest-tested core module (`lib/insult-library.ts`: manifest types, validation, clip selection, URL/path builders) plus an impure on-device module (`lib/insult-cache.ts`: manifest + clip fetch/cache/prefetch via `expo-file-system/legacy`). `app/workout.tsx`'s trash-talk loop picks a clip for a fixed default voice+tier (`rachel`/`sticks`), plays the locally-cached file, and falls back to the existing bundled `INSULT_AUDIO` on any failure. Phase 2 later swaps the constants for user-chosen voice + severity.

**Tech Stack:** TypeScript, React Native / Expo SDK 54, `expo-file-system@~19` (legacy API), `expo-audio@~1.1`, vitest (pure logic only — RN/expo verified on-device).

**Spec:** `docs/superpowers/specs/2026-06-12-insult-delivery-phase1-design.md`

---

## File Structure

- **Create** `lib/insult-library.ts` — pure core: `Manifest`/`VoiceLibrary`/`ClipEntry` types, `InsultTier`, `validateManifest`, `pickClip`, `remoteUrl`, `localUri`. No RN/expo imports (vitest-safe).
- **Create** `lib/__tests__/insult-library.test.ts` — vitest units for the pure core.
- **Create** `lib/insult-cache.ts` — impure: `fetchManifest`, `ensureClip`, `prefetchTier`. Imports the core + `expo-file-system/legacy` + reads `EXPO_PUBLIC_INSULTS_BASE_URL`. Verified on-device (not vitest).
- **Modify** `app/workout.tsx` — trash-talk effect uses the library with bundled fallback.
- **Modify** `.env.example` — add `EXPO_PUBLIC_INSULTS_BASE_URL`.
- **Modify** `package.json` — add `insults:deploy` script.
- **Modify** `scripts/insult-library/README.md` — add the Phase-1 hosting/deploy runbook.

---

## Task 1: Env config for the CDN base URL

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add the env var to `.env.example`**

Append to `.env.example`:

```
# Static CDN base URL for the voiced insult library (Netlify assets site).
# Unset → app uses the bundled fallback clips. Build-time inlined (EXPO_PUBLIC_).
EXPO_PUBLIC_INSULTS_BASE_URL=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore(insults): EXPO_PUBLIC_INSULTS_BASE_URL config"
```

---

## Task 2: Pure core module (`lib/insult-library.ts`, TDD)

**Files:**
- Create: `lib/insult-library.ts`
- Create: `lib/__tests__/insult-library.test.ts`

This module is pure (no RN/expo imports) so vitest can load it directly (the repo's convention — see `lib/__tests__/patterns.test.ts`). It mirrors the manifest wire shape produced by the pipeline (`scripts/insult-library/output/insult-library.json`); the app intentionally does not import from `scripts/`.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/insult-library.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateManifest, pickClip, remoteUrl, localUri, type Manifest } from '../insult-library';

const M: Manifest = {
  version: 1,
  format: 'mp3_44100_96',
  voices: {
    rachel: {
      label: 'Rachel',
      free: true,
      tiers: {
        'glass-house': [{ id: 'a', text: 'x', file: 'audio/rachel/glass-house/a.mp3' }],
        sticks: [
          { id: 'b', text: 'y', file: 'audio/rachel/sticks/b.mp3' },
          { id: 'c', text: 'z', file: 'audio/rachel/sticks/c.mp3' },
        ],
        roast: [],
      },
    },
  },
};

describe('validateManifest', () => {
  it('accepts a well-formed manifest', () => {
    expect(validateManifest(M)).toBe(true);
  });
  it('rejects malformed input', () => {
    expect(validateManifest(null)).toBe(false);
    expect(validateManifest({ version: 1 })).toBe(false);
    expect(validateManifest({ version: 1, format: 'x', voices: [] })).toBe(false);
    expect(validateManifest({ version: '1', format: 'x', voices: {} })).toBe(false);
  });
});

describe('pickClip', () => {
  it('returns a clip from the requested voice+tier (deterministic rng)', () => {
    expect(pickClip(M, 'rachel', 'sticks', () => 0)).toEqual(M.voices.rachel.tiers.sticks[0]);
    expect(pickClip(M, 'rachel', 'sticks', () => 0.99)).toEqual(M.voices.rachel.tiers.sticks[1]);
  });
  it('returns null for unknown voice, unknown tier, or empty tier', () => {
    expect(pickClip(M, 'nobody', 'sticks')).toBeNull();
    expect(pickClip(M, 'rachel', 'roast')).toBeNull();
  });
});

describe('remoteUrl', () => {
  it('joins base + file with exactly one slash', () => {
    expect(remoteUrl('https://x.net', 'audio/r/s/a.mp3')).toBe('https://x.net/audio/r/s/a.mp3');
    expect(remoteUrl('https://x.net/', '/audio/r/s/a.mp3')).toBe('https://x.net/audio/r/s/a.mp3');
  });
});

describe('localUri', () => {
  it('builds <root>insults/<file>', () => {
    expect(localUri('file:///docs/', 'audio/r/s/a.mp3')).toBe('file:///docs/insults/audio/r/s/a.mp3');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/__tests__/insult-library.test.ts`
Expected: FAIL — cannot resolve `../insult-library`.

- [ ] **Step 3: Implement the module**

Create `lib/insult-library.ts`:

```ts
/** Pure core for the voiced insult library. Mirrors the manifest wire shape
 *  produced by scripts/insult-library (the app never imports from scripts/).
 *  No RN/expo imports — vitest loads this directly. */

export type InsultTier = 'glass-house' | 'sticks' | 'roast';

export interface ClipEntry {
  id: string;
  text: string;
  /** Path relative to the CDN base / cache root, e.g. audio/<voice>/<tier>/<id>.mp3 */
  file: string;
}

export interface VoiceLibrary {
  label: string;
  free: boolean;
  tiers: Record<InsultTier, ClipEntry[]>;
}

export interface Manifest {
  version: number;
  format: string;
  voices: Record<string, VoiceLibrary>;
}

/** Shallow shape guard for a manifest fetched off the network. */
export function validateManifest(raw: unknown): raw is Manifest {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== 'number') return false;
  if (typeof o.format !== 'string') return false;
  if (!o.voices || typeof o.voices !== 'object' || Array.isArray(o.voices)) return false;
  return true;
}

/** Random clip from a voice+tier, or null if that voice/tier is absent/empty.
 *  `rng` is injectable for deterministic tests. */
export function pickClip(
  manifest: Manifest,
  voice: string,
  tier: InsultTier,
  rng: () => number = Math.random,
): ClipEntry | null {
  const clips = manifest.voices[voice]?.tiers?.[tier];
  if (!clips || clips.length === 0) return null;
  return clips[Math.floor(rng() * clips.length)] ?? null;
}

/** Join CDN base + a manifest-relative file path, collapsing the slash seam. */
export function remoteUrl(base: string, file: string): string {
  return `${base.replace(/\/+$/, '')}/${file.replace(/^\/+/, '')}`;
}

/** Local cache uri for a file: `<root>insults/<file>`. `root` must end in a
 *  slash (e.g. expo-file-system documentDirectory). */
export function localUri(root: string, file: string): string {
  return `${root}insults/${file.replace(/^\/+/, '')}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/__tests__/insult-library.test.ts`
Expected: PASS (all 6).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/insult-library.ts lib/__tests__/insult-library.test.ts
git commit -m "feat(insults): pure library core (manifest types, validate, pick, url/path)"
```

---

## Task 3: On-device cache module (`lib/insult-cache.ts`)

**Files:**
- Create: `lib/insult-cache.ts`

Impure — imports `expo-file-system/legacy` (native) + the core, so it is NOT vitest-tested; verified via typecheck here and on-device at the build step. Uses the SDK-54-documented legacy API (`documentDirectory`, `getInfoAsync`, `makeDirectoryAsync`, `downloadAsync`, `readAsStringAsync`, `writeAsStringAsync`).

- [ ] **Step 1: Implement the module**

Create `lib/insult-cache.ts`:

```ts
import * as FileSystem from 'expo-file-system/legacy';
import {
  validateManifest,
  remoteUrl,
  localUri,
  type ClipEntry,
  type InsultTier,
  type Manifest,
} from './insult-library';

/** Static CDN base URL (Netlify assets site). Empty → bundled-fallback only. */
const BASE = process.env.EXPO_PUBLIC_INSULTS_BASE_URL ?? '';
/** Persisted document directory; always ends in a slash. */
const ROOT = FileSystem.documentDirectory ?? '';

function dirOf(fileUri: string): string {
  return fileUri.slice(0, fileUri.lastIndexOf('/') + 1);
}

/** Fetch + cache the manifest. Falls back to a cached copy when offline.
 *  Returns null when no base URL is configured or nothing is available. */
export async function fetchManifest(): Promise<Manifest | null> {
  const cacheUri = localUri(ROOT, 'insult-library.json');
  if (BASE) {
    try {
      const res = await fetch(remoteUrl(BASE, 'insult-library.json'));
      if (res.ok) {
        const raw = await res.json();
        if (validateManifest(raw)) {
          try {
            await FileSystem.makeDirectoryAsync(dirOf(cacheUri), { intermediates: true });
            await FileSystem.writeAsStringAsync(cacheUri, JSON.stringify(raw));
          } catch {
            // cache write is best-effort; the fetched manifest is still usable
          }
          return raw;
        }
      }
    } catch {
      // network failure → try the cached copy below
    }
  }
  try {
    const info = await FileSystem.getInfoAsync(cacheUri);
    if (info.exists) {
      const raw = JSON.parse(await FileSystem.readAsStringAsync(cacheUri));
      if (validateManifest(raw)) return raw;
    }
  } catch {
    // no usable cache
  }
  return null;
}

/** Local uri for a clip, downloading + caching on first use. null on failure
 *  (caller falls back to a bundled clip). */
export async function ensureClip(entry: ClipEntry): Promise<string | null> {
  if (!BASE) return null;
  const fileUri = localUri(ROOT, entry.file);
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists) return fileUri;
    await FileSystem.makeDirectoryAsync(dirOf(fileUri), { intermediates: true });
    const res = await FileSystem.downloadAsync(remoteUrl(BASE, entry.file), fileUri);
    return res.uri;
  } catch {
    return null;
  }
}

/** Best-effort background prefetch of a whole voice+tier. Failures ignored. */
export function prefetchTier(manifest: Manifest, voice: string, tier: InsultTier): void {
  const clips = manifest.voices[voice]?.tiers?.[tier] ?? [];
  void (async () => {
    for (const entry of clips) {
      await ensureClip(entry).catch(() => null);
    }
  })();
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean. If `expo-file-system/legacy` fails to type-resolve, fall back to the new API (`import { File, Directory, Paths } from 'expo-file-system'`) keeping the same exported function signatures — but the legacy import is documented for SDK 54 and is preferred for this string-URI design. Report any change.

- [ ] **Step 3: Lint the new file**

Run: `npm run lint:ci`
Expected: clean (lib/ is in the lint scope).

- [ ] **Step 4: Commit**

```bash
git add lib/insult-cache.ts
git commit -m "feat(insults): on-device manifest+clip fetch/cache/prefetch"
```

---

## Task 4: Wire the library into the workout screen (`app/workout.tsx`)

**Files:**
- Modify: `app/workout.tsx`

Replace the bundled-only trash-talk loop with: load the manifest + prefetch on toggle-on; each cue plays a library clip for the default voice/tier, falling back to the bundled `INSULT_AUDIO` on any miss. The bundled array, `insultPlayer`, volume handling, and the on/off toggle are otherwise unchanged.

- [ ] **Step 1: Add imports**

At the top of `app/workout.tsx`, with the other `@/lib` imports, add:

```ts
import { pickClip, type Manifest } from '@/lib/insult-library';
import { ensureClip, fetchManifest, prefetchTier } from '@/lib/insult-cache';
```

- [ ] **Step 2: Add Phase-1 default constants**

Near the top-level constants (just after the `INSULT_AUDIO` array, before `type Soundscape`), add:

```ts
// Phase 1: trash talk plays the hosted library at a fixed default voice + tier.
// Phase 2 (severity sheet + voice picker) replaces these with user state.
const DEFAULT_INSULT_VOICE = 'rachel';
const DEFAULT_INSULT_TIER = 'sticks' as const;
```

- [ ] **Step 3: Add a manifest ref**

With the other refs inside the component (next to `const insultIdxRef = useRef(0);`), add:

```ts
  const manifestRef = useRef<Manifest | null>(null);
```

- [ ] **Step 4: Replace the trash-talk effect**

Replace the existing trash-talk `useEffect` (the one that begins `if (trashIntervalRef.current) clearInterval(trashIntervalRef.current);` and ends with the `[trashTalkOn]` dependency array) with:

```ts
  useEffect(() => {
    if (trashIntervalRef.current) clearInterval(trashIntervalRef.current);
    if (!trashTalkOn) {
      try { insultPlayer.pause(); } catch {}
      return;
    }
    let cancelled = false;

    // Load the hosted manifest once and warm the cache for the default tier.
    void (async () => {
      const m = await fetchManifest().catch(() => null);
      if (cancelled) return;
      manifestRef.current = m;
      if (m) prefetchTier(m, DEFAULT_INSULT_VOICE, DEFAULT_INSULT_TIER);
    })();

    // Bundled fallback rotation start (random so sessions differ).
    insultIdxRef.current = Math.floor(Math.random() * INSULT_AUDIO.length);

    const playNext = async () => {
      let src: any = null;
      const m = manifestRef.current;
      if (m) {
        const entry = pickClip(m, DEFAULT_INSULT_VOICE, DEFAULT_INSULT_TIER);
        if (entry) {
          const uri = await ensureClip(entry);
          if (uri) src = { uri };
        }
      }
      if (!src) {
        const idx = insultIdxRef.current % INSULT_AUDIO.length;
        insultIdxRef.current += 1;
        src = INSULT_AUDIO[idx];
      }
      if (cancelled) return;
      setInsultAudioSrc(src);
    };

    void playNext();
    trashIntervalRef.current = setInterval(() => { void playNext(); }, 55000);
    return () => {
      cancelled = true;
      if (trashIntervalRef.current) clearInterval(trashIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- insultPlayer is a stable expo-audio ref; trashTalkOn toggle is the meaningful trigger.
  }, [trashTalkOn]);
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean. (`setInsultAudioSrc` already accepts both a bundled `require()` number and a `{ uri }` source — `useAudioPlayer` takes either.)

- [ ] **Step 6: Lint**

Run: `npm run lint:ci`
Expected: clean.

- [ ] **Step 7: Run the full test suite (nothing regressed)**

Run: `npm test`
Expected: PASS — all existing tests plus Task 2's new ones; the screen change has no vitest coverage (verified on-device at the build).

- [ ] **Step 8: Commit**

```bash
git add app/workout.tsx
git commit -m "feat(insults): play hosted library in workout (rachel/sticks default, bundled fallback)"
```

---

## Task 5: Deploy script + hosting runbook

**Files:**
- Modify: `package.json`
- Modify: `scripts/insult-library/README.md`

- [ ] **Step 1: Add the deploy npm script**

In `package.json` `scripts`, after `"insults:voice"`, add:

```json
    "insults:deploy": "netlify deploy --dir scripts/insult-library/output"
```

(No `--prod` in the script so a dry/preview deploy is the default; the runbook shows when to add `--prod`. Ensure the preceding line keeps its trailing comma and the JSON stays valid.)

- [ ] **Step 2: Add the hosting runbook to the README**

Append to `scripts/insult-library/README.md`:

````markdown
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
````

- [ ] **Step 3: Verify JSON + typecheck unaffected**

Run: `node -e "require('./package.json')" && npm run typecheck`
Expected: no JSON error; typecheck clean.

- [ ] **Step 4: Commit**

```bash
git add package.json scripts/insult-library/README.md
git commit -m "chore(insults): deploy script + Phase-1 static hosting runbook"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full suite + typecheck + lint**

Run: `npm test && npm run typecheck && npm run lint:ci`
Expected: all tests pass (incl. the new `insult-library.test.ts`), typecheck clean, lint clean.

- [ ] **Step 2: Confirm fallback safety by reading the diff**

Confirm in `app/workout.tsx` that when `manifestRef.current` is null or `ensureClip` returns null, `playNext` still assigns a bundled `INSULT_AUDIO` source — i.e. trash talk is never silent without `EXPO_PUBLIC_INSULTS_BASE_URL`. No command; a read-through check.

---

## Manual / on-device verification (operator, after the build)

Not code tasks — the RN/expo behavior is verified on-device at the next build:
1. With `EXPO_PUBLIC_INSULTS_BASE_URL` set + `output/` deployed → toggle trash talk → hear **Rachel `sticks`** clips; second session offline still plays (cached).
2. With the env var unset → toggle trash talk → still hear the **bundled** clips (never silent).

---

## Self-Review (against the spec)

- **Static hosting + upload + base-URL config:** Task 1 (env var), Task 5 (deploy script + runbook). ✓
- **`lib/insult-library.ts` pure core (validate/pick/url/path):** Task 2, vitest-tested. ✓
- **`lib/insult-cache.ts` fetch/cache/prefetch, legacy FS API, env base URL:** Task 3. ✓
- **`workout.tsx` swap with rachel/sticks default + bundled fallback, never silent:** Task 4 + Task 6 Step 2. ✓
- **Forward-compatible with Phase 2:** the only Phase-2 change is replacing `DEFAULT_INSULT_VOICE`/`DEFAULT_INSULT_TIER` with user state; the modules already take `(voice, tier)` params. ✓
- **Testing convention (pure logic vitest; RN on-device):** Task 2 vitest; Tasks 3/4 typecheck+lint+on-device. ✓
- **Owner-ops called out (assets site + deploy + env):** Task 5 runbook + manual section. ✓
- **Placeholder scan:** every code step has complete code; no TBD/TODO. ✓
- **Type consistency:** `Manifest`/`ClipEntry`/`InsultTier`, `validateManifest`/`pickClip`/`remoteUrl`/`localUri`, `fetchManifest`/`ensureClip`/`prefetchTier`, `DEFAULT_INSULT_VOICE`/`DEFAULT_INSULT_TIER` used consistently across Tasks 2–4. ✓
