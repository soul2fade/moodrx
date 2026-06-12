import { describe, it, expect } from 'vitest';
import { sessionImprovement, classifyTier, detectTimeOfDay, detectDayOfWeek } from '@/lib/patterns';
import type { MoodKey, Session } from '@/lib/storage';

// ── Shared fixture helpers (used by all pattern tests) ───────────────────────
/** Local-constructed epoch ms — getHours() on this round-trips to `hour`
 *  regardless of the test machine's timezone. */
function at(year: number, month1: number, day: number, hour = 9): number {
  return new Date(year, month1 - 1, day, hour, 0, 0).getTime();
}
function dateStr(year: number, month1: number, day: number): string {
  return `${year}-${String(month1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function mk(over: Partial<Session>): Session {
  return {
    id: Math.random().toString(36).slice(2),
    mood: 'stressed',
    intensity: 6,
    postScore: 4,
    workoutName: 'Box Breathing',
    duration: 5,
    timestamp: at(2026, 6, 1, 9),
    rating: 'yes',
    localDateString: dateStr(2026, 6, 1),
    ...over,
  };
}
/** A June-2026 session on `day` at `hour`, with explicit intensity/post(/mood). */
function sess(day: number, hour: number, intensity: number, post: number, mood: MoodKey = 'stressed'): Session {
  return mk({
    timestamp: at(2026, 6, day, hour),
    localDateString: dateStr(2026, 6, day),
    intensity,
    postScore: post,
    mood,
  });
}

describe('sessionImprovement', () => {
  it('is intensity - post for distress moods (lower post = better)', () => {
    expect(sessionImprovement(sess(1, 9, 8, 4, 'stressed'))).toBe(4);
    expect(sessionImprovement(sess(1, 9, 6, 6, 'low'))).toBe(0);
  });
  it('is post - intensity for the good mood (higher post = better)', () => {
    expect(sessionImprovement(sess(1, 9, 3, 7, 'good'))).toBe(4);
  });
});

describe('classifyTier', () => {
  it('emits nothing below the observation floor', () => {
    expect(classifyTier(3, 4, 5, 1, 2)).toBe('none');
  });
  it('emits nothing when the effect is below the gray threshold', () => {
    expect(classifyTier(5, 4, 0.5, 1, 2)).toBe('none');
  });
  it('emits a question in the gray zone (>= gray, < strong)', () => {
    expect(classifyTier(5, 4, 1.5, 1, 2)).toBe('question');
    expect(classifyTier(4, 4, 1, 1, 2)).toBe('question'); // both at floor/boundary
  });
  it('emits a finding at or above the strong threshold', () => {
    expect(classifyTier(5, 4, 2, 1, 2)).toBe('finding');
    expect(classifyTier(10, 4, 4, 1, 2)).toBe('finding');
  });
});

describe('detectTimeOfDay', () => {
  it('emits a finding when one part of day clearly helps more', () => {
    const sessions = [
      // 4 morning sessions, improvement 4 (int 8 - post 4)
      sess(1, 9, 8, 4), sess(3, 9, 8, 4), sess(5, 9, 8, 4), sess(7, 9, 8, 4),
      // 4 evening sessions, improvement 1 (int 6 - post 5)
      sess(2, 19, 6, 5), sess(4, 19, 6, 5), sess(6, 19, 6, 5), sess(8, 19, 6, 5),
    ];
    const item = detectTimeOfDay(sessions);
    expect(item?.kind).toBe('finding');
    expect(item?.id).toBe('time-of-day');
    expect(item?.text.toLowerCase()).toContain('morning');
  });

  it('emits a hedged question in the gray zone', () => {
    const sessions = [
      // morning improvement 3 (int 7 - post 4)
      sess(1, 9, 7, 4), sess(3, 9, 7, 4), sess(5, 9, 7, 4), sess(7, 9, 7, 4),
      // evening improvement 1.5 (int 6 - post 4.5) → effect 1.5
      sess(2, 19, 6, 4.5), sess(4, 19, 6, 4.5), sess(6, 19, 6, 4.5), sess(8, 19, 6, 4.5),
    ];
    const item = detectTimeOfDay(sessions);
    expect(item?.kind).toBe('question');
    expect(item?.text.toLowerCase()).toContain('morning');
  });

  it('returns null below the per-bucket floor', () => {
    const sessions = [
      sess(1, 9, 8, 4), sess(3, 9, 8, 4), sess(5, 9, 8, 4), // only 3 morning
      sess(2, 19, 6, 5), sess(4, 19, 6, 5), sess(6, 19, 6, 5), sess(8, 19, 6, 5), sess(10, 19, 6, 5),
    ];
    expect(detectTimeOfDay(sessions)).toBeNull();
  });

  it('returns null when the two parts of day are equivalent', () => {
    const sessions = [
      sess(1, 9, 6, 4), sess(3, 9, 6, 4), sess(5, 9, 6, 4), sess(7, 9, 6, 4),   // imp 2
      sess(2, 19, 6, 4), sess(4, 19, 6, 4), sess(6, 19, 6, 4), sess(8, 19, 6, 4), // imp 2
    ];
    expect(detectTimeOfDay(sessions)).toBeNull();
  });
});

describe('detectDayOfWeek', () => {
  it('emits a finding when one weekday runs much rougher', () => {
    const sessions = [
      // 4 Wednesdays at intensity 9
      sess(3, 9, 9, 4), sess(10, 9, 9, 4), sess(17, 9, 9, 4), sess(24, 9, 9, 4),
      // other days at intensity 5 (≤2 per weekday so none else is eligible)
      sess(1, 9, 5, 4), sess(2, 9, 5, 4), sess(4, 9, 5, 4),
      sess(5, 9, 5, 4), sess(8, 9, 5, 4), sess(9, 9, 5, 4),
    ];
    const item = detectDayOfWeek(sessions);
    expect(item?.kind).toBe('finding');
    expect(item?.id).toBe('day-of-week');
    expect(item?.text.toLowerCase()).toContain('wednesday');
  });

  it('emits a question for a milder weekday spike', () => {
    const sessions = [
      sess(3, 9, 7, 4), sess(10, 9, 7, 4), sess(17, 9, 7, 4), // 3 Wednesdays at 7
      sess(1, 9, 5, 4), sess(2, 9, 5, 4), sess(4, 9, 5, 4), sess(5, 9, 5, 4), // others at 5 → effect 2.0
    ];
    const item = detectDayOfWeek(sessions);
    expect(item?.kind).toBe('question');
    expect(item?.text.toLowerCase()).toContain('wednesday');
  });

  it('returns null below the per-weekday floor', () => {
    const sessions = [
      sess(3, 9, 9, 4), sess(10, 9, 9, 4), // only 2 Wednesdays
      sess(1, 9, 5, 4), sess(2, 9, 5, 4), sess(4, 9, 5, 4), sess(5, 9, 5, 4),
    ];
    expect(detectDayOfWeek(sessions)).toBeNull();
  });

  it('returns null when no weekday stands out', () => {
    const sessions = [
      sess(3, 9, 5, 4), sess(10, 9, 5, 4), sess(17, 9, 5, 4), // Wednesdays at 5
      sess(1, 9, 5, 4), sess(2, 9, 5, 4), sess(4, 9, 5, 4),   // others at 5
    ];
    expect(detectDayOfWeek(sessions)).toBeNull();
  });
});
