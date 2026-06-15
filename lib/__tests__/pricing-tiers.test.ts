import { describe, it, expect } from 'vitest';
import { PRICING_TIERS, PRICING_FEATURES, tierValue } from '@/lib/pricing-tiers';

describe('pricing tiers', () => {
  it('has exactly free, own, plus in order', () => {
    expect(PRICING_TIERS.map((t) => t.key)).toEqual(['free', 'own', 'plus']);
  });

  it('is monotonic: free ⊆ own ⊆ plus for every feature', () => {
    for (const f of PRICING_FEATURES) {
      if (f.free) expect(f.own).toBe(true);
      if (f.own) expect(f.plus).toBe(true);
    }
  });

  it('AI-layer features are MoodRx+ only', () => {
    const aiOnly = ['Live Dr. MoodRx AI coach', 'Every coach personality', 'New content packs'];
    for (const label of aiOnly) {
      const f = PRICING_FEATURES.find((x) => x.label === label);
      expect(f, label).toBeDefined();
      expect(f!.free).toBe(false);
      expect(f!.own).toBe(false);
      expect(f!.plus).toBe(true);
    }
  });

  it('baseline features are in every tier', () => {
    const everyone = ['Mood check-ins + coach Rachel', 'Top workout + weekly bonus', "Today's supplement pick"];
    for (const label of everyone) {
      const f = PRICING_FEATURES.find((x) => x.label === label);
      expect(f, label).toBeDefined();
      expect([f!.free, f!.own, f!.plus]).toEqual([true, true, true]);
    }
  });

  it('tierValue reads the right column', () => {
    const f = PRICING_FEATURES[0];
    expect(tierValue(f, 'free')).toBe(f.free);
    expect(tierValue(f, 'own')).toBe(f.own);
    expect(tierValue(f, 'plus')).toBe(f.plus);
  });
});
