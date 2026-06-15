export interface VoiceOption {
  /** Matches the manifest voice keys + the audio folder names. */
  name: string;
  label: string;
  free: boolean;
}

/** The 5 coach voices, in picker order. Rachel is free; the other four are
 *  included with MoodRx+ (the `all_access` entitlement). Static so the picker
 *  renders even before the library is hosted (the manifest is only needed for
 *  playback). */
export const VOICES: VoiceOption[] = [
  { name: 'rachel', label: 'Rachel', free: true },
  { name: 'deadpan', label: 'Deadpan Cynic', free: false },
  { name: 'grampa', label: 'Grampa Werthers', free: false },
  { name: 'ruthie', label: 'Ruthie Jo', free: false },
  { name: 'ed', label: 'Ed', free: false },
];

const NAMES = VOICES.map((v) => v.name);

export function isVoiceName(v: unknown): v is string {
  return typeof v === 'string' && NAMES.includes(v);
}

export function normalizeVoice(raw: unknown, fallback = 'rachel'): string {
  return isVoiceName(raw) ? raw : fallback;
}

/** Which voice actually plays: a free voice as-is; a paid voice only when owned
 *  (per-voice, bundle, or all-access); otherwise fall back to 'rachel'. Pure. */
export function effectiveVoice(selected: string, owned: ReadonlySet<string>): string {
  const v = VOICES.find((x) => x.name === selected);
  if (!v) return 'rachel';
  return v.free || ownsVoice(selected, owned) ? selected : 'rachel';
}

// Entitlement ids inlined so this module imports no react-native
// (revenuecat.tsx pulls in react-native-purchases, which would break the vitest
// node env). `pack_voice_pack` is the legacy à la carte bundle entitlement —
// honored for anyone who bought it before voices moved into MoodRx+; new users
// unlock every coach via `all_access` (MoodRx+).
const VOICE_PACK_ENTITLEMENT = 'pack_voice_pack';
const ALL_ACCESS_ENTITLEMENT = 'all_access';

/** Per-voice non-consumable entitlement/product id, e.g. 'voice_ed'. */
export function voiceEntitlementId(name: string): string {
  return `voice_${name}`;
}

/** Whether the user can use a voice: free voices always; otherwise owns the
 *  per-voice entitlement, the bundle, or all-access (future MoodRx+). */
export function ownsVoice(name: string, owned: ReadonlySet<string>): boolean {
  const v = VOICES.find((x) => x.name === name);
  if (!v) return false;
  if (v.free) return true;
  return (
    owned.has(voiceEntitlementId(name)) ||
    owned.has(VOICE_PACK_ENTITLEMENT) ||
    owned.has(ALL_ACCESS_ENTITLEMENT)
  );
}
