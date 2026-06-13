import type { Handler } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import Anthropic from '@anthropic-ai/sdk';
import { coachSystemPrompt } from './lib/coach-prompt';

// Env var names map to the user's existing Netlify secrets:
//   MOODRX_COACH_KEY      → Anthropic API key
//   moodrx_coach_function → RevenueCat v1 secret key
const ANTHROPIC_KEY = process.env.MOODRX_COACH_KEY;
const REVENUECAT_SECRET = process.env.moodrx_coach_function;

const PER_USER_DAILY_CAP = 25;
const GLOBAL_MONTHLY_CAP = 5000; // hard ceiling on total calls/month

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

/** Verify the caller holds the base-unlock `premium` entitlement via the
 *  RevenueCat v1 REST API. 🔎 Re-verify response shape against current docs. */
async function isEntitled(appUserId: string): Promise<boolean> {
  // Time-box the RevenueCat call so a slow/hung response can't eat the whole
  // Netlify function budget (leaving no headroom for the Anthropic call). Any
  // network error or timeout resolves to "not entitled" — the client then
  // falls back to a static line, so the degradation is graceful.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      { headers: { Authorization: `Bearer ${REVENUECAT_SECRET}` }, signal: controller.signal },
    );
    if (!res.ok) return false;
    const data: any = await res.json();
    const ent = data?.subscriber?.entitlements?.premium;
    if (!ent) return false;
    // Non-consumable base unlock: present + no expiry (or a future expiry).
    return ent.expires_date == null || new Date(ent.expires_date).getTime() > Date.now();
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST' || !event.body) return { statusCode: 400, body: '' };
  if (!ANTHROPIC_KEY || !REVENUECAT_SECRET) return { statusCode: 500, body: '' };

  let payload: { context?: any; tone?: string; appUserId?: string };
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: '' };
  }
  const { context, tone, appUserId } = payload;
  if (!context || !appUserId || typeof tone !== 'string' || !tone.trim()) {
    return { statusCode: 400, body: '' };
  }

  // 1. Entitlement — only paying (base-unlock) users trigger spend.
  if (!(await isEntitled(appUserId))) return { statusCode: 403, body: '' };

  // 2. Rate + budget caps (Netlify Blobs as counter store). The get-then-set
  //    is non-atomic, so under concurrency the counts can drift slightly — this
  //    is an approximate ceiling, not an exact quota. Acceptable: worst-case
  //    overshoot is small at ~$0.001/call, and the cap exists to stop runaway
  //    abuse, not to bill-to-the-cent.
  //    Best-effort: the counter store is defensive infrastructure, so if Netlify
  //    Blobs is unavailable we degrade to "skip the cap" rather than failing the
  //    whole request. Caps resume automatically once Blobs is reachable.
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const userKey = `user:${appUserId}:${today}`;
  const globalKey = `global:${month}`;
  let store: ReturnType<typeof getStore> | undefined;
  let userCount = 0;
  let globalCount = 0;
  try {
    store = getStore('coach-usage');
    userCount = Number((await store.get(userKey)) ?? 0);
    globalCount = Number((await store.get(globalKey)) ?? 0);
  } catch {
    store = undefined; // Blobs unavailable → skip caps for this request
  }
  if (store && (userCount >= PER_USER_DAILY_CAP || globalCount >= GLOBAL_MONTHLY_CAP)) {
    return { statusCode: 429, body: '' };
  }

  // 3. Generate the line.
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      temperature: 0.9,
      system: coachSystemPrompt(tone, Boolean(context.crisis), Boolean(context.episode)),
      messages: [{ role: 'user', content: JSON.stringify(context) }],
    });
    const block = msg.content.find((b) => b.type === 'text');
    const line = block && block.type === 'text' ? block.text.trim() : '';
    if (!line) return { statusCode: 502, body: '' };

    // 4. Count only successful, billed calls (best-effort; a counter write
    //    failure must not 502 a line we already generated).
    if (store) {
      try {
        await store.set(userKey, String(userCount + 1));
        await store.set(globalKey, String(globalCount + 1));
      } catch {
        /* counter write failed — ignore, the line still stands */
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line }),
    };
  } catch {
    return { statusCode: 502, body: '' };
  }
};
