import { TIER_KEYS, type Tier } from './tiers';

export interface ClipEntry {
  id: string;
  text: string;
  /** Path relative to the manifest, e.g. audio/<voice>/<tier>/<id>.mp3 */
  file: string;
}

export interface VoiceMeta {
  name: string;
  label: string;
  free: boolean;
}

export interface VoiceLibrary {
  label: string;
  free: boolean;
  tiers: Record<Tier['key'], ClipEntry[]>;
}

export interface Manifest {
  version: 1;
  /** ElevenLabs output_format the clips were rendered at (provenance only). */
  format: string;
  voices: Record<string, VoiceLibrary>;
}

function emptyTiers(): Record<Tier['key'], ClipEntry[]> {
  return TIER_KEYS.reduce(
    (acc, k) => {
      acc[k] = [];
      return acc;
    },
    {} as Record<Tier['key'], ClipEntry[]>,
  );
}

export function emptyManifest(format: string): Manifest {
  return { version: 1, format, voices: {} };
}

export function hasEntry(m: Manifest, voice: string, tier: Tier['key'], id: string): boolean {
  return Boolean(m.voices[voice]?.tiers[tier]?.some((c) => c.id === id));
}

/** Add a voiced clip under (voice, tier). Creates the voice/tier scaffold on
 *  first use. Idempotent: re-adding an existing id is a no-op. Returns a new
 *  manifest; the input is not mutated. */
export function addEntry(m: Manifest, voice: VoiceMeta, tier: Tier['key'], clip: ClipEntry): Manifest {
  const next: Manifest = { ...m, voices: { ...m.voices } };
  const lib = next.voices[voice.name]
    ? { ...next.voices[voice.name], tiers: { ...next.voices[voice.name].tiers } }
    : { label: voice.label, free: voice.free, tiers: emptyTiers() };
  const list = lib.tiers[tier];
  if (!list.some((c) => c.id === clip.id)) {
    lib.tiers[tier] = [...list, clip];
  }
  next.voices[voice.name] = lib;
  return next;
}

export function validateManifest(raw: unknown): raw is Manifest {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (typeof o.format !== 'string') return false;
  if (!o.voices || typeof o.voices !== 'object' || Array.isArray(o.voices)) return false;
  return true;
}
