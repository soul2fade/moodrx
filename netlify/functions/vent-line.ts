import type { Context } from '@netlify/functions';
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
const PER_IP_DAILY_CAP = 40; // IPs can be shared (NAT/Wi-Fi), so a bit higher.
const GLOBAL_DAILY_CAP = 2000; // ~$4-6/day hard ceiling; tune via redeploy.

// Pin baseURL to the real Anthropic API. Netlify's AI Gateway extension injects
// ANTHROPIC_BASE_URL into the function env, which the SDK would otherwise pick up
// and route our key through the gateway proxy (→ 401). Pinning bypasses that.
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY, baseURL: 'https://api.anthropic.com' });

/** Best-effort client IP for a coarse second rate-limit dimension — the
 *  per-device id is client-supplied and trivially spoofable. Netlify sets
 *  x-nf-client-connection-ip; fall back to the first x-forwarded-for hop. */
function clientIp(headers: Headers): string {
  return (
    headers.get('x-nf-client-connection-ip') ||
    (headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() ||
    'unknown'
  );
}

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== 'POST') return new Response('', { status: 400 });
  if (!ANTHROPIC_KEY) return new Response('', { status: 500 });

  let payload: { transcript?: string; deviceId?: string; episodes?: Record<string, unknown> | null };
  try {
    payload = await req.json();
  } catch {
    return new Response('', { status: 400 }); // missing/invalid JSON body
  }
  const transcript = typeof payload.transcript === 'string' ? payload.transcript.trim() : '';
  const deviceId = typeof payload.deviceId === 'string' && payload.deviceId ? payload.deviceId : 'anon';
  if (!transcript) return new Response('', { status: 400 });
  // Bound input cost on this ungated endpoint: ~2000 chars is ~400 words, far
  // beyond any real 20–30s spoken vent. A direct caller can't burn input tokens.
  if (transcript.length > 2000) return new Response('', { status: 400 });

  // Rate + global budget caps (approximate; non-atomic get-then-set under
  // concurrency is acceptable for a runaway-abuse ceiling). Two per-caller
  // dimensions (client-supplied deviceId + coarse IP) plus a global daily cap.
  // The global cap is this UNGATED endpoint's only real cost ceiling, so a
  // counter-store (Netlify Blobs) outage fails CLOSED rather than skipping it.
  const today = new Date().toISOString().slice(0, 10);
  const deviceKey = `device:${deviceId}:${today}`;
  const ipKey = `ip:${clientIp(req.headers)}:${today}`;
  const globalKey = `global:${today}`;
  let store: ReturnType<typeof getStore>;
  let deviceCount = 0;
  let ipCount = 0;
  let globalCount = 0;
  try {
    store = getStore('vent-usage');
    [deviceCount, ipCount, globalCount] = (
      await Promise.all([store.get(deviceKey), store.get(ipKey), store.get(globalKey)])
    ).map((v) => Number(v ?? 0));
  } catch {
    // Can't read the budget counter → can't enforce the only cost ceiling on
    // this ungated endpoint. Fail CLOSED; the client degrades to the mood form.
    return new Response('', { status: 503 });
  }
  if (
    deviceCount >= PER_DEVICE_DAILY_CAP ||
    ipCount >= PER_IP_DAILY_CAP ||
    globalCount >= GLOBAL_DAILY_CAP
  ) {
    return new Response('', { status: 429 }); // client falls back to the mood form
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
    if (!assessment) return new Response('', { status: 502 });

    const risk = resolveRisk(assessment.risk, classifyKeywordFloor(transcript));

    // Best-effort counter increment; a Blobs write failure must not 502 a reply
    // we already generated.
    try {
      await Promise.all([
        store.set(deviceKey, String(deviceCount + 1)),
        store.set(ipKey, String(ipCount + 1)),
        store.set(globalKey, String(globalCount + 1)),
      ]);
    } catch {
      /* counter write failed — ignore, the reply still stands */
    }

    return new Response(
      JSON.stringify({ mood: assessment.mood, intensity: assessment.intensity, reply: assessment.reply, risk }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch {
    return new Response('', { status: 502 });
  }
};
