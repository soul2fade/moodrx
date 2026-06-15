import { describe, it, expect } from 'vitest';
import { SEVERITIES, isInsultTier, normalizeSeverity } from '../insult-severity';

describe('SEVERITIES', () => {
  it('lists the three tiers softest→sharpest with the exact labels', () => {
    expect(SEVERITIES.map((s) => s.key)).toEqual(['glass-house', 'sticks', 'roast']);
    expect(SEVERITIES.map((s) => s.label)).toEqual(['Glass House', 'Sticks and Stones', 'Roasted']);
    for (const s of SEVERITIES) expect(s.blurb.length).toBeGreaterThan(0);
  });
});

describe('isInsultTier', () => {
  it('narrows valid keys, rejects junk', () => {
    expect(isInsultTier('sticks')).toBe(true);
    expect(isInsultTier('x')).toBe(false);
    expect(isInsultTier(null)).toBe(false);
  });
});

describe('normalizeSeverity', () => {
  it('passes through valid tiers', () => {
    expect(normalizeSeverity('glass-house')).toBe('glass-house');
    expect(normalizeSeverity('roast')).toBe('roast');
  });
  it('defaults unknown/missing to sticks', () => {
    expect(normalizeSeverity('nope')).toBe('sticks');
    expect(normalizeSeverity(null)).toBe('sticks');
    expect(normalizeSeverity(undefined)).toBe('sticks');
  });
});

describe('severity warnings', () => {
  it('only Roasted carries a strong-language warning', () => {
    const roast = SEVERITIES.find((s) => s.key === 'roast');
    expect(roast?.warning).toBe('Contains strong language');
    for (const s of SEVERITIES.filter((x) => x.key !== 'roast')) {
      expect(s.warning).toBeUndefined();
    }
  });
});
