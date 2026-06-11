import { getWorkoutById, type Workout } from '@/lib/workouts';

export interface Program {
  id: string;
  title: string;
  description: string;
  workoutIds: string[];
}

/** Curated sequences of existing workouts. Free within the base unlock. */
export const PROGRAMS: Program[] = [
  {
    id: 'reset-week',
    title: 'Reset Week',
    description: 'Seven days to pull yourself back to baseline — one prescription a day, across the moods you actually cycle through.',
    workoutIds: ['anxious-1', 'low-3', 'foggy-3', 'restless-3', 'stressed-2', 'good-3', 'anxious-2'],
  },
  {
    id: 'calm-fast',
    title: 'Calm Down Fast',
    description: 'A three-session sequence for when the anxiety and stress are stacking up and you need off the ledge today.',
    workoutIds: ['anxious-1', 'stressed-1', 'anxious-2'],
  },
];

export function getProgramById(id: string): Program | undefined {
  return PROGRAMS.find((p) => p.id === id);
}

export function getProgramWorkouts(program: Program): Workout[] {
  return program.workoutIds
    .map((id) => getWorkoutById(id))
    .filter((w): w is Workout => w !== undefined);
}
