import { useCallback, useEffect, useRef, useState } from 'react';
import {
  derivePurchaseButtonState,
  type PurchasePhase,
  type PurchaseButtonState,
} from '@/lib/purchase-ui';

/** How long the "You're in ✓" confirmation stays up before we hand off. */
export const SUCCESS_FLASH_MS = 900;

interface Options {
  /** False until RevenueCat offerings have loaded — keeps the button disabled. */
  offeringsLoaded: boolean;
  /** True when the entitlement is already held. */
  owned?: boolean;
  /** Runs the purchase/restore; resolves true only when it actually succeeded. */
  run: () => Promise<boolean>;
  /** Fired after the success flash — close the sheet, drop into the unlocked thing. */
  onSuccess?: () => void;
  /** Override the flash duration (tests). */
  flashMs?: number;
}

export interface PurchaseButtonController extends PurchaseButtonState {
  phase: PurchasePhase;
  onPress: () => void;
}

/**
 * Drives a single buy/restore button through its lifecycle: spinner while in
 * flight, a brief success flash, then `onSuccess` to hand off. The pure
 * status/disabled/busy mapping lives in `derivePurchaseButtonState`; this hook
 * only owns the imperative bits (local phase + flash timer).
 */
export function usePurchaseButton({
  offeringsLoaded,
  owned = false,
  run,
  onSuccess,
  flashMs = SUCCESS_FLASH_MS,
}: Options): PurchaseButtonController {
  const [phase, setPhase] = useState<PurchasePhase>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const state = derivePurchaseButtonState({ offeringsLoaded, owned, phase });

  const onPress = useCallback(() => {
    if (state.disabled) return;
    setPhase('processing');
    void run().then((granted) => {
      if (!mountedRef.current) return;
      if (!granted) {
        setPhase('idle');
        return;
      }
      setPhase('success');
      timerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        onSuccess?.();
        // Reset so the button is reusable; `owned` will dominate if it flipped.
        setPhase('idle');
      }, flashMs);
    });
  }, [state.disabled, run, onSuccess, flashMs]);

  return { ...state, phase, onPress };
}
