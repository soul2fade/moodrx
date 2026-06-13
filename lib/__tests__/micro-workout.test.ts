import { describe, it, expect } from 'vitest';
import { microStepsForMood, MICRO_WORKOUTS_BY_MOOD, MICRO_WORKOUT_STEPS } from '@/lib/micro-workout';
import { MOOD_ORDER } from '@/lib/moods';

describe('microStepsForMood', () => {
  it('returns a non-empty, distinct routine for every mood', () => {
    for (const m of MOOD_ORDER) {
      const steps = microStepsForMood(m);
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThanOrEqual(3);
      expect(steps.every((s) => typeof s === 'string' && s.trim().length > 0)).toBe(true);
    }
  });
  it('restless and stressed get different routines', () => {
    expect(microStepsForMood('restless')).not.toEqual(microStepsForMood('stressed'));
  });
  it('falls back to the generic steps for an unknown mood', () => {
    // @ts-expect-error testing the runtime fallback
    expect(microStepsForMood('bogus')).toEqual(MICRO_WORKOUT_STEPS);
  });
  it('every mood key has an entry in the map', () => {
    for (const m of MOOD_ORDER) {
      expect(MICRO_WORKOUTS_BY_MOOD[m]).toBeDefined();
    }
  });
});
