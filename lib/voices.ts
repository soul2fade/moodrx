export interface VoiceOption {
  /** Matches the manifest voice keys + the audio folder names. */
  name: string;
  label: string;
  free: boolean;
}

/** The 5 coach voices, in picker order. Rachel is free; the other four unlock
 *  together via the VOICE_PACK_ID bundle. Static so the picker renders even
 *  before the library is hosted (the manifest is only needed for playback). */
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

/** Which voice actually plays: a free voice as-is; a paid voice only when the
 *  bundle is owned; otherwise fall back to 'rachel' (refund / unknown / unbought). */
export function effectiveVoice(selected: string, ownsBundle: boolean): string {
  const v = VOICES.find((x) => x.name === selected);
  if (!v) return 'rachel';
  return v.free || ownsBundle ? selected : 'rachel';
}
