import { colors } from '@/lib/colors';

export type TierKey = 'free' | 'own' | 'plus';

export interface PricingTier {
  key: TierKey;
  name: string;
  /** Fallback display price; live prices override at render time. */
  price: string;
  /** Short terms line shown under the column. */
  terms: string;
  color: string;
}

export interface PricingFeature {
  label: string;
  free: boolean;
  own: boolean;
  plus: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  { key: 'free', name: 'Free',    price: '$0',       terms: 'free forever', color: colors.tierFree },
  { key: 'own',  name: 'Own it',  price: '$9.99',    terms: 'one-time',     color: colors.tierOwn },
  { key: 'plus', name: 'MoodRx+', price: '$3.99/mo', terms: '7 days free',  color: colors.tierPlus },
];

// Canonical feature matrix. Mirrors the real gating: workouts + supplements use
// lib/free-tier.ts (free gets the top pick + weekly bonus / first supplement),
// the rest gate on isPremium, and the AI layer gates on isPlus. Keep in sync —
// the test enforces monotonicity and the AI-only / everyone rows.
export const PRICING_FEATURES: PricingFeature[] = [
  { label: 'Mood check-ins + coach Rachel',       free: true,  own: true,  plus: true },
  { label: 'Top workout + weekly bonus',          free: true,  own: true,  plus: true },
  { label: "Today's supplement pick",             free: true,  own: true,  plus: true },
  { label: 'All 18 workouts, every mood',         free: false, own: true,  plus: true },
  { label: 'Full supplement tracker + reminders', free: false, own: true,  plus: true },
  { label: 'Full history, patterns, calendar',    free: false, own: true,  plus: true },
  { label: 'Live Dr. MoodRx AI coach',            free: false, own: false, plus: true },
  { label: 'Every coach personality',             free: false, own: false, plus: true },
  { label: 'New content packs',                   free: false, own: false, plus: true },
];

export function tierValue(feature: PricingFeature, key: TierKey): boolean {
  return feature[key];
}
