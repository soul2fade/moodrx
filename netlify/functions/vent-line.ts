import type { Handler } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import Anthropic from '@anthropic-ai/sdk';
import {
  ASSESS_TOOL,
  buildVentSystem,
  classifyKeywordFloor,
  resolveRisk,
  validateAssessment,
} from './lib/vent-grading';

// Reuse the Anthropic key already configured for the coach function.
const ANTHROPIC_KEY = process.env.MOODRX_COACH_KEY;

const PER_DEVICE_DAILY_CAP = 20;
const GLOBAL_DAILY_CAP = 2000; // ~$4-6/day hard ceiling; tune via redeploy.

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST' || !event.body) return { statusCode: 400, body: '' };
  if (!ANTHROPIC_KEY) return { statusCode: 500, body: '' };

  let payload: { transcript?: string; deviceId?: string; episodes?: Record<string, unknown> | null };
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: '' };
  }
  const transcript = typeof payload.transcript === 'string' ? payload.transcript.trim() : '';
  const deviceId = typeof payload.deviceId === 'string' && payload.deviceId ? payload.deviceId : 'anon';
  if (!transcript) return { statusCode: 400, body: '' };

  // Rate + global budget caps (approximate; see coach-line note on non-atomic
  // get-then-set under concurrency — acceptable for a runaway-abuse ceiling).
  // Best-effort: the counter store (Netlify Blobs) is defensive infrastructure,
  // so if it's unavailable we degrade to "skip the cap" rather than failing the
  // whole request — a counter outage must never take venting down. Caps resume
  // automatically once Blobs is reachable again.
  const today = new Date().toISOString().slice(0, 10);
  const deviceKey = `device:${deviceId}:${today}`;
  const globalKey = `global:${today}`;
  let store: ReturnType<typeof getStore> | undefined;
  let deviceCount = 0;
  let globalCount = 0;
  try {
    store = getStore('vent-usage');
    deviceCount = Number((await store.get(deviceKey)) ?? 0);
    globalCount = Number((await store.get(globalKey)) ?? 0);
  } catch {
    store = undefined; // Blobs unavailable → skip caps for this request
  }
  if (store && (deviceCount >= PER_DEVICE_DAILY_CAP || globalCount >= GLOBAL_DAILY_CAP)) {
    return { statusCode: 429, body: '' }; // client falls back to the mood form
  }

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      temperature: 0.9,
      system: buildVentSystem(payload.episodes),
      tools: [ASSESS_TOOL],
      tool_choice: { type: 'tool', name: ASSESS_TOOL.name },
      messages: [{ role: 'user', content: transcript }],
    });
    const block = msg.content.find((b) => b.type === 'tool_use');
    const assessment = validateAssessment(block && block.type === 'tool_use' ? block.input : null);
    if (!assessment) return { statusCode: 502, body: '' };

    const risk = resolveRisk(assessment.risk, classifyKeywordFloor(transcript));

    // Best-effort counter increment; a Blobs write failure must not 502 a reply
    // we already generated.
    if (store) {
      try {
        await store.set(deviceKey, String(deviceCount + 1));
        await store.set(globalKey, String(globalCount + 1));
      } catch {
        /* counter write failed — ignore, the reply still stands */
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood: assessment.mood, intensity: assessment.intensity, reply: assessment.reply, risk }),
    };
  } catch {
    return { statusCode: 502, body: '' };
  }
};
