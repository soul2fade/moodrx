import Purchases from 'react-native-purchases';
import { getTrashTalkVolume } from '@/lib/storage';
import type { CoachContext, CoachTone } from '@/lib/coach-insight';

/** Deployed Netlify function that holds the API keys server-side. */
const COACH_ENDPOINT = 'https://moodrx-api.netlify.app/.netlify/functions/coach-line';
const TIMEOUT_MS = 4000;

/** Tone rides on the existing trash-talk volume (0–1): upper half roasts. */
export async function resolveTone(): Promise<CoachTone> {
  const volume = await getTrashTalkVolume().catch(() => 0.5);
  return volume >= 0.5 ? 'roasting' : 'teasing';
}

/** Returns a dynamic coach line, or null on offline/timeout/any error.
 *  Callers MUST fall back to the static line on null. */
export async function fetchDynamicLine(context: CoachContext): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const [tone, appUserId] = await Promise.all([resolveTone(), Purchases.getAppUserID()]);
    const res = await fetch(COACH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, tone, appUserId }),
      signal: controller.signal,
    });
    if (!res.ok) return null; // 403 not-entitled, 429 capped, 5xx, etc.
    const data = (await res.json()) as { line?: string };
    return typeof data.line === 'string' && data.line.trim() ? data.line.trim() : null;
  } catch {
    return null; // offline, timeout (abort), parse error — fall back to static
  } finally {
    clearTimeout(timer);
  }
}
