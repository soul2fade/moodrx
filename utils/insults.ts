import { COACH_LINES } from '../constants/coach-lines';
import { INSULTS, InsultMood, WorkoutMoment } from '../constants/insults';

const COACH_MOODS: InsultMood[] = ['anxious', 'low'];

export function getInsult(
  mood: string,
  moment: WorkoutMoment,
  options?: { enabled?: boolean; tone?: 'coach' | 'firm' }
): string {
  if (options?.enabled === false) return '';

  const moodKey = mood as InsultMood;
  const useCoach =
    options?.tone === 'coach' ||
    (options?.tone !== 'firm' && COACH_MOODS.includes(moodKey));

  const pool = useCoach ? COACH_LINES[moodKey]?.[moment] : INSULTS[moodKey]?.[moment];
  if (!pool?.length) {
    const fallback = INSULTS[moodKey]?.[moment];
    if (!fallback?.length) return '';
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
