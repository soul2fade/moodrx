/* Phase 1 — generate candidate insult TEXT per tier (no TTS spend).
 * Requires MOODRX_COACH_KEY + network. Re-runnable: only appends novel lines as
 * `pending`; never touches existing approve/reject decisions.
 *
 * Usage:
 *   MOODRX_COACH_KEY=sk-... npm run insults:generate                 # 60/tier, all tiers
 *   MOODRX_COACH_KEY=sk-... npm run insults:generate -- --count=80
 *   MOODRX_COACH_KEY=sk-... npm run insults:generate -- --tier=roast --count=40
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { TIERS, isTierKey, type Tier } from './lib/tiers';
import { buildGenerationPrompt } from './lib/generation-prompt';
import { dedupeNew } from './lib/text';
import { mergeCandidates, type ReviewFile, type ReviewEntry } from './lib/review';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(ROOT, 'data');

const RECORD_INSULTS_TOOL = {
  name: 'record_insults',
  description: 'Record the batch of generated insult lines.',
  input_schema: {
    type: 'object' as const,
    properties: {
      insults: {
        type: 'array',
        items: { type: 'string' },
        description: 'The distinct insult lines, one string each, no numbering or quotes.',
      },
    },
    required: ['insults'],
    additionalProperties: false,
  },
};

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
}

function reviewPath(tier: Tier['key']): string {
  return resolve(DATA_DIR, `${tier}.review.json`);
}

function loadReview(tier: Tier['key']): ReviewFile {
  const p = reviewPath(tier);
  if (!existsSync(p)) return { tier, entries: [] };
  return JSON.parse(readFileSync(p, 'utf8')) as ReviewFile;
}

function saveReview(file: ReviewFile): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(reviewPath(file.tier as Tier['key']), JSON.stringify(file, null, 2) + '\n');
}

async function generateForTier(client: Anthropic, tier: Tier, count: number): Promise<void> {
  const file = loadReview(tier.key);
  const existingTexts = file.entries.map((e: ReviewEntry) => e.text);

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    temperature: 1,
    system: buildGenerationPrompt(tier, count, existingTexts),
    tools: [RECORD_INSULTS_TOOL],
    tool_choice: { type: 'tool', name: RECORD_INSULTS_TOOL.name },
    messages: [{ role: 'user', content: `Write ${count} fresh "${tier.label}" lines.` }],
  });

  const block = msg.content.find((b) => b.type === 'tool_use');
  const raw = block && block.type === 'tool_use' ? (block.input as { insults?: unknown }) : {};
  const lines = Array.isArray(raw.insults) ? raw.insults.filter((x): x is string => typeof x === 'string') : [];

  const cleaned = lines
    .map((l) => l.trim().replace(/^["'\s-]+|["'\s]+$/g, ''))
    .filter((l) => l.length > 0 && l.length <= 180);

  const novel = dedupeNew(existingTexts, cleaned);
  const merged = mergeCandidates(file.entries, novel);
  saveReview({ tier: tier.key, entries: merged });

  console.log(
    `[${tier.key.padEnd(11)}] model:${lines.length} cleaned:${cleaned.length} novel:${novel.length} → total ${merged.length} (pending now: ${merged.filter((e) => e.status === 'pending').length})`,
  );
}

async function main() {
  const key = process.env.MOODRX_COACH_KEY;
  if (!key) throw new Error('Set MOODRX_COACH_KEY');
  const count = Math.max(1, parseInt(arg('count', '60'), 10) || 60);
  const tierArg = arg('tier', '');
  const tiers = tierArg ? TIERS.filter((t) => t.key === tierArg) : TIERS;
  if (tierArg && !isTierKey(tierArg)) throw new Error(`Unknown tier "${tierArg}"`);

  const client = new Anthropic({ apiKey: key });
  for (const tier of tiers) {
    await generateForTier(client, tier, count);
  }
  console.log('\nDone. Review the lines in scripts/insult-library/data/*.review.json — set each status to "approved" or "rejected" before running insults:voice.');
}

main();
