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
