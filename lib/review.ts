import * as StoreReview from 'expo-store-review';
import { getReviewState, setReviewRequested } from './storage';

// Once asked, don't ask again for a long stretch. Apple/Google already
// rate-limit their native prompts, but we add our own floor so the app
// never feels like it's nagging — we only ever surface this after a
// genuinely positive moment, and at most once per interval.
const MIN_INTERVAL_MS = 120 * 24 * 60 * 60 * 1000; // ~120 days

/**
 * Ask the OS to surface an in-app review prompt — but only at a genuinely
 * positive moment, and never in a way that nags or blocks the UI.
 *
 * Fully guarded: a no-op when store review isn't available (e.g. web), when
 * we've asked within the throttle window, or on any error. Callers can
 * fire-and-forget; this never throws and never blocks navigation.
 *
 * @param reason short label for the triggering moment (logging/debug only).
 */
export async function maybeRequestReview(reason: string): Promise<void> {
  try {
    if (!(await StoreReview.isAvailableAsync())) return;

    const { lastRequestedAt } = await getReviewState();
    const now = Date.now();
    if (lastRequestedAt !== null && now - lastRequestedAt < MIN_INTERVAL_MS) {
      return;
    }

    await StoreReview.requestReview();
    // Persist only after a successful request so a transient failure (e.g.
    // availability check passed but requestReview threw) doesn't burn the
    // whole interval — the next positive moment can retry.
    await setReviewRequested(now);
  } catch (e) {
    console.warn(`[MoodRx] maybeRequestReview (${reason}) failed:`, e);
  }
}
