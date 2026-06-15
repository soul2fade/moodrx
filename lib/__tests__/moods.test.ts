import { describe, it, expect } from 'vitest';
import { MOODS, MOOD_ORDER } from '@/lib/moods';

describe('mood colorDeep', () => {
  it('every mood has a colorDeep hex', () => {
    for (const k of MOOD_ORDER) {
      expect(MOODS[k].colorDeep).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
  it('stressed and low use richer deep variants than their light text color', () => {
    expect(MOODS.stressed.color).toBe('#E11D48');
    expect(MOODS.stressed.colorDeep).toBe('#E11D48');
    expect(MOODS.low.color).toBe('#7B7DF5');
    expect(MOODS.low.colorDeep).toBe('#6366F1');
  });
  it('non-lightened moods reuse their color as colorDeep', () => {
    expect(MOODS.anxious.colorDeep).toBe(MOODS.anxious.color);
    expect(MOODS.good.colorDeep).toBe(MOODS.good.color);
  });
});
