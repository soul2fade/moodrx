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
