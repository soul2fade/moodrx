/**
 * Canonical purchase copy — one offer, shown the same way everywhere (spec §2).
 * Pure module: NO react-native imports, so it stays vitest-safe.
 */

/** The one offer line, reused verbatim wherever the deal is described in prose. */
export const CANONICAL_OFFER_LINE = 'Unlock everything — $9.99 once. No subscription.';

/** The canonical reassurance line shown on/near every offer surface (spec §4). */
export const CANONICAL_REASSURANCE = '$9.99 once · no subscription · yours forever';

/** Entry points that open the offer sheet — each gets a contextual headline. */
export type OfferContext =
  | 'default'
  | 'workouts'
  | 'patterns'
  | 'history'
  | 'calendar'
  | 'supplements'
  | 'programs'
  | 'reminders';

const HEADLINES: Record<OfferContext, string> = {
  default: 'Unlock everything',
  workouts: 'Unlock all 18 workouts',
  patterns: 'See your full patterns',
  history: 'See your full history',
  calendar: 'See your progress over time',
  supplements: 'Unlock the supplement tracker',
  programs: 'Unlock programs',
  reminders: 'Unlock daily reminders',
};

export function offerHeadline(context: OfferContext | string = 'default'): string {
  return HEADLINES[context as OfferContext] ?? HEADLINES.default;
}

// Mirror of BASE_UNLOCK_PACKAGE_ID in lib/revenuecat.tsx. Inlined here so this
// module imports no react-native (revenuecat.tsx pulls in react-native-purchases,
// which would break the vitest node environment).
const BASE_UNLOCK_PACKAGE_ID = '$rc_lifetime';

interface PricedOfferings {
  current?: {
    availablePackages?: { identifier: string; product?: { priceString?: string } }[];
  } | null;
}

/** Reads the formatted base-unlock price from RevenueCat offerings. */
export function selectBasePrice(
  offerings: PricedOfferings | null | undefined,
  fallback = '$9.99',
): string {
  const pkg = offerings?.current?.availablePackages?.find(
    (p) => p.identifier === BASE_UNLOCK_PACKAGE_ID,
  );
  return pkg?.product?.priceString ?? fallback;
}
