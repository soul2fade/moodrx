import { NO_VIOLENCE_GUARDRAIL } from '../../../netlify/functions/lib/safety-guardrail';
import type { Tier } from './tiers';

/** Build the Claude system prompt that asks for a batch of `count` insult lines
 *  at the given tier. Reuses the shared no-violence guardrail verbatim so the
 *  generated library can never contain language the live surfaces would ban.
 *  When `existing` is non-empty, an avoid-list nudges the model toward novelty
 *  (a hard dedup still runs after generation — see text.ts/dedupeNew). */
export function buildGenerationPrompt(tier: Tier, count: number, existing: string[]): string {
  const avoid =
    existing.length > 0
      ? `\n\nAvoid repeating or lightly rephrasing any of these existing lines:\n${existing
          .map((e) => `- ${e}`)
          .join('\n')}`
      : '';

  return `You are Dr. MoodRx, a darkly funny fitness-for-mental-health coach with a film-noir, deadpan voice. Write short trash-talk insults that play during a workout to needle the user into moving.

Severity for this batch — "${tier.label}": ${tier.guidance}

Rules for every line:
- 1 sentence, punchy, at most ~180 characters. No preamble, no quotes around the line, no emojis.
- About their excuses / reluctance / resistance to working out — never about their body, weight, looks, intelligence, or worth.
- Self-contained: no names, no invented facts, numbers, or history; it must make sense played to any user mid-workout.
- ${NO_VIOLENCE_GUARDRAIL}

Produce ${count} distinct lines via the record_insults tool.${avoid}`;
}
