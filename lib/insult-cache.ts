import * as FileSystem from 'expo-file-system/legacy';
import {
  pickClip,
  validateManifest,
  remoteUrl,
  localUri,
  type ClipEntry,
  type InsultTier,
  type Manifest,
} from './insult-library';

/** Static CDN base URL (Netlify assets site). Empty → bundled-fallback only. */
const BASE = process.env.EXPO_PUBLIC_INSULTS_BASE_URL ?? '';
/** Cache directory (OS-evictable, not iCloud-backed) for downloaded clips +
 *  manifest — they're reproducible from the CDN, so they shouldn't consume
 *  persistent/backed-up storage. Falls back to documentDirectory if absent.
 *  Always ends in a slash. */
const ROOT = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';

function dirOf(fileUri: string): string {
  return fileUri.slice(0, fileUri.lastIndexOf('/') + 1);
}

// Session-level manifest memo so independent callers (TasteTheRoast,
// CoachVoicePicker, workout) share ONE network fetch instead of each re-fetching.
let cachedManifest: Manifest | null = null;
let manifestInflight: Promise<Manifest | null> | null = null;

/** Fetch + cache the manifest, deduped across callers for the app session.
 *  A successful result is memoized; a null (nothing available) is NOT cached, so
 *  a later call can retry once connectivity returns. */
export async function fetchManifest(): Promise<Manifest | null> {
  if (cachedManifest) return cachedManifest;
  if (manifestInflight) return manifestInflight;
  manifestInflight = loadManifest();
  try {
    const result = await manifestInflight;
    if (result) cachedManifest = result;
    return result;
  } finally {
    manifestInflight = null;
  }
}

/** Fetch + cache the manifest. Falls back to a cached copy when offline.
 *  Returns null when no base URL is configured or nothing is available. */
async function loadManifest(): Promise<Manifest | null> {
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

/** Resolve a playable clip URI for a voice+tier: pick a clip from the manifest,
 *  then ensure it's cached/downloaded. null if no manifest/clip or download
 *  fails. Shared by the voice + severity preview pickers. */
export async function resolvePreviewClip(
  manifest: Manifest | null, voice: string, tier: InsultTier,
): Promise<string | null> {
  if (!manifest) return null;
  const entry = pickClip(manifest, voice, tier);
  if (!entry) return null;
  return ensureClip(entry).catch(() => null);
}

/** Best-effort background prefetch of a voice+tier, capped to avoid pulling a
 *  whole tier on workout start (clips are picked at random, ~1/min, so warming
 *  a handful is enough; the rest download lazily on demand). Failures ignored. */
export function prefetchTier(manifest: Manifest, voice: string, tier: InsultTier, maxClips = 6): void {
  const clips = (manifest.voices[voice]?.tiers?.[tier] ?? []).slice(0, maxClips);
  void (async () => {
    for (const entry of clips) {
      await ensureClip(entry).catch(() => null);
    }
  })();
}
