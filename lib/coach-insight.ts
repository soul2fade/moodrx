import { sessionDateString, type MoodKey, type Session } from '@/lib/storage';
import type { Workout } from '@/lib/workouts';
import { getWorkoutEffectiveness } from '@/lib/workout-insights';
import { getLastNDays } from '@/lib/analytics';

export type CoachTone = 'teasing' | 'roasting';

export interface CoachContext {
  mood: MoodKey;
  intensity: number; // pre-workout 0–10
  workoutName: string;
  /** How often this workout has helped this user for this mood, if rated. */
  workoutHelpedRate: string | null; // e.g. "helped 3/4 times" or null
  /** Short recent-trend descriptor over the last logged days. */
  recentTrend: 'improving' | 'flat' | 'declining' | 'new';
  /** True when signals suggest genuine distress — the coach pulls its punch. */
  crisis: boolean;
}

/** Crisis floor: only the extreme tail, NOT everyday low moods.
 *  High pre-intensity on a distress mood, with no recent improvement. */
function isCrisisSignal(mood: MoodKey, intensity: number, sessions: Session[]): boolean {
  const distressMood = mood === 'anxious' || mood === 'low' || mood === 'stressed';
  if (!distressMood || intensity < 9) return false;
  // No improvement in the last 2 rated sessions = downward/stuck.
  const recentRated = [...sessions].reverse().filter((s) => s.rating).slice(0, 2);
  const noneHelped = recentRated.length >= 2 && recentRated.every((s) => s.rating === 'no');
  return noneHelped;
}

function trend(sessions: Session[]): CoachContext['recentTrend'] {
  const days = getLastNDays(sessions, 5);
  if (days.length < 2) return 'new';
  // Improvement = effective delta rising. For every mood except 'good', a
  // LOWER post-score is better, so flip the per-day sign before comparing.
  const effective = days.map((d) =>
    d.mood === 'good' ? d.postScore - d.intensity : d.intensity - d.postScore,
  );
  const first = effective[0];
  const last = effective[effective.length - 1];
  if (last - first > 0.5) return 'improving';
  if (first - last > 0.5) return 'declining';
  return 'flat';
}

export function buildCoachContext(
  args: { mood: MoodKey; intensity: number; workout: Workout | undefined },
  sessions: Session[],
): CoachContext {
  const { mood, intensity, workout } = args;
  const helped = workout != null ? getWorkoutEffectiveness(sessions, workout) : null;
  const workoutHelpedRate =
    helped && helped.ratedCount > 0 && helped.yesCount > 0
      ? `helped ${helped.yesCount}/${helped.ratedCount} times`
      : null;
  return {
    mood,
    intensity,
    workoutName: workout?.name ?? 'that workout',
    workoutHelpedRate,
    recentTrend: trend(sessions),
    crisis: isCrisisSignal(mood, intensity, sessions),
  };
}

// ─── Episodic memory (Unit B) ────────────────────────────────────────────────
//
// A specific past session the coach/vent reply may reference. Structured facts
// ONLY — never a transcript. Emitted only when a session genuinely teaches a
// lesson, so the model can never fabricate significance.
export interface Episode {
  mood: MoodKey;
  intensity: number;
  workoutName: string;
  /** The clear outcome the selector keys on. 'somewhat'/unrated never qualify,
   *  so an emitted episode is always a decisive win or flop. */
  helped: 'yes' | 'no';
  /** Full weekday name of the session, e.g. 'Monday'. */
  dayLabel: string;
  /** Whole days between the session and `now`. */
  daysAgo: number;
}

/** Older than this teaches little; excluded from recall. */
const EPISODE_RECENCY_DAYS = 30;

const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** Pick at most one decision-relevant prior episode for the given state, or
 *  null. Qualifiers: same mood, a clear 'yes'/'no' outcome, within the recency
 *  window, not in the future. Among qualifiers, score = recency + intensity
 *  closeness (recency dominates), ties broken toward the more recent session. */
export function selectEpisode(
  mood: MoodKey,
  intensity: number,
  sessions: Session[],
  now: number = Date.now(),
): Episode | null {
  const windowMs = EPISODE_RECENCY_DAYS * 86_400_000;
  const candidates = sessions.filter(
    (s) =>
      s.mood === mood &&
      (s.rating === 'yes' || s.rating === 'no') &&
      s.timestamp <= now &&
      now - s.timestamp <= windowMs,
  );
  if (candidates.length === 0) return null;

  let best: Session | null = null;
  let bestScore = -Infinity;
  for (const s of candidates) {
    const daysAgo = Math.floor((now - s.timestamp) / 86_400_000);
    const recencyScore = EPISODE_RECENCY_DAYS - daysAgo;        // newer → higher
    const closenessScore = 10 - Math.abs(intensity - s.intensity); // similar → higher
    const score = recencyScore + closenessScore;
    if (score > bestScore || (score === bestScore && best != null && s.timestamp > best.timestamp)) {
      bestScore = score;
      best = s;
    }
  }
  if (!best) return null;

  return {
    mood: best.mood,
    intensity: best.intensity,
    workoutName: best.workoutName,
    helped: best.rating as 'yes' | 'no',
    dayLabel: WEEKDAY_NAMES[new Date(sessionDateString(best) + 'T00:00:00').getDay()],
    daysAgo: Math.floor((now - best.timestamp) / 86_400_000),
  };
}
