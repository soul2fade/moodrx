/* Manual eval — requires MOODRX_COACH_KEY + network. Not part of CI.
 * Usage: MOODRX_COACH_KEY=sk-... npx tsx scripts/eval-vent.ts            */
import Anthropic from '@anthropic-ai/sdk';
import { ASSESS_TOOL, VENT_SYSTEM_PROMPT, classifyKeywordFloor, resolveRisk, validateAssessment } from '../netlify/functions/lib/vent-grading';
import { VENT_CASES } from '../netlify/functions/__tests__/fixtures/vent-cases';

async function main() {
  const key = process.env.MOODRX_COACH_KEY;
  if (!key) throw new Error('Set MOODRX_COACH_KEY');
  const anthropic = new Anthropic({ apiKey: key });
  let correct = 0;
  let overEscalations = 0; // resolved tier stricter than the human label
  for (const c of VENT_CASES) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      temperature: 0.9,
      system: VENT_SYSTEM_PROMPT,
      tools: [ASSESS_TOOL],
      tool_choice: { type: 'tool', name: ASSESS_TOOL.name },
      messages: [{ role: 'user', content: c.transcript }],
    });
    const block = msg.content.find((b) => b.type === 'tool_use');
    const a = validateAssessment(block && block.type === 'tool_use' ? (block as any).input : null);
    const resolved = a ? resolveRisk(a.risk, classifyKeywordFloor(c.transcript)) : 'INVALID';
    const rank = { none: 0, elevated: 1, acute: 2 } as Record<string, number>;
    if (resolved === c.expected) correct++;
    if (resolved !== 'INVALID' && rank[resolved] > rank[c.expected]) overEscalations++;
    console.log(`[${c.expected.padEnd(8)} -> ${String(resolved).padEnd(8)}] ${c.transcript}`);
  }
  console.log(`\n${correct}/${VENT_CASES.length} exact; ${overEscalations} over-escalations (the metric that erodes trust).`);
}
main();
