import { INSULTS, InsultMood, WorkoutMoment } from '../constants/insults';

export function getInsult(mood: string, moment: WorkoutMoment): string {
  const moodInsults = INSULTS[mood as InsultMood];
  if (!moodInsults) return '';
  const lines = moodInsults[moment];
  return lines[Math.floor(Math.random() * lines.length)];
}
