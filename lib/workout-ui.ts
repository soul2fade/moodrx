export const FIELD_NOTE_PROMPTS = [
  'What happened in there?',
  'What shifted?',
  'What did you notice?',
  'Anything worth remembering?',
  'What was the hardest part?',
] as const;

export function getFieldNotePlaceholder(sessionIndex: number): string {
  return FIELD_NOTE_PROMPTS[sessionIndex % FIELD_NOTE_PROMPTS.length];
}

/** Append a dictated transcript onto an existing field-notes string, joined by a
 *  single space and hard-capped at `cap` characters. Trims both sides; an empty
 *  transcript just returns the trimmed/capped base. Pure — used by the
 *  tap-to-dictate field-notes mic. */
export function appendDictation(base: string, transcript: string, cap = 280): string {
  const t = transcript.trim();
  const b = base.trim();
  if (!t) return b.slice(0, cap);
  const joined = b.length ? `${b} ${t}` : t;
  return joined.slice(0, cap);
}

export function stepHasReps(stepText: string): boolean {
  return /\breps?\b/i.test(stepText) || /×\s*\d+/i.test(stepText) || /\d+\s*x\s/i.test(stepText);
}
