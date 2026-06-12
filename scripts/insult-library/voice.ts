/* Phase 3 — voice APPROVED lines via ElevenLabs into mp3 + manifest.
 * Requires ELEVENLABS_API_KEY + network + scripts/insult-library/voices.config.json.
 * Idempotent: a line already in the manifest for a (voice, tier) is skipped.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... npm run insults:voice -- --dry-run   # estimate only, no spend
 *   ELEVENLABS_API_KEY=... npm run insults:voice                # voice approved+unvoiced
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIERS, type Tier } from './lib/tiers';
import { selectApproved, type ReviewFile } from './lib/review';
import {
  emptyManifest,
  hasEntry,
  addEntry,
  validateManifest,
  type Manifest,
  type VoiceMeta,
} from './lib/manifest';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(ROOT, 'data');
const OUTPUT_DIR = resolve(ROOT, 'output');
const AUDIO_DIR = resolve(OUTPUT_DIR, 'audio');
const MANIFEST_PATH = resolve(OUTPUT_DIR, 'insult-library.json');

const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5';
const FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_96';

interface VoiceConfig extends VoiceMeta {
  voiceId: string;
}

function loadVoices(): VoiceConfig[] {
  const p = resolve(ROOT, 'voices.config.json');
  if (!existsSync(p)) {
    throw new Error('Missing scripts/insult-library/voices.config.json (copy voices.config.example.json and fill in real voice IDs).');
  }
  const arr = JSON.parse(readFileSync(p, 'utf8')) as VoiceConfig[];
  if (!Array.isArray(arr) || arr.some((v) => !v.name || !v.voiceId)) {
    throw new Error('voices.config.json must be an array of { name, label, voiceId, free }.');
  }
  return arr;
}

function loadReview(tier: Tier['key']): ReviewFile {
  const p = resolve(DATA_DIR, `${tier}.review.json`);
  if (!existsSync(p)) return { tier, entries: [] };
  return JSON.parse(readFileSync(p, 'utf8')) as ReviewFile;
}

function loadManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) return emptyManifest(FORMAT);
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  if (!validateManifest(raw)) throw new Error('Existing manifest is malformed; move it aside.');
  return raw;
}

function saveManifest(m: Manifest): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2) + '\n');
}

async function tts(voiceId: string, text: string, apiKey: string): Promise<Buffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${FORMAT}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL }),
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!dryRun && !apiKey) throw new Error('Set ELEVENLABS_API_KEY (or pass --dry-run).');

  const voices = loadVoices();
  let manifest = loadManifest();

  let toVoice = 0;
  let chars = 0;
  let voiced = 0;

  for (const voice of voices) {
    const meta: VoiceMeta = { name: voice.name, label: voice.label, free: voice.free };
    for (const tier of TIERS) {
      const approved = selectApproved(loadReview(tier.key).entries);
      for (const entry of approved) {
        if (hasEntry(manifest, voice.name, tier.key, entry.id)) continue;
        toVoice++;
        chars += entry.text.length;
        if (dryRun) {
          console.log(`[would voice] ${voice.name}/${tier.key}/${entry.id}  "${entry.text}"`);
          continue;
        }
        const audio = await tts(voice.voiceId, entry.text, apiKey!);
        const dir = resolve(AUDIO_DIR, voice.name, tier.key);
        mkdirSync(dir, { recursive: true });
        const rel = `audio/${voice.name}/${tier.key}/${entry.id}.mp3`;
        writeFileSync(resolve(dir, `${entry.id}.mp3`), audio);
        manifest = addEntry(manifest, meta, tier.key, { id: entry.id, text: entry.text, file: rel });
        saveManifest(manifest); // persist after each clip → crash-resumable
        voiced++;
        console.log(`[voiced ${voiced}] ${rel}  (${audio.length} bytes)`);
      }
    }
  }

  if (dryRun) {
    console.log(`\nDRY RUN: ${toVoice} clips would be voiced across ${voices.length} voice(s); ~${chars} characters (≈ ElevenLabs credits, Flash ≈ half). No spend, no files written.`);
  } else {
    saveManifest(manifest);
    console.log(`\nDone. Voiced ${voiced} new clip(s); ~${chars} characters spent. Manifest: ${MANIFEST_PATH}`);
  }
}

main();
