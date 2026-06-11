import type { Handler } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import Anthropic from '@anthropic-ai/sdk';

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
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${REVENUECAT_SECRET}` } },
  );
  if (!res.ok) return false;
  const data: any = await res.json();
  const ent = data?.subscriber?.entitlements?.premium;
  if (!ent) return false;
  // Non-consumable base unlock: present + no expiry (or a future expiry).
  return ent.expires_date == null || new Date(ent.expires_date).getTime() > Date.now();
}

function systemPrompt(tone: 'teasing' | 'roasting', crisis: boolean): string {
  if (crisis) {
    return `You are Dr. MoodRx, a darkly funny but ultimately caring fitness-for-mental-health coach. The user is showing signs of genuine distress right now. Drop the roasting entirely. In 1-2 sentences, acknowledge they showed up and gently encourage them — warm, not clinical, no diagnoses, no jokes at their expense. Use ONLY the facts provided. Never invent numbers.`;
  }
  const intensity =
    tone === 'roasting'
      ? 'Sharper, funnier, more intense — but LIGHTHEARTED. Rib their resistance/excuses to work out, never their worth, body, or anything self-harm-adjacent.'
      : 'Playful, teasing, light jabs.';
  return `You are Dr. MoodRx, a darkly funny fitness-for-mental-health coach with a film-noir, deadpan voice. Tone: ${intensity} Speak directly to the user about the workout they just did. Use ONLY the facts provided — never invent statistics, numbers, or history. Never give clinical labels, diagnoses, or medical advice. 1-2 sentences. No preamble.`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST' || !event.body) return { statusCode: 400, body: '' };
  if (!ANTHROPIC_KEY || !REVENUECAT_SECRET) return { statusCode: 500, body: '' };

  let payload: { context?: any; tone?: 'teasing' | 'roasting'; appUserId?: string };
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: '' };
  }
  const { context, tone, appUserId } = payload;
  if (!context || !appUserId || (tone !== 'teasing' && tone !== 'roasting')) {
    return { statusCode: 400, body: '' };
  }

  // 1. Entitlement — only paying (base-unlock) users trigger spend.
  if (!(await isEntitled(appUserId))) return { statusCode: 403, body: '' };

  // 2. Rate + budget caps (Netlify Blobs as counter store).
  const store = getStore('coach-usage');
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const userKey = `user:${appUserId}:${today}`;
  const globalKey = `global:${month}`;
  const userCount = Number((await store.get(userKey)) ?? 0);
  const globalCount = Number((await store.get(globalKey)) ?? 0);
  if (userCount >= PER_USER_DAILY_CAP || globalCount >= GLOBAL_MONTHLY_CAP) {
    return { statusCode: 429, body: '' };
  }

  // 3. Generate the line.
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      temperature: 0.9,
      system: systemPrompt(tone, Boolean(context.crisis)),
      messages: [{ role: 'user', content: JSON.stringify(context) }],
    });
    const block = msg.content.find((b) => b.type === 'text');
    const line = block && block.type === 'text' ? block.text.trim() : '';
    if (!line) return { statusCode: 502, body: '' };

    // 4. Count only successful, billed calls.
    await store.set(userKey, String(userCount + 1));
    await store.set(globalKey, String(globalCount + 1));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line }),
    };
  } catch {
    return { statusCode: 502, body: '' };
  }
};
