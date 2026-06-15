import { NO_VIOLENCE_GUARDRAIL } from './safety-guardrail';

/** The three coach tones — same keys as the trash-talk severity tiers. */
export type PromptTone = 'glass-house' | 'sticks' | 'roast';

/** Normalize any incoming tone string to the 3 levels. Tolerates the legacy
 *  'teasing'/'roasting' values older app builds still send (teasing→sticks,
 *  roasting→roast — byte-identical to the pre-3-tone copy), and defaults any
 *  unknown value to the standard 'sticks'. */
function normalizeTone(tone: string): PromptTone {
  switch (tone) {
    case 'glass-house':
    case 'sticks':
    case 'roast':
      return tone;
    case 'roasting':
      return 'roast';
    case 'teasing':
      return 'sticks';
    default:
      return 'sticks';
  }
}

/** Builds the Dr. MoodRx post-workout system prompt. Pure — no SDK, no network
 *  — so it is unit-testable. The episode rule is appended only when the context
 *  actually carries an episode, so the model is never told to look for one that
 *  isn't there (and `buildCoachContext`/`selectEpisode` guarantee any present
 *  episode is real). */
export function coachSystemPrompt(
  tone: string,
  crisis: boolean,
  hasEpisode: boolean,
): string {
  if (crisis) {
    return `You are Dr. MoodRx, a darkly funny but ultimately caring fitness-for-mental-health coach. The user is showing signs of genuine distress right now. Drop the roasting entirely. In 1-2 sentences, acknowledge they showed up and gently encourage them — warm, not clinical, no diagnoses, no jokes at their expense. Use ONLY the facts provided. Never invent numbers.`;
  }
  const t = normalizeTone(tone);
  const intensity =
    t === 'roast'
      ? 'Sharper, funnier, more intense — but LIGHTHEARTED. Rib their resistance/excuses to work out, never their worth, body, or anything self-harm-adjacent.'
      : t === 'glass-house'
        ? 'Gentle and warm — the lightest ribbing, barely a jab; more encouraging than teasing.'
        : 'Playful, teasing, light jabs.';
  const episodeRule = hasEpisode
    ? ' If the context includes an `episode` object, you may briefly reference that specific past session — its workout name and whether it helped, on its day — in voice. Never invent a past session; use only the facts in `episode`.'
    : '';
  return `You are Dr. MoodRx, a darkly funny fitness-for-mental-health coach with a film-noir, deadpan voice. Tone: ${intensity} Speak directly to the user about the workout they just did. Use ONLY the facts provided — never invent statistics, numbers, or history. Never give clinical labels, diagnoses, or medical advice. ${NO_VIOLENCE_GUARDRAIL} 1-2 sentences. No preamble.${episodeRule}`;
}
