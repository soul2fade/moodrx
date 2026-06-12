import Purchases from 'react-native-purchases';
import { getSessions } from '@/lib/storage';
import { buildVentEpisodeMap } from '@/lib/coach-insight';
import { parseVentResponse, type VentAssessment } from '@/lib/vent';

/** Deployed Netlify function (free, ungated; same site as the coach). */
const VENT_ENDPOINT = 'https://moodrx-api.netlify.app/.netlify/functions/vent-line';
const TIMEOUT_MS = 8000; // STT + model; the screen shows a static placeholder meanwhile

/** Send a vent transcript; return a validated assessment, or null on
 *  offline/timeout/cap/any error (caller falls back to the mood form). */
export async function fetchVentReply(transcript: string): Promise<VentAssessment | null> {
  const text = transcript.trim();
  if (!text) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const [deviceId, sessions] = await Promise.all([
      Purchases.getAppUserID().catch(() => 'anon'),
      getSessions().catch(() => []),
    ]);
    const episodes = buildVentEpisodeMap(sessions);
    const res = await fetch(VENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: text, deviceId, episodes }),
      signal: controller.signal,
    });
    if (!res.ok) return null; // 400/429 (capped)/5xx → fall back to the form
    return parseVentResponse(await res.json());
  } catch {
    return null; // offline, timeout (abort), parse error
  } finally {
    clearTimeout(timer);
  }
}
