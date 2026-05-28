import type { Workout } from '@/lib/workouts';

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Rotating index (1..n-1) for the weekly free bonus workout. */
export function getWeeklyBonusWorkoutIndex(workoutCount: number): number | null {
  if (workoutCount <= 1) return null;
  const week = Math.floor(Date.now() / MS_PER_WEEK);
  return 1 + (week % (workoutCount - 1));
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

export function getWorkoutLockLabel(
  isPremium: boolean,
  index: number,
  workoutCount: number,
): string {
  if (isWorkoutUnlocked(isPremium, index, workoutCount)) return '';
  return 'PRO ONLY · FREE BONUS ROTATES WEEKLY';
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
