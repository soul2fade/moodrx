/**
 * Pure derivation of a purchase button's visual/interaction state.
 *
 * Every buy button in the app (base unlock, voice bundle, packs, restore) shares
 * the same lifecycle: it must stay disabled until RevenueCat offerings load, show
 * a spinner while a purchase is in flight, flash a brief confirmation on success,
 * and collapse to an "owned" state once the entitlement is held. Keeping that
 * mapping here — pure and unit-tested — means every button behaves identically and
 * the React components only have to render the result.
 */

/** Where a single purchase attempt is in its lifecycle (component-local state). */
export type PurchasePhase = 'idle' | 'processing' | 'success';

export type PurchaseButtonStatus =
  | 'preparing' // offerings not loaded yet — skeleton/disabled
  | 'idle' // ready to tap
  | 'processing' // purchase in flight — spinner
  | 'success' // just succeeded — show the confirmation flash
  | 'owned'; // entitlement already held — not purchasable

export interface PurchaseButtonState {
  status: PurchaseButtonStatus;
  /** True when the button must not respond to taps. */
  disabled: boolean;
  /** True when a spinner should be shown in place of the label. */
  busy: boolean;
}

export interface PurchaseButtonInput {
  /** False until RevenueCat offerings have loaded. */
  offeringsLoaded: boolean;
  /** True when the entitlement is already held. Defaults to false. */
  owned?: boolean;
  phase: PurchasePhase;
}

export function derivePurchaseButtonState({
  offeringsLoaded,
  owned = false,
  phase,
}: PurchaseButtonInput): PurchaseButtonState {
  // The success flash and an in-flight purchase outrank everything else: once the
  // user has tapped, we always show that attempt through to its confirmation —
  // even if `owned` flips true mid-flash, or offerings somehow reload.
  if (phase === 'success') return { status: 'success', disabled: true, busy: false };
  if (phase === 'processing') return { status: 'processing', disabled: true, busy: true };
  if (owned) return { status: 'owned', disabled: true, busy: false };
  if (!offeringsLoaded) return { status: 'preparing', disabled: true, busy: true };
  return { status: 'idle', disabled: false, busy: false };
}

/** Shown while a purchase is in flight. */
export const PROCESSING_LABEL = 'Processing…';
/** The brief success-flash label, per the design spec. */
export const SUCCESS_LABEL = "You're in ✓";

/**
 * The label for the processing/success/idle states. `owned` and `preparing` are
 * rendered by the component itself (badge, skeleton), so they fall back to idle.
 */
export function purchaseButtonLabel(
  status: PurchaseButtonStatus,
  labels: { idle: string; success?: string },
): string {
  if (status === 'processing') return PROCESSING_LABEL;
  if (status === 'success') return labels.success ?? SUCCESS_LABEL;
  return labels.idle;
}
