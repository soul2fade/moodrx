import { describe, it, expect } from 'vitest';
import { canUseLiveCoach, LIVE_COACH_TASTE_LIMIT } from '@/lib/live-coach';

describe('LIVE_COACH_TASTE_LIMIT', () => {
  it('is 3', () => {
    expect(LIVE_COACH_TASTE_LIMIT).toBe(3);
  });
});

describe('canUseLiveCoach', () => {
  it('MoodRx+ is always allowed, even past the limit', () => {
    expect(canUseLiveCoach({ isPlus: true, tasteUsed: 0 })).toBe(true);
    expect(canUseLiveCoach({ isPlus: true, tasteUsed: 99 })).toBe(true);
  });
  it('non-plus is allowed while taste remains', () => {
    expect(canUseLiveCoach({ isPlus: false, tasteUsed: 0 })).toBe(true);
    expect(canUseLiveCoach({ isPlus: false, tasteUsed: 2 })).toBe(true);
  });
  it('non-plus is blocked at/after the limit', () => {
    expect(canUseLiveCoach({ isPlus: false, tasteUsed: 3 })).toBe(false);
    expect(canUseLiveCoach({ isPlus: false, tasteUsed: 4 })).toBe(false);
  });
  it('honors a custom limit', () => {
    expect(canUseLiveCoach({ isPlus: false, tasteUsed: 1, tasteLimit: 1 })).toBe(false);
    expect(canUseLiveCoach({ isPlus: false, tasteUsed: 0, tasteLimit: 1 })).toBe(true);
  });
});
