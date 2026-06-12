import { describe, it, expect } from 'vitest';
import { sessionImprovement, classifyTier, detectTimeOfDay, detectDayOfWeek, detectConsistency, buildPatterns, detectSleep } from '@/lib/patterns';
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

describe('detectConsistency', () => {
  it('emits a finding when stacked days clearly help more', () => {
    const sessions = [
      // Run Jun 1-5: Jun 1 is after-gap; Jun 2-5 are back-to-back, improvement 4.
      sess(1, 9, 6, 5),                                   // after-gap, imp 1
      sess(2, 9, 8, 4), sess(3, 9, 8, 4), sess(4, 9, 8, 4), sess(5, 9, 8, 4), // back-to-back, imp 4
      // Isolated after-gap days, improvement 1 → gap group has 4 days total.
      sess(9, 9, 6, 5), sess(11, 9, 6, 5), sess(13, 9, 6, 5),
    ];
    const item = detectConsistency(sessions);
    expect(item?.kind).toBe('finding');
    expect(item?.id).toBe('consistency');
    expect(item?.text.toLowerCase()).toContain("skip"); // "don't skip days"
  });

  it('emits a question for a milder consistency effect', () => {
    const sessions = [
      sess(1, 9, 6, 4.5),                                       // after-gap, imp 1.5
      sess(2, 9, 7, 4), sess(3, 9, 7, 4), sess(4, 9, 7, 4), sess(5, 9, 7, 4), // back-to-back, imp 3
      sess(9, 9, 6, 4.5), sess(11, 9, 6, 4.5), sess(13, 9, 6, 4.5),           // gap, imp 1.5 → effect 1.5
    ];
    const item = detectConsistency(sessions);
    expect(item?.kind).toBe('question');
  });

  it('returns null below the per-group floor', () => {
    const sessions = [
      // Run Jun 1-3 → only 2 back-to-back days (Jun 2, 3).
      sess(1, 9, 6, 5), sess(2, 9, 8, 4), sess(3, 9, 8, 4),
      sess(9, 9, 6, 5), sess(11, 9, 6, 5), sess(13, 9, 6, 5), sess(15, 9, 6, 5),
    ];
    expect(detectConsistency(sessions)).toBeNull();
  });

  it('returns null when there are no back-to-back days at all', () => {
    const sessions = [
      sess(1, 9, 8, 4), sess(5, 9, 8, 4), sess(9, 9, 8, 4),
      sess(13, 9, 6, 5), sess(17, 9, 6, 5), sess(21, 9, 6, 5),
    ];
    expect(detectConsistency(sessions)).toBeNull();
  });
});

describe('buildPatterns', () => {
  it('produces ZERO findings on a flat/noise session set', () => {
    // Uniform improvement (imp 2) and intensity (5); alternating morning/evening;
    // no two days consecutive; no weekday reaching the floor. Nothing must fire.
    const noise = [
      sess(1, 9, 5, 3), sess(3, 19, 5, 3), sess(5, 9, 5, 3), sess(7, 19, 5, 3),
      sess(9, 9, 5, 3), sess(11, 19, 5, 3), sess(13, 9, 5, 3), sess(15, 19, 5, 3),
      sess(17, 9, 5, 3), sess(19, 19, 5, 3),
    ];
    const items = buildPatterns(noise);
    expect(items.filter((i) => i.kind === 'finding')).toHaveLength(0);
    expect(items).toEqual([]); // gray zone is quiet too on genuine noise
  });

  it('orders findings before questions', () => {
    // All hour 9 → time-of-day silent (evening bucket empty).
    // Consistency: Jun 2-5 back-to-back (imp 4) vs 6 after-gap days (imp 1) → FINDING.
    // Day-of-week: 3 Saturdays (Jun 13,20,27) at intensity 9 vs others ~7.14 → effect ~1.86 → QUESTION.
    const sessions = [
      sess(1, 9, 6, 5),                                                   // after-gap, imp 1, Mon
      sess(2, 9, 8, 4), sess(3, 9, 8, 4), sess(4, 9, 8, 4), sess(5, 9, 8, 4), // back-to-back, imp 4
      sess(9, 9, 6, 5), sess(11, 9, 6, 5),                                // after-gap, imp 1
      sess(13, 9, 9, 8), sess(20, 9, 9, 8), sess(27, 9, 9, 8),            // Saturdays, int 9, imp 1
    ];
    const items = buildPatterns(sessions);
    const kinds = items.map((i) => i.kind);
    expect(kinds).toContain('finding');
    expect(kinds).toContain('question');
    // every finding precedes every question
    expect(kinds.lastIndexOf('finding')).toBeLessThan(kinds.indexOf('question'));
  });

  it('returns an empty list when there is no data', () => {
    expect(buildPatterns([])).toEqual([]);
  });
});

describe('detectSleep', () => {
  it('emits a finding when rested nights clearly help more', () => {
    const sessions = [
      { ...sess(1, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(2, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(3, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(4, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(5, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(6, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(7, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(8, 9, 6, 5), sleepHoursLastNight: 5 },
    ];
    const item = detectSleep(sessions);
    expect(item?.kind).toBe('finding');
    expect(item?.id).toBe('sleep');
    expect(item?.text.toLowerCase()).toContain('sleep');
  });

  it('emits a hedged question in the gray zone', () => {
    const sessions = [
      { ...sess(1, 9, 7, 4), sleepHoursLastNight: 8 },
      { ...sess(2, 9, 7, 4), sleepHoursLastNight: 8 },
      { ...sess(3, 9, 7, 4), sleepHoursLastNight: 8 },
      { ...sess(4, 9, 7, 4), sleepHoursLastNight: 8 },
      { ...sess(5, 9, 6, 4.5), sleepHoursLastNight: 5 },
      { ...sess(6, 9, 6, 4.5), sleepHoursLastNight: 5 },
      { ...sess(7, 9, 6, 4.5), sleepHoursLastNight: 5 },
      { ...sess(8, 9, 6, 4.5), sleepHoursLastNight: 5 },
    ];
    expect(detectSleep(sessions)?.kind).toBe('question');
  });

  it('returns null below the per-bucket floor', () => {
    const sessions = [
      { ...sess(1, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(2, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(3, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(5, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(6, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(7, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(8, 9, 6, 5), sleepHoursLastNight: 5 },
    ];
    expect(detectSleep(sessions)).toBeNull();
  });

  it('ignores sessions that did not capture sleep (quiet until data accrues)', () => {
    const sessions = [
      { ...sess(1, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(2, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(3, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(4, 9, 8, 4), sleepHoursLastNight: 8 },
      sess(5, 9, 6, 5), sess(6, 9, 6, 5), sess(7, 9, 6, 5), sess(8, 9, 6, 5),
    ];
    expect(detectSleep(sessions)).toBeNull();
  });
});

describe('buildPatterns includes the sleep signal', () => {
  it('surfaces a sleep finding (and nothing spurious) on sleep-only data', () => {
    const sessions = [
      { ...sess(1, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(5, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(9, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(13, 9, 8, 4), sleepHoursLastNight: 8 },
      { ...sess(17, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(21, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(25, 9, 6, 5), sleepHoursLastNight: 5 },
      { ...sess(28, 9, 6, 5), sleepHoursLastNight: 5 },
    ];
    const items = buildPatterns(sessions);
    expect(items.some((i) => i.id === 'sleep' && i.kind === 'finding')).toBe(true);
    expect(items.filter((i) => i.kind === 'finding')).toHaveLength(1);
  });
});
