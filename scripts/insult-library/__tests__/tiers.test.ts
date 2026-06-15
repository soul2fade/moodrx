import { describe, it, expect } from 'vitest';
import { TIERS, TIER_KEYS, isTierKey } from '../lib/tiers';

describe('tiers', () => {
  it('defines exactly the three severity tiers in ascending bite', () => {
    expect(TIER_KEYS).toEqual(['glass-house', 'sticks', 'roast']);
    expect(TIERS).toHaveLength(3);
  });

  it('every tier has a key, a human label, and non-empty generation guidance', () => {
    for (const t of TIERS) {
      expect(t.key.length).toBeGreaterThan(0);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.guidance.length).toBeGreaterThan(20);
    }
  });

  it('isTierKey narrows valid keys and rejects junk', () => {
    expect(isTierKey('roast')).toBe(true);
    expect(isTierKey('nuclear')).toBe(false);
  });
});
