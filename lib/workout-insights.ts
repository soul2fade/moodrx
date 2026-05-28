import type { MoodKey, Session } from '@/lib/storage';
import type { Workout } from '@/lib/workouts';

export interface WorkoutEffectiveness {
  workoutId: string;
  workoutName: string;
  mood: MoodKey;
  yesCount: number;
  somewhatCount: number;
  noCount: number;
  ratedCount: number;
  sessionCount: number;
  avgDelta: number;
}

export interface PrescriptionWorkouts {
  ordered: Workout[];
  alternateNote: { demotedName: string; suggestedName: string } | null;
}

export interface EffectiveCombo {
  mood: MoodKey;
  workoutName: string;
  label: string;
  yesCount: number;
  ratedCount: number;
}

const NO_DEMOTE_THRESHOLD = 2;

const MOODS_LABEL: Record<MoodKey, string> = {
  anxious: 'Anxious',
  low: 'Low',
  foggy: 'Foggy',
  restless: 'Restless',
  stressed: 'Stressed',
  good: 'Good',
};

function sessionsForWorkout(sessions: Session[], workout: Workout): Session[] {
  return sessions.filter(
    (s) =>
      (s.workoutId && s.workoutId === workout.id) ||
      (!s.workoutId && s.workoutName === workout.name),
  );
}

export function getWorkoutEffectiveness(
  sessions: Session[],
  workout: Workout,
): WorkoutEffectiveness {
  const relevant = sessionsForWorkout(sessions, workout);
  const rated = relevant.filter((s) => s.rating);
  const yesCount = rated.filter((s) => s.rating === 'yes').length;
  const somewhatCount = rated.filter((s) => s.rating === 'somewhat').length;
  const noCount = rated.filter((s) => s.rating === 'no').length;
  const avgDelta =
    relevant.length > 0
      ? relevant.reduce((sum, s) => sum + (s.postScore - s.intensity), 0) / relevant.length
      : 0;

  return {
    workoutId: workout.id,
    workoutName: workout.name,
    mood: workout.mood,
    yesCount,
    somewhatCount,
    noCount,
    ratedCount: rated.length,
    sessionCount: relevant.length,
    avgDelta,
  };
}

function scoreWorkout(sessions: Session[], workout: Workout, catalogIndex: number): number {
  const stats = getWorkoutEffectiveness(sessions, workout);
  let score = 0;

  score += stats.yesCount * 10;
  score += stats.somewhatCount * 3;
  score -= stats.noCount * 8;
  if (stats.avgDelta < 0) score += 2;
  if (stats.noCount >= NO_DEMOTE_THRESHOLD) score -= 1000;

  return score * 1000 - catalogIndex;
}

export function rankWorkoutsByHistory(workouts: Workout[], sessions: Session[]): Workout[] {
  return [...workouts]
    .map((workout, index) => ({ workout, index, score: scoreWorkout(sessions, workout, index) }))
    .sort((a, b) => b.score - a.score)
    .map(({ workout }) => workout);
}

export function getPrescriptionWorkouts(
  workouts: Workout[],
  sessions: Session[],
): PrescriptionWorkouts {
  const ordered = rankWorkoutsByHistory(workouts, sessions);

  const demoted = workouts.find((workout) => {
    const stats = getWorkoutEffectiveness(sessions, workout);
    return stats.noCount >= NO_DEMOTE_THRESHOLD && ordered[0]?.id !== workout.id;
  });

  if (demoted && ordered[0]) {
    return {
      ordered,
      alternateNote: {
        demotedName: demoted.name,
        suggestedName: ordered[0].name,
      },
    };
  }

  return { ordered, alternateNote: null };
}

export function getWorkoutBadge(
  sessions: Session[],
  workout: Workout,
): string | null {
  const stats = getWorkoutEffectiveness(sessions, workout);
  if (stats.ratedCount === 0) return null;

  if (stats.yesCount > 0) {
    return `HELPED ${stats.yesCount}/${stats.ratedCount} TIMES`;
  }

  const relevant = sessionsForWorkout(sessions, workout).filter((s) => s.rating);
  const lastRating = relevant[relevant.length - 1]?.rating;
  if (lastRating === 'no') return "DIDN'T LAND LAST TIME";
  if (lastRating === 'somewhat') return 'MIXED RESULTS';

  return null;
}

export function getTopEffectiveCombinations(
  sessions: Session[],
  limit = 3,
): EffectiveCombo[] {
  const combos = new Map<string, EffectiveCombo>();

  for (const session of sessions) {
    if (!session.rating) continue;
    const key = `${session.mood}:${session.workoutName}`;
    const existing = combos.get(key) ?? {
      mood: session.mood,
      workoutName: session.workoutName,
      label: '',
      yesCount: 0,
      ratedCount: 0,
    };
    existing.ratedCount += 1;
    if (session.rating === 'yes') existing.yesCount += 1;
    combos.set(key, existing);
  }

  return [...combos.values()]
    .filter((c) => c.yesCount > 0)
    .sort((a, b) => {
      const rateA = a.yesCount / a.ratedCount;
      const rateB = b.yesCount / b.ratedCount;
      if (rateB !== rateA) return rateB - rateA;
      return b.yesCount - a.yesCount;
    })
    .slice(0, limit)
    .map((combo) => ({
      ...combo,
      label: `${MOODS_LABEL[combo.mood]} + ${combo.workoutName} — helped ${combo.yesCount}/${combo.ratedCount} times`,
    }));
}
