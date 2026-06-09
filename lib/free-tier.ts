import type { Workout } from '@/lib/workouts';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Number of complete weeks since 1970-01-05 (a Monday) in local time.
 *  Anchoring on local Monday at 00:00 means the bonus rotates at
 *  Sunday→Monday local midnight — not Wednesday/Thursday afternoon,
 *  which is when the old `Date.now() / MS_PER_WEEK` boundary hit for
 *  Western Hemisphere users (the Unix epoch was a Thursday in UTC,
 *  so the implicit "week start" sat on UTC Thursday 00:00 — mid-week
 *  in PT/MT/CT/ET local time).
 *  Math.round() on the day diff absorbs DST shifts: a 23h or 25h
 *  day doesn't push the calendar-day count off by one. */
function localMondayWeekIndex(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dow = now.getDay();           // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToMonday = (dow + 6) % 7; // Mon=0, Sun=6
  now.setDate(now.getDate() - daysToMonday);
  // 'now' is local Monday 00:00.
  const epoch = new Date(1970, 0, 5); // local Mon Jan 5, 1970 00:00
  epoch.setHours(0, 0, 0, 0);
  const days = Math.round((now.getTime() - epoch.getTime()) / MS_PER_DAY);
  return Math.floor(days / 7);
}

/** Rotating index (1..n-1) for the weekly free bonus workout. */
export function getWeeklyBonusWorkoutIndex(workoutCount: number): number | null {
  if (workoutCount <= 1) return null;
  return 1 + (localMondayWeekIndex() % (workoutCount - 1));
}

export function isWorkoutUnlocked(
  isPremium: boolean,
  index: number,
  workoutCount: number,
): boolean {
  if (isPremium) return true;
  if (index === 0) return true;
  const bonusIndex = getWeeklyBonusWorkoutIndex(workoutCount);
  return bonusIndex !== null && index === bonusIndex;
}

export function getFreeTierSummary(workouts: Workout[], isPremium: boolean): string | null {
  if (isPremium || workouts.length === 0) return null;

  const bonusIndex = getWeeklyBonusWorkoutIndex(workouts.length);
  const primary = workouts[0]?.name ?? "Today's pick";
  if (bonusIndex !== null && workouts[bonusIndex]) {
    return `Free: ${primary} + weekly bonus ${workouts[bonusIndex].name}. Pro unlocks all ${workouts.length}.`;
  }
  return `Free: ${primary}. Pro unlocks all ${workouts.length} prescriptions for this mood.`;
}

export function isSupplementUnlocked(isPremium: boolean, index: number): boolean {
  return isPremium || index === 0;
}
