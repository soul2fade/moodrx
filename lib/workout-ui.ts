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

export function stepHasReps(stepText: string): boolean {
  return /\breps?\b/i.test(stepText) || /×\s*\d+/i.test(stepText) || /\d+\s*x\s/i.test(stepText);
}
