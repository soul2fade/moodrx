import { describe, it, expect } from 'vitest';
import { healthFieldsFromSnapshot } from '@/lib/session-health';

// A structural HealthSnapshot (no import of lib/health needed — TS accepts the shape).
function snap(over: Record<string, unknown>) {
  return {
    connected: true,
    available: true,
    platform: 'apple',
    stepsToday: null,
    sleepHoursLastNight: null,
    ...over,
  } as Parameters<typeof healthFieldsFromSnapshot>[0];
}

describe('healthFieldsFromSnapshot', () => {
  it('copies both readings when present', () => {
    expect(healthFieldsFromSnapshot(snap({ stepsToday: 5000, sleepHoursLastNight: 7.5 }))).toEqual({
      stepsToday: 5000,
      sleepHoursLastNight: 7.5,
    });
  });

  it('omits fields that are null (unavailable)', () => {
    expect(healthFieldsFromSnapshot(snap({ stepsToday: null, sleepHoursLastNight: null }))).toEqual({});
  });

  it('includes only the reading that is present', () => {
    expect(healthFieldsFromSnapshot(snap({ stepsToday: 8200, sleepHoursLastNight: null }))).toEqual({
      stepsToday: 8200,
    });
  });

  it('omits non-finite numbers (NaN / Infinity)', () => {
    expect(healthFieldsFromSnapshot(snap({ stepsToday: NaN, sleepHoursLastNight: Infinity }))).toEqual({});
  });
});
