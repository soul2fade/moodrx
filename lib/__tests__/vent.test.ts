import { describe, it, expect } from 'vitest';
import { parseVentResponse, ventAction, buildVentSession } from '@/lib/vent';

describe('parseVentResponse', () => {
  const ok = { mood: 'stressed', intensity: 7, reply: 'You showed up.', risk: 'none' };

  it('accepts a well-formed response', () => {
    expect(parseVentResponse(ok)).toEqual(ok);
  });
  it('clamps/rounds intensity and trims reply', () => {
    expect(parseVentResponse({ ...ok, intensity: 7.6, reply: '  hi  ' })).toEqual({
      mood: 'stressed', intensity: 8, reply: 'hi', risk: 'none',
    });
    expect(parseVentResponse({ ...ok, intensity: 0 })?.intensity).toBe(1);
    expect(parseVentResponse({ ...ok, intensity: 99 })?.intensity).toBe(10);
  });
  it('rejects bad mood, non-finite intensity, empty reply, bad risk, non-object', () => {
    expect(parseVentResponse({ ...ok, mood: 'sad' })).toBeNull();
    expect(parseVentResponse({ ...ok, intensity: NaN })).toBeNull();
    expect(parseVentResponse({ ...ok, reply: '   ' })).toBeNull();
    expect(parseVentResponse({ ...ok, risk: 'panic' })).toBeNull();
    expect(parseVentResponse(null)).toBeNull();
    expect(parseVentResponse('nope')).toBeNull();
  });
});

describe('ventAction', () => {
  it('routes only acute to the crisis screen', () => {
    expect(ventAction('none')).toBe('reply');
    expect(ventAction('elevated')).toBe('reply-with-resource');
    expect(ventAction('acute')).toBe('crisis-redirect');
  });
});

describe('buildVentSession', () => {
  it('builds a workout-less check-in tagged source:vent (postScore = intensity)', () => {
    const s = buildVentSession({ id: 'v1', mood: 'low', intensity: 6, timestamp: 1234 });
    expect(s).toEqual({
      id: 'v1',
      mood: 'low',
      intensity: 6,
      postScore: 6,
      workoutName: 'Vent',
      duration: 0,
      timestamp: 1234,
      lightDay: true,
      source: 'vent',
    });
  });
  it('spreads captured health fields when provided', () => {
    const s = buildVentSession({
      id: 'v2', mood: 'anxious', intensity: 8, timestamp: 9,
      health: { stepsToday: 5000, sleepHoursLastNight: 7 },
    });
    expect(s.stepsToday).toBe(5000);
    expect(s.sleepHoursLastNight).toBe(7);
    expect(s.source).toBe('vent');
  });
});
