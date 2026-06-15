/** Single source of truth for the no-violence/weapon/self-harm-imagery rule.
 *  Imported by every surface that asks an LLM to speak in the Dr. MoodRx voice
 *  — the vent grader, the post-workout coach, and the offline insult generator —
 *  so the three can never drift. Must remain a single line (no newlines/backticks)
 *  so it can be interpolated into prompts without breaking their structure, and
 *  must keep the literal substrings "weapon" and "self-harm imagery" that the
 *  prompt tests assert on. */
export const NO_VIOLENCE_GUARDRAIL =
  'Never use violence, weapon, or self-harm imagery — no guns, shooting, knives, blades, hanging, jumping, "off yourself", "blow your brains out", "end it", "kill", etc. Not literally, not ironically, not as a joke or metaphor. This is a mental-health app; that language can land hard even when meant lightly.';
