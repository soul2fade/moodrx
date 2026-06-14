import { describe, it, expect } from 'vitest';
import {
  CANONICAL_OFFER_LINE,
  CANONICAL_REASSURANCE,
  offerHeadline,
  selectBasePrice,
} from '@/lib/offer-copy';

describe('canonical copy', () => {
  it('exposes the one offer line, verbatim', () => {
    expect(CANONICAL_OFFER_LINE).toBe('Unlock everything — $9.99 once. No subscription.');
  });
  it('exposes the canonical reassurance, verbatim', () => {
    expect(CANONICAL_REASSURANCE).toBe('$9.99 once · no subscription · yours forever');
  });
});

describe('offerHeadline', () => {
  it('returns a contextual headline per entry point', () => {
    expect(offerHeadline('workouts')).toBe('Unlock all 18 workouts');
    expect(offerHeadline('patterns')).toBe('See your full patterns');
    expect(offerHeadline('supplements')).toBe('Unlock the supplement tracker');
    expect(offerHeadline('programs')).toBe('Unlock programs');
    expect(offerHeadline('calendar')).toBe('See your progress over time');
    expect(offerHeadline('history')).toBe('See your full history');
    expect(offerHeadline('reminders')).toBe('Unlock daily reminders');
  });
  it('falls back to the generic headline', () => {
    expect(offerHeadline()).toBe('Unlock everything');
    expect(offerHeadline('default')).toBe('Unlock everything');
  });
  it('falls back to the generic headline for an unknown context', () => {
    expect(offerHeadline('something-new')).toBe('Unlock everything');
  });
});

describe('selectBasePrice', () => {
  const offerings = {
    current: { availablePackages: [{ identifier: '$rc_lifetime', product: { priceString: '$9.99' } }] },
  };
  it('reads the base unlock price string from offerings', () => {
    expect(selectBasePrice(offerings)).toBe('$9.99');
  });
  it('falls back to $9.99 when offerings are missing', () => {
    expect(selectBasePrice(null)).toBe('$9.99');
    expect(selectBasePrice({ current: { availablePackages: [] } })).toBe('$9.99');
  });
  it('respects a custom fallback', () => {
    expect(selectBasePrice(undefined, '—')).toBe('—');
  });
});
