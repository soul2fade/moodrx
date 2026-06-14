/** Live (Anthropic-backed) Dr. MoodRx coach gating. Pure — no react-native. */

/** Free lifetime live-coach replies a non-MoodRx+ owner gets before the upsell. */
export const LIVE_COACH_TASTE_LIMIT = 3;

/** Whether a live coach line may be fetched: MoodRx+ always; otherwise while the
 *  free lifetime taste remains. */
export function canUseLiveCoach({
  isPlus,
  tasteUsed,
  tasteLimit = LIVE_COACH_TASTE_LIMIT,
}: {
  isPlus: boolean;
  tasteUsed: number;
  tasteLimit?: number;
}): boolean {
  if (isPlus) return true;
  return tasteUsed < tasteLimit;
}
