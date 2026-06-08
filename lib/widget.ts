import type { Session } from './storage';
import { getStreak, hasSessionToday } from './storage';
import { buildWeeklyPrescription } from './analytics';
import { MOODS } from './moods';
import { writeWidgetSnapshot } from './widget-bridge';

/** Precomputed, native-friendly snapshot of what the widget renders. Mood
 *  name + brand color are resolved here so the widget never needs the MOODS
 *  map. Shared by Android (rendered in JS) and iOS (written to App Group). */
export interface WidgetSnapshot {
  streak: number;
  checkedInToday: boolean;
  hasSessions: boolean;          // false → "log your first mood" state
  today: {
    moodName: string;            // e.g. "Anxious"
    moodColor: string;           // e.g. "#E8B84B"
    workoutName: string;
    durationMin: number;
  } | null;
  updatedAt: number;             // unix ms
}

/** Pure: derive the widget snapshot from the session history. Must stay
 *  self-sufficient — the Android headless task handler calls this with
 *  sessions loaded straight from AsyncStorage. */
export function buildWidgetSnapshot(sessions: Session[]): WidgetSnapshot {
  const plan = buildWeeklyPrescription(sessions);
  const todayIdx = new Date().getDay();
  const todayRx = plan.find((d) => d.dayIndex === todayIdx) ?? null;
  return {
    streak: getStreak(sessions),
    checkedInToday: hasSessionToday(sessions),
    hasSessions: sessions.length > 0,
    today: todayRx
      ? {
          moodName: MOODS[todayRx.mood].name,
          moodColor: MOODS[todayRx.mood].color,
          workoutName: todayRx.workoutName,
          durationMin: todayRx.duration,
        }
      : null,
    updatedAt: Date.now(),
  };
}

/** Build + push the snapshot to the platform widget. Fully guarded so a
 *  widget failure can never break the app flow. No-op on web/iOS (PR 1). */
export async function syncWidget(sessions: Session[]): Promise<void> {
  try {
    await writeWidgetSnapshot(buildWidgetSnapshot(sessions));
  } catch (e) {
    console.warn('[MoodRx] syncWidget failed:', e);
  }
}
