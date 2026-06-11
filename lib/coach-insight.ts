import type { MoodKey, Session } from '@/lib/storage';
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
