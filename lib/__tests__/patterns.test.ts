import { describe, it, expect } from 'vitest';
import { sessionImprovement, classifyTier } from '@/lib/patterns';
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
