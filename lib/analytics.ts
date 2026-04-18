import type { MoodKey, Session } from './storage';
import { MOOD_ORDER } from './moods';

/** Returns the most frequently occurring mood across sessions */
export function getMostCommonMood(sessions: Session[]): MoodKey {
  const counts: Partial<Record<MoodKey, number>> = {};
  for (const s of sessions) {
    counts[s.mood] = (counts[s.mood] ?? 0) + 1;
  }
  let max = 0;
  let best: MoodKey = 'anxious';
  for (const key of MOOD_ORDER) {
    const c = counts[key] ?? 0;
    if (c > max) {
      max = c;
      best = key;
    }
  }
  return best;
}

/** Formats a numeric change as "+X.X" or "-X.X" */
export function formatChange(val: number): string {
  const rounded = Math.abs(val).toFixed(1);
  return val >= 0 ? `+${rounded}` : `-${rounded}`;
}
