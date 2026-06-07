import type { MoodKey, Session } from './storage';
import { MOOD_ORDER } from './moods';
import { getWorkoutsForMood } from './workouts';

/** Returns the most frequently occurring mood across sessions.
 *  Returns null for an empty array. Ties are broken by the most
 *  recent session's mood among the tied moods, so insights and
 *  weekly prescriptions reflect the recent trend instead of silently
 *  defaulting to whichever mood comes first in MOOD_ORDER (which
 *  was always 'anxious' under the previous implementation). */
export function getMostCommonMood(sessions: Session[]): MoodKey | null {
  if (sessions.length === 0) return null;
  const counts: Partial<Record<MoodKey, number>> = {};
  for (const s of sessions) {
    counts[s.mood] = (counts[s.mood] ?? 0) + 1;
  }
  let max = 0;
  for (const key of MOOD_ORDER) {
    const c = counts[key] ?? 0;
    if (c > max) max = c;
  }
  const tied = MOOD_ORDER.filter((k) => (counts[k] ?? 0) === max);
  if (tied.length === 1) return tied[0];
  // Tie-break: most recent session whose mood is in the tied set
  const sorted = [...sessions].sort((a, b) => b.timestamp - a.timestamp);
  for (const s of sorted) {
    if (tied.includes(s.mood)) return s.mood;
  }
  return tied[0];
}

/** Formats a numeric change as "+X.X" or "-X.X" */
export function formatChange(val: number): string {
  const rounded = Math.abs(val).toFixed(1);
  return val >= 0 ? `+${rounded}` : `-${rounded}`;
}

// ─── Weekly prescription ─────────────────────────────────────────────────────

export interface DayRx {
  dayIndex: number;      // JS getDay(): 0=Sun … 6=Sat
  dayLabel: string;      // 'MON' | 'TUE' | …
  mood: MoodKey;
  workoutId: string;
  workoutName: string;
  duration: number;
  intensity: string;
  isDataDriven: boolean; // true = learned from history, false = smart default
}

// Mon → Sun display order; dayIndex = JS Date.getDay() value
const WEEK_DAYS = [
  { label: 'MON', idx: 1 },
  { label: 'TUE', idx: 2 },
  { label: 'WED', idx: 3 },
  { label: 'THU', idx: 4 },
  { label: 'FRI', idx: 5 },
  { label: 'SAT', idx: 6 },
  { label: 'SUN', idx: 0 },
];

// Curated default rotation so every day gets something different
const DEFAULT_MOODS: MoodKey[] = [
  'anxious',   // Mon — start-of-week tension
  'low',       // Tue — mid-slump
  'stressed',  // Wed — hump-day pressure
  'foggy',     // Thu — mental fatigue
  'restless',  // Fri — pre-weekend energy
  'good',      // Sat — peak performance day
  'anxious',   // Sun — recovery / wind-down
];

export function buildWeeklyPrescription(sessions: Session[]): DayRx[] {
  const hasHistory = sessions.length >= 5;

  return WEEK_DAYS.map(({ label, idx }, i) => {
    // Sessions that historically fell on this day of the week
    const daySessions = sessions.filter(
      (s) => new Date(s.timestamp).getDay() === idx,
    );

    const isDataDriven = daySessions.length >= 2;

    // Pick mood: data-driven ≥ 2 sessions → most common on that day
    //            some history overall → overall most common
    //            cold start → curated default
    let mood: MoodKey;
    if (isDataDriven) {
      mood = getMostCommonMood(daySessions) ?? DEFAULT_MOODS[i];
    } else if (hasHistory) {
      mood = getMostCommonMood(sessions) ?? DEFAULT_MOODS[i];
    } else {
      mood = DEFAULT_MOODS[i];
    }

    const options = getWorkoutsForMood(mood);

    // Pick best workout: if we have day-level data, find the workout that
    // improved mood the most (postScore − intensity as a rough delta).
    // Otherwise rotate through options by day index to add variety.
    let best = options[i % options.length] ?? options[0];

    if (daySessions.length > 0) {
      const scores: Record<string, { total: number; count: number }> = {};
      for (const s of daySessions) {
        if (s.workoutId) {
          const delta = s.postScore - s.intensity;
          scores[s.workoutId] = scores[s.workoutId] ?? { total: 0, count: 0 };
          scores[s.workoutId].total += delta;
          scores[s.workoutId].count += 1;
        }
      }
      let bestScore = -Infinity;
      for (const opt of options) {
        const entry = scores[opt.id];
        if (entry) {
          const avg = entry.total / entry.count;
          if (avg > bestScore) {
            bestScore = avg;
            best = opt;
          }
        }
      }
    }

    return {
      dayIndex: idx,
      dayLabel: label,
      mood,
      workoutId: best.id,
      workoutName: best.name,
      duration: best.duration,
      intensity: best.intensity,
      isDataDriven,
    };
  });
}
