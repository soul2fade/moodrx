import type { InsultTier } from './insult-library';

export interface SeverityOption {
  key: InsultTier;
  label: string;
  blurb: string;
  /** Optional content warning shown under this tier (e.g. profanity at Roasted). */
  warning?: string;
}

/** Ordered softest → sharpest. Text-only (no emojis) per brand. */
export const SEVERITIES: SeverityOption[] = [
  { key: 'glass-house', label: 'Glass House', blurb: 'Gentle ribbing. Barely a scratch.' },
  { key: 'sticks', label: 'Sticks and Stones', blurb: 'Standard heat. The usual roast.' },
  { key: 'roast', label: 'Roasted', blurb: 'No mercy. Full send.', warning: 'Contains strong language' },
];

const KEYS = SEVERITIES.map((s) => s.key) as InsultTier[];

export function isInsultTier(v: unknown): v is InsultTier {
  return typeof v === 'string' && (KEYS as string[]).includes(v);
}

/** Coerce a stored/raw value to a tier, defaulting to 'sticks'. */
export function normalizeSeverity(raw: unknown, fallback: InsultTier = 'sticks'): InsultTier {
  return isInsultTier(raw) ? raw : fallback;
}
