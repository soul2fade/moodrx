import Purchases from 'react-native-purchases';
import { getInsultSeverity } from '@/lib/storage';
import type { CoachContext, CoachTone } from '@/lib/coach-insight';

/** Deployed Netlify function that holds the API keys server-side. */
const COACH_ENDPOINT = 'https://moodrx-api.netlify.app/.netlify/functions/coach-line';
const TIMEOUT_MS = 4000;

/** The coach's tone IS the chosen trash-talk severity (Glass House / Sticks and
 *  Stones / Roasted). Defaults to 'sticks' on any storage error. */
export async function resolveTone(): Promise<CoachTone> {
  return getInsultSeverity().catch(() => 'sticks');
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
