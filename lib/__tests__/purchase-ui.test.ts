import { describe, it, expect } from 'vitest';
import {
  derivePurchaseButtonState,
  purchaseButtonLabel,
  PROCESSING_LABEL,
  SUCCESS_LABEL,
} from '@/lib/purchase-ui';

describe('derivePurchaseButtonState', () => {
  it('is "preparing" (disabled, busy) while offerings have not loaded', () => {
    expect(derivePurchaseButtonState({ offeringsLoaded: false, phase: 'idle' })).toEqual({
      status: 'preparing',
      disabled: true,
      busy: true,
    });
  });

  it('is "idle" (tappable) once offerings load and nothing is in flight', () => {
    expect(derivePurchaseButtonState({ offeringsLoaded: true, phase: 'idle' })).toEqual({
      status: 'idle',
      disabled: false,
      busy: false,
    });
  });

  it('is "processing" (disabled, busy) while a purchase is in flight', () => {
    expect(derivePurchaseButtonState({ offeringsLoaded: true, phase: 'processing' })).toEqual({
      status: 'processing',
      disabled: true,
      busy: true,
    });
  });

  it('is "success" (disabled, not busy) during the confirmation flash', () => {
    expect(derivePurchaseButtonState({ offeringsLoaded: true, phase: 'success' })).toEqual({
      status: 'success',
      disabled: true,
      busy: false,
    });
  });

  it('is "owned" (disabled) when already purchased', () => {
    expect(derivePurchaseButtonState({ offeringsLoaded: true, owned: true, phase: 'idle' })).toEqual({
      status: 'owned',
      disabled: true,
      busy: false,
    });
  });

  it('defaults owned to false when omitted', () => {
    expect(derivePurchaseButtonState({ offeringsLoaded: true, phase: 'idle' }).status).toBe('idle');
  });

  it('lets the success flash win over a just-flipped owned entitlement', () => {
    // After a purchase, entitlement may flip to owned before the flash ends —
    // we still want "You're in ✓", not an instant "owned" swap.
    expect(derivePurchaseButtonState({ offeringsLoaded: true, owned: true, phase: 'success' }).status).toBe('success');
  });

  it('lets an in-flight purchase win over a not-yet-loaded offering', () => {
    expect(derivePurchaseButtonState({ offeringsLoaded: false, phase: 'processing' }).status).toBe('processing');
  });
});

describe('purchaseButtonLabel', () => {
  it('returns the idle label when idle', () => {
    expect(purchaseButtonLabel('idle', { idle: 'UNLOCK — $9.99' })).toBe('UNLOCK — $9.99');
  });

  it('returns the universal processing label while processing', () => {
    expect(purchaseButtonLabel('processing', { idle: 'UNLOCK — $9.99' })).toBe(PROCESSING_LABEL);
  });

  it('returns the universal success label on success', () => {
    expect(purchaseButtonLabel('success', { idle: 'UNLOCK — $9.99' })).toBe(SUCCESS_LABEL);
  });

  it('allows a custom success label (e.g. "Restored ✓")', () => {
    expect(purchaseButtonLabel('success', { idle: 'RESTORE', success: 'Restored ✓' })).toBe('Restored ✓');
  });

  it('falls back to the idle label for owned/preparing (component renders those itself)', () => {
    expect(purchaseButtonLabel('owned', { idle: 'BUY' })).toBe('BUY');
    expect(purchaseButtonLabel('preparing', { idle: 'BUY' })).toBe('BUY');
  });
});
